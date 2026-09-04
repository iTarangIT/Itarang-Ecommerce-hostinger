'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ClipboardCheck,
  Heart,
  Info,
  MapPin,
  Package,
  ShieldCheck,
  Star,
  User,
  UserCog,
} from 'lucide-react';
import type { ProductSummary } from '@/lib/commerce/summary';
import { useForgetWishlist, useWishlist } from '@/lib/store/hooks';
import { logoutAction, logoutEverywhereAction } from '@/lib/auth/actions';
import type { CustomerAddress } from '@/lib/account/addresses';
import { ResendVerification } from './resend-verification';
import { AddressList } from './address-list';
import { ProfileForm } from './profile-form';
import { Button, ButtonLink } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/states';
import { ProductCard } from '@/components/product/product-card';
import { ProductGridSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { categoryPath } from '@/lib/routes';

type TabId =
  | 'overview'
  | 'profile'
  | 'orders'
  | 'wishlist'
  | 'addresses'
  | 'warranties'
  | 'reviews';

const TABS: Array<{ id: TabId; label: string; icon: typeof User }> = [
  { id: 'overview', label: 'Overview', icon: User },
  // The four sections Stage 2C is about, in the order a customer needs them.
  { id: 'profile', label: 'Profile', icon: UserCog },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'wishlist', label: 'Saved products', icon: Heart },
  { id: 'addresses', label: 'Addresses', icon: MapPin },
  { id: 'warranties', label: 'Warranties', icon: ShieldCheck },
  { id: 'reviews', label: 'Your reviews', icon: Star },
];

/**
 * Account area.
 *
 * Overview, orders and saved products are real. Saved products live in local
 * storage and work signed out; order history comes from the server, filtered to
 * this account. Addresses, warranties and reviews are empty because the records
 * they would show are created by an order, and ordering is not open.
 *
 * The copy on those three panels used to say "once accounts are live" and
 * "until accounts go live". Accounts *are* live — a signed-in customer was
 * being told they needed an account while looking at their own order history.
 * What is actually missing is checkout, so that is what the panels now say.
 */

/** The serialisable slice of the session this component needs. */
export interface AccountUser {
  email: string;
  fullName: string | null;
  phone: string | null;
  verified: boolean;
}

/** One row of order history, already reduced to what the list renders. */
export interface AccountOrder {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  itemCount: number;
  placedAt: string;
}

export function AccountBody({
  suggestions,
  user,
  orders,
  addresses,
}: {
  suggestions: ProductSummary[];
  user: AccountUser | null;
  orders: AccountOrder[];
  /** Already scoped to this account by the page, which reads them with the session id. */
  addresses: CustomerAddress[];
}) {
  const searchParams = useSearchParams();
  const requested = searchParams.get('tab') as TabId | null;
  const [tab, setTab] = React.useState<TabId>(
    requested && TABS.some((t) => t.id === requested) ? requested : 'overview',
  );

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <nav aria-label="Account sections" className="lg:col-span-3">
        <ul className="flex gap-1 overflow-x-auto pb-1 no-scrollbar lg:flex-col lg:overflow-visible">
          {TABS.map((entry) => {
            const active = tab === entry.id;
            return (
              <li key={entry.id} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  onClick={() => setTab(entry.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-3.5 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  <entry.icon className="h-4.5 w-4.5 shrink-0" />
                  {entry.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="lg:col-span-9">
        {tab === 'overview' ? <Overview onOpen={setTab} user={user} /> : null}
        {tab === 'wishlist' ? (
          <Wishlist suggestions={suggestions} signedIn={Boolean(user)} />
        ) : null}
        {tab === 'profile' ? <Profile user={user} /> : null}
        {tab === 'orders' ? <OrderHistory orders={orders} signedIn={Boolean(user)} /> : null}
        {tab === 'addresses' ? (
          user ? (
            <AddressList addresses={addresses} />
          ) : (
            <AccountPlaceholder
              icon={<MapPin className="h-6 w-6" />}
              title="Sign in to save an address"
              description="Your address book is kept with your account, so there is nothing to show until you sign in."
              action={{ label: 'Sign in', href: '/login?next=%2Faccount' }}
            />
          )
        ) : null}
        {tab === 'warranties' ? (
          <AccountPlaceholder
            icon={<ShieldCheck className="h-6 w-6" />}
            title="No registered warranties yet"
            description="A warranty is recorded against an order, and ordering is not open yet, so there is nothing here to record. If a product you already own is faulty, raise a complaint and you will get a reference number to follow up on."
            action={{ label: 'Register a complaint', href: '/support/complaint' }}
          />
        ) : null}
        {tab === 'reviews' ? (
          <AccountPlaceholder
            icon={<Star className="h-6 w-6" />}
            title="No reviews yet"
            description="We only accept a review that is attached to a delivered order, so nobody can post about a product they have not bought. Ordering is not open yet, so there is nothing to review from here."
          />
        ) : null}
      </div>
    </div>
  );
}

function OrderHistory({ orders, signedIn }: { orders: AccountOrder[]; signedIn: boolean }) {
  if (!signedIn) {
    return (
      <AccountPlaceholder
        icon={<Package className="h-6 w-6" />}
        title="Sign in to see your orders"
        description="Your order history, invoices and returns live in your account. Orders placed as a guest before you signed up stay reachable with the order number and the mobile number on them."
        action={{ label: 'Sign in', href: '/login?next=%2Faccount' }}
      />
    );
  }

  if (orders.length === 0) {
    return (
      <AccountPlaceholder
        icon={<Package className="h-6 w-6" />}
        title="No orders yet"
        description="When you place an order it will appear here with its status and invoice."
        action={{ label: 'Start shopping', href: '/' }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <Link
          key={order.orderNumber}
          href={`/order/${order.orderNumber}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
        >
          <div className="min-w-0">
            <p className="tabular font-medium">{order.orderNumber}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(order.placedAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              {' · '}
              {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="text-right">
            <p className="tabular font-semibold">
              ₹{(order.total / 100).toLocaleString('en-IN')}
            </p>
            <p className="mt-0.5 text-xs capitalize text-muted-foreground">
              {order.status.replace(/_/g, ' ')}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

/**
 * Name and mobile number.
 *
 * Both are optional on an account created by an email code — there was no
 * signup form to collect them — so this is where a customer fills them in, and
 * where the number that reaches a delivery driver is kept current.
 *
 * The email is shown and not editable. It is the sign-in identifier, so
 * changing it is changing a credential: the new address has to be proved before
 * the old one stops working, or a typo locks the account out. That belongs in
 * its own flow, and this section says so rather than leaving a disabled field
 * to be puzzled over.
 */
function Profile({ user }: { user: AccountUser | null }) {
  if (!user) {
    return (
      <AccountPlaceholder
        icon={<UserCog className="h-6 w-6" />}
        title="Sign in to see your details"
        description="Your name, email and mobile number are kept with your account."
        action={{ label: 'Sign in', href: '/login?next=%2Faccount' }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="heading-3">Your details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Used on deliveries and to reach you about an order.
        </p>
        <div className="mt-5 max-w-md">
          <ProfileForm
            email={user.email}
            fullName={user.fullName}
            phone={user.phone}
            verified={user.verified}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="heading-4">How you sign in</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          We email a 6-digit code to <span className="font-medium text-foreground">{user.email}</span>{' '}
          each time you sign in. There is no password to remember or to lose.
        </p>
      </div>
    </div>
  );
}

function Overview({
  onOpen,
  user,
}: {
  onOpen: (tab: TabId) => void;
  user: AccountUser | null;
}) {
  const wishlist = useWishlist();
  const forgetWishlist = useForgetWishlist();

  return (
    <div className="space-y-6">
      {user ? (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="heading-3">{user.fullName ?? 'Your account'}</h2>
          <dl className="mt-2 space-y-0.5 text-sm text-muted-foreground">
            <div className="flex flex-wrap gap-x-1.5">
              <dt className="sr-only">Email</dt>
              <dd>Signed in as {user.email}</dd>
            </div>
            {/* Shown only when it is set. An empty line labelled "Phone" tells
                a customer nothing and invites them to look for an edit control
                that does not exist yet. */}
            {user.phone ? (
              <div className="flex flex-wrap gap-x-1.5">
                <dt className="sr-only">Phone</dt>
                <dd className="tabular">{user.phone}</dd>
              </div>
            ) : null}
          </dl>
          {user.verified ? null : (
            <div className="mt-3 rounded-lg border border-border bg-surface p-3">
              <p className="text-sm text-muted-foreground">
                Your email is not confirmed yet. We sent a link when you signed up — you can keep
                shopping without it, and confirming just means we can reach you about an order.
              </p>
              <ResendVerification />
            </div>
          )}
          {/*
            No "Change password" here any more.

            Customers sign in with a one-time code and have no password to
            change: an account created that way holds an unusable sentinel hash
            that verifies against nothing, so `/change-password` — which asks
            for the current password first — could never be completed from this
            page. Offering it was offering a dead end.

            The route, the form and `changePasswordAction` are all untouched and
            still work for the accounts that do have a password. Administrators
            reach it directly, and `admin/layout.tsx` still redirects a
            bootstrapped admin to `/change-password?forced=1`.
          */}
          <div className="mt-5 flex flex-wrap gap-2">
            <ButtonLink href="/track" variant="primary">
              Track an order
            </ButtonLink>
            {/* `onSubmit`, not `onClick`: it fires for a keyboard submit too,
                and before the action runs — so the local copy is gone whether
                or not the navigation that follows completes. */}
            <form action={logoutAction} onSubmit={forgetWishlist}>
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          </div>
          <form action={logoutEverywhereAction} className="mt-3" onSubmit={forgetWishlist}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out of every browser
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              Use this if you have signed in on a shared or borrowed device. Ordinary sign-out only
              ends the session in this browser.
            </p>
          </form>
        </div>
      ) : null}

      {/* Editing lives on the Profile tab. The card above is a summary, and
          two places to change the same name is one too many. */}

      {!user ? (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="heading-3">Not signed in</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Sign in to keep your order history in one place and to track an order without typing
            its number. Your saved products are already kept in this browser.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <ButtonLink href="/login" variant="primary">
              Sign in
            </ButtonLink>
            <ButtonLink href="/register" variant="outline">
              Create an account
            </ButtonLink>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="heading-3">Without an account</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          You can still follow an order with its order number and the mobile number on it.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink href="/track" variant="primary">
            Track an order
          </ButtonLink>
          <ButtonLink href="/support" variant="outline">
            Contact support
          </ButtonLink>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onOpen('wishlist')}
          className="rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-accent/40"
        >
          <Heart className="h-5 w-5 text-accent-600" />
          <p className="mt-3 font-display text-sm font-semibold text-foreground">Saved products</p>
          <p className="tabular mt-1 text-2xl font-bold text-foreground">{wishlist.ids.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Kept on this device</p>
        </button>

        {/* Warranty registration has been withdrawn from the after-sales
            navigation; its route is untouched. */}
        <Link
          href="/support/complaint"
          className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-accent/40"
        >
          <ClipboardCheck className="h-5 w-5 text-accent-600" />
          <p className="mt-3 font-display text-sm font-semibold text-foreground">
            Register a complaint
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Takes a minute and does not need an account.
          </p>
        </Link>
      </div>
    </div>
  );
}

function Wishlist({ suggestions, signedIn }: { suggestions: ProductSummary[]; signedIn: boolean }) {
  const wishlist = useWishlist();
  const [products, setProducts] = React.useState<ProductSummary[] | null>(null);

  const ids = wishlist.ids.join(',');

  React.useEffect(() => {
    if (!ids) {
      setProducts([]);
      return;
    }
    setProducts(null);
    const controller = new AbortController();
    // Encoded. A product id is an opaque catalogue key, and one containing a
    // `&`, `#` or `+` would previously have been cut short or altered by the
    // query string it was pasted into — losing a saved product with no error.
    fetch(`/api/products?ids=${encodeURIComponent(ids)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: { products: ProductSummary[] }) => setProducts(data.products))
      .catch(() => setProducts([]));
    return () => controller.abort();
  }, [ids]);

  if (products === null) return <ProductGridSkeleton count={4} />;

  if (products.length === 0) {
    return (
      <div className="space-y-8">
        <StateBlock
          icon={<Heart className="h-6 w-6" />}
          title="Nothing saved yet"
          description={
            signedIn
              ? 'Tap the heart on any product to keep it here while you decide. Saved products are kept with your account, so they follow you to another device.'
              : 'Tap the heart on any product to keep it here while you decide. Saved products are kept in this browser for now, and move to your account when you sign in.'
          }
          actions={
            <>
              <ButtonLink href={categoryPath('combos')} variant="primary">
                Browse combos
              </ButtonLink>
              <ButtonLink href="/search" variant="outline">
                Browse everything
              </ButtonLink>
            </>
          }
        />
        <section>
          <h2 className="heading-3">Popular right now</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {suggestions.slice(0, 3).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      </div>
    );
  }

  /*
   * Some saved ids may not have come back.
   *
   * A product can be unpublished, withdrawn, or have been saved while a
   * different `COMMERCE_PROVIDER` was active — the catalogue simply does not
   * know it any more. The row is deliberately left alone rather than deleted:
   * an unpublished product often comes back, and quietly removing things from
   * somebody's list on our own initiative is worse than a count that does not
   * match the grid. So the difference is stated instead of hidden.
   */
  const unavailable = wishlist.ids.length - products.length;

  return (
    <section>
      <h2 className="heading-3">
        Saved products <span className="tabular text-muted-foreground">({products.length})</span>
      </h2>
      {signedIn ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Saved to your account, so they follow you to another device.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Kept in this browser. Sign in and they move to your account.
        </p>
      )}
      {unavailable > 0 ? (
        <p className="mt-3 rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
          {unavailable === 1
            ? 'One saved product is not available right now. It stays on your list in case it returns.'
            : `${unavailable} saved products are not available right now. They stay on your list in case they return.`}
        </p>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

function AccountPlaceholder({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="space-y-4">
      <StateBlock
        icon={icon}
        title={title}
        description={description}
        actions={
          action ? (
            <ButtonLink href={action.href} variant="primary">
              {action.label}
            </ButtonLink>
          ) : undefined
        }
      />
      <p className="flex items-start gap-2 rounded-lg border border-border bg-surface p-4 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Nothing on this panel is invented. Every record it would show is created by an order, and
        ordering is not open yet — so it stays empty rather than filling with sample data.
      </p>
    </div>
  );
}
