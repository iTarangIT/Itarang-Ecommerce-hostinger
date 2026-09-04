'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CreditCard,
  FlaskConical,
  Loader2,
  Lock,
  MapPin,
  ShoppingBag,
  Truck,
  User,
  Wallet,
} from 'lucide-react';
import type { CartTotals } from '@/lib/store/totals';
import type { CartItem } from '@/lib/store/types';
import type { QuoteIssue } from '@/lib/orders/quote';
import type { ServiceabilityResult } from '@/lib/support/serviceability';
import { formatPrice } from '@/lib/catalog/pricing';
import { STATES } from '@/lib/checkout/validation';
import type { CustomerAddress } from '@/lib/account/addresses';
import { addAddressAction } from '@/lib/account/address-actions';
import { useCart } from '@/lib/store/hooks';
import { useUI } from '@/lib/store/ui-provider';
import { Button, ButtonLink } from '@/components/ui/button';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { StateBlock } from '@/components/ui/states';
import { OrderSummaryPanel } from './order-summary-panel';
import { RazorpayPanel } from './razorpay-panel';
import { TestModeBanner } from './test-mode-banner';
import { cn } from '@/lib/utils';
import { categoryPath } from '@/lib/routes';

/**
 * Three-step checkout.
 *
 * The client holds form state; every figure that matters — prices, discounts,
 * delivery, COD availability, totals — comes from `/api/checkout/quote`, which
 * recomputes from the catalogue. The cart's own prices are never sent.
 */

type Step = 1 | 2 | 3;
/**
 * What the shopper picks, not which provider runs.
 *
 * 'online' resolves to whichever provider the server has configured — the
 * client is told which one so it can render the right panel, but it never
 * chooses. `placeOrder` derives the stored payment method from the provider
 * itself, so a tampered request cannot mislabel an order.
 */
type PaymentChoice = 'cod' | 'online';

interface QuoteResponse {
  items: CartItem[];
  totals: CartTotals;
  issues: QuoteIssue[];
  serviceability: ServiceabilityResult | null;
  /** Whether the business offers COD at all, independent of the pincode. */
  codEnabled: boolean;
  codAvailable: boolean;
  codFee: number;
  placeable: boolean;
}

const STEPS: Array<{ id: Step; label: string; icon: typeof User }> = [
  { id: 1, label: 'Contact', icon: User },
  { id: 2, label: 'Delivery', icon: MapPin },
  { id: 3, label: 'Payment', icon: Wallet },
];

/**
 * A saved address, flattened into the shape the checkout form holds.
 *
 * `CustomerAddress` carries `line2`/`landmark` as optional and the form holds
 * them as always-present strings, so the empty string is the bridge. Nothing
 * else is copied: `recipientName` and `recipientPhone` stay on the saved
 * address and do not overwrite the contact step, which the shopper may already
 * have edited on the screen before this one.
 */
function toAddressFields(saved?: CustomerAddress) {
  return {
    line1: saved?.line1 ?? '',
    line2: saved?.line2 ?? '',
    landmark: saved?.landmark ?? '',
    city: saved?.city ?? '',
    state: saved?.state ?? '',
    pincode: saved?.pincode ?? '',
  };
}

/** The signed-in customer, passed down so the contact step starts filled in. */
export interface CheckoutAccount {
  email: string;
  fullName: string | null;
  phone: string | null;
}

export function CheckoutFlow({
  account,
  savedAddresses,
  provider,
}: {
  account: CheckoutAccount;
  /**
   * This account's saved addresses, read on the server with the session's id.
   *
   * Ordered default-first by `listAddresses`, which is why seeding the
   * selection is just "take the head of the list" rather than a search.
   */
  savedAddresses: CustomerAddress[];
  provider: 'mock' | 'razorpay-test';
}) {
  const cart = useCart();
  const router = useRouter();
  const { toast } = useUI();

  const [step, setStep] = React.useState<Step>(1);
  // Prefilled from the account rather than typed blind. The server ignores
  // these values for identity — ownership comes from the session — so they are
  // a convenience, not a trust boundary.
  const [contact, setContact] = React.useState({
    name: account.fullName ?? '',
    phone: account.phone ?? '',
    email: account.email,
  });
  /**
   * The shipping address for *this* order.
   *
   * Whether it came from a saved address or was typed by hand, this is the
   * object that gets posted — the payload shape is identical either way. That
   * is deliberate and is what keeps `place-order.ts`, the quote and the payment
   * path untouched by this feature: the server cannot tell where the values
   * came from, and does not need to.
   *
   * No address id is ever sent. There is therefore no id for the server to
   * resolve and no ownership check to get wrong at placement time — the whole
   * class of "customer A submits customer B's address id" is closed by not
   * having the field, rather than by remembering to verify it.
   */
  const [address, setAddress] = React.useState(() => toAddressFields(savedAddresses[0]));

  /**
   * Which saved address is selected, or null for "a new address".
   *
   * Seeded from the head of `savedAddresses`, which `listAddresses` orders
   * default-first — so a customer with a default never retypes it, and one with
   * saved addresses but no explicit default still gets their most recent.
   */
  const [selectedAddressId, setSelectedAddressId] = React.useState<number | null>(
    savedAddresses[0]?.id ?? null,
  );

  /** Only offered when the typed address is not already one of the saved ones. */
  const [saveNewAddress, setSaveNewAddress] = React.useState(false);
  const [wantsGstInvoice, setWantsGstInvoice] = React.useState(false);
  const [gstin, setGstin] = React.useState('');
  const [payment, setPayment] = React.useState<PaymentChoice>('online');

  const [quote, setQuote] = React.useState<QuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [placing, setPlacing] = React.useState(false);
  /**
   * Set when the server rebuilt the quote and got a different total from the
   * one on screen. Holds both figures so the shopper is shown the change
   * rather than just told about it.
   */
  const [priceChange, setPriceChange] = React.useState<{
    from: number;
    to: number;
  } | null>(null);
  const [pendingOrder, setPendingOrder] = React.useState<string | null>(null);
  const [intent, setIntent] = React.useState<{ clientParams: Record<string, string | number> } | null>(
    null,
  );

  /** One key per placement attempt, so a double click cannot create two orders. */
  const idempotencyKey = React.useRef<string>(crypto.randomUUID());

  const lines = React.useMemo(
    () => cart.items.map((item) => ({ variantId: item.id, quantity: item.quantity })),
    [cart.items],
  );

  /* ------------------------------------------------------------- quote */

  React.useEffect(() => {
    if (lines.length === 0) {
      setQuote(null);
      return;
    }

    const controller = new AbortController();
    setQuoteLoading(true);

    const timer = window.setTimeout(() => {
      fetch('/api/checkout/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          lines,
          couponCode: cart.coupon?.code,
          pincode: address.pincode.length === 6 ? address.pincode : undefined,
          paymentMethod: payment === 'cod' ? 'cod' : provider,
        }),
      })
        .then(async (response) => {
          // The quote endpoint requires a session. If it lapsed while the page
          // was open, the price on screen is no longer being refreshed, and
          // leaving it there would be worse than saying so.
          if (response.status === 401) {
            router.push(`/login?next=${encodeURIComponent('/checkout')}`);
            return null;
          }
          return (await response.json()) as QuoteResponse;
        })
        .then((data) => {
          if (data) setQuote(data);
        })
        .catch(() => {
          /* aborted or offline — the previous quote stays on screen */
        })
        .finally(() => setQuoteLoading(false));
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [lines, cart.coupon?.code, address.pincode, payment, provider, router]);

  /* ------------------------------------------------------- validation */

  const validateStep = (target: Step): boolean => {
    const errors: Record<string, string> = {};

    if (target >= 2) {
      if (contact.name.trim().length < 2) errors.name = 'Enter your name.';
      if (!/^[6-9]\d{9}$/.test(contact.phone.trim()))
        errors.phone = 'Enter a 10-digit Indian mobile number.';
      if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email.trim()))
        errors.email = 'Enter a valid email address.';
    }

    if (target >= 3) {
      if (address.line1.trim().length < 4) errors.line1 = 'Enter the flat or house number and street.';
      if (address.city.trim().length < 2) errors.city = 'Enter your city.';
      if (!address.state) errors.state = 'Select your state.';
      if (!/^\d{6}$/.test(address.pincode)) errors.pincode = 'Enter a valid 6-digit pincode.';
      if (wantsGstInvoice && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin))
        errors.gstin = 'That does not look like a valid 15-character GSTIN.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Choose a saved address for this order.
   *
   * Copies the values in and clears any field errors the previous address left
   * behind — a saved address has already been validated once, so carrying a
   * stale "enter a valid pincode" over to it would be wrong.
   *
   * The saved row itself is untouched. So is the default flag: picking a
   * different address for one order is not a statement about where the next one
   * should go.
   */
  const selectSavedAddress = (saved: CustomerAddress) => {
    setSelectedAddressId(saved.id);
    setAddress(toAddressFields(saved));
    setSaveNewAddress(false);
    setFieldErrors({});
  };

  /** Switch to a blank form. Nothing is saved unless the shopper asks. */
  const useNewAddress = () => {
    setSelectedAddressId(null);
    setAddress(toAddressFields());
    setSaveNewAddress(false);
    setFieldErrors({});
  };

  const goTo = (target: Step) => {
    if (target > step && !validateStep(target)) return;
    setFormError(null);
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* --------------------------------------------------------- placement */

  const placeOrder = async ({ acceptPriceChange = false } = {}) => {
    if (!validateStep(3)) return;
    if (!quote?.placeable) {
      setFormError('Some items in your cart need attention before you can place this order.');
      return;
    }

    setPlacing(true);
    setFormError(null);
    if (!acceptPriceChange) setPriceChange(null);

    const endpoint = payment === 'cod' ? '/api/checkout/cod' : '/api/checkout/order';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey.current,
        },
        body: JSON.stringify({
          lines,
          contact: { ...contact, email: contact.email || undefined },
          address,
          couponCode: cart.coupon?.code,
          gstin: wantsGstInvoice ? gstin : undefined,
          paymentMethod: payment === 'cod' ? 'cod' : provider,
          // What this browser is showing. Advisory only — the server prices the
          // order from the catalogue either way, and this can only stop the
          // order, never lower it.
          expectedTotal: quote.totals.total,
          acceptPriceChange,
        }),
      });

      const data = await response.json();

      // The session expired between loading the page and submitting. Send them
      // to sign in and straight back — the cart is in localStorage, so nothing
      // they typed into it is lost.
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent('/checkout')}`);
        return;
      }

      // The catalogue price moved between the quote on screen and this submit.
      // Nothing has been created, so show both figures and let the shopper
      // decide. The idempotency key is kept: this is the same order attempt.
      if (response.status === 409 && data.code === 'price_changed') {
        setPriceChange({ from: data.expectedTotal, to: data.total });
        setQuote((current) =>
          current ? { ...current, totals: { ...current.totals, total: data.total } } : current,
        );
        return;
      }

      if (!response.ok) {
        setFieldErrors(data.fields ?? {});
        setFormError(
          data.message ??
            data.error ??
            (data.code === 'insufficient_stock'
              ? 'One of your items just went out of stock.'
              : 'We could not place this order.'),
        );
        // A failed attempt gets a fresh key so a corrected retry is not
        // mistaken for a duplicate of the failed one.
        idempotencyKey.current = crypto.randomUUID();
        return;
      }

      /*
       * The order exists from here on.
       *
       * Saving the address is done now — after placement succeeded, before the
       * navigation or the payment modal — and deliberately *not* inside
       * `placeOrder` on the server. The order is already complete without it:
       * `orders.shipping_address` holds its own copy of these values, so this
       * write adds a convenience for next time and can fail without costing the
       * customer their order. Putting it in the placement transaction would
       * mean a full address book turning a paid order into a failed one.
       *
       * Ownership comes from the session inside `addAddressAction`. Nothing
       * here names an account.
       */
      if (selectedAddressId === null && saveNewAddress) {
        const form = new FormData();
        form.append('line1', address.line1);
        form.append('line2', address.line2);
        form.append('landmark', address.landmark);
        form.append('city', address.city);
        form.append('state', address.state);
        form.append('pincode', address.pincode);
        // The person this parcel is for, which is what the contact step
        // collected. The address book keeps a recipient per entry.
        form.append('recipientName', contact.name);
        form.append('recipientPhone', contact.phone);
        // Never silently promote it: the shopper asked to save an address, not
        // to change where everything goes from now on.
        form.append('isDefault', 'false');

        // A duplicate or a validation quibble must not interrupt a placed
        // order, so the result is not surfaced here.
        await addAddressAction(null, form).catch(() => null);
      }

      if (payment === 'cod') {
        cart.clear();
        router.push(`/order/${data.orderNumber}?placed=1`);
        return;
      }

      // Online: the order exists and is awaiting payment.
      setPendingOrder(data.orderNumber);
      setIntent(data.intent ?? null);
    } catch {
      setFormError('We could not reach the server. Your cart is safe — please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const simulatePayment = async (outcome: 'success' | 'failure' | 'abandon') => {
    if (!pendingOrder) return;
    setPlacing(true);

    try {
      const response = await fetch('/api/checkout/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: pendingOrder, outcome }),
      });
      const data = await response.json();

      if (data.paymentStatus === 'paid') {
        cart.clear();
        router.push(`/order/${pendingOrder}?placed=1`);
        return;
      }

      toast({
        title: outcome === 'failure' ? 'Payment failed (simulated)' : 'Payment not completed',
        description: 'Your order is still held. You can try the payment again.',
        tone: outcome === 'failure' ? 'error' : 'info',
      });
    } catch {
      setFormError('Could not run the simulation.');
    } finally {
      setPlacing(false);
    }
  };

  /* ------------------------------------------------------------ render */

  if (cart.hydrated && cart.items.length === 0 && !pendingOrder) {
    return (
      <StateBlock
        icon={<ShoppingBag className="h-6 w-6" />}
        title="Your cart is empty"
        description="Add something to your cart before checking out."
        actions={
          <>
            <ButtonLink href={categoryPath('combos')} variant="primary">
              Shop combos
            </ButtonLink>
            <ButtonLink href="/cart" variant="outline">
              Back to cart
            </ButtonLink>
          </>
        }
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-7">
        <TestModeBanner className="mb-6" />

        {/* Step indicator */}
        <ol className="mb-6 flex items-center gap-2">
          {STEPS.map((entry, index) => {
            const state = entry.id < step ? 'done' : entry.id === step ? 'current' : 'todo';
            return (
              <li key={entry.id} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => entry.id < step && goTo(entry.id)}
                  disabled={entry.id > step}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                    state === 'current' && 'text-foreground',
                    state === 'done' && 'text-success hover:bg-secondary',
                    state === 'todo' && 'text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-7 w-7 place-items-center rounded-full border-2 text-xs font-bold',
                      state === 'current' && 'border-accent bg-accent text-accent-foreground',
                      state === 'done' && 'border-success bg-success text-success-foreground',
                      state === 'todo' && 'border-border text-muted-foreground',
                    )}
                  >
                    {state === 'done' ? <Check className="h-4 w-4" /> : entry.id}
                  </span>
                  <span className="hidden sm:inline">{entry.label}</span>
                </button>
                {index < STEPS.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-px flex-1',
                      entry.id < step ? 'bg-success' : 'bg-border',
                    )}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>

        {priceChange ? (
          <div
            role="alert"
            className="mb-4 rounded-md border border-warning/40 bg-warning-soft p-4 text-sm"
          >
            <p className="flex items-start gap-2 font-semibold text-foreground">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              The price changed while you were checking out
            </p>
            <p className="mt-2 text-muted-foreground">
              This order was {formatPrice(priceChange.from)} and is now{' '}
              <strong className="font-semibold text-foreground">
                {formatPrice(priceChange.to)}
              </strong>
              . Nothing has been ordered or charged. Continue only if the new total is right.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={placing}
                onClick={() => placeOrder({ acceptPriceChange: true })}
              >
                {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue at {formatPrice(priceChange.to)}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={placing}
                onClick={() => {
                  setPriceChange(null);
                  router.push('/cart');
                }}
              >
                Back to cart
              </Button>
            </div>
          </div>
        ) : null}

        {formError ? (
          <p
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-sale-soft p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {formError}
          </p>
        ) : null}

        {/* ---------------------------------------------------- step 1 */}
        {step === 1 ? (
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="heading-3">Who is this order for?</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              We use the mobile number to confirm delivery and installation.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="name" required error={fieldErrors.name}>
                <Input
                  id="name"
                  value={contact.name}
                  onChange={(e) => setContact({ ...contact, name: e.target.value })}
                  autoComplete="name"
                />
              </Field>
              <Field label="Mobile number" htmlFor="phone" required error={fieldErrors.phone}>
                <Input
                  id="phone"
                  inputMode="numeric"
                  maxLength={10}
                  className="tabular"
                  value={contact.phone}
                  onChange={(e) =>
                    setContact({ ...contact, phone: e.target.value.replace(/\D/g, '') })
                  }
                  autoComplete="tel-national"
                />
              </Field>
              <Field
                label="Email address"
                htmlFor="email"
                hint="For the order confirmation and invoice"
                error={fieldErrors.email}
                className="sm:col-span-2"
              >
                <Input
                  id="email"
                  type="email"
                  value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  autoComplete="email"
                />
              </Field>
            </div>

            <div className="mt-6 flex justify-between">
              <ButtonLink href="/cart" variant="ghost">
                <ArrowLeft className="h-4 w-4" />
                Back to cart
              </ButtonLink>
              <Button onClick={() => goTo(2)} variant="primary" size="lg">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        ) : null}

        {/* ---------------------------------------------------- step 2 */}
        {step === 2 ? (
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="heading-3">Where should it go?</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {savedAddresses.length > 0
                ? 'Pick a saved address, or enter a new one.'
                : 'Enter the pincode first — we will confirm delivery and whether cash on delivery is available.'}
            </p>

            {/*
              The saved-address picker. Rendered only when there is something to
              pick: a customer with no saved addresses sees exactly the form
              that was here before, so checkout is never harder for them than it
              was.

              Choosing an entry copies its values into the same `address` state
              the form below writes to. Nothing is "selected" at submit time —
              by then there is only an address object, indistinguishable from a
              typed one. Changing the selection therefore affects this order and
              nothing else: it does not touch the saved row, the default flag,
              or any earlier order.
            */}
            {savedAddresses.length > 0 ? (
              <fieldset className="mt-6">
                <legend className="text-sm font-medium text-foreground">Deliver to</legend>
                <div className="mt-3 space-y-2">
                  {savedAddresses.map((saved) => (
                    <label
                      key={saved.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors',
                        selectedAddressId === saved.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-foreground/20',
                      )}
                    >
                      <input
                        type="radio"
                        name="savedAddress"
                        className="mt-1 h-4 w-4 shrink-0 accent-primary"
                        checked={selectedAddressId === saved.id}
                        onChange={() => selectSavedAddress(saved)}
                      />
                      <span className="min-w-0 text-sm">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">
                            {saved.recipientName}
                          </span>
                          {saved.isDefault ? (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              Default
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-muted-foreground">
                          {saved.line1}
                          {saved.line2 ? `, ${saved.line2}` : ''}
                          {saved.landmark ? `, ${saved.landmark}` : ''}
                          {`, ${saved.city}, ${saved.state} ${saved.pincode}`}
                        </span>
                        <span className="mt-0.5 block tabular text-muted-foreground">
                          {saved.recipientPhone}
                        </span>
                      </span>
                    </label>
                  ))}

                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-3.5 transition-colors',
                      selectedAddressId === null
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-foreground/20',
                    )}
                  >
                    <input
                      type="radio"
                      name="savedAddress"
                      className="h-4 w-4 shrink-0 accent-primary"
                      checked={selectedAddressId === null}
                      onChange={useNewAddress}
                    />
                    <span className="text-sm font-medium text-foreground">
                      Use a different address
                    </span>
                  </label>
                </div>
              </fieldset>
            ) : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Pincode" htmlFor="pincode" required error={fieldErrors.pincode}>
                <Input
                  id="pincode"
                  inputMode="numeric"
                  maxLength={6}
                  className="tabular"
                  value={address.pincode}
                  onChange={(e) =>
                    setAddress({ ...address, pincode: e.target.value.replace(/\D/g, '') })
                  }
                  autoComplete="postal-code"
                />
              </Field>

              <div className="flex items-end pb-1">
                {quote?.serviceability ? (
                  quote.serviceability.serviceable ? (
                    <p className="flex items-start gap-2 text-sm text-success">
                      <Truck className="mt-0.5 h-4 w-4 shrink-0" />
                      Delivers in {quote.serviceability.deliveryDays}–
                      {quote.serviceability.deliveryDays + 1} working days
                    </p>
                  ) : (
                    <p className="flex items-start gap-2 text-sm text-warning">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      {quote.serviceability.message}
                    </p>
                  )
                ) : null}
              </div>

              <Field
                label="Flat / house number and street"
                htmlFor="line1"
                required
                error={fieldErrors.line1}
                className="sm:col-span-2"
              >
                <Input
                  id="line1"
                  value={address.line1}
                  onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                  autoComplete="address-line1"
                />
              </Field>

              <Field label="Area / locality" htmlFor="line2" className="sm:col-span-2">
                <Input
                  id="line2"
                  value={address.line2}
                  onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                  autoComplete="address-line2"
                />
              </Field>

              <Field label="Landmark" htmlFor="landmark">
                <Input
                  id="landmark"
                  value={address.landmark}
                  onChange={(e) => setAddress({ ...address, landmark: e.target.value })}
                />
              </Field>

              <Field label="City" htmlFor="city" required error={fieldErrors.city}>
                <Input
                  id="city"
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  autoComplete="address-level2"
                />
              </Field>

              <Field
                label="State"
                htmlFor="state"
                required
                error={fieldErrors.state}
                className="sm:col-span-2"
              >
                <Select
                  id="state"
                  value={address.state}
                  onChange={(e) => setAddress({ ...address, state: e.target.value })}
                >
                  <option value="">Select a state…</option>
                  {STATES.map((entry) => (
                    <option key={entry.code} value={entry.name}>
                      {entry.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {/*
              Offered only for an address that is not already saved. Ticking it
              does not change what is ordered or where it goes — the order is
              placed from the same values either way, and the save is a separate
              write that happens once the order exists.
            */}
            {selectedAddressId === null ? (
              <label className="mt-4 flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  checked={saveNewAddress}
                  onChange={(e) => setSaveNewAddress(e.target.checked)}
                />
                <span className="text-sm text-foreground">
                  Save this address to my account
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    So you do not have to type it again next time.
                  </span>
                </span>
              </label>
            ) : null}

            <div className="mt-6 rounded-lg border border-border bg-surface p-4">
              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  checked={wantsGstInvoice}
                  onChange={(e) => setWantsGstInvoice(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  <span className="font-medium text-foreground">I need a GST invoice</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    For a business purchase — the invoice is raised against your GSTIN.
                  </span>
                </span>
              </label>

              {wantsGstInvoice ? (
                <Field label="GSTIN" htmlFor="gstin" required error={fieldErrors.gstin} className="mt-3">
                  <Input
                    id="gstin"
                    maxLength={15}
                    className="tabular uppercase"
                    placeholder="22AAAAA0000A1Z5"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  />
                </Field>
              ) : null}
            </div>

            <div className="mt-6 flex justify-between">
              <Button onClick={() => goTo(1)} variant="ghost">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => goTo(3)} variant="primary" size="lg">
                Continue to payment
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        ) : null}

        {/* ---------------------------------------------------- step 3 */}
        {step === 3 ? (
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="heading-3">How would you like to pay?</h2>

            {pendingOrder && provider === 'razorpay-test' && intent ? (
              <RazorpayPanel
                orderNumber={pendingOrder}
                intent={intent}
                total={quote?.totals.total ?? 0}
                busy={placing}
                prefill={{
                  name: contact.name,
                  email: contact.email,
                  contact: contact.phone,
                }}
                onVerified={() => {
                  cart.clear();
                  router.push(`/order/${pendingOrder}?placed=1`);
                }}
                onFailed={(message) => {
                  toast({ title: 'Payment not completed', description: message, tone: 'error' });
                }}
              />
            ) : pendingOrder ? (
              <MockPaymentPanel
                orderNumber={pendingOrder}
                total={quote?.totals.total ?? 0}
                busy={placing}
                onSimulate={simulatePayment}
              />
            ) : (
              <>
                <div className="mt-5 space-y-3">
                  <PaymentOption
                    id="online"
                    checked={payment === 'online'}
                    onSelect={() => setPayment('online')}
                    icon={
                      provider === 'razorpay-test' ? (
                        <CreditCard className="h-5 w-5" />
                      ) : (
                        <FlaskConical className="h-5 w-5" />
                      )
                    }
                    title={provider === 'razorpay-test' ? 'Card, UPI or netbanking' : 'Test payment'}
                    description={
                      provider === 'razorpay-test'
                        ? 'Pay securely through Razorpay. Test mode — use a test card; no real money moves.'
                        : 'Simulates a card or UPI payment. No gateway is contacted and no money moves.'
                    }
                    badge="Test mode"
                  />

                  {/* Not offered at all, so not shown at all.
                      `codEnabled` is the business's answer; `codAvailable`
                      additionally depends on the pincode. Rendering a disabled
                      "Cash on delivery — not available at this pincode" while
                      COD is switched off site-wide blamed the customer's
                      address for a decision that had nothing to do with it,
                      and invited them to keep trying other pincodes. The
                      server refuses a COD order in two independent places
                      regardless of what this renders. */}
                  {quote?.codEnabled ? (
                    <PaymentOption
                      id="cod"
                      checked={payment === 'cod'}
                      onSelect={() => setPayment('cod')}
                      disabled={!quote.codAvailable}
                      icon={<Banknote className="h-5 w-5" />}
                      title="Cash on delivery"
                      description={
                        quote.codAvailable
                          ? quote.codFee > 0
                            ? `Pay when it arrives. A ${formatPrice(quote.codFee)} handling fee applies.`
                            : 'Pay the delivery agent when your order arrives.'
                          : address.pincode.length === 6
                            ? 'Not available at this pincode.'
                            : 'Enter a delivery pincode to check availability.'
                      }
                    />
                  ) : null}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Button onClick={() => goTo(2)} variant="ghost">
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    // Wrapped so the click event is not read as the options object.
                    onClick={() => placeOrder()}
                    variant="accent"
                    size="lg"
                    disabled={placing || quoteLoading || !quote?.placeable}
                  >
                    {placing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    {payment === 'cod'
                      ? `Place order · ${quote ? formatPrice(quote.totals.total) : ''}`
                      : `Pay ${quote ? formatPrice(quote.totals.total) : ''}`}
                  </Button>
                </div>
              </>
            )}
          </section>
        ) : null}
      </div>

      <aside className="lg:col-span-5">
        <div className="lg:sticky lg:top-24">
          <OrderSummaryPanel
            items={quote?.items ?? cart.items}
            totals={quote?.totals ?? null}
            issues={quote?.issues ?? []}
            loading={quoteLoading && !quote}
          />
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------ pieces */

function PaymentOption({
  id,
  checked,
  onSelect,
  disabled,
  icon,
  title,
  description,
  badge,
}: {
  id: string;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
        checked ? 'border-accent bg-accent-50' : 'border-border bg-card hover:border-primary/30',
        disabled && 'cursor-not-allowed opacity-55 hover:border-border',
      )}
    >
      <input
        type="radio"
        name="payment-method"
        value={id}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="mt-1 h-4 w-4 accent-[hsl(var(--accent))]"
      />
      <span className={cn('mt-0.5 shrink-0', checked ? 'text-accent-600' : 'text-muted-foreground')}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {badge ? (
            <span className="rounded-sm bg-warning-soft px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wide text-warning">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

function MockPaymentPanel({
  orderNumber,
  total,
  busy,
  onSimulate,
}: {
  orderNumber: string;
  total: number;
  busy: boolean;
  onSimulate: (outcome: 'success' | 'failure' | 'abandon') => void;
}) {
  return (
    <div className="mt-5 rounded-lg border-2 border-warning/50 bg-warning-soft p-5">
      <p className="flex items-center gap-2 font-display text-base font-bold text-foreground">
        <FlaskConical className="h-5 w-5 text-warning" />
        Simulated payment
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Order <span className="tabular font-semibold text-foreground">{orderNumber}</span> is held
        awaiting payment of{' '}
        <span className="tabular font-semibold text-foreground">{formatPrice(total)}</span>. Choose
        an outcome to exercise the flow. Nothing is charged.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <Button onClick={() => onSimulate('success')} disabled={busy} variant="accent">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Success
        </Button>
        <Button onClick={() => onSimulate('failure')} disabled={busy} variant="outline">
          Failure
        </Button>
        <Button onClick={() => onSimulate('abandon')} disabled={busy} variant="outline">
          Abandon
        </Button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Failure and abandonment leave the order open and the stock held, so the retry path can be
        tested. The reservation expires on its own if nothing completes.
      </p>
    </div>
  );
}
