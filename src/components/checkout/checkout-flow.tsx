'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
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
import { useCart } from '@/lib/store/hooks';
import { useUI } from '@/lib/store/ui-provider';
import { Button, ButtonLink } from '@/components/ui/button';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { StateBlock } from '@/components/ui/states';
import { OrderSummaryPanel } from './order-summary-panel';
import { TestModeBanner } from './test-mode-banner';
import { cn } from '@/lib/utils';

/**
 * Three-step checkout.
 *
 * The client holds form state; every figure that matters — prices, discounts,
 * delivery, COD availability, totals — comes from `/api/checkout/quote`, which
 * recomputes from the catalogue. The cart's own prices are never sent.
 */

type Step = 1 | 2 | 3;
type PaymentChoice = 'cod' | 'mock';

interface QuoteResponse {
  items: CartItem[];
  totals: CartTotals;
  issues: QuoteIssue[];
  serviceability: ServiceabilityResult | null;
  codAvailable: boolean;
  codFee: number;
  placeable: boolean;
}

const STEPS: Array<{ id: Step; label: string; icon: typeof User }> = [
  { id: 1, label: 'Contact', icon: User },
  { id: 2, label: 'Delivery', icon: MapPin },
  { id: 3, label: 'Payment', icon: Wallet },
];

export function CheckoutFlow() {
  const cart = useCart();
  const router = useRouter();
  const { toast } = useUI();

  const [step, setStep] = React.useState<Step>(1);
  const [contact, setContact] = React.useState({ name: '', phone: '', email: '' });
  const [address, setAddress] = React.useState({
    line1: '',
    line2: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [wantsGstInvoice, setWantsGstInvoice] = React.useState(false);
  const [gstin, setGstin] = React.useState('');
  const [payment, setPayment] = React.useState<PaymentChoice>('mock');

  const [quote, setQuote] = React.useState<QuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [placing, setPlacing] = React.useState(false);
  const [pendingOrder, setPendingOrder] = React.useState<string | null>(null);

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
          paymentMethod: payment,
        }),
      })
        .then((r) => r.json())
        .then((data: QuoteResponse) => setQuote(data))
        .catch(() => {
          /* aborted or offline — the previous quote stays on screen */
        })
        .finally(() => setQuoteLoading(false));
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [lines, cart.coupon?.code, address.pincode, payment]);

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

  const goTo = (target: Step) => {
    if (target > step && !validateStep(target)) return;
    setFormError(null);
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* --------------------------------------------------------- placement */

  const placeOrder = async () => {
    if (!validateStep(3)) return;
    if (!quote?.placeable) {
      setFormError('Some items in your cart need attention before you can place this order.');
      return;
    }

    setPlacing(true);
    setFormError(null);

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
          paymentMethod: payment,
        }),
      });

      const data = await response.json();

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

      if (payment === 'cod') {
        cart.clear();
        router.push(`/order/${data.orderNumber}?placed=1`);
        return;
      }

      // Online: the order exists and is awaiting payment.
      setPendingOrder(data.orderNumber);
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
            <ButtonLink href="/c/combos" variant="primary">
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
              Enter the pincode first — we will confirm delivery and whether cash on delivery is
              available.
            </p>

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

            {pendingOrder ? (
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
                    id="mock"
                    checked={payment === 'mock'}
                    onSelect={() => setPayment('mock')}
                    icon={<FlaskConical className="h-5 w-5" />}
                    title="Test payment"
                    description="Simulates a card or UPI payment. No gateway is contacted and no money moves."
                    badge="Test mode"
                  />

                  <PaymentOption
                    id="cod"
                    checked={payment === 'cod'}
                    onSelect={() => setPayment('cod')}
                    disabled={!quote?.codAvailable}
                    icon={<Banknote className="h-5 w-5" />}
                    title="Cash on delivery"
                    description={
                      quote?.codAvailable
                        ? quote.codFee > 0
                          ? `Pay when it arrives. A ${formatPrice(quote.codFee)} handling fee applies.`
                          : 'Pay the delivery agent when your order arrives.'
                        : address.pincode.length === 6
                          ? 'Not available at this pincode.'
                          : 'Enter a delivery pincode to check availability.'
                    }
                  />
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Button onClick={() => goTo(2)} variant="ghost">
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={placeOrder}
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
