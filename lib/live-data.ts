// Live mode: reads the pipeline output in REG_CHANGE_DEMO and calls Cortex on demand. Server only.
// AI on demand: AI_COMPLETE (re-assess a notice) and the RULEBOOK_AGENT Cortex Agent (Ask the rulebook),
// which searches the RULEBOOK_SEARCH Cortex Search service. Every statement uses bind variables.
import { MODEL, type RctData } from './rct-data';
import { query } from './snowflake';
import type { Answer, Citation, Decision, Gap, MapRow, NoticeRow, Provenance } from './types';

type Row = Record<string, unknown>;
const AGENT = process.env.SNOWFLAKE_AGENT_NAME ?? 'REG_CHANGE_DEMO.RCT.RULEBOOK_AGENT';
const S = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const N = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const B = (v: unknown) => (v === null || v === undefined ? null : v === true || v === 'true');
const J = <T,>(v: unknown, d: T): T => { if (v === null || v === undefined) return d; try { return (typeof v === 'string' ? JSON.parse(v) : v) as T; } catch { return d; } };
const live = (ms: number): Provenance => ({ source: 'live', latencyMs: ms });
async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> { const t = Date.now(); const r = await fn(); return [r, Date.now() - t]; }

const NOTICE_SQL = `
  SELECT n.notice_id, n.regulator, n.notice_type, n.title, TO_VARCHAR(n.published_date) published, TO_VARCHAR(n.effective_date) effective,
         TO_VARCHAR(n.received_at, 'YYYY-MM-DD HH24:MI') received_at, n.feed, n.processed_by, n.ai_applicable, n.ai_summary, n.ai_reason,
         TO_JSON(n.ai_products) ai_products,
         (SELECT COUNT(*) FROM OBLIGATIONS o WHERE o.notice_id = n.notice_id) obligations,
         (SELECT COUNT(*) FROM GAPS g WHERE g.notice_id = n.notice_id) gaps,
         d.decision, d.reason, d.decided_by, TO_VARCHAR(d.decided_at, 'YYYY-MM-DD HH24:MI') decided_at
  FROM NOTICES n
  LEFT JOIN (SELECT * FROM APP.NOTICE_DECISIONS QUALIFY ROW_NUMBER() OVER (PARTITION BY notice_id ORDER BY decided_at DESC) = 1) d
    ON d.notice_id = n.notice_id`;

const toNotice = (r: Row): NoticeRow => ({
  noticeId: S(r.NOTICE_ID), regulator: S(r.REGULATOR), noticeType: S(r.NOTICE_TYPE), title: S(r.TITLE),
  published: S(r.PUBLISHED), effective: S(r.EFFECTIVE), receivedAt: S(r.RECEIVED_AT), feed: S(r.FEED), processedBy: S(r.PROCESSED_BY),
  aiApplicable: B(r.AI_APPLICABLE), aiSummary: S(r.AI_SUMMARY), aiReason: S(r.AI_REASON), aiProducts: J<string[]>(r.AI_PRODUCTS, []),
  obligations: N(r.OBLIGATIONS), gaps: N(r.GAPS),
  decision: r.DECISION ? { decision: S(r.DECISION) as Decision['decision'], reason: S(r.REASON), decidedBy: S(r.DECIDED_BY), decidedAt: S(r.DECIDED_AT) } : null,
});

const MAP_SQL = `
  SELECT m.obligation_id, m.notice_id, n.title notice_title, o.ref, o.obligation_text,
         m.policy_id, p.title policy_title, m.policy_score, m.policy2_id, p2.title policy2_title, m.policy2_score,
         m.control_id, c.description control_desc, c.owner_name control_owner, m.control_score,
         m.verdict, m.control_covers, m.verdict_reason, m.conflict, m.conflict_reason, g.gap_id, g.gap_type
  FROM OBLIGATION_MAP m
  JOIN OBLIGATIONS o ON o.obligation_id = m.obligation_id
  JOIN NOTICES n ON n.notice_id = m.notice_id
  JOIN POLICIES p ON p.policy_id = m.policy_id
  JOIN POLICIES p2 ON p2.policy_id = m.policy2_id
  JOIN CONTROLS c ON c.control_id = m.control_id
  LEFT JOIN GAPS g ON g.obligation_id = m.obligation_id`;

const toMap = (r: Row): MapRow => ({
  obligationId: S(r.OBLIGATION_ID), noticeId: S(r.NOTICE_ID), noticeTitle: S(r.NOTICE_TITLE), ref: S(r.REF), text: S(r.OBLIGATION_TEXT),
  policyId: S(r.POLICY_ID), policyTitle: S(r.POLICY_TITLE), policyScore: N(r.POLICY_SCORE),
  policy2Id: S(r.POLICY2_ID), policy2Title: S(r.POLICY2_TITLE), policy2Score: N(r.POLICY2_SCORE),
  controlId: S(r.CONTROL_ID), controlDesc: S(r.CONTROL_DESC), controlOwner: S(r.CONTROL_OWNER), controlScore: N(r.CONTROL_SCORE),
  verdict: (S(r.VERDICT) || 'Not assessed') as MapRow['verdict'], controlCovers: B(r.CONTROL_COVERS), reason: S(r.VERDICT_REASON),
  conflict: r.CONFLICT === true, conflictReason: S(r.CONFLICT_REASON), gapId: r.GAP_ID ? S(r.GAP_ID) : null, gapType: r.GAP_TYPE ? S(r.GAP_TYPE) : null,
});

async function config() {
  const rows = await query<Row>("SELECT key, value FROM CONFIG WHERE key IN ('firm_name', 'as_of_date', 'firm_profile')");
  const c = Object.fromEntries(rows.map((r) => [S(r.KEY), S(r.VALUE)]));
  return { firm: c.firm_name, asOf: c.as_of_date, profile: c.firm_profile };
}

// Answer text, plus citations from the Cortex Search results the agent used, in the order the answer cites them.
function parseAgent(resp: Row): Omit<Answer, 'provenance'> {
  const content = (resp.content as Row[] | undefined) ?? [];
  const lastTool = content.map((c) => c.type).lastIndexOf('tool_result');
  const answer = content.slice(lastTool + 1).filter((c) => c.type === 'text').map((c) => S(c.text)).join('\n').trim();
  const found = new Map<string, Citation>();
  for (const c of content) {
    const tr = c.tool_result as Row | undefined;
    for (const part of ((tr?.content as Row[] | undefined) ?? [])) {
      for (const s of (((part.json as Row | undefined)?.search_results as Row[] | undefined) ?? [])) {
        const id = S(s.doc_id);
        if (id && !found.has(id)) {
          const type = id.startsWith('RCN') ? 'notice' : id.startsWith('POL') ? 'policy' : 'control';
          found.set(id, { id, name: S(s.doc_title) || id, type, text: S(s.text).slice(0, 600) });
        }
      }
    }
  }
  const order = [...answer.matchAll(/\[([A-Z]{3}-[\w-]+)\]/g)].map((m) => m[1]);
  const citations = [...new Set(order)].map((id) => found.get(id)).filter((c): c is Citation => !!c);
  return { answer, citations };
}

export const liveData: RctData = {
  async inbox() {
    const [[cfg, rows], ms] = await timed(() => Promise.all([config(), query<Row>(`${NOTICE_SQL} ORDER BY n.received_at DESC`)]));
    return { firm: cfg.firm, asOf: cfg.asOf, notices: rows.map(toNotice), provenance: live(ms) };
  },

  async notice(id) {
    const [[rows, map, decisions], ms] = await timed(() => Promise.all([
      query<Row>(`${NOTICE_SQL.replace('n.processed_by,', 'n.processed_by, n.parsed_text,')} WHERE n.notice_id = ?`, [id]),
      query<Row>(`${MAP_SQL} WHERE m.notice_id = ? ORDER BY o.ref`, [id]),
      query<Row>(`SELECT decision, reason, decided_by, TO_VARCHAR(decided_at, 'YYYY-MM-DD HH24:MI') decided_at
        FROM APP.NOTICE_DECISIONS WHERE notice_id = ? ORDER BY decided_at DESC`, [id]),
    ]));
    if (!rows[0]) return null;
    return {
      notice: toNotice(rows[0]), text: S(rows[0].PARSED_TEXT), obligations: map.map(toMap),
      decisions: decisions.map((d) => ({ decision: S(d.DECISION) as Decision['decision'], reason: S(d.REASON), decidedBy: S(d.DECIDED_BY), decidedAt: S(d.DECIDED_AT) })),
      provenance: live(ms),
    };
  },

  async map() {
    const [rows, ms] = await timed(() => query<Row>(`${MAP_SQL} ORDER BY m.notice_id, o.ref`));
    return { rows: rows.map(toMap), provenance: live(ms) };
  },

  async gaps() {
    const [[cfg, rows, owners, hist], ms] = await timed(() => Promise.all([
      config(),
      query<Row>(`SELECT g.gap_id, g.notice_id, COALESCE(n.title, 'Earlier notice (prior review)') notice_title, g.obligation_id,
          COALESCE(o.obligation_text, '') obligation_text, g.gap_type, g.description, g.owner_team, g.owner_name,
          TO_VARCHAR(g.due_date) due, g.status, COALESCE(g.evidence_url, '') evidence_url, g.source
        FROM GAPS g LEFT JOIN NOTICES n ON n.notice_id = g.notice_id LEFT JOIN OBLIGATIONS o ON o.obligation_id = g.obligation_id
        ORDER BY IFF(g.status = 'Closed', 1, 0), g.due_date`),
      query<Row>('SELECT team, owner_name FROM OWNERS ORDER BY team'),
      query<Row>(`SELECT gap_id, status, owner_name, COALESCE(evidence_url, '') evidence_url, COALESCE(note, '') note, updated_by,
          TO_VARCHAR(updated_at, 'YYYY-MM-DD HH24:MI') updated_at FROM APP.GAP_UPDATES ORDER BY updated_at DESC`),
    ]));
    const gaps: Gap[] = rows.map((r) => ({
      gapId: S(r.GAP_ID), noticeId: S(r.NOTICE_ID), noticeTitle: S(r.NOTICE_TITLE), obligationId: r.OBLIGATION_ID ? S(r.OBLIGATION_ID) : null,
      obligationText: S(r.OBLIGATION_TEXT), gapType: S(r.GAP_TYPE), description: S(r.DESCRIPTION), ownerTeam: S(r.OWNER_TEAM),
      ownerName: S(r.OWNER_NAME), due: S(r.DUE), status: S(r.STATUS), evidenceUrl: S(r.EVIDENCE_URL), source: S(r.SOURCE),
      history: hist.filter((h) => h.GAP_ID === r.GAP_ID).map((h) => ({ status: S(h.STATUS), ownerName: S(h.OWNER_NAME), evidenceUrl: S(h.EVIDENCE_URL),
        note: S(h.NOTE), updatedBy: S(h.UPDATED_BY), updatedAt: S(h.UPDATED_AT) })),
    }));
    return { asOf: cfg.asOf, gaps, owners: owners.map((o) => ({ team: S(o.TEAM), ownerName: S(o.OWNER_NAME) })), provenance: live(ms) };
  },

  async assess(id) {
    const [rows, ms] = await timed(async () => {
      const { profile } = await config();
      return query<{ R: string }>(`SELECT TO_VARCHAR(AI_COMPLETE(
          model => ?,
          prompt => 'You help a bank compliance team triage new regulatory publications. Firm profile: ' || ?
            || ' Read the notice below. Decide whether it applies to this firm, based on who the notice says it applies to and the firm''s products. '
            || 'Write summary as 2 plain sentences on what changes and by when. List the firm''s products or functions affected (empty if not applicable). '
            || 'Give reason as one sentence that names the scope in the notice and why the firm is or is not in it. Notice: ' || parsed_text,
          response_format => TYPE OBJECT(summary STRING, applicable BOOLEAN, products_affected ARRAY(STRING), reason STRING))) AS R
        FROM NOTICES WHERE notice_id = ?`, [MODEL, profile, id]);
    });
    if (!rows[0]) throw new Error('Notice not found');
    const r = J<Row>(rows[0].R, {});
    return { applicable: r.applicable === true, summary: S(r.summary), reason: S(r.reason), products: (r.products_affected as string[]) ?? [], provenance: live(ms) };
  },

  async ask(question) {
    const body = JSON.stringify({ messages: [{ role: 'user', content: [{ type: 'text', text: question }] }] });
    const [rows, ms] = await timed(() => query<{ R: string }>('SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(?, ?, TRUE)::VARCHAR AS R', [AGENT, body]));
    return { ...parseAgent(JSON.parse(rows[0].R)), provenance: live(ms) };
  },

  async decide(d) {
    await query('INSERT INTO APP.NOTICE_DECISIONS (notice_id, decision, reason) VALUES (?, ?, ?)', [d.noticeId, d.decision, d.reason.slice(0, 1000)]);
    return { ok: true };
  },

  async updateGap(g) {
    await query(`UPDATE GAPS SET status = ?, owner_name = ?, owner_team = COALESCE((SELECT team FROM OWNERS WHERE owner_name = ?), owner_team),
        evidence_url = NULLIF(?, ''), updated_by = CURRENT_USER(), updated_at = SYSDATE() WHERE gap_id = ?`,
      [g.status, g.ownerName, g.ownerName, g.evidenceUrl, g.gapId]);
    await query('INSERT INTO APP.GAP_UPDATES (gap_id, status, owner_name, evidence_url, note) VALUES (?, ?, ?, ?, ?)',
      [g.gapId, g.status, g.ownerName, g.evidenceUrl, g.note.slice(0, 1000)]);
    return { ok: true };
  },
};
