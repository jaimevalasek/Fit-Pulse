import { useRef, useState } from "react";
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
import { isApiError } from "@/api/httpClient";
import { revealSavedFile } from "@/api/filesApi";
import { sendQuestionnaire, type QuestionnaireSend } from "@/api/questionnaireApi";

type SendState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; send: QuestionnaireSend }
  | { status: "failed"; message: string };

type CopyState = "idle" | "copied" | "manual";

interface SendQuestionnaireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: { id: string; name: string };
  // Runs once the file is in the Downloads folder: the company now waits for the answers
  onSent: (send: QuestionnaireSend) => void;
}

const SAVE_FAILED_MESSAGE = "Não foi possível salvar o questionário na pasta Downloads. Nada foi alterado. Tente de novo.";
const COPIED_MESSAGE = "Mensagem copiada.";
const COPY_BY_HAND_MESSAGE = "Não deu para copiar sozinho. O texto já está selecionado: copie com Ctrl+C.";

function describeFailure(error: unknown): string {
  return isApiError(error) && error.message ? error.message : SAVE_FAILED_MESSAGE;
}

function SendSteps() {
  return (
    <ol className="m-0 mt-4 flex list-decimal flex-col gap-1 pl-5 text-sm text-text-soft">
      <li>Gere o arquivo e mande para o cliente com a mensagem que aparece aqui.</li>
      <li>O cliente responde no computador e salva um arquivo de respostas.</li>
      <li>Ele devolve o arquivo e você usa "Importar respostas".</li>
    </ol>
  );
}

// "Copiar mensagem": when the clipboard refuses, the text is left selected for a copy by hand (AC-ra-48)
function useCopyMessage(message: string) {
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [copy, setCopy] = useState<CopyState>("idle");

  async function copyMessage() {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(message);
      setCopy("copied");
    } catch {
      setCopy("manual");
      messageRef.current?.focus();
      messageRef.current?.select();
    }
  }

  return { messageRef, copy, copyMessage };
}

// "Mostrar na pasta" sends only the file id (IF-002); a failure still says where the file is
function useRevealFile(send: QuestionnaireSend) {
  const [revealError, setRevealError] = useState<string | null>(null);

  async function reveal() {
    setRevealError(null);
    try {
      await revealSavedFile(send.fileId);
    } catch (error) {
      setRevealError(
        isApiError(error) && error.code === "file_not_found" && error.message
          ? error.message
          : `Não foi possível abrir a pasta. O arquivo está em ${send.directory}.`,
      );
    }
  }

  return { revealError, reveal };
}

// The saved file, "Mostrar na pasta" and the approved message to the client with "Copiar mensagem"
function SavedQuestionnaire({ send }: { send: QuestionnaireSend }) {
  const { messageRef, copy, copyMessage } = useCopyMessage(send.message);
  const { revealError, reveal } = useRevealFile(send);

  return (
    <div data-state="success" data-aioson-id="send-saved" className="mt-4 grid gap-3">
      <div className="rounded-md border border-line-strong bg-surface-raised px-4 py-3">
        <b className="block">Salvo na pasta Downloads</b>
        <span data-aioson-id="send-file-name" className="block font-mono text-sm break-all">
          {send.fileName}
        </span>
        <span className="block text-xs break-all text-text-muted">{send.directory}</span>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="send-message" className="text-sm font-medium">
          Mensagem para o cliente
        </label>
        <textarea
          id="send-message"
          ref={messageRef}
          readOnly
          rows={6}
          value={send.message}
          onFocus={(event) => event.currentTarget.select()}
          data-aioson-id="send-message"
          className="w-full resize-y rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-text select-text"
        />
        <p role="status" className="min-h-[1.25em] text-sm text-text-soft" data-copy-state={copy}>
          {copy === "copied" ? COPIED_MESSAGE : copy === "manual" ? COPY_BY_HAND_MESSAGE : null}
        </p>
      </div>
      {revealError ? (
        <p role="alert" className="text-sm text-danger">
          {revealError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="metal" onClick={copyMessage} data-aioson-id="send-copy-message">
          Copiar mensagem
        </Button>
        <Button variant="default" onClick={reveal} data-aioson-id="send-show-folder">
          Mostrar na pasta
        </Button>
      </div>
    </div>
  );
}

// "Enviar questionário" (CAP-ra-remote-questionnaire): the server saves `{empresa}-questionario-{data}.html`
// in Downloads and records the send (IF-011); the app itself never sends anything to the client
function SendQuestionnaireDialog({ open, onOpenChange, company, onSent }: SendQuestionnaireDialogProps) {
  const [state, setState] = useState<SendState>({ status: "idle" });
  const isSaving = state.status === "saving";

  function handleOpenChange(next: boolean) {
    // Esc and Cancel cannot drop a save that is already running
    if (!next && isSaving) return;
    if (!next) setState({ status: "idle" });
    onOpenChange(next);
  }

  async function handleGenerate() {
    if (isSaving) return;
    setState({ status: "saving" });
    try {
      const send = await sendQuestionnaire(company.id);
      setState({ status: "saved", send });
      onSent(send);
    } catch (error) {
      setState({ status: "failed", message: describeFailure(error) });
    }
  }

  const isSaved = state.status === "saved";
  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent data-aioson-id="send-questionnaire-modal" aria-busy={isSaving || undefined} className="w-[min(640px,calc(100%-32px))]">
        <AlertDialogHeader>
          <AlertDialogTitle>{isSaved ? "Arquivo gerado" : `Enviar questionário para ${company.name}`}</AlertDialogTitle>
          <AlertDialogDescription>
            {isSaved
              ? 'Mande o arquivo para o cliente com a mensagem abaixo. Quando ele devolver as respostas, use "Importar respostas".'
              : "O FitPulse gera um arquivo que abre no navegador do computador do cliente, sem internet e sem instalar nada. Você manda o arquivo por WhatsApp ou e-mail; o app não envia nada sozinho."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {isSaved ? null : <SendSteps />}
        {isSaving ? (
          <p role="status" aria-busy="true" data-state="loading" className="mt-4 text-sm text-text-soft">
            Gerando o arquivo…
          </p>
        ) : null}
        {state.status === "failed" ? (
          <p role="alert" data-state="error" className="mt-4 text-sm text-danger">
            {state.message}
          </p>
        ) : null}
        {isSaved ? <SavedQuestionnaire send={state.send} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel aria-disabled={isSaving || undefined} onClick={(event) => isSaving && event.preventDefault()}>
            {isSaved ? "Fechar" : "Cancelar"}
          </AlertDialogCancel>
          {isSaved ? null : (
            <Button variant="metal" onClick={handleGenerate} aria-disabled={isSaving || undefined} data-aioson-id="send-generate">
              {isSaving ? "Gerando…" : state.status === "failed" ? "Tentar de novo" : "Gerar arquivo"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { SendQuestionnaireDialog };
export type { SendQuestionnaireDialogProps };
