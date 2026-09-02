import type { SellerInfo as SellerInfoData } from '@/lib/commerce/types';

/**
 * Manufacturer detail — the body of the "Manufacturer Detail" panel.
 *
 * India's Legal Metrology rules require an e-commerce listing to name the
 * seller and the packer and give an address, so this is a compliance block
 * before it is a design one. That is why it reads as a plain labelled record
 * and sits inside a collapsed panel: it has to be present and findable, not
 * prominent.
 */
export function SellerDetail({ seller }: { seller: SellerInfoData }) {
  return (
    <dl className="space-y-3 text-sm">
      <div>
        <dt className="text-xs text-muted-foreground">Seller Name</dt>
        <dd className="mt-0.5 font-medium uppercase text-foreground">{seller.name}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Seller Address</dt>
        <dd className="mt-0.5 leading-relaxed text-foreground">{seller.address}</dd>
      </div>
      {seller.packedBy ? (
        <div>
          <dt className="text-xs text-muted-foreground">Packer Details</dt>
          <dd className="mt-0.5 leading-relaxed text-foreground">{seller.packedBy}</dd>
        </div>
      ) : null}
    </dl>
  );
}
