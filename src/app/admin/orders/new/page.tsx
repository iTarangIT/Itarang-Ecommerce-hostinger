import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { allProducts } from '@/lib/catalog/collections';
import { purchaseBlockFor } from '@/lib/commerce/purchase';
import { formatPrice } from '@/lib/catalog/pricing';
import { STATES } from '@/lib/checkout/validation';
import { paymentProvider } from '@/lib/payments';
import { StaffOrderForm, type StaffOrderOption } from '@/components/admin/staff-order-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'New order',
  robots: { index: false, follow: false },
};

/**
 * Admin → New order (R-18): an order placed for a customer who rang or sent a
 * WhatsApp, paid through a Razorpay payment link sent to their phone.
 *
 * Authorization is inherited from `admin/layout.tsx`; the action repeats it.
 * Only what the storefront would sell is offered — the same purchase rules,
 * so staff cannot place an order the website would refuse.
 */
export default async function NewStaffOrderPage() {
  const products = await allProducts();
  const options: StaffOrderOption[] = products
    .flatMap((product) =>
      product.variants
        .filter((variant) => purchaseBlockFor(product, variant) === null)
        .map((variant) => ({
          variantId: variant.id,
          label: `${product.title}${variant.title && variant.title !== product.title ? ` — ${variant.title}` : ''} · ${variant.sku} · ${formatPrice(variant.price.selling)}`,
        })),
    )
    .sort((a, b) => a.label.localeCompare(b.label));
  const linksAvailable = Boolean(paymentProvider().createPaymentLink);

  return (
    <div className="container py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All orders
      </Link>
      <h1 className="heading-2 mt-4">New order for a customer</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        For phone and WhatsApp enquiries. The customer gets a Razorpay payment link by SMS; the order
        confirms when they pay, and follows the usual dispatch steps.
      </p>
      {!linksAvailable ? (
        <p className="mt-4 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-foreground">
          This server runs the test payment provider, which cannot send payment links. Orders can be placed
          here to check the form, but no link will go out.
        </p>
      ) : null}
      <StaffOrderForm options={options} states={STATES.map((entry) => entry.name)} />
    </div>
  );
}
