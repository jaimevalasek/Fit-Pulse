// Content of the "Cópia de segurança" settings block (F-06): export every company and diagnosis, the
// action progress, the diary, the questionnaires sent, the brand and the interval (AC-ra-55) to a file
// in Downloads, and import a backup that only adds data (RULE-dm-18). A file that is not a backup, too
// large or from a newer version is refused and nothing changes.
import { useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { BACKUP_MAX_BYTES, exportBackup, importBackup } from "@/api/backupApi";
import type { BackupCounts, BackupExport, BackupImport } from "@/api/backupApi";
import { isApiError } from "@/api/httpClient";
import { Button } from "@/components/ui/button";

type BackupState =
  | { status: "idle" }
  | { status: "exporting" }
  | { status: "importing"; fileName: string }
  | { status: "exported"; saved: BackupExport }
  | { status: "imported"; fileName: string; result: BackupImport }
  | { status: "exportFailed"; message: string }
  | { status: "importFailed"; fileName: string; message: string };

const UNCHANGED = "Nenhum dado foi alterado.";
const INVALID_FILE_MESSAGE = `O arquivo não é uma cópia do FitPulse ou está danificado. ${UNCHANGED}`;
const TOO_LARGE_MESSAGE = `O arquivo passa de 10 MB, o limite de uma cópia. ${UNCHANGED}`;
const IMPORT_FALLBACK_MESSAGE = `Algo deu errado ao importar. Tente de novo. ${UNCHANGED}`;
const EXPORT_FALLBACK_MESSAGE = "Não foi possível salvar a cópia. Tente de novo.";

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function newerVersionMessage(rulesVersion: unknown): string {
  const version = typeof rulesVersion === "number" || typeof rulesVersion === "string" ? ` (regras v${rulesVersion})` : "";
  return `O arquivo veio de uma versão mais nova do app${version}. Atualize o FitPulse pela loja do Play e tente de novo. ${UNCHANGED}`;
}

function importFailureMessage(error: unknown): string {
  if (!isApiError(error)) return IMPORT_FALLBACK_MESSAGE;
  if (error.code === "backup_newer_version") {
    const details = error.details as { rulesVersion?: unknown } | undefined;
    return error.message || newerVersionMessage(details?.rulesVersion);
  }
  if (error.code === "backup_invalid") return error.message || INVALID_FILE_MESSAGE;
  if (error.status === 413) return TOO_LARGE_MESSAGE;
  return error.message ? `${error.message} ${UNCHANGED}` : IMPORT_FALLBACK_MESSAGE;
}

function exportFailureMessage(error: unknown): string {
  return isApiError(error) && error.message ? error.message : EXPORT_FALLBACK_MESSAGE;
}

function joinParts(parts: string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}` : parts.join("");
}

// The records of version 2 beyond companies and diagnoses; zero counts stay out of the sentence
function extraParts(counts: BackupCounts): string[] {
  const parts: string[] = [];
  if (counts.actions > 0) parts.push(countLabel(counts.actions, "ação com andamento", "ações com andamento"));
  if (counts.diaryEntries > 0) parts.push(countLabel(counts.diaryEntries, "mês do diário", "meses do diário"));
  if (counts.questionnaireSends > 0) parts.push(countLabel(counts.questionnaireSends, "questionário enviado", "questionários enviados"));
  if (counts.brand > 0) parts.push("a marca dos relatórios");
  if (counts.reevaluationInterval > 0) parts.push("o intervalo de reavaliação");
  return parts;
}

function exportExtras(saved: BackupExport): string {
  const parts = extraParts(saved);
  return parts.length > 0 ? ` Também leva ${joinParts(parts)}.` : "";
}

// Brand and interval are never replaced: when this installation already has its own, it stays
function keptSettings(skipped: BackupCounts): string {
  const parts: string[] = [];
  if (skipped.brand > 0) parts.push("a marca");
  if (skipped.reevaluationInterval > 0) parts.push("o intervalo de reavaliação");
  return parts.length > 0 ? ` Este app já tinha ${joinParts(parts)} e ${parts.length > 1 ? "eles ficaram como estavam" : "ficou como estava"}.` : "";
}

function importSummary({ imported, skipped }: BackupImport): string {
  const added = `${countLabel(imported.companies, "empresa", "empresas")} e ${countLabel(imported.diagnoses, "diagnóstico", "diagnósticos")} adicionados.`;
  const extras = extraParts(imported);
  const alsoAdded = extras.length > 0 ? ` Também entraram ${joinParts(extras)}.` : "";
  const keptCount = skipped.companies + skipped.diagnoses + skipped.actions + skipped.diaryEntries + skipped.questionnaireSends;
  const kept = keptCount > 0 ? ` ${countLabel(keptCount, "registro já existia", "registros já existiam")} e não mudou.` : "";
  return `${added}${alsoAdded}${kept}${keptSettings(skipped)} Nada que já existia foi apagado.`;
}

// Reads the chosen file as text and parses it; a file that is not JSON never reaches the server
async function readBackupFile(file: File): Promise<{ ok: true; backup: unknown } | { ok: false; message: string }> {
  if (file.size > BACKUP_MAX_BYTES) return { ok: false, message: TOO_LARGE_MESSAGE };
  try {
    return { ok: true, backup: JSON.parse(await file.text()) as unknown };
  } catch {
    return { ok: false, message: INVALID_FILE_MESSAGE };
  }
}

function ResultBox({ kind, title, dataId, children }: {
  kind: "success" | "error";
  title: string;
  dataId: string;
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      data-state={kind}
      data-aioson-id={dataId}
      className={
        kind === "success"
          ? "mt-4 rounded-md border border-line bg-surface px-4 py-3 text-sm"
          : "mt-4 rounded-md border border-danger bg-danger-wash px-4 py-3 text-sm"
      }
    >
      <p className="font-semibold break-words">{title}</p>
      <div className="mt-1 text-text-soft">{children}</div>
    </div>
  );
}

function BackupResult({ state, onChooseFile }: { state: BackupState; onChooseFile: () => void }) {
  return (
    <>
      {state.status === "exported" ? (
        <ResultBox kind="success" title="Cópia salva" dataId="backup-export-saved">
          <p>
            Arquivo <span className="font-mono break-all text-text">{state.saved.fileName}</span> na pasta{" "}
            <span className="font-mono break-all text-text">{state.saved.directory}</span>, com{" "}
            {countLabel(state.saved.companies, "empresa", "empresas")} e{" "}
            {countLabel(state.saved.diagnoses, "diagnóstico", "diagnósticos")}.{exportExtras(state.saved)}
          </p>
        </ResultBox>
      ) : null}
      {state.status === "exportFailed" ? (
        <ResultBox kind="error" title="Não foi possível exportar os dados" dataId="backup-export-error">
          <p>{state.message}</p>
        </ResultBox>
      ) : null}
      {state.status === "imported" ? (
        <ResultBox kind="success" title="Cópia importada" dataId="backup-import-done">
          <p>{importSummary(state.result)}</p>
        </ResultBox>
      ) : null}
      {state.status === "importFailed" ? (
        <ResultBox kind="error" title={`Não foi possível importar ${state.fileName}`} dataId="backup-import-error">
          <p>{state.message}</p>
          <p className="mt-2">
            <Button onClick={onChooseFile}>Escolher outro arquivo</Button>
          </p>
        </ResultBox>
      ) : null}
    </>
  );
}

// Export and import runs; at most one runs at a time
function useBackupActions() {
  const [state, setState] = useState<BackupState>({ status: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = state.status === "exporting" || state.status === "importing";

  const runExport = () => {
    if (busy) return;
    setState({ status: "exporting" });
    exportBackup().then(
      (saved) => setState({ status: "exported", saved }),
      (error: unknown) => setState({ status: "exportFailed", message: exportFailureMessage(error) }),
    );
  };

  const chooseFile = () => {
    if (!busy) fileInputRef.current?.click();
  };

  const runImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Clearing the value lets the same file be chosen again after a refusal
    input.value = "";
    if (!file || busy) return;
    setState({ status: "importing", fileName: file.name });
    const read = await readBackupFile(file);
    if (!read.ok) {
      setState({ status: "importFailed", fileName: file.name, message: read.message });
      return;
    }
    try {
      const result = await importBackup(read.backup);
      setState({ status: "imported", fileName: file.name, result });
    } catch (error) {
      setState({ status: "importFailed", fileName: file.name, message: importFailureMessage(error) });
    }
  };

  return { state, busy, fileInputRef, runExport, chooseFile, runImport };
}

function BackupSection() {
  const { state, busy, fileInputRef, runExport, chooseFile, runImport } = useBackupActions();
  return (
    <div data-aioson-id="settings-backup-actions">
      <div className="flex flex-wrap gap-2">
        <Button data-aioson-id="backup-export" onClick={runExport} disabled={busy} aria-busy={state.status === "exporting"}>
          {state.status === "exporting" ? "Salvando a cópia…" : "Exportar meus dados"}
        </Button>
        <Button data-aioson-id="backup-import" onClick={chooseFile} disabled={busy} aria-busy={state.status === "importing"}>
          {state.status === "importing" ? "Importando…" : "Importar uma cópia"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          aria-label="Arquivo da cópia de segurança"
          data-aioson-id="backup-import-file"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => void runImport(event)}
        />
      </div>
      <p className="mt-3 text-sm text-text-soft">
        Desinstalar o FitPulse no Play apaga os dados deste computador. Exporte uma cópia antes.
      </p>

      <BackupResult state={state} onChooseFile={chooseFile} />
    </div>
  );
}

export { BackupSection };
