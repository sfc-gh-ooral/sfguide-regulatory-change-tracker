// No-account mode: responses captured from the live app on the same synthetic data
// (scripts/capture-sample.mjs), so Sample and Live show the same numbers and AI text.
// Decisions and gap updates you make are kept in memory for this session only.
import { type RctData, SUGGESTED } from './rct-data';
import gapsJson from './mock/gaps.json';
import inboxJson from './mock/inbox.json';
import mapJson from './mock/map.json';
import { jitter, SAMPLE_DELAY_MS } from './sample-timing';
import type { Answer, Assessment, Decision, DecisionInput, GapInput, Gaps, Inbox, NoticeDetail, NoticeRow, ObligationMap } from './types';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const decisions: (DecisionInput & { decidedAt: string })[] = [];
const gapEdits: (GapInput & { updatedAt: string })[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const SAMPLE_USER = 'you (sample session)';

async function load<T>(path: string): Promise<T | null> {
  if (typeof window === 'undefined') {
    // Server (local dev in Sample mode): read the same files from public/.
    const { readFile } = await import('node:fs/promises');
    try { return JSON.parse(await readFile(`${process.cwd()}/public/mock/${path}`, 'utf8')) as T; } catch { return null; }
  }
  const res = await fetch(`${BASE}/mock/${path}`);
  return res.ok ? ((await res.json()) as T) : null;
}

function latestDecision(id: string): Decision | null {
  const d = [...decisions].reverse().find((x) => x.noticeId === id);
  return d ? { decision: d.decision, reason: d.reason, decidedBy: SAMPLE_USER, decidedAt: d.decidedAt } : null;
}
const withDecision = (n: NoticeRow): NoticeRow => ({ ...n, decision: latestDecision(n.noticeId) ?? n.decision });

let answers: Record<string, Omit<Answer, 'provenance'>> | null = null;
let assessments: Record<string, Omit<Assessment, 'provenance'>> | null = null;

export const mockData: RctData = {
  async inbox() {
    const inbox = clone(inboxJson as unknown as Inbox);
    inbox.notices = inbox.notices.map(withDecision);
    inbox.provenance = { source: 'mock' };
    return inbox;
  },
  async notice(id) {
    if (!/^RCN-\d{4}-\d{3}$/.test(id)) return null;
    const file = await load<NoticeDetail>(`notices/${id}.json`);
    if (!file) return null;
    file.notice = withDecision(file.notice);
    const mine = decisions.filter((d) => d.noticeId === id).reverse()
      .map((d) => ({ decision: d.decision, reason: d.reason, decidedBy: SAMPLE_USER, decidedAt: d.decidedAt }));
    file.decisions = [...mine, ...file.decisions];
    file.provenance = { source: 'mock' };
    return file;
  },
  async map() {
    const m = clone(mapJson as unknown as ObligationMap);
    m.provenance = { source: 'mock' };
    return m;
  },
  async gaps() {
    const g = clone(gapsJson as unknown as Gaps);
    for (const gap of g.gaps) {
      for (const e of gapEdits.filter((x) => x.gapId === gap.gapId)) {
        gap.status = e.status;
        gap.ownerName = e.ownerName;
        gap.ownerTeam = g.owners.find((o) => o.ownerName === e.ownerName)?.team ?? gap.ownerTeam;
        gap.evidenceUrl = e.evidenceUrl;
        gap.history.unshift({ status: e.status, ownerName: e.ownerName, evidenceUrl: e.evidenceUrl, note: e.note, updatedBy: SAMPLE_USER, updatedAt: e.updatedAt });
      }
    }
    g.provenance = { source: 'mock' };
    return g;
  },
  async assess(id) {
    assessments ??= (await load<Record<string, Omit<Assessment, 'provenance'>>>('assessments.json')) ?? {};
    await sleep(jitter(SAMPLE_DELAY_MS.assess));
    const a = assessments[id];
    if (!a) throw new Error('No sample assessment for this notice');
    return { ...a, provenance: { source: 'mock' } };
  },
  async ask(question) {
    answers ??= (await load<Record<string, Omit<Answer, 'provenance'>>>('answers.json')) ?? {};
    await sleep(jitter(SAMPLE_DELAY_MS.ask));
    const hit = answers[question];
    if (hit) return { ...hit, provenance: { source: 'mock' } };
    return {
      answer: `Sample mode has captured answers only for the suggested questions, for example "${SUGGESTED[0]}". Pick one of them, or run the app in Live mode to ask the rulebook agent anything.`,
      citations: [], provenance: { source: 'mock' },
    };
  },
  async decide(d) {
    decisions.push({ ...d, decidedAt: now() });
    return { ok: true };
  },
  async updateGap(g) {
    gapEdits.push({ ...g, updatedAt: now() });
    return { ok: true };
  },
};
