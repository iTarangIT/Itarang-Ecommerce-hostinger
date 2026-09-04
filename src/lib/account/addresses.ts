import { query, queryOne, transaction } from '@/lib/db/pool';
import type { ShippingAddress } from '@/lib/orders/types';

/**
 * The customer address book.
 *
 * Data access only — no session reading, no cookie handling, no policy about
 * who may call it. `address-actions.ts` owns that, the same split `users.ts`
 * and `actions.ts` already use.
 *
 * **Every function takes `userId` and every statement filters on it.** Not as a
 * convenience but as the authorization boundary: an address id is a small
 * integer that anybody can guess, so a query that found a row by id alone and
 * checked ownership afterwards would be one forgotten `if` away from letting
 * one customer read or rewrite another's. Scoping in SQL means the row is never
 * in hand to begin with, and an id belonging to somebody else simply matches
 * nothing.
 */

export interface CustomerAddress extends ShippingAddress {
  id: number;
  recipientName: string;
  recipientPhone: string;
  isDefault: boolean;
  createdAt: string;
}

interface AddressRow {
  id: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  recipient_name: string;
  recipient_phone: string;
  is_default: boolean;
  created_at: Date;
}

const COLUMNS = `
  id, line1, line2, landmark, city, state, pincode,
  recipient_name, recipient_phone, is_default, created_at
`;

/**
 * `line2` and `landmark` come back as `undefined` rather than `null`.
 *
 * `ShippingAddress` declares them optional, and `orders.shipping_address`
 * snapshots are written from that shape — so a `null` here would land in the
 * order JSON as an explicit null where every existing snapshot has the key
 * absent. Same data, two shapes, and the difference would show up much later in
 * whatever reads the history.
 */
function toAddress(row: AddressRow): CustomerAddress {
  return {
    id: Number(row.id),
    line1: row.line1,
    line2: row.line2 ?? undefined,
    landmark: row.landmark ?? undefined,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    isDefault: row.is_default,
    createdAt: row.created_at.toISOString(),
  };
}

export interface AddressInput {
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  recipientName: string;
  recipientPhone: string;
}

/** Empty optional fields are stored as NULL, so the digest treats them alike. */
const orNull = (value: string | undefined) => (value?.trim() ? value.trim() : null);

/* -------------------------------------------------------------- reading */

/** This customer's live addresses. The default first, then newest. */
export async function listAddresses(userId: number): Promise<CustomerAddress[]> {
  const rows = await query<AddressRow>(
    `SELECT ${COLUMNS}
       FROM customer_addresses
      WHERE user_id = $1 AND archived_at IS NULL
      ORDER BY is_default DESC, created_at DESC`,
    [userId],
  );
  return rows.map(toAddress);
}

/** One address, or null if it is archived, absent, or somebody else's. */
export async function findAddress(
  userId: number,
  addressId: number,
): Promise<CustomerAddress | null> {
  const row = await queryOne<AddressRow>(
    `SELECT ${COLUMNS}
       FROM customer_addresses
      WHERE id = $1 AND user_id = $2 AND archived_at IS NULL`,
    [addressId, userId],
  );
  return row ? toAddress(row) : null;
}

/**
 * The address checkout should offer first, or null.
 *
 * Falls back to the most recently added when nothing is marked default, so a
 * customer with exactly one saved address never has to nominate it before
 * checkout will use it. Stage 2D reads this.
 */
export async function defaultAddress(userId: number): Promise<CustomerAddress | null> {
  const row = await queryOne<AddressRow>(
    `SELECT ${COLUMNS}
       FROM customer_addresses
      WHERE user_id = $1 AND archived_at IS NULL
      ORDER BY is_default DESC, created_at DESC
      LIMIT 1`,
    [userId],
  );
  return row ? toAddress(row) : null;
}

export async function countAddresses(userId: number): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*) AS n FROM customer_addresses
      WHERE user_id = $1 AND archived_at IS NULL`,
    [userId],
  );
  return Number(row?.n ?? 0);
}

/* -------------------------------------------------------------- writing */

/** Raised when the dedupe index rejects a second copy of the same address. */
export class DuplicateAddressError extends Error {
  constructor() {
    super('That address is already saved.');
    this.name = 'DuplicateAddressError';
  }
}

/** PostgreSQL unique-violation. */
const UNIQUE_VIOLATION = '23505';

function isDuplicate(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === UNIQUE_VIOLATION &&
    String((error as { constraint?: string }).constraint ?? '').includes('no_duplicates')
  );
}

/**
 * Save a new address.
 *
 * The default is set in the same transaction that inserts, and the previous
 * one cleared first: the unique index permits exactly one live default per
 * customer, so doing it in two round trips would leave a window where a
 * concurrent write fails on a constraint the caller did nothing wrong to hit.
 *
 * The first address a customer saves becomes their default whether or not they
 * asked, because a default nobody chose is more useful than none — and Stage 2D
 * has something to prefill from.
 */
export async function addAddress(
  userId: number,
  input: AddressInput,
  makeDefault: boolean,
): Promise<CustomerAddress> {
  try {
    return await transaction(async (client) => {
      const existing = await client.query<{ n: string }>(
        `SELECT count(*) AS n FROM customer_addresses
          WHERE user_id = $1 AND archived_at IS NULL`,
        [userId],
      );
      const isDefault = makeDefault || Number(existing.rows[0]!.n) === 0;

      if (isDefault) {
        await client.query(
          `UPDATE customer_addresses SET is_default = false, updated_at = now()
            WHERE user_id = $1 AND is_default AND archived_at IS NULL`,
          [userId],
        );
      }

      const rows = await client.query<AddressRow>(
        `INSERT INTO customer_addresses
           (user_id, line1, line2, landmark, city, state, pincode,
            recipient_name, recipient_phone, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING ${COLUMNS}`,
        [
          userId,
          input.line1.trim(),
          orNull(input.line2),
          orNull(input.landmark),
          input.city.trim(),
          input.state.trim(),
          input.pincode.trim(),
          input.recipientName.trim(),
          input.recipientPhone.trim(),
          isDefault,
        ],
      );

      return toAddress(rows.rows[0]!);
    });
  } catch (error) {
    if (isDuplicate(error)) throw new DuplicateAddressError();
    throw error;
  }
}

/**
 * Update an address in place.
 *
 * Returns null when the id is not this customer's live address — which is the
 * same answer as "no such address", and deliberately so: distinguishing them
 * would confirm that an id exists and belongs to somebody.
 */
export async function updateAddress(
  userId: number,
  addressId: number,
  input: AddressInput,
): Promise<CustomerAddress | null> {
  try {
    const row = await queryOne<AddressRow>(
      `UPDATE customer_addresses
          SET line1 = $3, line2 = $4, landmark = $5, city = $6, state = $7,
              pincode = $8, recipient_name = $9, recipient_phone = $10,
              updated_at = now()
        WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
        RETURNING ${COLUMNS}`,
      [
        addressId,
        userId,
        input.line1.trim(),
        orNull(input.line2),
        orNull(input.landmark),
        input.city.trim(),
        input.state.trim(),
        input.pincode.trim(),
        input.recipientName.trim(),
        input.recipientPhone.trim(),
      ],
    );
    return row ? toAddress(row) : null;
  } catch (error) {
    if (isDuplicate(error)) throw new DuplicateAddressError();
    throw error;
  }
}

/**
 * Make one address the default, clearing the previous one.
 *
 * Both statements in one transaction, and in this order. The unique index means
 * the reverse order would transiently hold two live defaults and fail; failing
 * loudly is the right behaviour for a constraint, so the code orders itself to
 * satisfy it rather than the constraint being loosened to tolerate the code.
 *
 * Returns false when the id is not this customer's live address.
 */
export async function setDefaultAddress(userId: number, addressId: number): Promise<boolean> {
  return transaction(async (client) => {
    const owned = await client.query<{ id: string }>(
      `SELECT id FROM customer_addresses
        WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
        FOR UPDATE`,
      [addressId, userId],
    );
    if (!owned.rows[0]) return false;

    await client.query(
      `UPDATE customer_addresses SET is_default = false, updated_at = now()
        WHERE user_id = $1 AND is_default AND archived_at IS NULL`,
      [userId],
    );
    await client.query(
      `UPDATE customer_addresses SET is_default = true, updated_at = now()
        WHERE id = $1 AND user_id = $2`,
      [addressId, userId],
    );
    return true;
  });
}

/**
 * Archive an address. A soft delete — the row stays, the listings stop showing it.
 *
 * `is_default` is cleared in the same statement, because the table's CHECK
 * constraint forbids an archived default. That is not a technicality to work
 * around: an archived row holding the default slot would leave the customer
 * with a default they can neither see nor replace.
 *
 * If the archived address *was* the default, the most recent survivor is
 * promoted, so a customer who deletes their only default is not silently left
 * without one.
 */
export async function archiveAddress(userId: number, addressId: number): Promise<boolean> {
  return transaction(async (client) => {
    const archived = await client.query<{ was_default: boolean }>(
      `UPDATE customer_addresses
          SET archived_at = now(), is_default = false, updated_at = now()
        WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
        RETURNING is_default AS was_default`,
      [addressId, userId],
    );
    if (!archived.rows[0]) return false;

    // `RETURNING` reports the post-update value, so ask the table whether any
    // live default remains rather than trying to infer it.
    const remaining = await client.query<{ id: string }>(
      `SELECT id FROM customer_addresses
        WHERE user_id = $1 AND archived_at IS NULL AND is_default
        LIMIT 1`,
      [userId],
    );

    if (!remaining.rows[0]) {
      await client.query(
        `UPDATE customer_addresses SET is_default = true, updated_at = now()
          WHERE id = (
            SELECT id FROM customer_addresses
             WHERE user_id = $1 AND archived_at IS NULL
             ORDER BY created_at DESC
             LIMIT 1
          )`,
        [userId],
      );
    }

    return true;
  });
}
