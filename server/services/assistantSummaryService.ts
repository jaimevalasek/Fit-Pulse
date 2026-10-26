import { DIMENSIONS, getStage } from "../../shared/content/stageContent.ts";
import { DIMENSION_KEYS, type DimensionKey, type StageNumber } from "../../shared/domain/types.ts";
import type { PrismaClient } from "../generated/prisma/client.ts";

/**
 * What the Play assistant may read about one company (RULE-dm-17): exactly these
 * five fields. No money value and no questionnaire answer is ever added here.
 */
export interface AssistantCompanySummary {
  name: string;
  stage: StageNumber;
  stageName: string;
  /** Name of the dimension with the lowest score. */
  lockingDimension: string;
  /** ISO timestamp of the latest completed, non-archived diagnosis. */
  lastDiagnosisAt: string;
}

export interface AssistantSummary {
  companies: AssistantCompanySummary[];
}

function isStageNumber(value: number | null): value is StageNumber {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

// The frozen result is JSON; only the weakest dimension key is read from it.
function readWeakestDimension(result: unknown): DimensionKey | null {
  if (typeof result !== "object" || result === null) {
    return null;
  }
  const { weakestDimension } = result as { weakestDimension?: unknown };
  return DIMENSION_KEYS.find((key) => key === weakestDimension) ?? null;
}

/**
 * One entry per active company that has a completed, non-archived diagnosis,
 * most recent first. A company with no such diagnosis has nothing to report, so
 * it is left out instead of listed with empty fields.
 */
export async function readAssistantSummary(prisma: PrismaClient): Promise<AssistantSummary> {
  const diagnoses = await prisma.diagnosis.findMany({
    where: {
      status: "completed",
      archivedAt: null,
      completedAt: { not: null },
      company: { archivedAt: null },
    },
    orderBy: [{ completedAt: "desc" }, { id: "asc" }],
    select: {
      companyId: true,
      stage: true,
      result: true,
      completedAt: true,
      company: { select: { name: true } },
    },
  });

  // Newest first, so the first row seen for a company is its latest diagnosis.
  const latestByCompany = new Map<string, (typeof diagnoses)[number]>();
  for (const diagnosis of diagnoses) {
    if (!latestByCompany.has(diagnosis.companyId)) {
      latestByCompany.set(diagnosis.companyId, diagnosis);
    }
  }

  const companies: AssistantCompanySummary[] = [];
  for (const diagnosis of latestByCompany.values()) {
    const weakest = readWeakestDimension(diagnosis.result);
    if (!isStageNumber(diagnosis.stage) || weakest === null || diagnosis.completedAt === null) {
      continue;
    }
    companies.push({
      name: diagnosis.company.name,
      stage: diagnosis.stage,
      stageName: getStage(diagnosis.stage).name,
      lockingDimension: DIMENSIONS[weakest].name,
      lastDiagnosisAt: diagnosis.completedAt.toISOString(),
    });
  }
  return { companies };
}
