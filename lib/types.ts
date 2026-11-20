// Shapes shared by the screens, the live Snowflake implementation and the bundled sample data.
export type Provenance = { source: 'live' | 'mock'; latencyMs?: number };

export type Decision = { decision: 'Applicable' | 'Not applicable'; reason: string; decidedBy: string; decidedAt: string };

export type NoticeRow = {
  noticeId: string;
  regulator: string;
  noticeType: string;
  title: string;
  published: string;
  effective: string;
  receivedAt: string;
  feed: string;
  processedBy: string;
  aiApplicable: boolean | null;
  aiSummary: string;
  aiReason: string;
  aiProducts: string[];
  obligations: number;
  gaps: number;
  decision: Decision | null;
};

export type Inbox = {
  firm: string;
  asOf: string;
  notices: NoticeRow[];
  provenance: Provenance;
};

export type Verdict = 'Meets' | 'Partially meets' | 'Does not meet' | 'Not assessed';

export type MapRow = {
  obligationId: string;
  noticeId: string;
  noticeTitle: string;
  ref: string;
  text: string;
  policyId: string;
  policyTitle: string;
  policyScore: number;
  policy2Id: string;
  policy2Title: string;
  policy2Score: number;
  controlId: string;
  controlDesc: string;
  controlOwner: string;
  controlScore: number;
  verdict: Verdict;
  controlCovers: boolean | null;
  reason: string;
  conflict: boolean;
  conflictReason: string;
  gapId: string | null;
  gapType: string | null;
};

export type ObligationMap = { rows: MapRow[]; provenance: Provenance };

export type NoticeDetail = {
  notice: NoticeRow;
  text: string;
  obligations: MapRow[];
  decisions: Decision[];
  provenance: Provenance;
};

export type GapUpdate = { status: string; ownerName: string; evidenceUrl: string; note: string; updatedBy: string; updatedAt: string };

export type Gap = {
  gapId: string;
  noticeId: string;
  noticeTitle: string;
  obligationId: string | null;
  obligationText: string;
  gapType: string;
  description: string;
  ownerTeam: string;
  ownerName: string;
  due: string;
  status: string;
  evidenceUrl: string;
  source: string;
  history: GapUpdate[];
};

export type Gaps = { asOf: string; gaps: Gap[]; owners: { team: string; ownerName: string }[]; provenance: Provenance };

export type Assessment = { applicable: boolean; summary: string; reason: string; products: string[]; provenance: Provenance };

export type Citation = { id: string; name: string; type: string; text: string };
export type Answer = { answer: string; citations: Citation[]; provenance: Provenance };

export type DecisionInput = { noticeId: string; decision: Decision['decision']; reason: string };
export type GapInput = { gapId: string; status: string; ownerName: string; evidenceUrl: string; note: string };

/** A fresh Document AI pass over one notice's PDF (AI_PARSE_DOCUMENT OCR + AI_EXTRACT). */
export type Extraction = { noticeId: string; pages: number; chars: number; regulator: string; title: string; effective: string;
  obligations: { ref: string; text: string }[]; provenance: Provenance };
/** A fresh mapping of one obligation: AI_EMBED, VECTOR_COSINE_SIMILARITY ranking, AI_COMPLETE coverage verdict. */
export type Remap = { obligationId: string; policies: { id: string; title: string; score: number }[]; controls: { id: string; desc: string; score: number }[];
  verdict: string; controlCovers: boolean | null; reason: string; provenance: Provenance };
