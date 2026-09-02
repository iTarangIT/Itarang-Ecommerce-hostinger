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
} from 'lucide-react';
import type { ProductSummary } from '@/lib/commerce/summary';
import { useWishlist } from '@/lib/store/hooks';
import { logoutAction } from '@/lib/auth/actions';
import { Button, ButtonLink } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/states';
import { ProductCard } from '@/components/product/product-card';
import { ProductGridSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type TabId = 'overview' | 'orders' | 'wishlist' | 'addresses' | 'warranties' | 'reviews';

const TABS: Array<{ id: TabId; label: string; icon: typeof User }> = [
  { id: 'overview', label: 'Overview', icon: User },
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
 * this account. Addresses, warranties and reviews are still honest placeholders
 * rather than invented data.
 */

/** The serialisable slice of the session this component needs. */
export interface AccountUser {
  email: string;
  fullName: string | null;
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
}: {
  suggestions: ProductSummary[];
  user: AccountUser | null;
  orders: AccountOrder[];
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
        {tab === 'wishlist' ? <Wishlist suggestions={suggestions} /> : null}
        {tab === 'orders' ? <OrderHistory orders={orders} signedIn={Boolean(user)} /> : null}
        {tab === 'addresses' ? (
          <AccountPlaceholder
            icon={<MapPin className="h-6 w-6" />}
            title="Saved addresses need an account"
            description="Once accounts are live you can keep home, office and site addresses here and pick one at checkout instead of typing it each time."
          />
        ) : null}
        {tab === 'warranties' ? (
          <AccountPlaceholder
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Your registered warranties will appear here"
            description="Once accounts are live, the warranty on every product you buy will be recorded here automatically. If something is faulty in the meantime, raise a complaint and you will get a reference number to follow up on."
            action={{ label: 'Register a complaint', href: '/support/complaint' }}
          />
        ) : null}
        {tab === 'reviews' ? (
          <AccountPlaceholder
            icon={<Star className="h-6 w-6" />}
            title="Reviews are open to verified buyers"
            description="Once an order is delivered you will be able to review the product from here. We do not accept reviews that are not attached to an order."
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

function Overview({
  onOpen,
  user,
}: {
  onOpen: (tab: TabId) => void;
  user: AccountUser | null;
}) {
  const wishlist = useWishlist();

  return (
    <div className="space-y-6">
      {user ? (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="heading-3">{user.fullName ?? 'Your account'}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {user.email}
            {user.verified ? null : ' — email not confirmed yet'}
          </p>
          {user.verified ? null : (
            <p className="mt-3 rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
              We sent a confirmation link when you signed up. You can keep shopping without it —
              confirming just means we can reach you about an order.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <ButtonLink href="/track" variant="primary">
              Track an order
            </ButtonLink>
            <form action={logoutAction}>
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="heading-3">Not signed in</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Sign in to keep your order history, addresses and warranty registrations in one place.
            Your saved products are already kept on this device.
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
      )}

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

function Wishlist({ suggestions }: { suggestions: ProductSummary[] }) {
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
    fetch(`/api/products?ids=${ids}`, { signal: controller.signal })
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
          description="Tap the heart on any product to keep it here while you decide. Saved products stay on this device until accounts go live."
          actions={
            <>
              <ButtonLink href="/c/combos" variant="primary">
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

  return (
    <section>
      <h2 className="heading-3">
        Saved products <span className="tabular text-muted-foreground">({products.length})</span>
      </h2>
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
        This is the front-end build. Nothing on this panel is fabricated — the data simply does not
        exist until accounts and orders are connected.
      </p>
    </div>
  );
}
