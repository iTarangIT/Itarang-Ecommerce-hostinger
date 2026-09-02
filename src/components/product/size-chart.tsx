import type { SizeChart as SizeChartData } from '@/lib/commerce/types';

/**
 * The catalogue's includes/measurement table.
 *
 * The first column is merged down each group, so a size that ships three
 * parts names itself once rather than three times — the shape a shopper is
 * used to reading on a size chart. Columns vary by category, so nothing here
 * assumes what they mean beyond "the first one heads the group".
 *
 * Scrolls horizontally rather than wrapping: a measurement broken across two
 * lines is harder to read than one that moves.
 */
export function SizeChart({ chart }: { chart: SizeChartData }) {
  if (chart.groups.length === 0) return null;

  return (
    <section aria-labelledby="size-chart-heading">
      <h2 id="size-chart-heading" className="heading-3">
        {chart.title}
      </h2>
      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-surface">
              {chart.columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.groups.map((group) =>
              group.rows.map((row, rowIndex) => (
                <tr key={`${group.label}-${rowIndex}`} className="bg-card">
                  {rowIndex === 0 ? (
                    <th
                      scope="rowgroup"
                      rowSpan={group.rows.length}
                      className="border-b border-r border-border bg-surface/50 px-4 py-3 align-middle font-semibold text-foreground"
                    >
                      {group.label}
                    </th>
                  ) : null}
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="border-b border-border px-4 py-3 text-muted-foreground"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
