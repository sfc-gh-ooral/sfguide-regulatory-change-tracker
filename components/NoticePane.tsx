'use client';

// The reading pane for one notice: AI applicability and summary, the analyst's decision, extracted
// obligations with their mapped policy/control, and a link to the full text. Used by the inbox and /notice.
import { ArrowUpRight, Check, FileText, RefreshCw, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Reasoning } from '@/components/Reasoning';
import { ApplicabilityPill, GapPill, Pill, PoweredBy, SampleAiBadge, Score, StreamText, VerdictPill } from '@/components/ui';
import { daysUntil } from '@/lib/charts';
import { data } from '@/lib/client';
import type { Assessment, Decision, Extraction, NoticeDetail, Remap } from '@/lib/types';

const ASSESS_STEPS = (pages: number) => [
  `Reading the notice text (${pages.toLocaleString()} characters from AI_PARSE_DOCUMENT)`,
  'Comparing its scope with Brivanta Bank\u2019s product profile',
  'Writing applicability and summary with AI_COMPLETE (structured output)',
];

const EXTRACT_STEPS = ['Reading the PDF from the NOTICE_DOCS stage', 'Running AI_PARSE_DOCUMENT (OCR) for the full text', 'Running AI_EXTRACT for header fields and the numbered requirements'];
const REMAP_STEPS = ['Embedding the obligation with AI_EMBED', 'Ranking policy sentences and controls with VECTOR_COSINE_SIMILARITY', 'Judging coverage of the top two policies and controls with AI_COMPLETE'];

/** Runs the Document AI step on this notice now and compares it with what the pipeline stored. Read-only. */
function ExtractAgain({ noticeId, stored }: { noticeId: string; stored: number }) {
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Extraction | null>(null);
  const [err, setErr] = useState('');
  const run = async () => { setBusy(true); setErr(''); setR(null); try { setR(await data.extract(noticeId)); } catch (e) { setErr(String((e as Error).message)); } finally { setBusy(false); } };
  return (
    <div className="px-4 pb-3">
      {busy ? <Reasoning kind="extract" steps={EXTRACT_STEPS} /> : r && (
        <div className="rounded-lg border border-quill/20 bg-quill-soft/50 p-3 text-[12.5px] space-y-1 rise">
          <div className="flex items-center gap-2 flex-wrap"><strong>Fresh extraction</strong>{r.provenance.source === 'mock' ? <SampleAiBadge /> : <span className="text-muted">live · {((r.provenance.latencyMs ?? 0) / 1000).toFixed(1)} s</span>}</div>
          <p>{r.pages} page{r.pages === 1 ? '' : 's'}, {r.chars.toLocaleString()} characters parsed · {r.regulator} · effective {r.effective}</p>
          <p>{r.obligations.length} requirements found{r.obligations.length === stored ? ', the same count the pipeline stored' : ` (the pipeline stored ${stored})`}: {r.obligations.map((o) => `§${o.ref}`).join(', ')}</p>
        </div>
      )}
      {err && <p role="alert" className="text-[12.5px] text-redline">{err}</p>}
      <button className="btn mt-2" onClick={run} disabled={busy}><RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden />Extract again</button>
    </div>
  );
}

/** Re-embeds one obligation, re-ranks policies and controls, and asks AI_COMPLETE for a fresh verdict. Read-only. */
function RemapOne({ obligationId }: { obligationId: string }) {
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Remap | null>(null);
  const [err, setErr] = useState('');
  const run = async () => { setBusy(true); setErr(''); setR(null); try { setR(await data.remap(obligationId)); } catch (e) { setErr(String((e as Error).message)); } finally { setBusy(false); } };
  return (
    <div className="mt-2">
      {busy ? <Reasoning kind="remap" steps={REMAP_STEPS} /> : r && (
        <div className="rounded-lg border border-quill/20 bg-quill-soft/50 p-3 text-[12px] space-y-1 rise">
          <div className="flex items-center gap-2 flex-wrap"><strong>Fresh mapping</strong><VerdictPill verdict={r.verdict as never} />{r.provenance.source === 'mock' ? <SampleAiBadge /> : <span className="text-muted">live · {((r.provenance.latencyMs ?? 0) / 1000).toFixed(1)} s</span>}</div>
          {[...r.policies.map((p) => [p.id, p.title, p.score] as const), ...r.controls.map((c) => [c.id, c.desc, c.score] as const)].map(([id, t, sc]) => (
            <div key={id} className="flex items-center gap-2 min-w-0"><span className="id text-ink shrink-0">{id}</span><span className="truncate min-w-0 flex-1">{t}</span><span className="ml-auto shrink-0"><Score value={sc} /></span></div>
          ))}
          {r.reason && <p className="text-ink-2"><strong className="text-ink">Verdict:</strong> {r.reason}</p>}
        </div>
      )}
      {err && <p role="alert" className="text-[12px] text-redline">{err}</p>}
      {!busy && <button className="text-[12px] font-semibold text-quill underline mt-1" onClick={run}>Re-map this obligation</button>}
    </div>
  );
}

export function NoticePane({ file, onChanged, full = false }: { file: NoticeDetail; onChanged: () => void; full?: boolean }) {
  const n = file.notice;
  const sample = file.provenance.source === 'mock';
  const [assessing, setAssessing] = useState(false);
  const [fresh, setFresh] = useState<Assessment | null>(null);
  const [assessError, setAssessError] = useState('');
  const [choice, setChoice] = useState<Decision['decision'] | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const reassess = async () => {
    setAssessing(true); setAssessError(''); setFresh(null);
    try { setFresh(await data.assess(n.noticeId)); } catch (e) { setAssessError(String((e as Error).message)); } finally { setAssessing(false); }
  };
  const open = (d: Decision['decision']) => {
    setChoice(d);
    setReason(d === 'Not applicable' && n.aiApplicable === false ? n.aiReason : d === 'Applicable' && n.aiApplicable ? `Confirmed: ${n.aiReason}` : '');
  };
  const save = async () => {
    if (!choice || !reason.trim()) return;
    setSaving(true); setSaveError('');
    try { await data.decide({ noticeId: n.noticeId, decision: choice, reason: reason.trim() }); setChoice(null); onChanged(); }
    catch (e) { setSaveError(String((e as Error).message)); } finally { setSaving(false); }
  };
  const a = fresh ?? { applicable: n.aiApplicable, summary: n.aiSummary, reason: n.aiReason, products: n.aiProducts };
  const daysToEffective = daysUntil(n.effective);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap text-[12px] text-muted">
          <span className="id text-ink-2">{n.noticeId}</span><span aria-hidden>·</span><span>{n.regulator}</span><span aria-hidden>·</span><span>{n.noticeType}</span>
        </div>
        <h2 className="font-serif text-[22px] leading-snug font-semibold mt-1">{n.title}</h2>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <ApplicabilityPill ai={n.aiApplicable} decision={n.decision?.decision} />
          <Pill tone={daysToEffective < 90 ? 'red' : 'muted'}>Effective {n.effective} · {daysToEffective} days</Pill>
          {n.gaps > 0 && <Pill tone="red">{n.gaps} gap{n.gaps > 1 ? 's' : ''}</Pill>}
        </div>
      </div>

      <section className="rounded-lg border border-quill/20 bg-quill-soft/50 p-4">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <Sparkles className="w-4 h-4 text-quill" aria-hidden /><span className="font-bold text-[13px]">AI applicability assessment</span>
          {sample && <SampleAiBadge />}
          <span className="ml-auto"><PoweredBy>AI_COMPLETE</PoweredBy></span>
        </div>
        {assessing ? <Reasoning kind="assess" steps={ASSESS_STEPS(file.text.length)} /> : (
          <div key={fresh ? 'fresh' : 'stored'}>
            <div className={`text-[13px] font-bold mb-1 ${a.applicable ? 'text-approve' : 'text-caution'}`}>
              {a.applicable ? 'Applies to Brivanta Bank' : 'Does not apply. Suggested: dismiss'}{fresh && <span className="ml-2 text-muted font-semibold">· fresh assessment</span>}
            </div>
            {fresh ? <StreamText text={a.summary} /> : <p className="text-[14px] leading-relaxed">{a.summary}</p>}
            <p className="text-[13px] text-ink-2 mt-2"><strong className="text-ink">Why:</strong> {a.reason}</p>
            {a.products.length > 0 && <div className="mt-2 flex gap-1.5 flex-wrap">{a.products.map((p) => <Pill key={p} tone="quill">{p}</Pill>)}</div>}
          </div>
        )}
        {assessError && <p role="alert" className="text-[12.5px] text-redline mt-2">{assessError}</p>}
        <button className="btn mt-3" onClick={reassess} disabled={assessing}><RefreshCw className={`w-3.5 h-3.5 ${assessing ? 'animate-spin' : ''}`} aria-hidden />Re-assess</button>
      </section>

      <section className="panel p-4">
        <div className="eyebrow mb-2">Analyst decision</div>
        {n.decision ? (
          <p className="text-[13px]"><strong>{n.decision.decision}</strong> by {n.decision.decidedBy} on {n.decision.decidedAt}. <span className="text-ink-2">{n.decision.reason}</span></p>
        ) : <p className="text-[13px] text-ink-2">No decision yet. Confirm or overrule the AI suggestion; your reason is kept with the notice.</p>}
        {!choice ? (
          <div className="mt-3 flex gap-2 flex-wrap">
            <button className="btn btn-green" onClick={() => open('Applicable')}><Check className="w-3.5 h-3.5" aria-hidden />Applicable</button>
            <button className="btn" onClick={() => open('Not applicable')}><X className="w-3.5 h-3.5" aria-hidden />Not applicable</button>
          </div>
        ) : (
          <div className="mt-3 space-y-2 rise">
            <label className="text-[12.5px] font-bold" htmlFor="reason">Reason for “{choice}”</label>
            <textarea id="reason" className="field min-h-[84px]" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
            {saveError && <p role="alert" className="text-[12.5px] text-redline">{saveError}</p>}
            <div className="flex gap-2"><button className="btn btn-ink" onClick={save} disabled={saving || !reason.trim()}>{saving ? 'Saving…' : 'Save decision'}</button>
              <button className="btn" onClick={() => setChoice(null)}>Cancel</button></div>
          </div>
        )}
        {full && file.decisions.length > 0 && (
          <ol className="mt-3 border-t border-rule pt-3 space-y-1.5">
            {file.decisions.map((d, i) => <li key={i} className="text-[12px] text-ink-2"><span className="id">{d.decidedAt}</span> · <strong>{d.decision}</strong> · {d.decidedBy}: {d.reason}</li>)}
          </ol>
        )}
      </section>

      <section className="panel">
        <div className="flex items-center gap-2 px-4 pt-3.5 pb-2 flex-wrap">
          <span className="eyebrow">Obligations extracted · {file.obligations.length}</span>
          <span className="ml-auto flex gap-1.5 flex-wrap"><PoweredBy>AI_PARSE_DOCUMENT</PoweredBy><PoweredBy>AI_EXTRACT</PoweredBy><PoweredBy>VECTOR_COSINE_SIMILARITY</PoweredBy></span>
        </div>
        <ExtractAgain noticeId={n.noticeId} stored={file.obligations.length} />
        {file.obligations.length === 0 ? <p className="px-4 pb-4 text-[13px] text-muted">No obligations: the notice was not mapped.</p> : (
          <ul className="divide-y divide-rule/70">
            {file.obligations.map((o) => (
              <li key={o.obligationId} className={`px-4 py-3 ${o.gapType ? 'bg-redline-soft/40' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap"><span className="id font-semibold">§{o.ref}</span><VerdictPill verdict={o.verdict} />{o.gapType && <GapPill type={o.gapType} />}</div>
                <p className="font-serif text-[14.5px] leading-snug mt-1.5">{o.text}</p>
                {o.policyId && (
                  <div className="mt-2 grid gap-1 text-[12px] text-ink-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0"><span className="id text-ink shrink-0">{o.policyId}</span><span className="truncate min-w-0 flex-1">{o.policyTitle}</span><span className="ml-auto shrink-0"><Score value={o.policyScore} /></span></div>
                    <div className="flex items-center gap-2 min-w-0"><span className="id text-ink shrink-0">{o.controlId}</span><span className="truncate min-w-0 flex-1">{o.controlDesc}</span><span className="ml-auto shrink-0"><Score value={o.controlScore} /></span></div>
                  </div>
                )}
                {o.verdict !== 'Meets' && o.reason && <p className="text-[12.5px] mt-2 text-ink-2"><strong className="text-ink">Verdict:</strong> {o.reason}</p>}
                {o.conflict && <p className="text-[12.5px] mt-1 text-caution"><strong>Conflict:</strong> {o.conflictReason}</p>}
                {o.policyId && <RemapOne obligationId={o.obligationId} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!full && (
        <Link href={`/notice?id=${n.noticeId}`} className="btn w-full justify-center no-underline"><FileText className="w-4 h-4" aria-hidden />Read the full notice<ArrowUpRight className="w-3.5 h-3.5" aria-hidden /></Link>
      )}
    </div>
  );
}
