import type { CatalogProvider } from './types';
import { MockCatalogProvider } from './mock/mock-provider';
import { HostingerCatalogProvider } from './hostinger/hostinger-provider';
import { env } from '@/lib/env';

/**
 * The single place the application resolves a catalog backend.
 *
 * `COMMERCE_PROVIDER=hostinger` opts into the live, read-only Hostinger Sales
 * Channel catalogue; anything else (including unset) keeps the development
 * catalogue. No page or component imports a provider directly — they all call
 * `catalog()` — so switching backends changes nothing above this line.
 */
let instance: CatalogProvider | null = null;

export function catalog(): CatalogProvider {
  if (!instance) {
    instance =
      env().COMMERCE_PROVIDER === 'hostinger'
        ? new HostingerCatalogProvider()
        : new MockCatalogProvider();
  }
  return instance;
}

/** Which provider is serving this process — used by diagnostics and logging. */
export function activeProviderName(): string {
  return catalog().name;
}

export * from './types';
