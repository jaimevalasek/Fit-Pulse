import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Question } from "../../../shared/content/questionBank";
import type { AnswerValue } from "../../../shared/domain/types";

// Radio cards of the prototype: a label of at least 44px wraps each input (AC-dm-46)
const OPTION_CLASS = cn(
  "flex min-h-(--touch) cursor-pointer items-center gap-3 rounded-md border border-line-strong px-4 py-3",
  "transition-[border-color,background-color] duration-(--fast) ease-app hover:border-text-soft",
  "has-checked:border-bronze has-checked:bg-wash",
);
const RADIO_CLASS = "size-4 flex-none accent-bronze";
const UNKNOWN_VALUE = "unknown";

interface QuestionHeadingProps {
  title: ReactNode;
  help: ReactNode;
  helpLabel?: string;
  // Lets a fieldset name its group after the title
  titleId?: string;
}

// Question title with the "?" button that shows and hides its help (aria-expanded, AC-dm-11)
function QuestionHeading({ title, help, helpLabel = "O que significa esta pergunta?", titleId }: QuestionHeadingProps) {
  const [open, setOpen] = useState(false);
  const helpId = useId();
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <h2 id={titleId} className="text-lg leading-snug font-semibold">
          {title}
        </h2>
        <button
          type="button"
          className={cn(
            "grid size-8 flex-none cursor-pointer place-items-center rounded-full border border-line-strong font-serif text-base text-bronze italic",
            "relative before:absolute before:-inset-1.5 before:content-[''] hover:border-bronze",
          )}
          aria-expanded={open}
          aria-controls={helpId}
          aria-label={helpLabel}
          onClick={() => setOpen((value) => !value)}
        >
          ?
        </button>
      </div>
      <p
        id={helpId}
        hidden={!open}
        className="mt-2 rounded-md border border-line bg-surface px-4 py-3 text-sm text-text-soft"
      >
        {help}
      </p>
    </>
  );
}

interface AnchoredQuestionProps {
  question: Question;
  // undefined: not answered yet; null: "não sei"
  value: AnswerValue | undefined;
  onAnswer: (value: AnswerValue) => void;
  name: string;
}

// One question with its four anchors and, only where the catalog allows, "não sei" (AC-dm-11)
function AnchoredQuestion({ question, value, onAnswer, name }: AnchoredQuestionProps) {
  const titleId = useId();
  return (
    <fieldset
      className="m-0 min-w-0 border-0 border-b border-line px-0 py-6"
      aria-labelledby={titleId}
      data-aioson-id={`item-${question.id}`}
    >
      <QuestionHeading title={question.text} help={question.help} titleId={titleId} />
      <div className="mt-4 grid gap-2">
        {question.options.map((option) => (
          <label key={option.value} className={OPTION_CLASS}>
            <input
              type="radio"
              className={RADIO_CLASS}
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onAnswer(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
        {question.unknownLabel !== null ? (
          <label className={cn(OPTION_CLASS, "border-dashed")}>
            <input
              type="radio"
              className={RADIO_CLASS}
              name={name}
              value={UNKNOWN_VALUE}
              checked={value === null}
              onChange={() => onAnswer(null)}
            />
            <span>{question.unknownLabel}</span>
          </label>
        ) : null}
      </div>
    </fieldset>
  );
}

export { AnchoredQuestion, OPTION_CLASS, QuestionHeading, RADIO_CLASS };
