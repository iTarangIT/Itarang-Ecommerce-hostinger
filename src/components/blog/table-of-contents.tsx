import type { TocEntry } from '@/lib/blog';
import { cn } from '@/lib/utils';

/** In-page contents built from the article's headings. Plain anchors; no JS. */
export function TableOfContents({ entries, className }: { entries: TocEntry[]; className?: string }) {
  if (entries.length === 0) return null;
  return (
    <nav aria-label="On this page" className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        On this page
      </h2>
      <ol className="mt-3 space-y-1.5 text-sm">
        {entries.map((entry) => (
          <li key={entry.id} className={entry.level === 3 ? 'pl-4' : undefined}>
            <a
              href={`#${entry.id}`}
              className="block rounded px-1 py-0.5 leading-snug text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
