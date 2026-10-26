import type { ReportTone } from "./reportDocument.ts";

// The light-paper version of the app palette ("Tinta & Ouro"), in one place: the PDF draws with it
// and the preview paints the sheet with it. Ink text on porcelain, the app's olive-bronze accent.
// Every text color holds 4.5:1 on `paper`, and the tones never carry meaning alone.

export const PAPER_PALETTE = {
  paper: "#fffdf7",
  ink: "#1c1710",
  soft: "#4c4436",
  muted: "#6b6252",
  accent: "#55692a",
  accentWash: "#eef0e1",
  copper: "#824421",
  copperWash: "#f6e7dc",
  danger: "#9e2d37",
  dangerWash: "#f6dfdf",
  gold: "#8a6512",
  line: "#d9d2c0",
  track: "#ece6d6",
  panel: "#f6f2e7",
} as const;

export type PaperColor = keyof typeof PAPER_PALETTE;

/** Text and border color of a tag for each tone. */
export const PAPER_TONE_COLORS: Record<ReportTone, string> = {
  neutral: PAPER_PALETTE.soft,
  ok: PAPER_PALETTE.accent,
  warn: PAPER_PALETTE.copper,
  bad: PAPER_PALETTE.danger,
};

/** Background wash behind a tag for each tone. */
export const PAPER_TONE_WASHES: Record<ReportTone, string> = {
  neutral: PAPER_PALETTE.panel,
  ok: PAPER_PALETTE.accentWash,
  warn: PAPER_PALETTE.copperWash,
  bad: PAPER_PALETTE.dangerWash,
};
