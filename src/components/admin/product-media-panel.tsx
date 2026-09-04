import Image from 'next/image';
import { ChevronDown, ChevronUp, Star, Trash2 } from 'lucide-react';
import {
  deleteProductMediaAction,
  moveProductMediaAction,
  setPrimaryProductMediaAction,
  updateProductMediaAction,
  uploadProductMediaAction,
} from '@/lib/admin/product-actions';
import { MAX_MEDIA_BYTES, mediaUploadsEnabled } from '@/lib/products/media';
import { PRODUCT_MEDIA_ROLES, type ProductRecord } from '@/lib/products/types';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';

/**
 * Image management.
 *
 * Files go to Supabase Storage; the database keeps the object key and the
 * ordering. Nothing about this touches Hostinger, which is the point: an image
 * hosted in the merchant's CDN disappears when the merchant's product does, and
 * that is exactly the coupling this catalogue exists to remove.
 *
 * Reordering is a pair of arrow buttons rather than drag-and-drop. Dragging
 * needs client state, a pointer, and a keyboard fallback that ends up being
 * these buttons anyway — so the fallback is the whole feature, and the panel
 * stays server-rendered like every other one.
 */

const ROLE_LABELS: Record<string, string> = {
  battery: 'Product shot',
  size: 'Dimensions',
  electrical: 'Electrical rating',
  listing: 'Spec card',
  other: 'Other',
};

export function ProductMediaPanel({ product }: { product: ProductRecord }) {
  const media = [...product.media].sort((a, b) => a.position - b.position);
  const uploadsEnabled = mediaUploadsEnabled();

  return (
    <div>
      <div className="mb-5">
        <h2 className="heading-3">Media</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The first image is what the gallery opens on and what every product card shows. JPEG,
          PNG, WebP or AVIF, up to {MAX_MEDIA_BYTES / 1024 / 1024} MB.
        </p>
      </div>

      {!uploadsEnabled ? (
        <p className="mb-5 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-foreground">
          <span className="font-semibold text-warning">Uploads are not configured.</span> Set
          <code className="mx-1 rounded-sm bg-card px-1 py-0.5 text-xs">SUPABASE_URL</code> and
          <code className="mx-1 rounded-sm bg-card px-1 py-0.5 text-xs">
            SUPABASE_SERVICE_ROLE_KEY
          </code>
          to add images. Existing images still display.
        </p>
      ) : null}

      <form
        action={uploadProductMediaAction}
        encType="multipart/form-data"
        className="rounded-lg border border-border bg-surface p-4"
      >
        <input type="hidden" name="productKey" value={product.productKey} />
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <Field label="Image file" htmlFor="file" required>
            <Input
              id="file"
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
              disabled={!uploadsEnabled}
              className="h-auto py-2.5 file:mr-3 file:rounded-sm file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
            />
          </Field>
          <Field label="Shows" htmlFor="role">
            <Select id="role" name="role" defaultValue="battery" disabled={!uploadsEnabled}>
              {PRODUCT_MEDIA_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-4">
          <Field
            label="Alt text"
            htmlFor="altText"
            hint="What the image shows, for a screen reader and for search. Describe the product, not the file."
          >
            <Input id="altText" name="altText" disabled={!uploadsEnabled} />
          </Field>
        </div>

        <div className="mt-4">
          <Button type="submit" disabled={!uploadsEnabled}>
            Upload
          </Button>
        </div>
      </form>

      {media.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No images yet. A product cannot be published without at least one.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {media.map((item, index) => (
            <li key={item.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap gap-4">
                <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-md border border-border bg-surface">
                  <Image
                    src={item.url}
                    alt={item.altText || `${product.title} image ${index + 1}`}
                    fill
                    sizes="112px"
                    className="object-contain"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {index + 1}. {ROLE_LABELS[item.role] ?? item.role}
                    </span>
                    {item.isPrimary ? (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-success-soft px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-success">
                        <Star className="h-3 w-3" />
                        Primary
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 break-all text-xs text-muted-foreground">
                    {item.storagePath}
                  </p>

                  <form
                    action={updateProductMediaAction}
                    className="mt-3 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="productKey" value={product.productKey} />
                    <input type="hidden" name="mediaId" value={item.id} />
                    <div className="min-w-[14rem] flex-1">
                      <Field label="Alt text" htmlFor={`altText-${item.id}`}>
                        <Input
                          id={`altText-${item.id}`}
                          name="altText"
                          defaultValue={item.altText}
                        />
                      </Field>
                    </div>
                    <div className="w-40">
                      <Field label="Shows" htmlFor={`role-${item.id}`}>
                        <Select id={`role-${item.id}`} name="role" defaultValue={item.role}>
                          {PRODUCT_MEDIA_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <Button type="submit" variant="outline">
                      Save
                    </Button>
                  </form>
                </div>

                <div className="flex flex-col gap-2">
                  <form action={moveProductMediaAction}>
                    <input type="hidden" name="productKey" value={product.productKey} />
                    <input type="hidden" name="mediaId" value={item.id} />
                    <input type="hidden" name="direction" value="up" />
                    <Button
                      type="submit"
                      variant="outline"
                      size="icon-sm"
                      aria-label="Move earlier"
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </form>

                  <form action={moveProductMediaAction}>
                    <input type="hidden" name="productKey" value={product.productKey} />
                    <input type="hidden" name="mediaId" value={item.id} />
                    <input type="hidden" name="direction" value="down" />
                    <Button
                      type="submit"
                      variant="outline"
                      size="icon-sm"
                      aria-label="Move later"
                      disabled={index === media.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </form>

                  {!item.isPrimary ? (
                    <form action={setPrimaryProductMediaAction}>
                      <input type="hidden" name="productKey" value={product.productKey} />
                      <input type="hidden" name="mediaId" value={item.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Make primary"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    </form>
                  ) : null}

                  <form action={deleteProductMediaAction}>
                    <input type="hidden" name="productKey" value={product.productKey} />
                    <input type="hidden" name="mediaId" value={item.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete image"
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
