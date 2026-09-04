/**
 * Put the supplied product images into Supabase Storage and record them.
 *
 *   node --env-file-if-exists=.env.local scripts/upload-product-media.mts [--dry-run]
 *   node --env-file-if-exists=.env.local scripts/upload-product-media.mts --dir path/to/images
 *
 * Reads `docs/Trontek_Battery_Images_32.zip` directly — no manual extraction
 * step, so the archive stays the single artefact and a re-run cannot pick up a
 * half-extracted directory. `--dir` overrides it with a folder of loose files
 * for the case where the archive has been replaced by newer photography.
 *
 * Idempotent in the way that matters: an object key is derived from the product
 * key and the image's role, so a second run overwrites the same object
 * (`x-upsert`) and `ON CONFLICT (storage_path)` updates the same row. Running
 * it twice does not double a gallery.
 *
 * It writes only rows this catalogue owns. Nothing here touches Hostinger, and
 * nothing here changes a product's status — an image arriving does not publish
 * anything.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import pg from 'pg';
import { connectionOptions } from '../src/lib/db/connection.ts';
import { TRONTEK_PRODUCTS } from '../db/seed/trontek-products.ts';

const { Client } = pg;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVE = join(ROOT, 'docs', 'Trontek_Battery_Images_32.zip');

const DRY_RUN = process.argv.includes('--dry-run');
const DIR_INDEX = process.argv.indexOf('--dir');
const SOURCE_DIR = DIR_INDEX === -1 ? null : process.argv[DIR_INDEX + 1];

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

/* ------------------------------------------------------------ zip reading */

/**
 * The minimum of the ZIP format needed to read one archive of JPEGs.
 *
 * Node ships no zip reader and this needs three fields per entry, so a
 * dependency would be a lot of supply chain for `inflateRawSync`. Only the two
 * compression methods that exist in practice are handled — stored and deflate —
 * and anything else is refused loudly rather than returning wrong bytes.
 */
function readZip(buffer: Buffer): Map<string, Buffer> {
  const EOCD_SIGNATURE = 0x06054b50;
  const CENTRAL_SIGNATURE = 0x02014b50;

  // The end-of-central-directory record is last, but a trailing comment may
  // follow it, so scan backwards for the signature.
  let eocd = -1;
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === EOCD_SIGNATURE) {
      eocd = index;
      break;
    }
  }
  if (eocd === -1) fail('Not a zip archive: no end-of-central-directory record.');

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  if (offset === 0xffffffff) fail('ZIP64 archives are not supported by this script.');

  const files = new Map<string, Buffer>();

  for (let entry = 0; entry < count; entry += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      fail(`Corrupt central directory at entry ${entry}.`);
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

    offset += 46 + nameLength + extraLength + commentLength;

    // Directory entries carry a trailing slash and no data.
    if (name.endsWith('/')) continue;

    // The local header repeats the name and extra fields, and its extra field
    // length can differ from the central one — so it must be read again here
    // rather than reused.
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);

    if (method === 0) files.set(name, Buffer.from(data));
    else if (method === 8) files.set(name, inflateRawSync(data));
    else fail(`Unsupported compression method ${method} for ${name}.`);
  }

  return files;
}

/** JPEG intrinsic size, read from the first start-of-frame marker. */
function jpegSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1]!;
    const length = buffer.readUInt16BE(offset + 2);

    // SOF0…SOF15, excluding the DHT/JPG/DAC markers interleaved in that range.
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }

    offset += 2 + length;
  }
  return null;
}

/* --------------------------------------------------------------- storage */

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'product-media';

async function upload(storagePath: string, body: Buffer, contentType: string): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': contentType,
        // Makes a re-run overwrite rather than fail, which is what keeps this
        // script idempotent.
        'x-upsert': 'true',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: new Uint8Array(body),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    fail(`Upload of ${storagePath} failed with ${response.status}. ${detail.slice(0, 300)}`);
  }
}

/* ------------------------------------------------------------------- main */

async function main(): Promise<void> {
  const expected = TRONTEK_PRODUCTS.flatMap((product) =>
    product.media.map((media) => ({ product, media })),
  );

  // Source the bytes: the archive by default, a directory when asked.
  const files = new Map<string, Buffer>();
  if (SOURCE_DIR) {
    const dir = resolve(ROOT, SOURCE_DIR);
    for (const name of readdirSync(dir)) files.set(name, readFileSync(join(dir, name)));
    console.log(`\n  Source: ${dir} (${files.size} files)`);
  } else {
    const archive = readZip(readFileSync(ARCHIVE));
    // Entries are nested under `images/`; index them by base name so either
    // layout works.
    for (const [name, data] of archive) files.set(name.split('/').pop()!, data);
    console.log(`\n  Source: ${ARCHIVE} (${files.size} files)`);
  }

  const missing = expected.filter(({ media }) => !files.has(media.file));
  if (missing.length > 0) {
    fail(
      `${missing.length} image(s) named in the seed data are not in the source:\n    ` +
        missing.map(({ media }) => media.file).join('\n    '),
    );
  }

  const unused = [...files.keys()].filter(
    (name) => !expected.some(({ media }) => media.file === name),
  );
  if (unused.length > 0) {
    console.warn(`  ! ${unused.length} file(s) in the source are not referenced: ${unused.join(', ')}`);
  }

  console.log(`  ${expected.length} images across ${TRONTEK_PRODUCTS.length} products.`);

  if (DRY_RUN) {
    console.log('\n  Dry run — nothing was uploaded or written.\n');
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set to upload.');
  }

  const { connectionString, ssl, info } = connectionOptions();
  const client = new Client({ connectionString, ssl });
  await client.connect();
  console.log(`  → ${info.host}/${info.database}, bucket ${BUCKET}\n`);

  try {
    for (const product of TRONTEK_PRODUCTS) {
      const row = await client.query<{ id: number }>(
        'SELECT id FROM products WHERE product_key = $1',
        [product.productKey],
      );
      const productId = row.rows[0]?.id;
      if (!productId) {
        fail(`${product.productKey} is not in the database. Run npm run products:import first.`);
      }

      for (const [index, media] of product.media.entries()) {
        const bytes = files.get(media.file)!;
        const storagePath = `products/${product.productKey}/${index}-${media.role}.jpg`;
        const size = jpegSize(bytes);

        await upload(storagePath, bytes, 'image/jpeg');

        // The first image is the primary one. Clearing the others first is
        // required, not tidiness: `product_media_primary_idx` is a partial
        // unique index and a second claim violates it.
        const isPrimary = index === 0;
        if (isPrimary) {
          await client.query(
            'UPDATE product_media SET is_primary = false WHERE product_id = $1 AND is_primary',
            [productId],
          );
        }

        await client.query(
          `INSERT INTO product_media
             (product_id, storage_path, alt_text, role, mime, bytes, width, height,
              position, is_primary)
           VALUES ($1, $2, $3, $4, 'image/jpeg', $5, $6, $7, $8, $9)
           ON CONFLICT (storage_path) DO UPDATE SET
             alt_text = EXCLUDED.alt_text, role = EXCLUDED.role, bytes = EXCLUDED.bytes,
             width = EXCLUDED.width, height = EXCLUDED.height,
             position = EXCLUDED.position, is_primary = EXCLUDED.is_primary`,
          [
            productId,
            storagePath,
            media.altText,
            media.role,
            bytes.length,
            size?.width ?? null,
            size?.height ?? null,
            index,
            isPrimary,
          ],
        );
      }

      console.log(`    ${product.media.length} images  ${product.productKey}`);
    }

    console.log('\n  ✓ Media uploaded and recorded.\n');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
