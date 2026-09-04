import type { ManufacturerInfo } from '@/lib/commerce/types';

/**
 * Who made the product.
 *
 * A sibling of `SellerDetail`, and the reason that component's panel is no
 * longer titled "Manufacturer Detail": it renders the *seller*, which was the
 * same company only for as long as the catalogue was own-brand. For a
 * third-party product the manufacturer and the marketer are different
 * businesses, and Legal Metrology wants both named.
 *
 * Every row below the name is conditional. Seven of the eight source documents
 * for this catalogue say the manufacturer's legal name and registered address
 * are still to be confirmed — so those rows are absent until they are, rather
 * than filled with something that looks official and is not.
 */
export function ManufacturerDetail({ manufacturer }: { manufacturer: ManufacturerInfo }) {
  return (
    <dl className="space-y-3 text-sm">
      <div>
        <dt className="text-xs text-muted-foreground">Manufacturer</dt>
        <dd className="mt-0.5 font-medium uppercase text-foreground">{manufacturer.name}</dd>
      </div>

      {manufacturer.legalName ? (
        <div>
          <dt className="text-xs text-muted-foreground">Registered Name</dt>
          <dd className="mt-0.5 leading-relaxed text-foreground">{manufacturer.legalName}</dd>
        </div>
      ) : null}

      {manufacturer.address ? (
        <div>
          <dt className="text-xs text-muted-foreground">Manufacturer Address</dt>
          <dd className="mt-0.5 leading-relaxed text-foreground">{manufacturer.address}</dd>
        </div>
      ) : null}

      {manufacturer.countryOfOrigin ? (
        <div>
          <dt className="text-xs text-muted-foreground">Country of Origin</dt>
          <dd className="mt-0.5 text-foreground">{manufacturer.countryOfOrigin}</dd>
        </div>
      ) : null}

      {manufacturer.email || manufacturer.phone ? (
        <div>
          <dt className="text-xs text-muted-foreground">Contact</dt>
          <dd className="mt-0.5 space-y-0.5 text-foreground">
            {manufacturer.email ? (
              <a
                href={`mailto:${manufacturer.email}`}
                className="block text-primary underline-offset-4 hover:underline"
              >
                {manufacturer.email}
              </a>
            ) : null}
            {manufacturer.phone ? <span className="block">{manufacturer.phone}</span> : null}
          </dd>
        </div>
      ) : null}

      {manufacturer.website ? (
        <div>
          <dt className="text-xs text-muted-foreground">Website</dt>
          <dd className="mt-0.5">
            <a
              // The catalogue stores these as bare hostnames, which a browser
              // would resolve against this site rather than the manufacturer's.
              href={
                manufacturer.website.startsWith('http')
                  ? manufacturer.website
                  : `https://${manufacturer.website}`
              }
              target="_blank"
              rel="noreferrer nofollow"
              className="text-primary underline-offset-4 hover:underline"
            >
              {manufacturer.website}
            </a>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
