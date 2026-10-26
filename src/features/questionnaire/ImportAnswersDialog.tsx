import { useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { isApiError } from "@/api/httpClient";
import { importAnswers, type DraftExistsDetails, type ImportedAnswers } from "@/api/questionnaireApi";

type ImportStage =
  | { kind: "pick" }
  | { kind: "reading" }
  | { kind: "replace"; content: string; draftCreatedAt: string }
  | { kind: "done"; result: ImportedAnswers }
  | { kind: "failed"; message: string };

interface ImportAnswersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: { id: string; name: string };
  // Runs once the answers became the company's draft: the company leaves "aguardando resposta"
  onImported: (result: ImportedAnswers) => void;
}

// Same limit and wording as the server (RULE-ra-10): a file this big is refused before it is read
const ANSWERS_FILE_MAX_BYTES = 1024 * 1024;
const TOO_LARGE_MESSAGE = "Este arquivo é grande demais para ser um arquivo de respostas do FitPulse (o limite é 1 MB).";
const NOT_ANSWERS_MESSAGE = "Este arquivo não é um arquivo de respostas do FitPulse.";
const READ_FAILED_MESSAGE = "Não foi possível ler o arquivo.";
const NOTHING_CHANGED = "Nada foi alterado.";

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : DATE_FORMAT.format(date);
}

function isDraftExists(error: unknown): error is { details: DraftExistsDetails } {
  if (!isApiError(error) || error.code !== "draft_exists") return false;
  const details = error.details as Partial<DraftExistsDetails> | undefined;
  return typeof details?.draftCreatedAt === "string";
}

// Every refusal names what is wrong with the file and ends with "Nada foi alterado." (AC-ra-52)
function withNothingChanged(message: string): string {
  return message.includes(NOTHING_CHANGED) ? message : `${message} ${NOTHING_CHANGED}`;
}

function describeImportFailure(error: unknown): string {
  if (isApiError(error) && error.code === "validation_failed") return withNothingChanged(NOT_ANSWERS_MESSAGE);
  return withNothingChanged(isApiError(error) && error.message ? error.message : READ_FAILED_MESSAGE);
}

// Reads the chosen file, sends its text through IF-011 and turns each answer into the next stage.
// `stageRef` lets the replace confirmation tell its own Cancel from the close that follows a confirm.
function useAnswersImport(companyId: string, onImported: ImportAnswersDialogProps["onImported"]) {
  const [stage, setStageState] = useState<ImportStage>({ kind: "pick" });
  const stageRef = useRef<ImportStage>(stage);

  function setStage(next: ImportStage) {
    stageRef.current = next;
    setStageState(next);
  }

  async function send(content: string, replaceDraft: boolean) {
    try {
      const result = await importAnswers(companyId, replaceDraft ? { content, replaceDraft } : { content });
      setStage({ kind: "done", result });
      onImported(result);
    } catch (error) {
      if (!replaceDraft && isDraftExists(error)) {
        setStage({ kind: "replace", content, draftCreatedAt: error.details.draftCreatedAt });
        return;
      }
      setStage({ kind: "failed", message: describeImportFailure(error) });
    }
  }

  async function readFile(file: File) {
    if (file.size > ANSWERS_FILE_MAX_BYTES) {
      setStage({ kind: "failed", message: withNothingChanged(TOO_LARGE_MESSAGE) });
      return;
    }
    setStage({ kind: "reading" });
    let content: string;
    try {
      content = await file.text();
    } catch {
      setStage({ kind: "failed", message: withNothingChanged(READ_FAILED_MESSAGE) });
      return;
    }
    if (!content.trim()) {
      setStage({ kind: "failed", message: withNothingChanged(NOT_ANSWERS_MESSAGE) });
      return;
    }
    await send(content, false);
  }

  return { stage, stageRef, setStage, readFile, send };
}

function ImportResult({ stage, companyName }: { stage: ImportStage; companyName: string }) {
  if (stage.kind === "reading") {
    return (
      <p role="status" aria-busy="true" data-state="loading" className="mt-4 text-sm text-text-soft">
        Lendo o arquivo…
      </p>
    );
  }
  if (stage.kind === "done") {
    return (
      <div data-state="success" data-aioson-id="import-done" className="mt-4 rounded-md border border-line-strong bg-surface-raised px-4 py-3">
        <b className="block">Rascunho criado</b>
        <p className="mt-1 text-sm text-text-soft">
          As respostas que {companyName} salvou em {formatDate(stage.result.clientSavedAt)} viraram um rascunho. Revise com o cliente e conclua o
          diagnóstico.
        </p>
      </div>
    );
  }
  if (stage.kind === "failed") {
    return (
      <div role="alert" data-state="error" data-aioson-id="import-error" className="mt-4 rounded-md border border-danger/40 px-4 py-3">
        <b className="block">Não foi possível importar</b>
        <p className="mt-1 text-sm text-text-soft">{stage.message}</p>
      </div>
    );
  }
  return null;
}

// "Substituir o rascunho de {data}?" (AC-ra-53, AC-ra-59): Cancel or Esc keeps the current draft;
// after a confirm the stage has already moved on, so the close that follows it is not a cancel
function ReplaceDraftConfirm({ stage, onCancel, onConfirm }: { stage: ImportStage | null; onCancel: () => void; onConfirm: () => Promise<void> | undefined }) {
  const isReplacing = stage?.kind === "replace";
  return (
    <ConfirmDialog
      open={isReplacing}
      onOpenChange={(next) => !next && onCancel()}
      title={isReplacing ? `Substituir o rascunho de ${formatDate(stage.draftCreatedAt)}?` : ""}
      consequence="Já existe um rascunho em andamento. Ele será descartado e trocado pelas respostas deste arquivo. Não dá para desfazer."
      confirmLabel="Substituir rascunho"
      tone="destructive"
      dataId="import-replace-confirm"
      onConfirm={onConfirm}
    />
  );
}

// "Importar respostas" (AC-ra-51..53): the client's `.fitpulse` file becomes the company's draft through
// IF-011; an open draft is replaced only after the app's own confirmation, and every refusal changes nothing
function ImportAnswersDialog({ open, onOpenChange, company, onImported }: ImportAnswersDialogProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { stage, stageRef, setStage, readFile, send } = useAnswersImport(company.id, onImported);
  const isReading = stage.kind === "reading";

  function close() {
    setStage({ kind: "pick" });
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    // Esc and Cancel cannot drop a file that is still being read
    if (!next && isReading) return;
    if (!next) close();
    else onOpenChange(true);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void readFile(file);
  }

  function chooseFile() {
    if (isReading) return;
    setStage({ kind: "pick" });
    inputRef.current?.click();
  }

  function reviewDraft(draftId: string) {
    close();
    navigate(`/diagnostico/${encodeURIComponent(draftId)}`);
  }

  return (
    <>
      <AlertDialog open={open && stage.kind !== "replace"} onOpenChange={handleOpenChange}>
        <AlertDialogContent data-aioson-id="import-answers-modal" aria-busy={isReading || undefined} className="w-[min(600px,calc(100%-32px))]">
          <AlertDialogHeader>
            <AlertDialogTitle>Importar respostas de {company.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha o arquivo de respostas que o cliente devolveu (termina em .fitpulse). Ele vira um rascunho para você revisar e concluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input ref={inputRef} type="file" accept=".fitpulse" hidden onChange={handleFileChange} data-aioson-id="import-file-input" />
          <ImportResult stage={stage} companyName={company.name} />
          <AlertDialogFooter>
            <AlertDialogCancel aria-disabled={isReading || undefined} onClick={(event) => isReading && event.preventDefault()}>
              {stage.kind === "pick" ? "Cancelar" : "Fechar"}
            </AlertDialogCancel>
            {stage.kind === "done" ? (
              <Button variant="metal" onClick={() => reviewDraft(stage.result.draftId)} data-aioson-id="import-review-draft">
                Revisar e concluir
              </Button>
            ) : (
              <Button variant="metal" onClick={chooseFile} aria-disabled={isReading || undefined} data-aioson-id="import-choose-file">
                {stage.kind === "failed" ? "Escolher outro arquivo" : "Escolher arquivo"}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ReplaceDraftConfirm
        stage={open ? stage : null}
        onCancel={() => stageRef.current.kind === "replace" && close()}
        onConfirm={() => (stageRef.current.kind === "replace" ? send(stageRef.current.content, true) : undefined)}
      />
    </>
  );
}

export { ImportAnswersDialog };
export type { ImportAnswersDialogProps };
