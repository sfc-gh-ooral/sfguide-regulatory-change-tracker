'use client';

// Gap tracker: every gap the pipeline opened (plus earlier reviews), with owner, due date, status and
// evidence. Board or table view; edits are written to APP.GAP_UPDATES in Live mode.
import { AlarmClock, CheckCircle2, Columns3, Download, ExternalLink, List, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Drawer, ErrorState, GapPill, Kpi, PageSkeleton, Pill, PoweredBy, SourceBadge, StatusPill } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { axis, C, daysUntil, tooltip } from '@/lib/charts';
import { data } from '@/lib/client';
import { GAP_STATUSES } from '@/lib/rct-data';
import type { Gap, Gaps } from '@/lib/types';

const STATUS_BAR: Record<string, string> = { Open: C.red, 'In progress': C.amber, 'Ready for review': C.quill, Closed: C.green };

function Due({ g }: { g: Gap }) {
  const d = daysUntil(g.due);
  if (g.status === 'Closed') return <span className="text-[12px] text-muted">Due {g.due}</span>;
  return <span className={`text-[12px] font-semibold ${d < 0 ? 'text-redline' : d <= 30 ? 'text-caution' : 'text-ink-2'}`}>{d < 0 ? `${-d} d overdue` : `Due in ${d} d`} · {g.due}</span>;
}

function csv(gaps: Gap[]) {
  const cols: (keyof Gap)[] = ['gapId', 'noticeId', 'obligationId', 'gapType', 'description', 'ownerTeam', 'ownerName', 'due', 'status', 'evidenceUrl', 'source'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = [cols.join(','), ...gaps.map((g) => cols.map((c) => esc(g[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' }));
  a.download = 'obliqa-gap-tracker.csv'; a.click(); URL.revokeObjectURL(a.href);
}

function GapEditor({ gap, g, onSaved }: { gap: Gap; g: Gaps; onSaved: () => void }) {
  const [status, setStatus] = useState(gap.status);
  const [owner, setOwner] = useState(gap.ownerName);
  const [evidence, setEvidence] = useState(gap.evidenceUrl);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const save = async () => {
    setSaving(true); setErr(''); setOk(false);
    try { await data.updateGap({ gapId: gap.gapId, status, ownerName: owner, evidenceUrl: evidence.trim(), note: note.trim() }); setNote(''); setOk(true); onSaved(); }
    catch (e) { setErr(String((e as Error).message)); } finally { setSaving(false); }
  };
  return (
    <>
      <div className="flex gap-1.5 flex-wrap"><StatusPill status={gap.status} /><GapPill type={gap.gapType} /><Due g={gap} /></div>
      <p className="text-[14px] leading-relaxed">{gap.description}</p>
      {gap.obligationText && <blockquote className="font-serif text-[14.5px] border-l-2 border-redline pl-3 leading-relaxed"><span className="id text-ink-2 mr-1">{gap.obligationId}</span>{gap.obligationText}</blockquote>}
      <div className="text-[12.5px] text-ink-2">From <Link className="underline" href={`/notice?id=${gap.noticeId}`}>{gap.noticeId}</Link> · {gap.noticeTitle} · source: {gap.source}</div>
      <div className="panel p-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="text-[12px] font-bold" htmlFor="st">Status</label>
            <select id="st" className="field mt-1" value={status} onChange={(e) => setStatus(e.target.value)}>{GAP_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="text-[12px] font-bold" htmlFor="ow">Owner</label>
            <select id="ow" className="field mt-1" value={owner} onChange={(e) => setOwner(e.target.value)}>{g.owners.map((o) => <option key={o.ownerName} value={o.ownerName}>{o.ownerName} · {o.team}</option>)}</select></div>
        </div>
        <div><label className="text-[12px] font-bold" htmlFor="ev">Evidence link (https)</label>
          <input id="ev" className="field mt-1" placeholder="https://grc.example.com/evidence/…" value={evidence} onChange={(e) => setEvidence(e.target.value)} /></div>
        <div><label className="text-[12px] font-bold" htmlFor="nt">Note</label>
          <textarea id="nt" className="field mt-1 min-h-[70px]" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="What changed and why" /></div>
        {err && <p role="alert" className="text-[12.5px] text-redline">{err}</p>}
        {ok && <p role="status" className="text-[12.5px] text-approve font-semibold">Saved. The history below is updated.</p>}
        <button className="btn btn-ink" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save update'}</button>
      </div>
      <div>
        <div className="eyebrow mb-2">History</div>
        {gap.history.length === 0 ? <p className="text-[12.5px] text-muted">No updates yet.</p> : (
          <ol className="relative border-l border-rule ml-1.5 space-y-3">
            {gap.history.map((h, i) => (
              <li key={i} className="pl-4 relative"><span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-ink" aria-hidden />
                <div className="text-[12px] text-muted"><span className="id">{h.updatedAt}</span> · {h.updatedBy}</div>
                <div className="text-[13px] flex gap-1.5 flex-wrap items-center"><StatusPill status={h.status} /> {h.ownerName}{h.evidenceUrl && <a className="underline inline-flex items-center gap-0.5" href={h.evidenceUrl} target="_blank" rel="noreferrer">evidence<ExternalLink className="w-3 h-3" aria-hidden /></a>}</div>
                {h.note && <p className="text-[12.5px] text-ink-2 mt-0.5">{h.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}

export default function GapTracker() {
  const [reload, setReload] = useState(0);
  const g = useAsync(() => data.gaps(), [reload], true);
  const [view, setView] = useState<'board' | 'table'>('board');
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => { setOpenId(new URLSearchParams(window.location.search).get('id')); }, []);
  const gaps = useMemo(() => g.data?.gaps ?? [], [g.data]);

  if (g.error) return <ErrorState error={g.error} />;
  if (!g.data) return <PageSkeleton />;
  const open = gaps.filter((x) => x.status !== 'Closed');
  const overdue = open.filter((x) => daysUntil(x.due) < 0).length;
  const soon = open.filter((x) => { const d = daysUntil(x.due); return d >= 0 && d <= 30; }).length;
  const byTeam = Object.values(gaps.reduce<Record<string, Record<string, number | string>>>((a, x) => {
    a[x.ownerTeam] ??= { team: x.ownerTeam }; a[x.ownerTeam][x.status] = (Number(a[x.ownerTeam][x.status]) || 0) + 1; return a;
  }, {}));
  const current = gaps.find((x) => x.gapId === openId);
  const choose = (id: string | null) => { setOpenId(id); window.history.replaceState(null, '', id ? `${window.location.pathname}?id=${id}` : window.location.pathname); };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="eyebrow">Remediation · as of {g.data.asOf}</div>
          <h1 className="font-serif text-[28px] font-semibold tracking-tight leading-tight">Gap tracker</h1>
          <p className="text-ink-2 text-[13.5px] mt-0.5">Gaps opened by the mapping, plus earlier reviews still in flight. Assign, attach evidence and close.</p>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center"><PoweredBy>Snowflake tables</PoweredBy><SourceBadge p={g.data.provenance} />
          <button className="btn" onClick={() => csv(gaps)}><Download className="w-3.5 h-3.5" aria-hidden />Export CSV</button></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Open gaps" value={open.length} tone="red" icon={<ShieldAlert className="w-4 h-4" />} sub={<span>of {gaps.length} tracked</span>} />
        <Kpi label="Overdue" value={overdue} tone={overdue ? 'red' : 'green'} icon={<AlarmClock className="w-4 h-4" />} />
        <Kpi label="Due in 30 days" value={soon} icon={<AlarmClock className="w-4 h-4" />} />
        <Kpi label="Closed" value={gaps.length - open.length} tone="green" icon={<CheckCircle2 className="w-4 h-4" />} />
      </div>

      <section className="panel p-4">
        <h2 className="font-bold text-[13.5px] mb-2">Gaps by owner team</h2>
        <div className="h-[170px]"><ResponsiveContainer>
          <BarChart data={byTeam} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke={C.rule} strokeDasharray="2 3" />
            <XAxis type="number" allowDecimals={false} {...axis} /><YAxis type="category" dataKey="team" width={130} {...axis} />
            <Tooltip {...tooltip} /><Legend iconType="square" iconSize={9} wrapperStyle={{ fontSize: 11.5 }} />
            {GAP_STATUSES.map((s, i) => <Bar key={s} dataKey={s} stackId="s" fill={STATUS_BAR[s]} maxBarSize={16} radius={i === GAP_STATUSES.length - 1 ? [0, 3, 3, 0] : 0} />)}
          </BarChart>
        </ResponsiveContainer></div>
      </section>

      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-rule bg-sheet p-0.5" role="group" aria-label="View">
          <button aria-pressed={view === 'board'} onClick={() => setView('board')} className={`flex items-center gap-1.5 px-3 h-8 rounded-md text-[12.5px] font-semibold ${view === 'board' ? 'bg-ink text-white' : ''}`}><Columns3 className="w-3.5 h-3.5" aria-hidden />Board</button>
          <button aria-pressed={view === 'table'} onClick={() => setView('table')} className={`flex items-center gap-1.5 px-3 h-8 rounded-md text-[12.5px] font-semibold ${view === 'table' ? 'bg-ink text-white' : ''}`}><List className="w-3.5 h-3.5" aria-hidden />Table</button>
        </div>
      </div>

      {view === 'board' ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
          {GAP_STATUSES.map((s) => {
            const col = gaps.filter((x) => x.status === s);
            return (
              <section key={s} className="rounded-xl bg-sheet-2/70 border border-rule p-2.5 min-w-0" aria-label={s}>
                <div className="flex items-center gap-2 px-1 pb-2"><span className="w-2 h-2 rounded-full" style={{ background: STATUS_BAR[s] }} aria-hidden /><span className="font-bold text-[13px]">{s}</span><span className="id text-muted ml-auto">{col.length}</span></div>
                <div className="space-y-2">
                  {col.length === 0 && <p className="text-[12px] text-muted px-1 py-3">None</p>}
                  {col.map((x) => (
                    <button key={x.gapId} onClick={() => choose(x.gapId)} className={`panel w-full text-left p-3 transition-all hover:-translate-y-0.5 hover:shadow-md ${x.source !== 'Prior review' && x.status !== 'Closed' ? 'border-l-[3px] border-l-redline' : ''}`}>
                      <div className="flex items-center gap-2"><span className="id font-semibold">{x.gapId}</span><span className="ml-auto"><GapPill type={x.gapType} /></span></div>
                      <p className="text-[13px] leading-snug mt-1.5 line-clamp-3">{x.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-ink text-white grid place-items-center text-[10px] font-bold shrink-0" aria-hidden>{x.ownerName.split(' ').map((p) => p[0]).join('')}</span>
                        <span className="text-[12px] truncate">{x.ownerName}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap"><Due g={x} />{x.evidenceUrl && <Pill tone="green">evidence</Pill>}</div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="panel overflow-hidden"><div className="relative overflow-x-auto">
          <table className="table-ledger w-full min-w-[860px]">
            <thead><tr><th>Gap</th><th>Description</th><th>Type</th><th>Owner</th><th>Due</th><th>Status</th><th>Evidence</th></tr></thead>
            <tbody>{gaps.map((x) => (
              <tr key={x.gapId} onClick={() => choose(x.gapId)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && choose(x.gapId)} className={x.status !== 'Closed' && x.source !== 'Prior review' ? 'is-gap' : ''}>
                <td><div className="id font-semibold">{x.gapId}</div><div className="id text-muted">{x.noticeId}</div></td>
                <td className="max-w-[340px]">{x.description}</td><td><GapPill type={x.gapType} /></td>
                <td><div>{x.ownerName}</div><div className="text-[12px] text-muted">{x.ownerTeam}</div></td>
                <td><Due g={x} /></td><td><StatusPill status={x.status} /></td>
                <td>{x.evidenceUrl ? <a className="underline" href={x.evidenceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>link</a> : <span className="text-muted">none</span>}</td>
              </tr>))}</tbody>
          </table>
        </div></section>
      )}

      {current && (
        <Drawer title={`${current.gapId} · ${current.gapType}`} eyebrow={current.ownerTeam} onClose={() => choose(null)}>
          <GapEditor key={current.gapId} gap={current} g={g.data} onSaved={() => setReload((r) => r + 1)} />
        </Drawer>
      )}
    </div>
  );
}
