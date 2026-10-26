import express, { Router, type RequestHandler } from "express";
import type { QuestionnaireService } from "../services/questionnaireService.ts";
import { DomainError } from "../services/domainError.ts";
import { ANSWERS_BODY_LIMIT, ANSWERS_TOO_LARGE_MESSAGE, importAnswersSchema } from "../validation/questionnaireSchemas.ts";

export interface QuestionnaireRoutesDeps {
  questionnaire: QuestionnaireService;
}

/** `POST …/questionnaire` is sent as `{}`; the route reads nothing from it. */
const SEND_BODY_LIMIT = "4kb";

function isBodyTooLarge(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { type?: unknown }).type === "entity.too.large";
}

const parseAnswersBody = express.json({ limit: ANSWERS_BODY_LIMIT });

// A file past the body limit gets the same refusal the screen shows for the other files that are too large.
const readAnswersBody: RequestHandler<{ id: string }> = (req, res, next) => {
  parseAnswersBody(req, res, (error?: unknown) => {
    next(isBodyTooLarge(error) ? new DomainError(413, "payload_too_large", ANSWERS_TOO_LARGE_MESSAGE) : error);
  });
};

/**
 * IF-011. `POST /api/companies/:id/questionnaire` saves the company's questionnaire file in the Downloads
 * folder and answers `{ fileId, fileName, directory, sentAt, message }`. `POST /api/companies/:id/questionnaire-answers`
 * takes `{ content, replaceDraft? }`, the text of the file the client sent back (up to 1 MB), and answers 201
 * `{ draftId, clientSavedAt }`. The router brings its own body parser (2 MB) and mounts before the app's
 * 1 MB one. Handlers only validate, delegate to the service and answer; refusals reach the shared error handler.
 */
export function createQuestionnaireRoutes({ questionnaire }: QuestionnaireRoutesDeps): Router {
  const router = Router();

  router.post("/api/companies/:id/questionnaire", express.json({ limit: SEND_BODY_LIMIT }), async (req, res) => {
    res.json(await questionnaire.send(req.params.id));
  });

  router.post("/api/companies/:id/questionnaire-answers", readAnswersBody, async (req, res) => {
    const input = importAnswersSchema.parse(req.body);
    res.status(201).json(await questionnaire.importAnswers(req.params.id, input));
  });

  return router;
}
