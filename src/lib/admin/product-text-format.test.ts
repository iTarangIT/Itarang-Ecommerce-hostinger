import { describe, expect, it } from 'vitest';
import {
  formatFaqs,
  formatLines,
  formatPairs,
  formatParagraphs,
  formatScenarios,
  formatSpecGroups,
  formatTitledItems,
  parseFaqs,
  parseLines,
  parsePairs,
  parseParagraphs,
  parseScenarios,
  parseSpecGroups,
  parseTitledItems,
} from './product-text-format';

describe('parseLines', () => {
  it('drops blank and whitespace-only lines', () => {
    expect(parseLines('a\n\n  \nb\n')).toEqual(['a', 'b']);
  });

  it('round-trips', () => {
    const items = ['Intelligent BMS', '2000 cycles at 0.5C'];
    expect(parseLines(formatLines(items))).toEqual(items);
  });
});

describe('parseParagraphs', () => {
  it('joins wrapped lines into one paragraph', () => {
    expect(parseParagraphs('one line\nwrapped here\n\nsecond')).toEqual([
      'one line wrapped here',
      'second',
    ]);
  });

  it('round-trips', () => {
    const paragraphs = ['First paragraph.', 'Second paragraph.'];
    expect(parseParagraphs(formatParagraphs(paragraphs))).toEqual(paragraphs);
  });
});

describe('parsePairs', () => {
  it('splits on the first pipe only, so a value may contain one', () => {
    expect(parsePairs('Charge method | CC | CV')).toEqual([
      { label: 'Charge method', value: 'CC | CV' },
    ]);
  });

  it('drops a line with no separator rather than guessing a label', () => {
    expect(parsePairs('Nominal voltage 51 V')).toEqual([]);
  });

  it('drops a line whose label or value is empty', () => {
    expect(parsePairs(' | 51 V\nNominal voltage | ')).toEqual([]);
  });

  it('round-trips', () => {
    const pairs = [{ label: 'Nominal voltage', value: '51 V' }];
    expect(parsePairs(formatPairs(pairs))).toEqual(pairs);
  });
});

describe('parseSpecGroups', () => {
  const source = [
    '## Electrical characteristics',
    'Nominal voltage | 51 V',
    'Nominal capacity | 45 Ah',
    '',
    '## Operation conditions',
    'Max. charge voltage | 57.6 V',
  ].join('\n');

  it('reads groups and their rows in order', () => {
    expect(parseSpecGroups(source)).toEqual([
      {
        title: 'Electrical characteristics',
        specs: [
          { label: 'Nominal voltage', value: '51 V' },
          { label: 'Nominal capacity', value: '45 Ah' },
        ],
      },
      {
        title: 'Operation conditions',
        specs: [{ label: 'Max. charge voltage', value: '57.6 V' }],
      },
    ]);
  });

  it('ignores rows before the first heading rather than inventing a group name', () => {
    expect(parseSpecGroups('Orphan | row\n## Real\nLabel | Value')).toEqual([
      { title: 'Real', specs: [{ label: 'Label', value: 'Value' }] },
    ]);
  });

  it('drops a heading with no rows under it', () => {
    expect(parseSpecGroups('## Empty\n\n## Full\nLabel | Value')).toEqual([
      { title: 'Full', specs: [{ label: 'Label', value: 'Value' }] },
    ]);
  });

  it('round-trips', () => {
    expect(formatSpecGroups(parseSpecGroups(source))).toBe(source);
  });
});

describe('parseFaqs', () => {
  it('reads question and answer pairs', () => {
    expect(parseFaqs('Q: Is it safe?\nA: Yes.\n\nQ: How long?\nA: Five years.')).toEqual([
      { question: 'Is it safe?', answer: 'Yes.' },
      { question: 'How long?', answer: 'Five years.' },
    ]);
  });

  it('continues an answer across wrapped lines', () => {
    expect(parseFaqs('Q: Why?\nA: Because it is\nwrapped over two lines.')).toEqual([
      { question: 'Why?', answer: 'Because it is wrapped over two lines.' },
    ]);
  });

  it('drops a question with no answer', () => {
    expect(parseFaqs('Q: Unanswered?\n\nQ: Answered?\nA: Yes.')).toEqual([
      { question: 'Answered?', answer: 'Yes.' },
    ]);
  });

  it('round-trips', () => {
    const faqs = [{ question: 'Is it safe?', answer: 'Yes.' }];
    expect(parseFaqs(formatFaqs(faqs))).toEqual(faqs);
  });
});

describe('parseTitledItems', () => {
  it('round-trips', () => {
    const items = [{ title: 'Home backup', description: 'Runs fans and lights.' }];
    expect(parseTitledItems(formatTitledItems(items))).toEqual(items);
  });
});

describe('parseScenarios', () => {
  it('requires all three columns', () => {
    expect(parseScenarios('Fans and lights | 300 W | 4 hours\nIncomplete | 100 W')).toEqual([
      { load: 'Fans and lights', draw: '300 W', runtime: '4 hours' },
    ]);
  });

  it('round-trips', () => {
    const scenarios = [{ load: 'Fans', draw: '300 W', runtime: '4 hours' }];
    expect(parseScenarios(formatScenarios(scenarios))).toEqual(scenarios);
  });
});
