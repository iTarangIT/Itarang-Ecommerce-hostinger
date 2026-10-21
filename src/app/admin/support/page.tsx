import type { Metadata } from 'next';
import { updateSupportRequestAction } from '@/lib/admin/service-actions';
import { listSupportRequests, type SupportRequestStatus } from '@/lib/support/requests';
import { KIND_LABEL, SUPPORT_FORMS, type SupportRequestKind } from '@/lib/support/request-forms';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Notice, ServiceNav } from '@/components/admin/service-nav';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Support requests',
  robots: { index: false, follow: false },
};

const STATUSES: SupportRequestStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
const KINDS: SupportRequestKind[] = ['complaint', 'warranty', 'installation'];

const STATUS_TONE: Record<SupportRequestStatus, string> = {
  open: 'bg-warning-soft text-warning',
  in_progress: 'bg-accent-50 text-accent-600',
  resolved: 'bg-success-soft text-success',
  closed: 'bg-secondary text-secondary-foreground',
};

/** Field labels for the `details` keys, from the forms that produced them. */
const LABELS = new Map(
  Object.values(SUPPORT_FORMS)
    .flat()
    .map((field) => [field.name, field.label]),
);

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kind?: string; notice?: string }>;
}) {
  const search = await searchParams;
  const status = STATUSES.find((s) => s === search.status);
  const kind = KINDS.find((k) => k === search.kind);
  const requests = await listSupportRequests({ status, kind });

  const filterHref = (next: { status?: string; kind?: string }) => {
    const params = new URLSearchParams();
    const s = 'status' in next ? next.status : status;
    const k = 'kind' in next ? next.kind : kind;
    if (s) params.set('status', s);
    if (k) params.set('kind', k);
    const q = params.toString();
    return `/admin/support${q ? `?${q}` : ''}`;
  };

  return (
    <div className="container py-8">
      <ServiceNav
        current="/admin/support"
        title="Support requests"
        description="Complaints, warranty registrations and installation bookings from the support pages. Each customer received the reference shown here."
      />
      <Notice text={search.notice} />

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">Status:</span>
          {[undefined, ...STATUSES].map((s) => (
            <a
              key={s ?? 'all'}
              href={filterHref({ status: s })}
              className={cn(
                'rounded-md border px-2.5 py-1',
                s === status ? 'border-primary bg-primary/10 font-medium' : 'border-border',
              )}
            >
              {s ? s.replace('_', ' ') : 'All'}
            </a>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">Type:</span>
          {[undefined, ...KINDS].map((k) => (
            <a
              key={k ?? 'all'}
              href={filterHref({ kind: k })}
              className={cn(
                'rounded-md border px-2.5 py-1',
                k === kind ? 'border-primary bg-primary/10 font-medium' : 'border-border',
              )}
            >
              {k ? KIND_LABEL[k] : 'All'}
            </a>
          ))}
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="mt-8 rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground">
          No requests match these filters.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {requests.map((request) => (
            <li key={request.id} className="rounded-lg border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular font-display text-base font-semibold">{request.reference}</span>
                <span className="rounded-sm bg-secondary px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide">
                  {KIND_LABEL[request.kind]}
                </span>
                <span
                  className={cn(
                    'rounded-sm px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide',
                    STATUS_TONE[request.status],
                  )}
                >
                  {request.status.replace('_', ' ')}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">{formatDate(request.createdAt)}</span>
              </div>

              <div className="mt-3 grid gap-4 lg:grid-cols-12">
                <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:col-span-8">
                  <Detail label="Name" value={request.name} />
                  <Detail label="Phone" value={request.phone} href={`tel:+91${request.phone}`} />
                  {request.email ? (
                    <Detail label="Email" value={request.email} href={`mailto:${request.email}`} />
                  ) : null}
                  {request.pincode ? <Detail label="Pincode" value={request.pincode} /> : null}
                  {Object.entries(request.details).map(([key, value]) => (
                    <Detail key={key} label={LABELS.get(key) ?? key} value={value} wide={value.length > 60} />
                  ))}
                </dl>

                <form action={updateSupportRequestAction} className="space-y-2 lg:col-span-4">
                  <input type="hidden" name="id" value={request.id} />
                  <select
                    name="status"
                    defaultValue={request.status}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                  <textarea
                    name="adminNote"
                    defaultValue={request.adminNote ?? ''}
                    rows={2}
                    placeholder="Internal note (not sent to the customer)"
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  />
                  <Button type="submit" size="sm" variant="outline" fullWidth>
                    Update
                  </Button>
                  {request.updatedBy ? (
                    <p className="text-xs text-muted-foreground">
                      Last updated by {request.updatedBy}, {formatDate(request.updatedAt)}
                    </p>
                  ) : null}
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  href,
  wide,
}: {
  label: string;
  value: string;
  href?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-line text-foreground">
        {href ? (
          <a href={href} className="text-primary hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
