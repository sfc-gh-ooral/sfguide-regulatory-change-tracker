'use client';

// Gap tracker: owners, due dates, status and evidence for every open regulatory gap.
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Card, GapPill, Kpi, PoweredBy, SourceBadge, StatusPill, Thinking } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import { GAP_STATUSES } from '@/lib/rct-data';
import type { Gap } from '@/lib/types';

const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

function Editor({ gap, owners, onSaved }: { gap: Gap; owners: { team: string; ownerName: string }[]; onSaved: () => void }) {
  const [status, setStatus] = useState(gap.status);
  const [owner, setOwner] = useState(gap.ownerName);
  const [evidence, setEvidence] = useState(gap.evidenceUrl);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try { await data.updateGap({ gapId: gap.gapId, status, ownerName: owner, evidenceUrl: evidence.trim(), note: note.trim() }); onSaved(); }
    catch (e) { setErr(String((e as Error).message)); } finally { setBusy(false); }
  };
  const ownerList = owners.some((o) => o.ownerName === gap.ownerName) ? owners : [{ team: gap.ownerTeam, ownerName: gap.ownerName }, ...owners];
  return (
    <div className="grid sm:grid-cols-2 gap-3 mt-3 text-xs">
      <label className="space-y-1"><span className="muted block">Status</span>
        <select className="input w-full" value={status} onChange={(e) => setStatus(e.target.value)}>{GAP_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="space-y-1"><span className="muted block">Owner</span>
        <select className="input w-full" value={owner} onChange={(e) => setOwner(e.target.value)}>
          {ownerList.map((o) => <option key={o.ownerName} value={o.ownerName}>{o.ownerName} · {o.team}</option>)}</select></label>
      <label className="space-y-1 sm:col-span-2"><span className="muted block">Evidence link (https://)</span>
        <input className="input w-full" placeholder="https://grc.example.com/evidence/…" value={evidence} onChange={(e) => setEvidence(e.target.value)} maxLength={300} /></label>
      <label className="space-y-1 sm:col-span-2"><span className="muted block">Note</span>
        <textarea className="input w-full" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="What changed, and what is still needed" /></label>
      {err && <p className="sm:col-span-2" style={{ color: 'var(--negative)' }}>{err}</p>}
      <div className="sm:col-span-2"><button className="btn btn-primary text-xs" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save update'}</button></div>
    </div>
  );
}

function GapsView() {
  const focus = useSearchParams().get('id');
  const [reload, setReload] = useState(0);
  const { data: g, error, loading } = useAsync(() => data.gaps(), [reload]);
  const [open, setOpen] = useState<string | null>(focus);
  const [status, setStatus] = useState('active');
  useEffect(() => { if (focus) setOpen(focus); }, [focus]);
  const rows = useMemo(() => (g?.gaps ?? []).filter((x) => status === 'all' || (status === 'active' ? x.status !== 'Closed' : x.status === status)), [g, status]);

  if (loading) return <Thinking label="Loading the gap tracker" />;
  if (error || !g) return <Card title="Could not load the gap tracker"><p className="text-sm">{error}</p></Card>;
  const active = g.gaps.filter((x) => x.status !== 'Closed');
  const soon = active.filter((x) => days(g.asOf, x.due) <= 45);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Gap tracker</h1>
          <p className="text-sm muted">Gaps from the obligation map get the owner of the closest policy and a due date 30 days before the rule takes effect. Owners update status and attach evidence.</p>
        </div>
        <div className="flex gap-2 flex-wrap"><PoweredBy>Snowflake tables + app write-back</PoweredBy><SourceBadge p={g.provenance} /></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Open gaps" value={String(active.length)} sub={`${active.filter((x) => x.source === 'AI mapping').length} from new notices`} />
        <Kpi label="Due within 45 days" value={String(soon.length)} sub={`As of ${g.asOf}`} />
        <Kpi label="Ready for review" value={String(g.gaps.filter((x) => x.status === 'Ready for review').length)} sub="Evidence attached, awaiting sign-off" />
        <Kpi label="Closed" value={String(g.gaps.filter((x) => x.status === 'Closed').length)} sub="With an evidence link" />
      </div>

      <Card className="min-w-0" title="Gaps" right={
        <select aria-label="Filter gaps" className="input text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Not closed</option><option value="all">All gaps</option>
          {GAP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>}>
        <ul className="space-y-2">
          {rows.map((x) => {
            const left = days(g.asOf, x.due);
            return (
              <li key={x.gapId} className={`rounded-lg border p-3 ${x.gapId === open ? 'ring-2' : ''}`} style={{ borderColor: 'var(--border)', ['--tw-ring-color' as string]: 'var(--accent)' }}>
                <button className="w-full text-left" onClick={() => setOpen(open === x.gapId ? null : x.gapId)} aria-expanded={open === x.gapId}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-[11px] muted">{x.gapId} · {x.noticeId} · {x.noticeTitle}</div>
                      <div className="text-sm font-medium">{x.obligationText || x.description}</div>
                    </div>
                    <div className="flex gap-2 flex-wrap items-center"><GapPill type={x.gapType} /><StatusPill status={x.status} /></div>
                  </div>
                  {x.obligationText && <p className="text-xs text-2 mt-1">{x.description}</p>}
                  <div className="text-[11px] muted mt-1.5 flex gap-3 flex-wrap">
                    <span>Owner <strong style={{ color: 'var(--text)' }}>{x.ownerName}</strong> · {x.ownerTeam}</span>
                    <span style={x.status !== 'Closed' && left <= 45 ? { color: 'var(--warning)' } : undefined}>Due {x.due}{x.status !== 'Closed' ? ` (${left >= 0 ? `${left} days` : `${-left} days overdue`})` : ''}</span>
                    {x.evidenceUrl ? <span className="inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" aria-hidden />Evidence attached</span> : <span>No evidence yet</span>}
                  </div>
                </button>
                {open === x.gapId && (
                  <div className="border-t mt-3 pt-2" style={{ borderColor: 'var(--border)' }}>
                    {x.evidenceUrl && <p className="text-xs">Evidence: <a className="underline break-all" href={x.evidenceUrl} target="_blank" rel="noreferrer">{x.evidenceUrl}</a> <span className="muted">(example link)</span></p>}
                    {x.obligationId && <p className="text-xs mt-1"><Link className="underline" href={`/notice?id=${x.noticeId}`}>Open the notice</Link></p>}
                    {x.history.length > 0 && (
                      <ul className="text-[11px] muted mt-2 space-y-0.5">{x.history.map((h, i) => <li key={i}>{h.updatedAt} · {h.updatedBy} · {h.status} · {h.ownerName}{h.note ? ` · ${h.note}` : ''}</li>)}</ul>
                    )}
                    <Editor gap={x} owners={g.owners} onSaved={() => setReload((r) => r + 1)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

export default function GapsPage() {
  return <Suspense fallback={<Thinking label="Loading" />}><GapsView /></Suspense>;
}
