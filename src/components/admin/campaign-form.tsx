import type { Category } from '@/lib/commerce/types';
import { CUSTOMER_TYPES, type Campaign } from '@/lib/offers/campaigns';
import { STATES } from '@/lib/checkout/validation';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';

/**
 * The campaign editor, shared by "new" and "edit". A plain server-rendered
 * form posting to a Server Action, like the rest of the console.
 *
 * Every restriction is optional and left empty means "no restriction", so a
 * simple code is a name, a code and an amount.
 */

/** A Date as the `datetime-local` value an Indian admin expects (IST). */
function istInput(date: Date | null): string {
  if (!date) return '';
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 16);
}

const rupees = (paise: number | null | undefined) => (paise == null ? '' : String(paise / 100));

const SECTION = 'space-y-4 rounded-lg border border-border bg-card p-5';
const HEADING = 'font-display text-sm font-semibold uppercase tracking-wide';

export function CampaignForm({
  campaign,
  categories,
  action,
  submitLabel,
}: {
  campaign: Campaign | null;
  categories: Category[];
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const amount =
    campaign?.kind === 'flat' ? rupees(campaign.value) : campaign?.kind === 'percent' ? String(campaign.value) : '';

  return (
    <form action={action} className="mt-6 space-y-6">
      {campaign ? <input type="hidden" name="id" value={campaign.id} /> : null}

      <section className={SECTION}>
        <h2 className={HEADING}>The offer</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coupon code" htmlFor="code" required hint="What the customer types. Letters and digits, e.g. DIWALI25.">
            <Input id="code" name="code" required defaultValue={campaign?.code ?? ''} className="uppercase" placeholder="e.g. DIWALI25" />
          </Field>
          <Field label="Internal name" htmlFor="name" required hint="For the admin list only.">
            <Input id="name" name="name" required defaultValue={campaign?.name ?? ''} placeholder="e.g. Diwali sale 2026" />
          </Field>
          <Field label="Offer line" htmlFor="label" required hint="Shown to the shopper when the code is applied.">
            <Input id="label" name="label" required defaultValue={campaign?.label ?? ''} placeholder="e.g. 10% off every battery" />
          </Field>
          <Field label="Description" htmlFor="description" hint="Terms in one or two sentences, shown on the Offers page.">
            <Textarea id="description" name="description" rows={2} defaultValue={campaign?.description ?? ''} />
          </Field>
          <Field label="Discount type" htmlFor="kind" required>
            <Select id="kind" name="kind" defaultValue={campaign?.kind ?? 'flat'}>
              <option value="flat">Fixed amount off (₹)</option>
              <option value="percent">Percentage off (%)</option>
              <option value="free-shipping">Free delivery</option>
            </Select>
          </Field>
          <Field label="Amount" htmlFor="amount" hint="Rupees for a fixed amount, a number from 1 to 100 for a percentage. Not used for free delivery.">
            <Input id="amount" name="amount" inputMode="decimal" defaultValue={amount} placeholder="e.g. 1000 or 10" />
          </Field>
          <Field label="Maximum discount (₹)" htmlFor="maxDiscount" hint="Caps a percentage discount. Optional.">
            <Input id="maxDiscount" name="maxDiscount" inputMode="decimal" defaultValue={rupees(campaign?.maxDiscount)} />
          </Field>
          <Field label="Minimum spend (₹)" htmlFor="minCart" hint="On qualifying products. Optional.">
            <Input id="minCart" name="minCart" inputMode="decimal" defaultValue={rupees(campaign?.minCart)} />
          </Field>
        </div>
      </section>

      <section className={SECTION}>
        <h2 className={HEADING}>When and how often</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts (India time)" htmlFor="startsAt" hint="Leave empty to start now.">
            <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={istInput(campaign?.startsAt ?? null)} />
          </Field>
          <Field label="Ends (India time)" htmlFor="endsAt" hint="Leave empty for no end date.">
            <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={istInput(campaign?.endsAt ?? null)} />
          </Field>
          <Field label="Total uses" htmlFor="maxRedemptionsTotal" hint="Across all customers, e.g. the first 100 orders. Empty = unlimited.">
            <Input id="maxRedemptionsTotal" name="maxRedemptionsTotal" inputMode="numeric" defaultValue={campaign?.maxRedemptionsTotal ?? ''} />
          </Field>
          <Field label="Uses per customer" htmlFor="maxPerCustomer" hint="1 = once per customer (by account and phone). Empty = unlimited.">
            <Input id="maxPerCustomer" name="maxPerCustomer" inputMode="numeric" defaultValue={campaign ? (campaign.maxPerCustomer ?? '') : '1'} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox name="isActive" defaultChecked={campaign?.isActive ?? true} />
            Active
          </label>
          <label className="flex items-center gap-2">
            <Checkbox name="showOnSite" defaultChecked={campaign?.showOnSite ?? false} />
            Show on the Offers page and home page
          </label>
        </div>
      </section>

      <section className={SECTION}>
        <h2 className={HEADING}>Products</h2>
        <p className="text-sm text-muted-foreground">
          Tick nothing for any product. The discount is worked out on the qualifying products in the cart.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {categories.map((category) => (
            <fieldset key={category.slug} className="space-y-1.5 text-sm">
              <label className="flex items-center gap-2 font-medium">
                <Checkbox name="categories" value={category.slug} defaultChecked={campaign?.categories?.includes(category.slug)} />
                All {category.name}
              </label>
              {category.subcategories.map((sub) => (
                <label key={sub.slug} className="ml-6 flex items-center gap-2">
                  <Checkbox name="subcategories" value={sub.slug} defaultChecked={campaign?.subcategories?.includes(sub.slug)} />
                  {sub.name}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      </section>

      <section className={SECTION}>
        <h2 className={HEADING}>Who can use it</h2>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="firstOrderOnly" defaultChecked={campaign?.firstOrderOnly ?? false} />
          First order only — the customer has no earlier confirmed or paid order
        </label>
        <fieldset className="text-sm">
          <legend className="font-medium">Customer type</legend>
          <p className="text-xs text-muted-foreground">
            Set on each customer&rsquo;s page in Customers. Tick nothing for every customer.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            {CUSTOMER_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 capitalize">
                <Checkbox name="customerTypes" value={type} defaultChecked={campaign?.customerTypes.includes(type)} />
                {type}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Only these customers" htmlFor="customerPhones" hint="10-digit mobile numbers, one per line or comma-separated. Empty = everyone.">
          <Textarea id="customerPhones" name="customerPhones" rows={2} defaultValue={campaign?.customerPhones.join('\n') ?? ''} />
        </Field>
      </section>

      <section className={SECTION}>
        <h2 className={HEADING}>Where (delivery address)</h2>
        <Field label="Cities" htmlFor="cities" hint="One per line or comma-separated, e.g. Gurugram. Empty = any city.">
          <Textarea id="cities" name="cities" rows={2} defaultValue={campaign?.cities.join('\n') ?? ''} />
        </Field>
        <Field label="States" htmlFor="states" hint="Hold Ctrl (Cmd on Mac) to pick several. None selected = any state.">
          <select
            id="states"
            name="states"
            multiple
            size={8}
            defaultValue={campaign?.states ?? []}
            className="w-full rounded-md border border-input bg-card p-2 text-sm"
          >
            {STATES.map((state) => (
              <option key={state.code} value={state.name}>
                {state.name}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
