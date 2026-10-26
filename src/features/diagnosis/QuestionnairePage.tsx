import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { StatusView } from "@/components/feedback/StatusView";
import { isApiError } from "@/api/httpClient";
import { getCompany } from "@/api/companiesApi";
import { discardDiagnosis, getDiagnosis, isBlockNumber, type Diagnosis } from "@/api/diagnosesApi";
import { BLOCK_COUNT, BLOCKS, questionsOfBlock } from "../../../shared/content/questionBank";
import { isBlockComplete } from "../../../shared/domain/completeness";
import type { BlockNumber } from "../../../shared/domain/types";
import { AnchoredQuestion } from "./AnchoredQuestion";
import { BlockRail, SaveStatus, blockHref } from "./BlockRail";
import { CalculatorBlock } from "./CalculatorBlock";
import { CompletionGate } from "./CompletionGate";
import { UnitEconomicsPanel } from "./UnitEconomicsPanel";
import { useDraftAutosave, type DraftAutosave } from "./useDraftAutosave";

type LoadState =
  | { status: "loading" }
  | { status: "error"; notFound: boolean }
  | { status: "ready"; diagnosis: Diagnosis; companyName?: string };

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function readBlockParam(value: string | null): BlockNumber | null {
  const block = value === null ? Number.NaN : Number(value);
  return isBlockNumber(block) ? block : null;
}

function companyHref(companyId: string): string {
  return `/empresa/${encodeURIComponent(companyId)}`;
}

interface QuestionnaireFormProps {
  diagnosis: Diagnosis;
  companyName?: string;
}

function DiscardDraftDialog({ open, onOpenChange, date, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; date: Date | null; onConfirm: () => Promise<void> }) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="destructive"
      title={date ? `Descartar o rascunho de ${DATE_FORMAT.format(date)}?` : "Descartar o rascunho?"}
      consequence="As respostas deste rascunho serão apagadas. Os diagnósticos concluídos não mudam."
      confirmLabel="Descartar rascunho"
      onConfirm={onConfirm}
      dataId="diagnosis-discard-confirm"
    />
  );
}

interface DraftAsideProps {
  diagnosis: Diagnosis;
  block: BlockNumber;
  draft: DraftAutosave;
  onDiscard: () => void;
}

function DraftAside({ diagnosis, block, draft, onDiscard }: DraftAsideProps) {
  const { answers, calculator } = draft;
  const isBlockDone = useCallback((number: BlockNumber) => isBlockComplete(number, answers, calculator), [answers, calculator]);
  return (
    <aside aria-label="Andamento do diagnóstico" className="lg:sticky lg:top-26 lg:self-start">
      <BlockRail diagnosisId={diagnosis.id} currentBlock={block} isBlockDone={isBlockDone} />
      <SaveStatus saveState={draft.saveState} savedAt={draft.savedAt} saveError={draft.saveError} onRetry={draft.retry} />
      <p className="mt-3 flex flex-wrap gap-x-4 text-sm">
        <Link to={companyHref(diagnosis.companyId)} className="inline-flex min-h-(--touch) items-center">
          Sair e continuar depois
        </Link>
        <Button variant="link" size="sm" className="text-danger" onClick={onDiscard} data-aioson-id="diagnosis-discard">
          Descartar rascunho
        </Button>
      </p>
    </aside>
  );
}

function BlockBody({ diagnosisId, block, draft }: { diagnosisId: string; block: BlockNumber; draft: DraftAutosave }) {
  if (block === 1) {
    return (
      <div data-aioson-id="cac-ltv-calculator" className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <CalculatorBlock diagnosisId={diagnosisId} calculator={draft.calculator} onChange={draft.setCalculator} flushPending={draft.flush} />
        <UnitEconomicsPanel calculator={draft.calculator} />
      </div>
    );
  }
  return questionsOfBlock(block).map((question) => (
    <AnchoredQuestion
      key={question.id}
      question={question}
      name={`${diagnosisId}-${question.id}`}
      value={draft.answers[question.id]}
      onAnswer={(value) => draft.setAnswer(question.id, value)}
    />
  ));
}

function BlockFooter({ diagnosis, companyName, block, draft }: QuestionnaireFormProps & { block: BlockNumber; draft: DraftAutosave }) {
  const back =
    block > 1 ? (
      <Link to={blockHref(diagnosis.id, (block - 1) as BlockNumber)} className={buttonVariants({ variant: "default" })}>
        <span aria-hidden="true">←</span> Bloco anterior
      </Link>
    ) : null;
  if (block === BLOCK_COUNT) {
    return (
      <CompletionGate
        diagnosisId={diagnosis.id}
        companyName={companyName}
        answers={draft.answers}
        calculator={draft.calculator}
        flush={draft.flush}
        leading={back}
      />
    );
  }
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
      {back ?? <span />}
      <Link to={blockHref(diagnosis.id, (block + 1) as BlockNumber)} className={buttonVariants({ variant: "metal" })} data-aioson-id="quiz-next">
        Próximo bloco <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

// The open draft: rail, current block, navigation, autosave and discard (CAP-dm-questionnaire)
function QuestionnaireForm({ diagnosis, companyName }: QuestionnaireFormProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draft = useDraftAutosave(diagnosis);
  const [discardOpen, setDiscardOpen] = useState(false);
  const { setCurrentBlock } = draft;
  const block = readBlockParam(searchParams.get("bloco")) ?? draft.currentBlock;
  const info = BLOCKS[block - 1];

  // Opening a block through the rail or the footer saves it as the place to come back to.
  // Runs only when the block changes, not on every save of the draft.
  useEffect(() => {
    if (block !== draft.currentBlock) setCurrentBlock(block);
    window.scrollTo({ top: 0 });
  }, [block]);

  async function handleDiscard() {
    await discardDiagnosis(diagnosis.id);
    draft.cancel();
    navigate(companyHref(diagnosis.companyId), { replace: true });
  }

  return (
    <div data-aioson-id="diagnosis-questionnaire">
      <p className="mb-4 text-sm">
        <Link to={companyHref(diagnosis.companyId)} className="inline-flex min-h-(--touch) items-center">
          {companyName ?? "Voltar para a empresa"}
        </Link>
      </p>
      {/* minmax(0,1fr) below lg keeps the rail scrolling inside itself instead of widening the page */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
        <DraftAside diagnosis={diagnosis} block={block} draft={draft} onDiscard={() => setDiscardOpen(true)} />
        <section data-aioson-id="quiz-block" aria-labelledby="block-title" className="min-w-0">
          <header>
            <h1 id="block-title">{info.title}</h1>
            <p className="mt-2 max-w-[60ch] text-text-soft">{info.intro}</p>
            <p className="mt-1 text-sm text-text-muted">
              Bloco {block} de {BLOCK_COUNT}
            </p>
          </header>
          <BlockBody diagnosisId={diagnosis.id} block={block} draft={draft} />
          <BlockFooter diagnosis={diagnosis} companyName={companyName} block={block} draft={draft} />
        </section>
      </div>
      <DiscardDraftDialog open={discardOpen} onOpenChange={setDiscardOpen} date={diagnosis.createdAt ? new Date(diagnosis.createdAt) : draft.savedAt} onConfirm={handleDiscard} />
    </div>
  );
}

function useDiagnosisLoad(diagnosisId: string) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    (async () => {
      try {
        const diagnosis = await getDiagnosis(diagnosisId, controller.signal);
        // The company name is only the breadcrumb: the draft opens even if it cannot be read
        const company = await getCompany(diagnosis.companyId, controller.signal).catch(() => null);
        if (!controller.signal.aborted) setLoad({ status: "ready", diagnosis, companyName: company?.name });
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoad({ status: "error", notFound: isApiError(error) && error.status === 404 });
      }
    })();
    return () => controller.abort();
  }, [diagnosisId, attempt]);

  return { load, retry: () => setAttempt((value) => value + 1) };
}

// Route #/diagnostico/:diagnosisId
function QuestionnairePage() {
  const { diagnosisId = "" } = useParams();
  const { load, retry } = useDiagnosisLoad(diagnosisId);

  if (load.status === "loading") {
    return <StatusView state="loading" title="Abrindo o diagnóstico…" dataId="diagnosis-loading" />;
  }
  if (load.status === "error") {
    return load.notFound ? (
      <StatusView
        state="error"
        title="Diagnóstico não encontrado"
        description="Ele pode ter sido descartado."
        action={
          <Link to="/empresas" className={buttonVariants({ variant: "default" })}>
            Ir para Empresas
          </Link>
        }
        dataId="diagnosis-not-found"
      />
    ) : (
      <StatusView
        state="error"
        title="Não foi possível abrir o diagnóstico"
        description="Suas respostas salvas continuam guardadas."
        onRetry={retry}
        dataId="diagnosis-error"
      />
    );
  }
  if (load.diagnosis.status !== "draft") {
    return <Navigate to={`/resultado/${encodeURIComponent(load.diagnosis.id)}`} replace />;
  }
  return <QuestionnaireForm key={load.diagnosis.id} diagnosis={load.diagnosis} companyName={load.companyName} />;
}

export { QuestionnairePage };
