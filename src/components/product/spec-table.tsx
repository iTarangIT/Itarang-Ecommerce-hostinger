import type { SpecGroup } from '@/lib/commerce/types';

export function SpecTable({ groups }: { groups: SpecGroup[] }) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.title}>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-accent-600">
            {group.title}
          </h3>
          <dl className="mt-3 overflow-hidden rounded-lg border border-border">
            {group.specs.map((spec, index) => (
              <div
                key={spec.label}
                className={`flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-6 ${
                  index % 2 === 0 ? 'bg-card' : 'bg-surface'
                }`}
              >
                <dt className="text-sm text-muted-foreground sm:w-56 sm:shrink-0">{spec.label}</dt>
                <dd className="text-sm font-medium text-foreground">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
