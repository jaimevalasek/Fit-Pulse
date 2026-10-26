import { useCallback, useEffect, useRef, useState } from "react";
import { isApiError } from "@/api/httpClient";
import { updateDiagnosis, type Diagnosis, type DiagnosisPatch } from "@/api/diagnosesApi";
import type {
  Answers,
  AnswerValue,
  BlockNumber,
  CalculatorInput,
  QuestionId,
} from "../../../shared/domain/types";

type SaveState = "saved" | "saving" | "error";

interface CalculatorChangeOptions {
  // Typed values wait a short pause before saving; choices save at once
  typed?: boolean;
}

interface DraftAutosave {
  answers: Answers;
  calculator: CalculatorInput;
  currentBlock: BlockNumber;
  saveState: SaveState;
  savedAt: Date | null;
  saveError: string | null;
  setAnswer: (id: QuestionId, value: AnswerValue) => void;
  setCalculator: (next: CalculatorInput, options?: CalculatorChangeOptions) => void;
  setCurrentBlock: (block: BlockNumber) => void;
  retry: () => void;
  // Sends what is still pending and rejects when the save fails
  flush: () => Promise<void>;
  // Drops pending changes and stops saving (the draft is being discarded)
  cancel: () => void;
}

const TYPING_PAUSE_MS = 600;

function toDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function describeSaveError(error: unknown): string {
  if (isApiError(error) && error.code === "diagnosis_not_draft") {
    return "Este diagnóstico já foi concluído. As últimas mudanças não foram salvas.";
  }
  return "Não foi possível salvar. Suas respostas continuam nesta tela.";
}

function hasKeys(patch: DiagnosisPatch): boolean {
  return Object.keys(patch).length > 0;
}

interface SaveQueue {
  saveState: SaveState;
  savedAt: Date | null;
  saveError: string | null;
  saveSoon: (patch: DiagnosisPatch, typed?: boolean) => void;
  flush: () => Promise<void>;
  cancel: () => void;
}

// Sends PATCH requests one at a time; changes made while one runs go in the next one.
function useSaveQueue(diagnosisId: string, lastSavedIso: string): SaveQueue {
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(() => toDate(lastSavedIso));
  const [saveError, setSaveError] = useState<string | null>(null);
  const pendingRef = useRef<DiagnosisPatch>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const cancelledRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const drain = useCallback(async () => {
    while (!cancelledRef.current && hasKeys(pendingRef.current)) {
      const patch = pendingRef.current;
      pendingRef.current = {};
      setSaveState("saving");
      try {
        await updateDiagnosis(diagnosisId, patch);
        setSavedAt(new Date());
        setSaveError(null);
      } catch (error) {
        pendingRef.current = { ...patch, ...pendingRef.current };
        setSaveState("error");
        setSaveError(describeSaveError(error));
        throw error;
      }
    }
    setSaveState("saved");
  }, [diagnosisId]);

  const flush = useCallback((): Promise<void> => {
    clearTimer();
    if (inFlightRef.current) return inFlightRef.current;
    const run = drain().finally(() => {
      inFlightRef.current = null;
    });
    inFlightRef.current = run;
    return run;
  }, [clearTimer, drain]);

  const saveSoon = useCallback(
    (patch: DiagnosisPatch, typed = false) => {
      if (cancelledRef.current) return;
      pendingRef.current = { ...pendingRef.current, ...patch };
      clearTimer();
      if (typed) timerRef.current = setTimeout(() => void flush().catch(() => undefined), TYPING_PAUSE_MS);
      else void flush().catch(() => undefined);
    },
    [clearTimer, flush],
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    clearTimer();
    pendingRef.current = {};
  }, [clearTimer]);

  // Leaving the screen or closing the window sends a typed value still waiting for its pause
  useEffect(() => {
    const sendPending = () => {
      if (hasKeys(pendingRef.current)) void flush().catch(() => undefined);
    };
    window.addEventListener("pagehide", sendPending);
    return () => {
      window.removeEventListener("pagehide", sendPending);
      sendPending();
    };
  }, [flush]);

  return { saveState, savedAt, saveError, saveSoon, flush, cancel };
}

// Keeps the draft on screen and saves each change through PATCH /api/diagnoses/:id (AC-dm-12).
function useDraftAutosave(diagnosis: Diagnosis): DraftAutosave {
  const [answers, setAnswersState] = useState<Answers>(() => diagnosis.answers ?? {});
  const [calculator, setCalculatorState] = useState<CalculatorInput>(() => diagnosis.calculator);
  const [currentBlock, setCurrentBlockState] = useState<BlockNumber>(() => diagnosis.currentBlock);
  const answersRef = useRef(answers);
  const { saveSoon, flush, ...queue } = useSaveQueue(diagnosis.id, diagnosis.updatedAt);

  const setAnswer = useCallback(
    (id: QuestionId, value: AnswerValue) => {
      const next = { ...answersRef.current, [id]: value };
      answersRef.current = next;
      setAnswersState(next);
      saveSoon({ answers: next });
    },
    [saveSoon],
  );

  const setCalculator = useCallback(
    (next: CalculatorInput, options: CalculatorChangeOptions = {}) => {
      setCalculatorState(next);
      saveSoon({ calculator: next }, options.typed);
    },
    [saveSoon],
  );

  const setCurrentBlock = useCallback(
    (block: BlockNumber) => {
      setCurrentBlockState(block);
      saveSoon({ currentBlock: block });
    },
    [saveSoon],
  );

  const retry = useCallback(() => void flush().catch(() => undefined), [flush]);

  return { ...queue, answers, calculator, currentBlock, setAnswer, setCalculator, setCurrentBlock, retry, flush };
}

export { useDraftAutosave };
export type { CalculatorChangeOptions, DraftAutosave, SaveState };
