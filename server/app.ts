import express, { type Express } from "express";
import { errorHandler, notFoundHandler } from "./http/errorHandler.ts";
import { requireJsonWrites, requireLocalHost } from "./http/requestGuards.ts";
import { createSystemOpener, type SystemOpener } from "./files/systemOpener.ts";
import type { PrismaClient } from "./generated/prisma/client.ts";
import { rulesV1 } from "../shared/rules/rulesV1.ts";
import type { Rules } from "../shared/domain/types.ts";
import { createActionRoutes } from "./routes/actionRoutes.ts";
import { createBackupRoutes } from "./routes/backupRoutes.ts";
import { createBrandRoutes } from "./routes/brandRoutes.ts";
import { createCompanyRoutes } from "./routes/companyRoutes.ts";
import { createDiagnosisRoutes } from "./routes/diagnosisRoutes.ts";
import { createDiaryRoutes } from "./routes/diaryRoutes.ts";
import { createFileRoutes } from "./routes/fileRoutes.ts";
import { createHistoryRoutes } from "./routes/historyRoutes.ts";
import { createHomeRoutes } from "./routes/homeRoutes.ts";
import { createPlayRoutes } from "./routes/playRoutes.ts";
import { createPreferenceRoutes } from "./routes/preferenceRoutes.ts";
import { createQuestionnaireRoutes } from "./routes/questionnaireRoutes.ts";
import { createReportRoutes } from "./routes/reportRoutes.ts";
import { createActionService } from "./services/actionService.ts";
import { createBackupService } from "./services/backupService.ts";
import { createBrandService } from "./services/brandService.ts";
import { createCompanyService } from "./services/companyService.ts";
import { createDiagnosisService } from "./services/diagnosisService.ts";
import { createDiaryService } from "./services/diaryService.ts";
import { createFileService } from "./services/fileService.ts";
import { createHistoryService } from "./services/historyService.ts";
import { createHomeService } from "./services/homeService.ts";
import { createPortfolioService } from "./services/portfolioService.ts";
import { createPreferenceService } from "./services/preferenceService.ts";
import { createQuestionnaireService } from "./services/questionnaireService.ts";
import { createReportService } from "./services/reportService.ts";

export const DEFAULT_BACKEND_PORT = 3301;

/** The Play injects `BACKEND_PORT` at spawn; the fallback only serves manual runs. */
export function resolveBackendPort(env: NodeJS.ProcessEnv = process.env): number {
  return Number(env.BACKEND_PORT) || DEFAULT_BACKEND_PORT;
}

export interface AppDependencies {
  prisma: PrismaClient;
  /** Clock for stored timestamps and anything that depends on "today". */
  now: () => Date;
  /** Folder where generated files (PDF report, backup) are written. */
  downloadsDir: string;
  /** Opens a saved file in the computer's reader or shows it in its folder; defaults to the real one. Tests swap it. */
  systemOpener?: SystemOpener;
  /** Port reported to the Play in `api_base_url`; defaults to `BACKEND_PORT`. */
  backendPort?: number;
  /** Rules a new diagnosis is calculated with; defaults to the current version. Tests swap it. */
  rules?: Rules;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");

  // No CORS middleware on purpose: only the app's own origin may call the API.
  app.use(requireLocalHost);
  app.use(requireJsonWrites);
  const rules = deps.rules ?? rulesV1;

  // Routers that accept a larger body mount before this line with their own parser.
  app.use(
    createBackupRoutes({
      backup: createBackupService({ prisma: deps.prisma, downloadsDir: deps.downloadsDir, now: deps.now, rulesVersion: rules.version }),
    }),
  );
  app.use(createBrandRoutes({ brand: createBrandService({ prisma: deps.prisma, now: deps.now }) }));
  app.use(
    createQuestionnaireRoutes({
      questionnaire: createQuestionnaireService({ prisma: deps.prisma, now: deps.now, downloadsDir: deps.downloadsDir }),
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.use(createPlayRoutes({ prisma: deps.prisma, backendPort: deps.backendPort ?? resolveBackendPort() }));
  app.use(
    createCompanyRoutes({
      companies: createCompanyService({
        prisma: deps.prisma,
        now: deps.now,
        portfolio: createPortfolioService({ prisma: deps.prisma, now: deps.now }),
      }),
    }),
  );
  app.use(createDiagnosisRoutes({ diagnoses: createDiagnosisService({ prisma: deps.prisma, now: deps.now, rules }) }));
  app.use(createActionRoutes({ actions: createActionService({ prisma: deps.prisma, now: deps.now }) }));
  app.use(createDiaryRoutes({ diary: createDiaryService({ prisma: deps.prisma }), now: deps.now }));
  app.use(createHistoryRoutes({ history: createHistoryService({ prisma: deps.prisma, now: deps.now, rules }) }));
  app.use(
    createReportRoutes({
      report: createReportService({ prisma: deps.prisma, downloadsDir: deps.downloadsDir, now: deps.now, rules }),
    }),
  );
  app.use(
    createFileRoutes({
      files: createFileService({
        prisma: deps.prisma,
        downloadsDir: deps.downloadsDir,
        systemOpener: deps.systemOpener ?? createSystemOpener(),
      }),
    }),
  );
  app.use(createPreferenceRoutes({ preferences: createPreferenceService({ prisma: deps.prisma }) }));
  app.use(createHomeRoutes({ home: createHomeService({ prisma: deps.prisma, now: deps.now }) }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
