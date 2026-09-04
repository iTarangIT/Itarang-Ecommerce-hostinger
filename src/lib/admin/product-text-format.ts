import type { ProductFaq, SpecGroup } from '@/lib/commerce/types';

/**
 * Plain-text encodings for the repeating parts of a product.
 *
 * A specification table is a list of groups of label/value rows, and a browser
 * form has no native control for that. The two usual answers are a client-side
 * repeater — arrays of inputs, add/remove buttons, drag handles, a pile of
 * state — or a textarea with a format. This is the textarea.
 *
 * It is the better trade here for three reasons. The admin console is otherwise
 * entirely server-rendered plain forms (`admin/actions.ts` and every page under
 * `/admin`), and a repeater would be the first island of client state in it.
 * The source material arrives as tables that paste straight into this format.
 * And an editor can reorder forty specification rows by moving lines, which no
 * drag handle makes faster.
 *
 * Every parser here is total: it never throws, it drops what it cannot read,
 * and `format*` round-trips `parse*` so an edit that saves and reloads shows
 * the same text back. `product-text-format.test.ts` holds that to it.
 */

/** One item per line, blanks dropped. Used for highlights, box contents, care. */
export function parseLines(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function formatLines(items: readonly string[]): string {
  return items.join('\n');
}

/**
 * Paragraphs, separated by a blank line.
 *
 * Distinct from `parseLines` because prose wraps: a description typed across
 * three visual lines is one paragraph, and treating each line as its own would
 * shatter it into fragments on the page.
 */
export function parseParagraphs(input: string): string[] {
  return input
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.replace(/\s*\r?\n\s*/g, ' ').trim())
    .filter(Boolean);
}

export function formatParagraphs(paragraphs: readonly string[]): string {
  return paragraphs.join('\n\n');
}

/** `Label | Value` per line. The separator is `|` because no spec value contains one. */
export function parsePairs(input: string): Array<{ label: string; value: string }> {
  return parseLines(input)
    .map((line) => {
      const index = line.indexOf('|');
      if (index === -1) return null;
      const label = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();
      return label && value ? { label, value } : null;
    })
    .filter((pair): pair is { label: string; value: string } => pair !== null);
}

export function formatPairs(pairs: ReadonlyArray<{ label: string; value: string }>): string {
  return pairs.map((pair) => `${pair.label} | ${pair.value}`).join('\n');
}

/**
 * Specification groups.
 *
 *   ## Electrical characteristics
 *   Nominal voltage | 51 V
 *   Nominal capacity | 45 Ah
 *
 *   ## Operation conditions
 *   Max. charge voltage | 57.6 V
 *
 * Rows before the first `##` are ignored rather than filed under an invented
 * group name: a table with no heading is an editing mistake, and guessing a
 * title for it would bury the mistake in the product page.
 */
export function parseSpecGroups(input: string): SpecGroup[] {
  const groups: SpecGroup[] = [];
  let current: SpecGroup | null = null;

  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('##')) {
      const title = trimmed.replace(/^#+/, '').trim();
      if (!title) continue;
      current = { title, specs: [] };
      groups.push(current);
      continue;
    }

    if (!current) continue;

    const index = trimmed.indexOf('|');
    if (index === -1) continue;
    const label = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (label && value) current.specs.push({ label, value });
  }

  return groups.filter((group) => group.specs.length > 0);
}

export function formatSpecGroups(groups: readonly SpecGroup[]): string {
  return groups
    .map((group) => [`## ${group.title}`, formatPairs(group.specs)].join('\n'))
    .join('\n\n');
}

/**
 * FAQs.
 *
 *   Q: Which vehicles is this compatible with?
 *   A: Any 60V-system scooter whose controller accepts …
 *
 * An answer may run to several lines; everything up to the next `Q:` belongs to
 * it. Blank lines inside an answer are preserved as paragraph breaks would be
 * lost otherwise, and the PDP renders an answer as one block anyway.
 */
export function parseFaqs(input: string): ProductFaq[] {
  const faqs: ProductFaq[] = [];
  let question: string | null = null;
  let answer: string[] = [];

  const flush = () => {
    if (question && answer.length > 0) {
      faqs.push({ question, answer: answer.join(' ').replace(/\s+/g, ' ').trim() });
    }
    question = null;
    answer = [];
  };

  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim();
    const questionMatch = /^Q\s*[:.]\s*(.*)$/i.exec(trimmed);
    if (questionMatch) {
      flush();
      question = questionMatch[1]?.trim() ?? '';
      continue;
    }

    const answerMatch = /^A\s*[:.]\s*(.*)$/i.exec(trimmed);
    if (answerMatch) {
      answer = [answerMatch[1]?.trim() ?? ''];
      continue;
    }

    if (question && answer.length > 0 && trimmed) answer.push(trimmed);
  }

  flush();
  return faqs.filter((faq) => faq.question && faq.answer);
}

export function formatFaqs(faqs: readonly ProductFaq[]): string {
  return faqs.map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n');
}

/** `Title | Description` per line, for the applications section. */
export function parseTitledItems(input: string): Array<{ title: string; description: string }> {
  return parsePairs(input).map((pair) => ({ title: pair.label, description: pair.value }));
}

export function formatTitledItems(
  items: ReadonlyArray<{ title: string; description: string }>,
): string {
  return items.map((item) => `${item.title} | ${item.description}`).join('\n');
}

/** `Load | Draw | Run time` per line, for the runtime table. */
export function parseScenarios(
  input: string,
): Array<{ load: string; draw: string; runtime: string }> {
  return parseLines(input)
    .map((line) => {
      const parts = line.split('|').map((part) => part.trim());
      const [load, draw, runtime] = parts;
      return load && draw && runtime ? { load, draw, runtime } : null;
    })
    .filter((row): row is { load: string; draw: string; runtime: string } => row !== null);
}

export function formatScenarios(
  scenarios: ReadonlyArray<{ load: string; draw: string; runtime: string }>,
): string {
  return scenarios
    .map((row) => `${row.load} | ${row.draw} | ${row.runtime}`)
    .join('\n');
}
