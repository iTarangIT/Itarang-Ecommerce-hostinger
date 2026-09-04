import type { SellerInfo as SellerInfoData } from '@/lib/commerce/types';

/**
 * Seller detail — the body of the "Seller & marketer" panel.
 *
 * India's Legal Metrology rules require an e-commerce listing to name the
 * seller and the packer and give an address, so this is a compliance block
 * before it is a design one. That is why it reads as a plain labelled record
 * and sits inside a collapsed panel: it has to be present and findable, not
 * prominent.
 *
 * The panel was titled "Manufacturer Detail" while every product was made and
 * sold by one company. It is not any more — `ManufacturerDetail` states who
 * made it, and this states who sells it.
 *
 * Everything after the address is conditional. The customer-care email is a
 * literal placeholder in seven of this catalogue's eight source documents, and
 * a support address a customer writes to and never hears back from is worse
 * than no support address at all.
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
      {seller.gstin ? (
        <div>
          <dt className="text-xs text-muted-foreground">GSTIN</dt>
          <dd className="tabular mt-0.5 text-foreground">{seller.gstin}</dd>
        </div>
      ) : null}
      {seller.customerCarePhone || seller.customerCareEmail ? (
        <div>
          <dt className="text-xs text-muted-foreground">Customer Care</dt>
          <dd className="mt-0.5 space-y-0.5 text-foreground">
            {seller.customerCarePhone ? (
              <a
                href={`tel:${seller.customerCarePhone.replace(/[^\d+]/g, '')}`}
                className="block text-primary underline-offset-4 hover:underline"
              >
                {seller.customerCarePhone}
              </a>
            ) : null}
            {seller.customerCareEmail ? (
              <a
                href={`mailto:${seller.customerCareEmail}`}
                className="block text-primary underline-offset-4 hover:underline"
              >
                {seller.customerCareEmail}
              </a>
            ) : null}
          </dd>
        </div>
      ) : null}
      {seller.grievanceOfficer ? (
        <div>
          <dt className="text-xs text-muted-foreground">Grievance Officer</dt>
          <dd className="mt-0.5 leading-relaxed text-foreground">{seller.grievanceOfficer}</dd>
        </div>
      ) : null}
    </dl>
  );
}
