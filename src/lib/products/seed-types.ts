import type {
  BadgeKind,
  CategorySlug,
  ProductArtKind,
  ProductFacetValues,
  ProductFaq,
  ProductSection,
  SpecGroup,
} from '@/lib/commerce/types';
import type { ProductMediaRole, VariantInput } from './types';

/**
 * One product, as transcribed from its source document.
 *
 * The importer takes these and upserts them; nothing here is derived at import
 * time from a `.docx`. That is deliberate. Parsing the Word files on every run
 * would make the catalogue's content unreviewable — a diff would show a changed
 * binary — and would make a re-run depend on files nobody version-controls.
 * Transcribing once into a typed module means the data is read, reviewed and
 * diffed like any other code, and the documents remain its provenance.
 *
 * **Two rules the transcription follows, without exception.**
 *
 * A `[insert …]` placeholder in a source document becomes `null`, never a
 * guess and never a value borrowed from somewhere else. A product whose
 * document does not state a warranty gets `warranty*: null` and shows no
 * warranty on its page; a product whose document does not state a price gets
 * `mrp: null` and cannot be published at all.
 *
 * Strings are copied verbatim, including anything that looks like a typo.
 * Correcting source copy is a business decision, and one made silently in a
 * transcription is invisible afterwards.
 *
 * **Do not add a specification row for a value that already has a column.**
 * `netQuantity` is the worked example: it was transcribed both as the field and
 * as a "Net quantity" row in the "Product details" group, and the two drifted
 * the first time somebody edited one of them. A structured column is the
 * canonical store; `to-domain.ts` drops duplicate rows so they cannot render.
 */
export interface ProductSeed {
  productKey: string;
  slug: string;
  /** Where the product starts. Anything unpriced must start as a draft. */
  status: 'draft' | 'published';

  brand: string;
  title: string;
  subtitle: string;
  modelName: string;
  genericName: string | null;
  productType: string | null;
  netQuantity: string | null;

  category: CategorySlug;
  subcategory: string;
  art: ProductArtKind;

  countryOfOrigin: string | null;

  description: string[];
  highlights: string[];
  boxContents: string[];
  careInstructions: string[] | null;

  warrantyMonths: number | null;
  warrantyCycles: number | null;
  warrantyText: string | null;
  installationIncluded: boolean;
  returnWindowDays: number | null;

  hsnCode: string | null;
  /** A fraction, e.g. 0.18 for eighteen per cent. */
  taxRate: number | null;

  facets: ProductFacetValues;
  badges: BadgeKind[];
  popularityRank: number;

  /** Keys into `MANUFACTURERS` / `SELLERS`, resolved by the importer. */
  manufacturerKey: string;
  sellerKey: string;

  variants: VariantInput[];
  specGroups: SpecGroup[];
  faqs: ProductFaq[];
  sections: ProductSection[];

  /**
   * Images, in gallery order, named by their file inside the supplied archive.
   * The first is the primary one.
   */
  media: Array<{ file: string; role: ProductMediaRole; altText: string }>;
}
