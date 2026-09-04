import type { CatalogProvider } from './types';
import { MockCatalogProvider } from './mock/mock-provider';
import { HostingerCatalogProvider } from './hostinger/hostinger-provider';
import { DbCatalogProvider } from './db/db-provider';
import { env } from '@/lib/env';

/**
 * The single place the application resolves a catalog backend.
 *
 * `COMMERCE_PROVIDER=db` serves the catalogue we own — our database, our admin
 * panel, our ids. `hostinger` opts into the live, read-only Hostinger Sales
 * Channel catalogue. Anything else (including unset) keeps the development
 * catalogue. No page or component imports a provider directly — they all call
 * `catalog()` — so switching backends changes nothing above this line.
 */
let instance: CatalogProvider | null = null;

export function catalog(): CatalogProvider {
  if (!instance) {
    switch (env().COMMERCE_PROVIDER) {
      case 'db':
        instance = new DbCatalogProvider();
        break;
      case 'hostinger':
        instance = new HostingerCatalogProvider();
        break;
      default:
        instance = new MockCatalogProvider();
    }
  }
  return instance;
}

/**
 * Drop the active provider's cached catalogue snapshot.
 *
 * Called after every admin product write. It is a no-op on a provider that has
 * nothing cached, and deliberately does not reach across processes — the
 * provider's own TTL covers the others.
 */
export function invalidateCatalogSnapshot(): void {
  const provider = catalog() as CatalogProvider & { invalidate?: () => void };
  provider.invalidate?.();
}

/** Which provider is serving this process — used by diagnostics and logging. */
export function activeProviderName(): string {
  return catalog().name;
}

export * from './types';
