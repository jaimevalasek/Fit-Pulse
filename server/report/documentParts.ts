import type {
  ReportBlock,
  ReportBrand,
  ReportFact,
  ReportFooter,
  ReportPage,
} from "../../shared/report/reportDocument.ts";
import { COVER_CREDIT, GUIDANCE_WARNING, HOW_TO_READ_SECTIONS, PAGE_TITLES } from "./reportCopy.ts";

// The pages every report shares: the cover, the footer and "Como ler este relatório". The three
// reports (diagnosis, evolution, portfolio) build them here so they look and read the same.

export const FITPULSE_BRAND_NAME = "FitPulse";

/** What the user filled in "Seus relatórios"; any field may be missing or blank. */
export interface ReportBrandInput {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  site?: string | null;
  logoDataUrl?: string | null;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** A blank brand is FitPulse (BR-ra-04); a name makes the brand the user's own. */
export function resolveBrand(input?: ReportBrandInput | null): ReportBrand {
  const name = clean(input?.name);
  return {
    name: name ?? FITPULSE_BRAND_NAME,
    custom: name !== null,
    phone: clean(input?.phone),
    email: clean(input?.email),
    site: clean(input?.site),
    logoDataUrl: clean(input?.logoDataUrl),
  };
}

function contactLineOf(brand: ReportBrand): string | null {
  const parts = [brand.phone, brand.email, brand.site].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}

export interface CoverInput {
  brand: ReportBrand;
  title: string;
  /** The company, or the portfolio, the report is about. */
  subject: string;
  /** Date, calculation version and confidence, in the order they are printed. */
  facts: ReportFact[];
  /** The day the file is made, already formatted (`25/10/2026`). */
  generatedOn: string;
}

export function buildCoverPage({ brand, title, subject, facts, generatedOn }: CoverInput): ReportPage {
  return {
    id: "cover",
    title,
    blocks: [
      {
        kind: "cover",
        brand,
        title,
        subject,
        facts,
        contactLine: contactLineOf(brand),
        credit: brand.custom ? COVER_CREDIT.withBrand(brand.name, generatedOn) : COVER_CREDIT.withoutBrand(generatedOn),
      },
    ],
  };
}

export function buildFooter(brand: ReportBrand, label: string): ReportFooter {
  return { text: `${brand.name} · ${label}` };
}

/** The last page of the diagnosis and evolution reports: the approved explanation and the warning. */
export function buildHowToReadPage(): ReportPage {
  const blocks: ReportBlock[] = HOW_TO_READ_SECTIONS.flatMap(({ heading, text }): ReportBlock[] => [
    { kind: "heading", text: heading },
    { kind: "paragraph", text },
  ]);
  blocks.push({ kind: "notice", text: GUIDANCE_WARNING });
  return { id: "how-to-read", title: PAGE_TITLES.howToRead, blocks };
}
