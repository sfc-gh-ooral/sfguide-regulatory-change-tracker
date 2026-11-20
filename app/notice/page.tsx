'use client';

// Notice detail: the AI assessment and summary, the analyst's applicability decision, the extracted
// obligations with their mapped policies and controls, and the parsed source text.
import { Check, FileText, RefreshCw, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Reasoning } from '@/components/Reasoning';
import { ApplicabilityPill, Card, GapPill, PoweredBy, SampleAiBadge, Score, SourceBadge, Thinking, VerdictPill } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { Assessment, Decision } from '@/lib/types';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function NoticeView() {
  const id = useSearchParams().get('id') ?? 'RCN-2026-004';
  const [reload, setReload] = useState(0);
  const { data: file, error, loading } = useAsync(() => data.notice(id), [id, reload]);
  const [assessing, setAssessing] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [assessError, setAssessError] = useState('');
  const [choice, setChoice] = useState<Decision['decision'] | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showText, setShowText] = useState(false);

  if (loading) return <Thinking label="Loading the notice" />;
  if (error || !file || 'notFound' in (file as object)) return <Card title="Notice not found"><p className="text-sm">{error ?? `No notice ${id}.`} <Link className="underline" href="/">Back to the inbox</Link></p></Card>;
  const n = file.notice;
  const sample = file.provenance.source === 'mock';

  const reassess = async () => {
    setAssessing(true); setAssessError(''); setAssessment(null);
    try { setAssessment(await data.assess(id)); } catch (e) { setAssessError(String((e as Error).message)); } finally { setAssessing(false); }
  };
  const open = (d: Decision['decision']) => {
    setChoice(d);
    setReason(d === 'Not applicable' && n.aiApplicable === false ? n.aiReason : d === 'Applicable' && n.aiApplicable ? `Confirmed: ${n.aiReason}` : '');
  };
  const save = async () => {
    if (!choice || !reason.trim()) return;
    setSaving(true); setSaveError('');
    try { await data.decide({ noticeId: id, decision: choice, reason: reason.trim() }); setChoice(null); setReload((r) => r + 1); }
    catch (e) { setSaveError(String((e as Error).message)); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs muted"><Link href="/" className="underline">Change inbox</Link> / {n.noticeId}</div>
          <h1 className="text-xl font-bold tracking-tight">{n.title}</h1>
          <p className="text-sm muted">{n.regulator} · {n.noticeType} · published {n.published} · effective <strong>{n.effective}</strong></p>
        </div>
        <div className="flex gap-2 flex-wrap items-center"><ApplicabilityPill ai={n.aiApplicable} decision={n.decision?.decision} /><SourceBadge p={file.provenance} /></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 min-w-0" title="AI applicability assessment"
          right={<>{sample && <SampleAiBadge />}<PoweredBy>AI_COMPLETE</PoweredBy>
            <button className="btn btn-ai text-xs" onClick={reassess} disabled={assessing}><RefreshCw className="w-3.5 h-3.5" aria-hidden />Re-assess</button></>}>
          {assessing ? <Reasoning kind="assess" /> : (
            <div className="space-y-2 text-sm">
              {assessError && <p style={{ color: 'var(--negative)' }}>{assessError}</p>}
              {assessment && <div className="text-[11px] muted flex items-center gap-2">Fresh assessment {assessment.provenance.source === 'mock' ? <SampleAiBadge /> : <SourceBadge p={assessment.provenance} />}</div>}
              <p>{assessment?.summary ?? n.aiSummary}</p>
              <p><strong>{(assessment ? assessment.applicable : n.aiApplicable) ? 'Applies to the firm.' : 'Does not apply to the firm.'}</strong> {assessment?.reason ?? n.aiReason}</p>
              {(assessment?.products ?? n.aiProducts).length > 0 && (
                <div className="flex gap-1.5 flex-wrap">{(assessment?.products ?? n.aiProducts).map((p) => <span key={p} className="chip text-[11px]">{p}</span>)}</div>
              )}
            </div>
          )}
        </Card>

        <Card title="Your decision" className="min-w-0">
          {n.decision ? (
            <p className="text-sm mb-3"><strong>{n.decision.decision}</strong> · {n.decision.decidedBy} · {n.decision.decidedAt}<br /><span className="text-2">{n.decision.reason}</span></p>
          ) : <p className="text-sm text-2 mb-3">The AI suggestion is not a decision. Confirm or override it, with a reason for the audit trail.</p>}
          <div className="flex gap-2 flex-wrap">
            <button className={`btn text-xs ${choice === 'Applicable' ? 'btn-primary' : ''}`} onClick={() => open('Applicable')}><Check className="w-3.5 h-3.5" aria-hidden />Applicable</button>
            <button className={`btn text-xs ${choice === 'Not applicable' ? 'btn-primary' : ''}`} onClick={() => open('Not applicable')}><X className="w-3.5 h-3.5" aria-hidden />Not applicable</button>
          </div>
          {choice && (
            <div className="mt-3 space-y-2">
              <label className="text-xs muted block" htmlFor="reason">Reason</label>
              <textarea id="reason" className="input w-full text-sm" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
              {saveError && <p className="text-xs" style={{ color: 'var(--negative)' }}>{saveError}</p>}
              <button className="btn btn-primary text-xs" disabled={saving || !reason.trim()} onClick={save}>{saving ? 'Saving…' : `Record "${choice}"`}</button>
            </div>
          )}
          {file.decisions.length > 1 && <p className="text-[11px] muted mt-3">{file.decisions.length} decisions recorded for this notice.</p>}
        </Card>
      </div>

      <Card title={`Obligations (${file.obligations.length})`} right={<><PoweredBy>AI_EXTRACT</PoweredBy><PoweredBy>AI_EMBED</PoweredBy></>} className="min-w-0">
        <div className="space-y-3">
          {file.obligations.map((o) => (
            <div key={o.obligationId} className={`rounded-lg p-3 border ${o.gapId ? 'gap-row' : ''}`} style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <p className="text-sm min-w-0"><strong>{o.ref}</strong> {o.text}</p>
                <div className="flex gap-2 flex-wrap">{o.gapType && <GapPill type={o.gapType} />}<VerdictPill verdict={o.verdict} /></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 mt-2 text-xs">
                <div className="min-w-0"><span className="muted">Closest policy</span> <strong>{o.policyId}</strong> {o.policyTitle} <Score value={o.policyScore} /></div>
                <div className="min-w-0"><span className="muted">Closest control</span> <strong>{o.controlId}</strong> <Score value={o.controlScore} /><div className="text-2 line-clamp-2">{o.controlDesc}</div></div>
              </div>
              {(o.reason || o.conflictReason) && <p className="text-xs text-2 mt-2">{o.conflict ? o.conflictReason : o.reason}</p>}
            </div>
          ))}
        </div>
        <p className="text-[11px] muted mt-3"><Link className="underline" href="/map">Open the obligation map</Link> to see every obligation across notices.</p>
      </Card>

      <Card title="Source document" right={<><PoweredBy>AI_PARSE_DOCUMENT</PoweredBy>
        <a className="btn text-xs" href={`${BASE}/notices/${n.noticeId}.pdf`} target="_blank" rel="noreferrer"><FileText className="w-3.5 h-3.5" aria-hidden />PDF</a>
        <button className="btn text-xs" onClick={() => setShowText((s) => !s)}>{showText ? 'Hide text' : 'Show parsed text'}</button></>} className="min-w-0">
        <p className="text-xs muted">Received {n.receivedAt} from the {n.feed} · processed by {n.processedBy === 'Setup' ? 'the first pipeline run in setup' : 'the PROCESS_NOTICES_TASK task'}.</p>
        {showText && <pre className="text-xs whitespace-pre-wrap mt-3 p-3 rounded-lg overflow-x-auto" style={{ background: 'var(--surface-2)' }}>{file.text}</pre>}
      </Card>
    </div>
  );
}

export default function NoticePage() {
  return <Suspense fallback={<Thinking label="Loading" />}><NoticeView /></Suspense>;
}
