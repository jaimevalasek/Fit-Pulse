import type { GeneratedFile, PrismaClient } from "../generated/prisma/client.ts";

/** What a saved file is. Stored as text, so a new kind needs no migration. */
export const GENERATED_FILE_KINDS = ["diagnosis_pdf", "evolution_pdf", "portfolio_pdf", "questionnaire_html"] as const;
export type GeneratedFileKind = (typeof GENERATED_FILE_KINDS)[number];

/** The kinds that are reports in PDF, the ones "last PDF saved" looks at. */
export const REPORT_PDF_KINDS: readonly GeneratedFileKind[] = ["diagnosis_pdf", "evolution_pdf", "portfolio_pdf"];

export type GeneratedFileRecord = GeneratedFile;

export interface NewGeneratedFile {
  /** Empty for a file that belongs to no single company (the portfolio PDF). */
  companyId: string | null;
  kind: GeneratedFileKind;
  fileName: string;
  /** Absolute path of the folder the file was written to. */
  directory: string;
  /** Moment of the save, from the app clock. */
  createdAt: Date;
}

export interface GeneratedFileRepository {
  insert(input: NewGeneratedFile): Promise<GeneratedFileRecord>;
  findById(id: string): Promise<GeneratedFileRecord | null>;
  /** The most recent file of the company among the given kinds (report PDFs by default). */
  findLatestByCompany(companyId: string, kinds?: readonly GeneratedFileKind[]): Promise<GeneratedFileRecord | null>;
}

export function createGeneratedFileRepository(prisma: PrismaClient): GeneratedFileRepository {
  return {
    insert: (input) => prisma.generatedFile.create({ data: input }),

    findById: (id) => prisma.generatedFile.findUnique({ where: { id } }),

    findLatestByCompany: (companyId, kinds = REPORT_PDF_KINDS) =>
      prisma.generatedFile.findFirst({
        where: { companyId, kind: { in: [...kinds] } },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
  };
}
