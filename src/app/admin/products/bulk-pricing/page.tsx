import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BulkPricingForm } from '@/components/admin/bulk-pricing-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Bulk pricing',
  robots: { index: false, follow: false },
};

/**
 * Bulk MRP and selling-price update.
 *
 * The console can already edit one product's prices at a time, which is the
 * wrong shape for a price list from a manufacturer. This page takes a
 * spreadsheet keyed on SKU and changes those two columns and nothing else.
 *
 * Authorization comes from `admin/layout.tsx`, and again inside the action
 * itself — a Server Action is its own POST endpoint and the layout does not
 * protect it.
 */
export default function BulkPricingPage() {
  return (
    <div className="container py-8">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Products
      </Link>

      <div className="mt-4">
        <h1 className="heading-2">Bulk pricing</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Update MRP, selling price, cost price, stock and availability for many products at once
          from an Excel sheet. SKU is the identifier — each row changes only the product with that
          SKU.
        </p>
      </div>

      <BulkPricingForm />
    </div>
  );
}
