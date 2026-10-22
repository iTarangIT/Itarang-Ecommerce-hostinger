import Link from 'next/link';
import { AlertTriangle, Info, Lightbulb } from 'lucide-react';
import { headingIds, type Block, type RichText } from '@/lib/blog';
import { cn } from '@/lib/utils';

/** Inline runs as JSX. Links are internal paths, so they use `next/link`. */
export function RichTextView({ text }: { text: RichText }) {
  if (typeof text === 'string') return <>{text}</>;
  return (
    <>
      {text.map((run, index) => {
        if (typeof run === 'string') return <span key={index}>{run}</span>;
        if ('strong' in run) return <strong key={index}>{run.strong}</strong>;
        return (
          <Link
            key={index}
            href={run.href}
            className="font-medium text-primary underline underline-offset-4 hover:text-primary-600"
          >
            {run.text}
          </Link>
        );
      })}
    </>
  );
}

const CALLOUT_STYLES = {
  info: { icon: Info, box: 'border-primary/25 bg-secondary', iconClass: 'text-primary-600' },
  tip: { icon: Lightbulb, box: 'border-accent/30 bg-accent-50', iconClass: 'text-accent-600' },
  warning: {
    icon: AlertTriangle,
    box: 'border-warning/40 bg-warning-soft',
    iconClass: 'text-warning',
  },
} as const;

function BlockView({ block, id }: { block: Block; id?: string }) {
  switch (block.type) {
    case 'heading':
      return block.level === 2 ? (
        <h2
          id={id}
          className="mt-10 scroll-mt-28 font-display text-xl font-bold leading-snug text-foreground first:mt-0 sm:text-2xl"
        >
          {block.text}
        </h2>
      ) : (
        <h3
          id={id}
          className="mt-6 scroll-mt-28 font-display text-base font-semibold text-foreground sm:text-lg"
        >
          {block.text}
        </h3>
      );

    case 'paragraph':
      return (
        <p className="mt-4">
          <RichTextView text={block.text} />
        </p>
      );

    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag
          className={cn(
            'mt-4 space-y-2 pl-5 marker:text-accent-600',
            block.ordered ? 'list-decimal' : 'list-disc',
          )}
        >
          {block.items.map((item, index) => (
            <li key={index} className="pl-1">
              <RichTextView text={item} />
            </li>
          ))}
        </Tag>
      );
    }

    case 'callout': {
      const style = CALLOUT_STYLES[block.tone];
      const Icon = style.icon;
      return (
        <aside className={cn('mt-6 flex gap-3 rounded-lg border p-4', style.box)}>
          <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.iconClass)} aria-hidden="true" />
          <div className="min-w-0">
            {block.title ? (
              <p className="font-display text-sm font-semibold text-foreground">{block.title}</p>
            ) : null}
            <p className={cn('text-foreground/85', block.title && 'mt-1')}>
              <RichTextView text={block.text} />
            </p>
          </div>
        </aside>
      );
    }

    case 'table':
      return (
        <div className="relative mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
            {block.caption ? (
              <caption className="border-b border-border bg-surface px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                {block.caption}
              </caption>
            ) : null}
            <thead className="bg-surface">
              <tr>
                {block.columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="border-b border-border px-4 py-2.5 font-semibold text-foreground"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border last:border-b-0">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="tabular px-4 py-2.5 text-foreground/85">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/** Renders a post body. Plain JSX only — no HTML strings, no parser. */
export function ArticleBody({ body }: { body: Block[] }) {
  const ids = headingIds(body);
  return (
    <div className="rich-text text-[0.95rem] sm:text-base [&>*:first-child]:mt-0">
      {body.map((block, index) => (
        <BlockView key={index} block={block} id={ids.get(index)} />
      ))}
    </div>
  );
}
