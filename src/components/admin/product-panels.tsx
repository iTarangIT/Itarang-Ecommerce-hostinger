import {
  updateProductContentAction,
  updateProductFacetsAction,
  updateProductFaqsAction,
  updateProductInformationAction,
  updateProductPartiesAction,
  updateProductPricingAction,
  updateProductSectionsAction,
  updateProductSeoAction,
  updateProductSpecsAction,
  updateProductWarrantyAction,
} from '@/lib/admin/product-actions';
import { CATEGORIES } from '@/lib/commerce/mock/categories';
import type { ProductSection } from '@/lib/commerce/types';
import type { Manufacturer, ProductRecord, Seller } from '@/lib/products/types';
import {
  formatFaqs,
  formatLines,
  formatPairs,
  formatParagraphs,
  formatScenarios,
  formatSpecGroups,
  formatTitledItems,
} from '@/lib/admin/product-text-format';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';

/**
 * The editor panels.
 *
 * Every one is a plain `<form action={serverAction}>` carrying a hidden
 * `productKey` and its own submit button. No client components, no shared
 * state, no `useActionState` — a save is a POST and a redirect, and a failed
 * save comes back on the query string.
 *
 * The repeating parts of a product — specifications, FAQs, the page sections —
 * are edited as text in a documented line format rather than as arrays of
 * inputs with add/remove buttons. `lib/admin/product-text-format.ts` explains
 * why and holds the parsers; the hints under each textarea are the format's
 * user-facing documentation.
 */

function PanelHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="heading-3">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function KeyField({ productKey }: { productKey: string }) {
  return <input type="hidden" name="productKey" value={productKey} />;
}

function SaveRow({ label = 'Save' }: { label?: string }) {
  return (
    <div className="mt-6">
      <Button type="submit">{label}</Button>
    </div>
  );
}

/** Every subcategory in the taxonomy, labelled by its parent. */
const SUBCATEGORY_OPTIONS = CATEGORIES.flatMap((category) =>
  category.subcategories.map((sub) => ({
    value: sub.slug,
    label: `${category.name} · ${sub.name}`,
  })),
);

/* --------------------------------------------------------------- information */

export function InformationPanel({ product }: { product: ProductRecord }) {
  return (
    <form action={updateProductInformationAction}>
      <KeyField productKey={product.productKey} />
      <PanelHeading
        title="Product information"
        description="Identity and where the product is filed. Everything here appears on the page or decides which listing it belongs to."
      />

      <div className="grid gap-5">
        <Field label="Title" htmlFor="title" required>
          <Input id="title" name="title" defaultValue={product.title} required />
        </Field>

        <Field
          label="Subtitle"
          htmlFor="subtitle"
          hint="One line under the title, and the description used in search results."
        >
          <Input id="subtitle" name="subtitle" defaultValue={product.subtitle} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Brand" htmlFor="brand">
            <Input id="brand" name="brand" defaultValue={product.brand ?? ''} />
          </Field>
          <Field label="Model number" htmlFor="modelName">
            <Input id="modelName" name="modelName" defaultValue={product.modelName ?? ''} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Generic name"
            htmlFor="genericName"
            hint="The Legal Metrology generic name, e.g. Lithium Iron Phosphate EV battery pack."
          >
            <Input id="genericName" name="genericName" defaultValue={product.genericName ?? ''} />
          </Field>
          <Field label="Product type" htmlFor="productType">
            <Input id="productType" name="productType" defaultValue={product.productType ?? ''} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Net quantity" htmlFor="netQuantity" hint="e.g. 1 Count.">
            <Input id="netQuantity" name="netQuantity" defaultValue={product.netQuantity ?? ''} />
          </Field>
          <Field label="Country of origin" htmlFor="countryOfOrigin">
            <Input
              id="countryOfOrigin"
              name="countryOfOrigin"
              defaultValue={product.countryOfOrigin ?? ''}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" htmlFor="category" required>
            <Select id="category" name="category" defaultValue={product.category} required>
              {CATEGORIES.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type" htmlFor="subcategory" required>
            <Select id="subcategory" name="subcategory" defaultValue={product.subcategory} required>
              {SUBCATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Illustration"
          htmlFor="art"
          hint="Only used if this product has no images of its own."
        >
          <Select id="art" name="art" defaultValue={product.art}>
            <option value="battery">Battery</option>
            <option value="inverter">Inverter</option>
            <option value="ups">UPS</option>
            <option value="combo">Combo</option>
          </Select>
        </Field>

        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox
            name="installationIncluded"
            defaultChecked={product.installationIncluded}
            className="mt-0.5"
          />
          <span>
            Installation is included in the price
            <span className="block text-xs text-muted-foreground">
              Leave this off unless certified installation is genuinely part of what the customer
              pays for. The product page states one or the other, in full.
            </span>
          </span>
        </label>
      </div>

      <SaveRow />
    </form>
  );
}

/* ------------------------------------------------------------------ pricing */

export function PricingPanel({ product }: { product: ProductRecord }) {
  // A product with no variants still needs one editable row, or there is no way
  // to give it its first price.
  const rows =
    product.variants.length > 0
      ? product.variants
      : [
          {
            id: 0,
            variantKey: 'default',
            sku: '',
            title: '',
            optionValues: {},
            mrp: null,
            selling: null,
            stock: null,
            availability: null,
            position: 0,
          },
        ];

  const rupees = (paise: number | null) => (paise === null ? '' : String(paise / 100));

  return (
    <form action={updateProductPricingAction}>
      <KeyField productKey={product.productKey} />
      <input type="hidden" name="variantCount" value={rows.length} />
      <PanelHeading
        title="Pricing"
        description="Prices are entered in rupees and stored in paise. A row left without a price is kept, but the product cannot be published until at least one row has both an MRP and a selling price."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="HSN code" htmlFor="hsnCode">
          <Input id="hsnCode" name="hsnCode" defaultValue={product.hsnCode ?? ''} />
        </Field>
        <Field label="GST rate (%)" htmlFor="taxRatePercent" hint="e.g. 18 for eighteen per cent.">
          <Input
            id="taxRatePercent"
            name="taxRatePercent"
            inputMode="decimal"
            defaultValue={product.taxRate === null ? '' : String(product.taxRate * 100)}
          />
        </Field>
      </div>

      <label className="mt-5 flex items-start gap-2.5 text-sm">
        <Checkbox name="emiEnabled" defaultChecked={product.emiEnabled} className="mt-0.5" />
        <span>
          Offer no-cost EMI on this product
          <span className="block text-xs text-muted-foreground">
            Ticking this prints{' '}
            <strong className="font-medium text-foreground">
              “Or ₹x/month on 6-month no-cost EMI”
            </strong>{' '}
            on the product page — a specific financing claim, not a general one. Only tick it
            where those exact terms have been agreed with a lender. Off by default, and no
            imported product has it on.
          </span>
        </span>
      </label>

      <div className="mt-6 space-y-5">
        {rows.map((variant, index) => (
          <div key={variant.variantKey || index} className="rounded-lg border border-border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SKU" htmlFor={`sku-${index}`} required>
                <Input
                  id={`sku-${index}`}
                  name={`sku-${index}`}
                  defaultValue={variant.sku}
                  autoComplete="off"
                />
              </Field>
              <Field
                label="Variant key"
                htmlFor={`variantKey-${index}`}
                hint="Internal, unique within this product. Leave as 'default' for a single-variant product."
              >
                <Input
                  id={`variantKey-${index}`}
                  name={`variantKey-${index}`}
                  defaultValue={variant.variantKey}
                  autoComplete="off"
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="MRP (₹)" htmlFor={`mrp-${index}`}>
                <Input
                  id={`mrp-${index}`}
                  name={`mrp-${index}`}
                  inputMode="decimal"
                  defaultValue={rupees(variant.mrp)}
                />
              </Field>
              <Field label="Selling price (₹)" htmlFor={`selling-${index}`}>
                <Input
                  id={`selling-${index}`}
                  name={`selling-${index}`}
                  inputMode="decimal"
                  defaultValue={rupees(variant.selling)}
                />
              </Field>
              <Field
                label="Units in stock"
                htmlFor={`stock-${index}`}
                hint="Enter a number and it decides availability: 0 takes the product off sale, 1–5 shows “Only N left”. Leave blank if stock is not tracked."
              >
                <Input
                  id={`stock-${index}`}
                  name={`stock-${index}`}
                  inputMode="numeric"
                  defaultValue={variant.stock === null ? '' : String(variant.stock)}
                />
              </Field>
              <Field
                label="Availability"
                htmlFor={`availability-${index}`}
                hint="Only used when stock is left blank. A counted quantity always decides for itself."
              >
                <Select
                  id={`availability-${index}`}
                  name={`availability-${index}`}
                  defaultValue={variant.availability ?? ''}
                >
                  <option value="">From stock number</option>
                  <option value="in-stock">In stock</option>
                  <option value="low-stock">Low stock</option>
                  <option value="out-of-stock">Out of stock</option>
                  <option value="preorder">Pre-order</option>
                </Select>
              </Field>
            </div>

            <div className="mt-4">
              <Field
                label="Variant label"
                htmlFor={`variantTitle-${index}`}
                hint="Only shown when a product has more than one variant."
              >
                <Input
                  id={`variantTitle-${index}`}
                  name={`variantTitle-${index}`}
                  defaultValue={variant.title}
                />
              </Field>
            </div>
          </div>
        ))}
      </div>

      <SaveRow />
    </form>
  );
}

/* ------------------------------------------------------------------ content */

export function ContentPanel({ product }: { product: ProductRecord }) {
  return (
    <form action={updateProductContentAction}>
      <KeyField productKey={product.productKey} />
      <PanelHeading
        title="Highlights & description"
        description="What the page leads with, and the prose behind it."
      />

      <div className="grid gap-5">
        <Field
          label="Highlights"
          htmlFor="highlights"
          hint="One per line. These are the bullets under “About the product”, and the first three also fill the highlights tile in the gallery."
        >
          <Textarea
            id="highlights"
            name="highlights"
            rows={8}
            defaultValue={formatLines(product.highlights)}
          />
        </Field>

        <Field
          label="Description"
          htmlFor="description"
          hint="Separate paragraphs with a blank line. A paragraph may wrap across lines."
        >
          <Textarea
            id="description"
            name="description"
            rows={12}
            defaultValue={formatParagraphs(product.description)}
          />
        </Field>

        <Field label="What is in the box" htmlFor="boxContents" hint="One item per line.">
          <Textarea
            id="boxContents"
            name="boxContents"
            rows={5}
            defaultValue={formatLines(product.boxContents)}
          />
        </Field>

        <Field
          label="Care instructions"
          htmlFor="careInstructions"
          hint="One per line. Left empty, the page shows no care section at all — it does not show an empty one."
        >
          <Textarea
            id="careInstructions"
            name="careInstructions"
            rows={6}
            defaultValue={formatLines(product.careInstructions ?? [])}
          />
        </Field>
      </div>

      <SaveRow />
    </form>
  );
}

/* -------------------------------------------------------------------- specs */

export function SpecsPanel({ product }: { product: ProductRecord }) {
  return (
    <form action={updateProductSpecsAction}>
      <KeyField productKey={product.productKey} />
      <PanelHeading
        title="Technical specifications"
        description="Grouped tables, in the order they appear on the page. This is where every category-specific figure lives — an EV pack's charge profile and connector pin map, a home battery's IP rating and inverter compatibility."
      />

      <Field
        label="Specifications"
        htmlFor="specs"
        hint="Start a group with ## and its title. Then one row per line as: Label | Value. Separate groups with a blank line."
      >
        <Textarea
          id="specs"
          name="specs"
          rows={26}
          spellCheck={false}
          className="font-mono text-xs"
          defaultValue={formatSpecGroups(product.specGroups)}
        />
      </Field>

      <SaveRow />
    </form>
  );
}

/* ----------------------------------------------------------------- sections */

/**
 * Find one section by kind, narrowed to its own member of the union.
 *
 * Three lookups rather than one generic helper, because two members of
 * `ProductSection` each cover two kinds — charging and discharge share a shape,
 * as do compatibility and care. `Extract<ProductSection, { kind: 'charging' }>`
 * resolves to `never` for those, since the member's `kind` is the wider union
 * and is not assignable to the single literal. Narrowing by the same predicate
 * the type is written with is what actually works.
 */
function findSummarySection(product: ProductRecord, kind: 'charging' | 'discharge') {
  const section = product.sections.find((entry) => entry.kind === kind);
  return section && (section.kind === 'charging' || section.kind === 'discharge')
    ? section
    : undefined;
}

function findItemsSection(product: ProductRecord, kind: 'compatibility' | 'care') {
  const section = product.sections.find((entry) => entry.kind === kind);
  return section && (section.kind === 'compatibility' || section.kind === 'care')
    ? section
    : undefined;
}

function findSection<K extends 'applications' | 'runtime'>(
  product: ProductRecord,
  kind: K,
): Extract<ProductSection, { kind: K }> | undefined {
  return product.sections.find(
    (section): section is Extract<ProductSection, { kind: K }> => section.kind === kind,
  );
}

export function SectionsPanel({ product }: { product: ProductRecord }) {
  const applications = findSection(product, 'applications');
  const charging = findSummarySection(product, 'charging');
  const discharge = findSummarySection(product, 'discharge');
  const runtime = findSection(product, 'runtime');
  const compatibility = findItemsSection(product, 'compatibility');
  const care = findItemsSection(product, 'care');

  return (
    <form action={updateProductSectionsAction}>
      <KeyField productKey={product.productKey} />
      <PanelHeading
        title="Page sections"
        description="The blocks below the fold. Leave a section empty and it is not rendered — a product only shows the sections it has something to say in."
      />

      <div className="grid gap-6">
        <Field
          label="Recommended applications"
          htmlFor="applications"
          hint="One card per line, as: Title | Description."
        >
          <Textarea
            id="applications"
            name="applications"
            rows={6}
            className="font-mono text-xs"
            defaultValue={formatTitledItems(applications?.items ?? [])}
          />
        </Field>

        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-1.5 text-sm font-semibold">Charging</legend>
          <div className="grid gap-4">
            <Field label="Summary" htmlFor="chargingSummary">
              <Textarea
                id="chargingSummary"
                name="chargingSummary"
                rows={3}
                defaultValue={charging?.summary ?? ''}
              />
            </Field>
            <Field label="Figures" htmlFor="chargingPoints" hint="One per line, as: Label | Value.">
              <Textarea
                id="chargingPoints"
                name="chargingPoints"
                rows={6}
                className="font-mono text-xs"
                defaultValue={formatPairs(charging?.points ?? [])}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-1.5 text-sm font-semibold">Discharge</legend>
          <div className="grid gap-4">
            <Field label="Summary" htmlFor="dischargeSummary">
              <Textarea
                id="dischargeSummary"
                name="dischargeSummary"
                rows={3}
                defaultValue={discharge?.summary ?? ''}
              />
            </Field>
            <Field
              label="Figures"
              htmlFor="dischargePoints"
              hint="One per line, as: Label | Value."
            >
              <Textarea
                id="dischargePoints"
                name="dischargePoints"
                rows={6}
                className="font-mono text-xs"
                defaultValue={formatPairs(discharge?.points ?? [])}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-1.5 text-sm font-semibold">How long it will run</legend>
          <div className="grid gap-4">
            <Field
              label="Summary"
              htmlFor="runtimeSummary"
              hint="Only state figures the source documents give. Range and run-time estimates are performance claims."
            >
              <Textarea
                id="runtimeSummary"
                name="runtimeSummary"
                rows={3}
                defaultValue={runtime?.summary ?? ''}
              />
            </Field>
            <Field
              label="Scenarios"
              htmlFor="runtimeScenarios"
              hint="One row per line, as: Load | Draw | Run time."
            >
              <Textarea
                id="runtimeScenarios"
                name="runtimeScenarios"
                rows={6}
                className="font-mono text-xs"
                defaultValue={formatScenarios(runtime?.scenarios ?? [])}
              />
            </Field>
          </div>
        </fieldset>

        <Field label="What it works with" htmlFor="compatibility" hint="One point per line.">
          <Textarea
            id="compatibility"
            name="compatibility"
            rows={6}
            defaultValue={formatLines(compatibility?.items ?? [])}
          />
        </Field>

        <Field label="Looking after it" htmlFor="care" hint="One point per line.">
          <Textarea
            id="care"
            name="care"
            rows={6}
            defaultValue={formatLines(care?.items ?? [])}
          />
        </Field>
      </div>

      <SaveRow />
    </form>
  );
}

/* ------------------------------------------------------------------- facets */

export function FacetsPanel({ product }: { product: ProductRecord }) {
  const value = (key: 'batteryAh' | 'voltage' | 'capacityVa' | 'backupHours') => {
    const facet = product.facets[key];
    return facet === undefined ? '' : String(facet);
  };

  return (
    <form action={updateProductFacetsAction}>
      <KeyField productKey={product.productKey} />
      <PanelHeading
        title="Comparison values"
        description="The normalised figures the listing filters, the comparison table and the product card read. A field left blank leaves the product out of that filter, which is the correct rendering of “not stated” — it is never filed under a guess."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Battery capacity (Ah)" htmlFor="batteryAh">
          <Input id="batteryAh" name="batteryAh" inputMode="decimal" defaultValue={value('batteryAh')} />
        </Field>
        <Field
          label="Nominal voltage (V)"
          htmlFor="voltage"
          hint="The first thing an EV buyer filters on. Leave blank on a home inverter battery."
        >
          <Input id="voltage" name="voltage" inputMode="decimal" defaultValue={value('voltage')} />
        </Field>
        <Field label="Inverter capacity (VA)" htmlFor="capacityVa">
          <Input
            id="capacityVa"
            name="capacityVa"
            inputMode="decimal"
            defaultValue={value('capacityVa')}
          />
        </Field>
        <Field label="Typical backup (hours)" htmlFor="backupHours">
          <Input
            id="backupHours"
            name="backupHours"
            inputMode="decimal"
            defaultValue={value('backupHours')}
          />
        </Field>
        <Field label="Technology" htmlFor="technology" hint="e.g. LiFePO4.">
          <Input id="technology" name="technology" defaultValue={product.facets.technology ?? ''} />
        </Field>
        <Field
          label="Sort rank"
          htmlFor="popularityRank"
          hint="Lower sorts earlier under “Best selling”. Blank sorts last."
        >
          <Input
            id="popularityRank"
            name="popularityRank"
            inputMode="numeric"
            defaultValue={product.popularityRank === null ? '' : String(product.popularityRank)}
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field
          label="Badges"
          htmlFor="badges"
          hint="One per line. Allowed: bestseller, new, sale, combo-saver, premium. Anything else is ignored."
        >
          <Textarea id="badges" name="badges" rows={4} defaultValue={formatLines(product.badges)} />
        </Field>
      </div>

      <SaveRow />
    </form>
  );
}

/* ----------------------------------------------------------------- warranty */

export function WarrantyPanel({ product }: { product: ProductRecord }) {
  return (
    <form action={updateProductWarrantyAction}>
      <KeyField productKey={product.productKey} />
      <PanelHeading
        title="Warranty & returns"
        description="A warranty is a promise a customer can act on. Leave every field blank when the source does not state one and the page shows no warranty at all — which is correct, and far better than a plausible default."
      />

      <div className="grid gap-5">
        <Field
          label="Warranty (verbatim)"
          htmlFor="warrantyText"
          hint="The phrase exactly as it is offered, e.g. “3 years or 1200 cycles, whichever is earlier”. This is what the page shows."
        >
          <Input
            id="warrantyText"
            name="warrantyText"
            defaultValue={product.warrantyText ?? ''}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Warranty (months)"
            htmlFor="warrantyMonths"
            hint="The machine-readable half, used by the warranty filter and the comparison table."
          >
            <Input
              id="warrantyMonths"
              name="warrantyMonths"
              inputMode="numeric"
              defaultValue={product.warrantyMonths === null ? '' : String(product.warrantyMonths)}
            />
          </Field>
          <Field label="Warranty (cycles)" htmlFor="warrantyCycles">
            <Input
              id="warrantyCycles"
              name="warrantyCycles"
              inputMode="numeric"
              defaultValue={product.warrantyCycles === null ? '' : String(product.warrantyCycles)}
            />
          </Field>
        </div>

        <Field
          label="Return window (days)"
          htmlFor="returnWindowDays"
          hint="Blank means the page states no return policy. Only fill this in when a return window genuinely applies to this product."
        >
          <Input
            id="returnWindowDays"
            name="returnWindowDays"
            inputMode="numeric"
            defaultValue={
              product.returnWindowDays === null ? '' : String(product.returnWindowDays)
            }
          />
        </Field>
      </div>

      <SaveRow />
    </form>
  );
}

/* ------------------------------------------------------------------ parties */

export function PartiesPanel({
  product,
  manufacturers,
  sellers,
}: {
  product: ProductRecord;
  manufacturers: Manufacturer[];
  sellers: Seller[];
}) {
  return (
    <form action={updateProductPartiesAction}>
      <KeyField productKey={product.productKey} />
      <PanelHeading
        title="Manufacturer & seller"
        description="Who made it and who sells it, stated separately because they are different companies. Both are shared records — editing one changes it on every product that points at it."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Manufacturer" htmlFor="manufacturerId">
          <Select
            id="manufacturerId"
            name="manufacturerId"
            defaultValue={product.manufacturer ? String(product.manufacturer.id) : ''}
          >
            <option value="">Not stated</option>
            {manufacturers.map((manufacturer) => (
              <option key={manufacturer.id} value={manufacturer.id}>
                {manufacturer.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Seller / marketer" htmlFor="sellerId">
          <Select
            id="sellerId"
            name="sellerId"
            defaultValue={product.seller ? String(product.seller.id) : ''}
          >
            <option value="">Not stated</option>
            {sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {product.manufacturer ? (
        <dl className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm">
          <dt className="font-semibold">{product.manufacturer.name}</dt>
          <dd className="mt-1 text-muted-foreground">
            {product.manufacturer.legalName ?? (
              <span className="text-warning">Legal name not confirmed</span>
            )}
            {product.manufacturer.address ? (
              <>
                <br />
                {product.manufacturer.address}
              </>
            ) : (
              <>
                <br />
                <span className="text-warning">Registered address not confirmed</span>
              </>
            )}
          </dd>
        </dl>
      ) : null}

      <SaveRow />
    </form>
  );
}

/* ---------------------------------------------------------------------- faq */

export function FaqPanel({ product }: { product: ProductRecord }) {
  return (
    <form action={updateProductFaqsAction}>
      <KeyField productKey={product.productKey} />
      <PanelHeading
        title="Frequently asked questions"
        description="Shown in their own card on the product page, in this order."
      />

      <Field
        label="Questions and answers"
        htmlFor="faqs"
        hint="Write each as two lines — “Q: the question” then “A: the answer” — with a blank line between pairs. An answer may wrap across lines."
      >
        <Textarea
          id="faqs"
          name="faqs"
          rows={24}
          className="font-mono text-xs"
          defaultValue={formatFaqs(product.faqs)}
        />
      </Field>

      <SaveRow />
    </form>
  );
}

/* ---------------------------------------------------------------------- seo */

export function SeoPanel({ product }: { product: ProductRecord }) {
  return (
    <form action={updateProductSeoAction}>
      <KeyField productKey={product.productKey} />
      <PanelHeading
        title="SEO & URL"
        description="How the page is addressed and how it is described in search results."
      />

      <div className="grid gap-5">
        <Field
          label="URL slug"
          htmlFor="slug"
          required
          hint={`The page address is /products/${product.slug}. Changing it breaks every existing link to this product.`}
        >
          <Input id="slug" name="slug" defaultValue={product.slug} required autoComplete="off" />
        </Field>

        <Field
          label="SEO title"
          htmlFor="seoTitle"
          hint="Left blank, the product title is used."
        >
          <Input id="seoTitle" name="seoTitle" defaultValue={product.seoTitle ?? ''} />
        </Field>

        <Field
          label="SEO description"
          htmlFor="seoDescription"
          hint="Left blank, the subtitle and price are used."
        >
          <Textarea
            id="seoDescription"
            name="seoDescription"
            rows={3}
            defaultValue={product.seoDescription ?? ''}
          />
        </Field>
      </div>

      <SaveRow />
    </form>
  );
}
