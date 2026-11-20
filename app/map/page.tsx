'use client';

// Obligation map: every extracted obligation, its closest policy and control (VECTOR_COSINE_SIMILARITY over
// AI_EMBED vectors), and the AI_COMPLETE coverage verdict. Gaps and low-confidence matches stand out.
import { ArrowDownUp, ArrowUpRight, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Drawer, EmptyState, ErrorState, GapPill, Kpi, PageSkeleton, Pill, PoweredBy, Score, SourceBadge, VerdictPill } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { axis, C, tooltip } from '@/lib/charts';
import { data } from '@/lib/client';
import type { MapRow } from '@/lib/types';

const LOW = 0.55;
type F = 'all' | 'gaps' | 'low' | 'meets';
type SortKey = 'obligation' | 'policy' | 'control' | 'verdict';
const VERDICT_ORDER = ['Does not meet', 'Partially meets', 'Not assessed', 'Meets'];
const VERDICT_FILL: Record<string, string> = { Meets: C.green, 'Partially meets': C.amber, 'Does not meet': C.red, 'Not assessed': '#B9B3A6' };

export default function ObligationMap() {
  const m = useAsync(() => data.map(), []);
  const [f, setF] = useState<F>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ k: SortKey; asc: boolean }>({ k: 'verdict', asc: true });
  const [open, setOpen] = useState<MapRow | null>(null);

  const rows = useMemo(() => m.data?.rows ?? [], [m.data]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const r = rows.filter((x) => (f === 'all' || (f === 'gaps' && x.gapType) || (f === 'low' && x.policyId && Math.min(x.policyScore, x.controlScore) < LOW) || (f === 'meets' && x.verdict === 'Meets'))
      && (!s || `${x.obligationId} ${x.text} ${x.policyId} ${x.controlId} ${x.noticeTitle}`.toLowerCase().includes(s)));
    const val = (x: MapRow) => sort.k === 'policy' ? x.policyScore : sort.k === 'control' ? x.controlScore : sort.k === 'verdict' ? VERDICT_ORDER.indexOf(x.verdict) * 10 + (x.gapType ? 0 : 1) : 0;
    return [...r].sort((a, b) => sort.k === 'obligation' ? a.obligationId.localeCompare(b.obligationId) * (sort.asc ? 1 : -1) : (val(a) - val(b)) * (sort.asc ? 1 : -1));
  }, [rows, f, q, sort]);

  if (m.error) return <ErrorState error={m.error} />;
  if (!m.data) return <PageSkeleton />;

  const mapped = rows.filter((r) => r.policyId);
  const meets = rows.filter((r) => r.verdict === 'Meets').length;
  const gaps = rows.filter((r) => r.gapType).length;
  const low = mapped.filter((r) => Math.min(r.policyScore, r.controlScore) < LOW).length;
  const bins = Array.from({ length: 8 }, (_, i) => { const lo = 0.3 + i * 0.1; return { bin: lo.toFixed(1), lo, policy: 0, control: 0 }; });
  for (const r of mapped) for (const [k, v] of [['policy', r.policyScore], ['control', r.controlScore]] as const) {
    const b = bins[Math.min(7, Math.max(0, Math.floor((v - 0.3) / 0.1)))]; b[k]++;
  }
  const verdicts = VERDICT_ORDER.map((v) => ({ name: v, value: rows.filter((r) => r.verdict === v).length })).filter((v) => v.value);
  const th = (k: SortKey, label: string) => (
    <th aria-sort={sort.k === k ? (sort.asc ? 'ascending' : 'descending') : 'none'}>
      <button className="inline-flex items-center gap-1 uppercase" onClick={() => setSort((s) => ({ k, asc: s.k === k ? !s.asc : true }))}>{label}<ArrowDownUp className="w-3 h-3" aria-hidden /></button>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="eyebrow">Obligations → policies → controls</div>
          <h1 className="font-serif text-[28px] font-semibold tracking-tight leading-tight">Obligation map</h1>
          <p className="text-ink-2 text-[13.5px] mt-0.5">Each obligation is matched to its closest policy sentence and control, then judged against them. Scores under {LOW} need a human look.</p>
        </div>
        <div className="flex gap-1.5 flex-wrap"><PoweredBy>AI_EMBED</PoweredBy><PoweredBy>VECTOR_COSINE_SIMILARITY</PoweredBy><PoweredBy>AI_COMPLETE</PoweredBy><SourceBadge p={m.data.provenance} /></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Obligations" value={rows.length} sub={<span>{mapped.length} mapped · {rows.length - mapped.length} out of scope</span>} />
        <Kpi label="Meet the rule" value={meets} tone="green" sub={<span>{Math.round((meets / Math.max(1, mapped.length)) * 100)}% of mapped</span>} />
        <Kpi label="Gaps opened" value={gaps} tone="red" sub={<button className="underline" onClick={() => setF('gaps')}>show gaps</button>} />
        <Kpi label="Low-confidence matches" value={low} sub={<button className="underline" onClick={() => setF('low')}>review</button>} />
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-3">
        <section className="panel p-4">
          <h2 className="font-bold text-[13.5px]">Similarity of best matches</h2>
          <p className="text-[12px] text-muted mb-2">How close each obligation sits to its top policy sentence and top control. The amber line is the {LOW} review threshold.</p>
          <div className="h-[190px]"><ResponsiveContainer>
            <BarChart data={bins} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={C.rule} strokeDasharray="2 3" />
              <XAxis dataKey="bin" {...axis} /><YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tooltip} labelFormatter={(l) => `Score ${l}–${(Number(l) + 0.1).toFixed(1)}`} />
              <ReferenceLine x="0.5" stroke={C.amber} strokeDasharray="4 3" label={{ value: 'review', fill: C.amber, fontSize: 10, position: 'insideTopRight' }} />
              <Bar dataKey="policy" name="Policy" fill={C.ink} maxBarSize={18} radius={[2, 2, 0, 0]} />
              <Bar dataKey="control" name="Control" fill="#8C8676" maxBarSize={18} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer></div>
        </section>
        <section className="panel p-4 flex flex-col">
          <h2 className="font-bold text-[13.5px] mb-1">Coverage verdicts</h2>
          <div className="flex items-center gap-4 flex-1 flex-wrap">
            <div className="w-[150px] h-[150px] relative"><ResponsiveContainer>
              <PieChart><Pie data={verdicts} dataKey="value" nameKey="name" innerRadius={46} outerRadius={70} paddingAngle={2} stroke="none">
                {verdicts.map((v) => <Cell key={v.name} fill={VERDICT_FILL[v.name]} />)}</Pie><Tooltip {...tooltip} /></PieChart>
            </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none"><div className="text-center"><div className="text-[22px] font-extrabold leading-none">{rows.length}</div><div className="text-[10.5px] text-muted">obligations</div></div></div>
            </div>
            <ul className="space-y-1.5 text-[12.5px]">{verdicts.map((v) => <li key={v.name} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: VERDICT_FILL[v.name] }} aria-hidden />{v.name}<span className="id ml-auto pl-3">{v.value}</span></li>)}</ul>
          </div>
        </section>
      </div>

      <section className="panel overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-rule flex-wrap">
          <div className="tabs-scroll flex gap-1 overflow-x-auto" role="group" aria-label="Filter obligations">
            {([['all', 'All'], ['gaps', 'Gaps'], ['low', `Low confidence (< ${LOW})`], ['meets', 'Meets']] as [F, string][]).map(([k, l]) => (
              <button key={k} aria-pressed={f === k} onClick={() => setF(k)} className={`px-3 h-8 rounded-md text-[12.5px] font-semibold whitespace-nowrap ${f === k ? 'bg-ink text-white' : 'hover:bg-sheet-2'}`}>{l}</button>
            ))}
          </div>
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="mq" className="sr-only">Search obligations</label>
            <input id="mq" className="field !pl-8" placeholder="Search obligations, IDs" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {shown.length === 0 ? <EmptyState title="No obligations match" /> : (
          <div className="relative overflow-x-auto max-h-[640px]">
            <table className="table-ledger w-full min-w-[920px]">
              <thead><tr>{th('obligation', 'Obligation')}<th>Best policy</th>{th('policy', 'Policy score')}<th>Best control</th>{th('control', 'Control score')}{th('verdict', 'Verdict')}</tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.obligationId} className={r.gapType ? 'is-gap' : ''} onClick={() => setOpen(r)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(r)}>
                    <td className="max-w-[360px]"><div className="id text-ink-2">{r.obligationId}</div><div className="font-serif text-[14px] leading-snug line-clamp-2">{r.text}</div></td>
                    <td className="max-w-[220px]">{r.policyId ? <><div className="id">{r.policyId}</div><div className="text-[12px] text-ink-2 truncate">{r.policyTitle}</div></> : <span className="text-muted text-[12px]">Not mapped (out of scope)</span>}</td>
                    <td>{r.policyId && <Score value={r.policyScore} />}</td>
                    <td className="max-w-[240px]">{r.controlId && <><div className="id">{r.controlId}</div><div className="text-[12px] text-ink-2 line-clamp-2">{r.controlDesc}</div></>}</td>
                    <td>{r.controlId && <Score value={r.controlScore} />}</td>
                    <td><div className="flex flex-col gap-1 items-start"><VerdictPill verdict={r.verdict} />{r.gapType && <GapPill type={r.gapType} />}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {open && (
        <Drawer title={open.noticeTitle} eyebrow={`${open.obligationId} · §${open.ref}`} onClose={() => setOpen(null)}>
          <div className="flex gap-1.5 flex-wrap"><VerdictPill verdict={open.verdict} />{open.gapType && <GapPill type={open.gapType} />}{open.gapId && <Pill tone="ink">{open.gapId}</Pill>}</div>
          <blockquote className="font-serif text-[16px] leading-relaxed border-l-2 border-ink pl-3"><span className="mark">{open.text}</span></blockquote>
          {open.policyId ? (
            <>
              <div className="panel p-3.5 space-y-3">
                <div className="eyebrow">Candidate policies (VECTOR_COSINE_SIMILARITY)</div>
                {[[open.policyId, open.policyTitle, open.policyScore], [open.policy2Id, open.policy2Title, open.policy2Score]].filter(([id]) => id).map(([id, t, s], i) => (
                  <div key={String(id)} className="flex items-center gap-2"><span className="id font-semibold">{id}</span><span className="text-[12.5px] truncate">{t}</span><span className="ml-auto"><Score value={Number(s)} /></span>{i === 0 && <Pill tone="ink">top</Pill>}</div>
                ))}
                <div className="eyebrow pt-1">Closest control</div>
                <div><div className="flex items-center gap-2"><span className="id font-semibold">{open.controlId}</span><span className="ml-auto"><Score value={open.controlScore} /></span></div>
                  <p className="text-[12.5px] text-ink-2 mt-1">{open.controlDesc}</p><p className="text-[12px] text-muted mt-1">Owner: {open.controlOwner}</p></div>
              </div>
              <div className="panel p-3.5"><div className="eyebrow mb-1">Coverage verdict · AI_COMPLETE</div><p className="text-[13.5px] leading-relaxed">{open.reason}</p>
                {open.conflict && <p className="text-[13px] mt-2 text-caution"><strong>Policy conflict:</strong> {open.conflictReason}</p>}</div>
            </>
          ) : <p className="text-[13px] text-ink-2">This obligation comes from a notice assessed as not applicable, so it was not mapped.</p>}
          <div className="flex gap-2 flex-wrap">
            <Link className="btn no-underline" href={`/notice?id=${open.noticeId}`}>Open notice<ArrowUpRight className="w-3.5 h-3.5" aria-hidden /></Link>
            {open.gapId && <Link className="btn btn-red no-underline" href={`/gaps?id=${open.gapId}`}>Open gap {open.gapId}</Link>}
          </div>
        </Drawer>
      )}
    </div>
  );
}
