// One interface, two implementations: lib/mock-data.ts (bundled synthetic captures) and
// lib/live-data.ts (Snowflake). Every screen goes through it.
import type { Answer, Assessment, DecisionInput, GapInput, Gaps, Inbox, NoticeDetail, ObligationMap } from './types';

export interface RctData {
  inbox(): Promise<Inbox>;
  notice(noticeId: string): Promise<NoticeDetail | null>;
  map(): Promise<ObligationMap>;
  gaps(): Promise<Gaps>;
  /** Re-run the AI applicability assessment and summary for one notice. */
  assess(noticeId: string): Promise<Assessment>;
  /** Ask the rulebook agent a question across notices, policies and controls. */
  ask(question: string): Promise<Answer>;
  /** Record a compliance analyst's applicability decision. */
  decide(d: DecisionInput): Promise<{ ok: true }>;
  /** Update a gap's status, owner, evidence link or note. */
  updateGap(g: GapInput): Promise<{ ok: true }>;
}

export const MODEL = process.env.SNOWFLAKE_COMPLETE_MODEL ?? 'claude-sonnet-4-5';
export const GAP_STATUSES = ['Open', 'In progress', 'Ready for review', 'Closed'] as const;

/** Questions offered on "Ask the rulebook". Sample mode has captured live answers for these. */
export const SUGGESTED = [
  'Does our complaint procedure meet the new final response deadline?',
  'How long must we keep complaint records, and do our policies agree?',
  'What do we need to do about third-party AI models in credit decisions?',
  'Does the annuity suitability rule apply to us?',
  'Which new rules set deadlines for reporting to a regulator?',
];

/** Notice and gap ids accepted by the API. */
export const NOTICE_ID = /^RCN-\d{4}-\d{3}$/;
export const GAP_ID = /^GAP-\d{4}$/;
