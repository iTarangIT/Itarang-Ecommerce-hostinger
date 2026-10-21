/**
 * A policy, as numbered sections of short paragraphs or bullet lists.
 *
 * Shared by the refund, payment-failure and grievance pages so a customer reads
 * every policy in the same shape. Plain data in, plain markup out: no client
 * code, and each section has an `id` so another page can link straight to it.
 */
export interface PolicySection {
  id: string;
  title: string;
  paragraphs?: string[];
  points?: string[];
}

export function PolicySections({
  sections,
  updated,
}: {
  sections: PolicySection[];
  updated: string;
}) {
  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <section
          key={section.id}
          id={section.id}
          className="scroll-mt-28 rounded-lg border border-border bg-card p-5 sm:p-6"
        >
          <h2 className="font-display text-base font-semibold text-foreground">
            <span className="tabular mr-2 text-accent-600">{index + 1}.</span>
            {section.title}
          </h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
          {section.points ? (
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              {section.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      <p className="text-xs text-muted-foreground">Last updated {updated}.</p>
    </div>
  );
}
