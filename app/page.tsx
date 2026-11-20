'use client';

// Change inbox: KPIs, the effective-date runway, and a three-pane docket (filters · notices · reading pane).
import { CalendarClock, FileWarning, Filter, Inbox, Layers, Search, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NoticePane } from '@/components/NoticePane';
import { ApplicabilityPill, Drawer, EmptyState, ErrorState, Kpi, PageSkeleton, Pill, PoweredBy, Skeleton, SourceBadge } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { axis, C, daysUntil, tooltip } from '@/lib/charts';
import { data } from '@/lib/client';
import type { NoticeRow } from '@/lib/types';

type View = 'all' | 'needs' | 'applies' | 'dismiss' | 'decided';
const VIEWS: { id: View; label: string; test: (n: NoticeRow) => boolean }[] = [
  { id: 'all', label: 'All notices', test: () => true },
  { id: 'needs', label: 'Needs decision', test: (n) => !n.decision },
  { id: 'applies', label: 'AI: applies', test: (n) => !n.decision && n.aiApplicable === true },
  { id: 'dismiss', label: 'AI: dismiss', test: (n) => !n.decision && n.aiApplicable === false },
  { id: 'decided', label: 'Decided', test: (n) => !!n.decision },
];
const month = (d: string) => new Date(`${d.slice(0, 7)}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const isWide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

export default function ChangeInbox() {
  const [reload, setReload] = useState(0);
  const inbox = useAsync(() => data.inbox(), [reload], true);
  const [view, setView] = useState<View>('needs');
  const [reg, setReg] = useState<string>('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string>('');
  const [drawer, setDrawer] = useState(false);
  const detail = useAsync(() => (selected ? data.notice(selected) : Promise.resolve(null)), [selected, reload], true);

  const notices = useMemo(() => inbox.data?.notices ?? [], [inbox.data]);
  const list = useMemo(() => {
    const t = VIEWS.find((v) => v.id === view)!.test;
    const s = q.trim().toLowerCase();
    return notices.filter((n) => t(n) && (!reg || n.regulator === reg) && (!s || `${n.noticeId} ${n.title} ${n.aiSummary}`.toLowerCase().includes(s)));
  }, [notices, view, reg, q]);

  useEffect(() => { // default selection: the notice in the URL, else the first in the list (desktop only)
    if (selected || !notices.length) return;
    const fromUrl = new URLSearchParams(window.location.search).get('id');
    if (fromUrl) { setSelected(fromUrl); if (!isWide()) setDrawer(true); }
    else if (isWide()) setSelected('RCN-2026-004');
  }, [notices, selected]);
  const pick = useCallback((id: string) => {
    setSelected(id); if (!isWide()) setDrawer(true);
    window.history.replaceState(null, '', `${window.location.pathname}?id=${id}`);
  }, []);

  if (inbox.error) return <ErrorState error={inbox.error} />;
  if (!inbox.data) return <PageSkeleton />;
  const d = inbox.data;

  const thisMonth = notices.filter((n) => n.receivedAt.startsWith(d.asOf.slice(0, 7))).length;
  const prevKey = new Date(Date.parse(`${d.asOf.slice(0, 7)}-01`) - 864e5).toISOString().slice(0, 7);
  const lastMonth = notices.filter((n) => n.receivedAt.startsWith(prevKey)).length;
  const needs = notices.filter((n) => !n.decision).length;
  const dismiss = notices.filter((n) => n.aiApplicable === false).length;
  const obligations = notices.reduce((s, n) => s + n.obligations, 0);
  const gaps = notices.reduce((s, n) => s + n.gaps, 0);
  const soon = notices.filter((n) => daysUntil(n.effective) <= 90 && n.aiApplicable !== false).length;

  const runway = Object.entries(notices.reduce<Record<string, { month: string; clean: number; gaps: number }>>((acc, n) => {
    const k = n.effective.slice(0, 7); acc[k] ??= { month: month(n.effective), clean: 0, gaps: 0 };
    if (n.gaps > 0) acc[k].gaps++; else acc[k].clean++; return acc;
  }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  const regulators = Object.entries(notices.reduce<Record<string, number>>((a, n) => ({ ...a, [n.regulator]: (a[n.regulator] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);

  const pane = detail.data ? <NoticePane key={detail.data.notice.noticeId} file={detail.data} onChanged={() => setReload((r) => r + 1)} /> : null;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="eyebrow">Brivanta Bank · as of {d.asOf}</div>
          <h1 className="font-serif text-[28px] font-semibold tracking-tight leading-tight">Change inbox</h1>
          <p className="text-ink-2 text-[13.5px] mt-0.5">New rules and guidance from the regulator feeds, read and triaged by AI. You make the call.</p>
        </div>
        <div className="flex gap-1.5 flex-wrap"><PoweredBy>Task + stage stream</PoweredBy><PoweredBy>AI_PARSE_DOCUMENT</PoweredBy><SourceBadge p={d.provenance} /></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Received this month" value={thisMonth} icon={<Inbox className="w-4 h-4" />} trend={{ delta: thisMonth - lastMonth, good: 'down', label: 'vs last month' }} />
        <Kpi label="Awaiting decision" value={needs} tone={needs ? 'red' : 'green'} icon={<Filter className="w-4 h-4" />} sub={<span>of {notices.length} notices</span>} />
        <Kpi label="AI dismissals" value={dismiss} icon={<Sparkles className="w-4 h-4" />} sub={<span>out of scope, with a reason</span>} />
        <Kpi label="Obligations extracted" value={obligations} icon={<Layers className="w-4 h-4" />} sub={<span>by AI_EXTRACT</span>} />
        <Kpi label="Open gaps" value={gaps} tone="red" icon={<FileWarning className="w-4 h-4" />} sub={<span>{soon} rules effective ≤ 90 days</span>} />
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-3">
        <section className="panel p-4">
          <div className="flex items-center gap-2 mb-1"><CalendarClock className="w-4 h-4 text-muted" aria-hidden /><h2 className="font-bold text-[13.5px]">Effective-date runway</h2></div>
          <p className="text-[12px] text-muted mb-2">Notices by the month they take effect. Red: at least one obligation not yet met.</p>
          <div className="h-[190px]"><ResponsiveContainer>
            <BarChart data={runway} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={C.rule} strokeDasharray="2 3" />
              <XAxis dataKey="month" {...axis} /><YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tooltip} /><Legend iconType="square" iconSize={9} wrapperStyle={{ fontSize: 11.5 }} />
              <Bar dataKey="clean" name="Mapped, no gaps" stackId="a" fill={C.ink} radius={[0, 0, 0, 0]} maxBarSize={34} />
              <Bar dataKey="gaps" name="Has gaps" stackId="a" fill={C.red} radius={[3, 3, 0, 0]} maxBarSize={34} />
            </BarChart>
          </ResponsiveContainer></div>
        </section>
        <section className="panel p-4">
          <h2 className="font-bold text-[13.5px] mb-2">By regulator</h2>
          <ul className="space-y-1.5">
            {regulators.map(([r, c]) => (
              <li key={r}><button className={`w-full text-left group ${reg === r ? 'font-bold' : ''}`} onClick={() => setReg(reg === r ? '' : r)} aria-pressed={reg === r}>
                <div className="flex justify-between text-[12.5px]"><span className="truncate group-hover:underline">{r}</span><span className="id">{c}</span></div>
                <div className="h-1.5 rounded-full bg-sheet-2 mt-1 overflow-hidden"><div className={`h-full rounded-full transition-all ${reg === r ? 'bg-redline' : 'bg-ink'}`} style={{ width: `${(c / regulators[0][1]) * 100}%` }} /></div>
              </button></li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid lg:grid-cols-[200px_minmax(0,380px)_minmax(0,1fr)] gap-3 items-start">
        <aside className="panel p-2 lg:sticky lg:top-20" aria-label="Inbox filters">
          <div className="tabs-scroll flex lg:flex-col gap-1 overflow-x-auto">
            {VIEWS.map((v) => {
              const c = notices.filter(v.test).length;
              return (
                <button key={v.id} onClick={() => setView(v.id)} aria-pressed={view === v.id}
                  className={`flex items-center justify-between gap-3 px-3 h-9 rounded-md text-[13px] font-semibold whitespace-nowrap transition-colors ${view === v.id ? 'bg-ink text-white' : 'hover:bg-sheet-2'}`}>
                  {v.label}<span className={`id text-[11px] ${view === v.id ? 'text-white/70' : 'text-muted'}`}>{c}</span>
                </button>
              );
            })}
          </div>
          {reg && <div className="px-2 pt-2 mt-1 border-t border-rule text-[12px]">Regulator: <strong>{reg}</strong> <button className="underline ml-1" onClick={() => setReg('')}>clear</button></div>}
        </aside>

        <section className="panel overflow-hidden" aria-label="Notices">
          <div className="p-2.5 border-b border-rule relative">
            <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <label className="sr-only" htmlFor="q">Search notices</label>
            <input id="q" className="field !pl-8" placeholder="Search title, ID or summary" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {list.length === 0 ? <EmptyState title="Nothing here" body="No notices match this filter." /> : (
            <ul className="max-h-[720px] overflow-y-auto divide-y divide-rule/70">
              {list.map((n) => {
                const days = daysUntil(n.effective);
                return (
                  <li key={n.noticeId}>
                    <button onClick={() => pick(n.noticeId)} aria-current={selected === n.noticeId ? 'true' : undefined}
                      className={`w-full text-left px-4 py-3 transition-colors ${selected === n.noticeId ? 'bg-marker/25 shadow-[inset_3px_0_0_#17191E]' : 'hover:bg-sheet-2/60'}`}>
                      <div className="flex items-center gap-2 text-[11.5px] text-muted"><span className="id text-ink-2">{n.noticeId}</span><span className="truncate">{n.regulator}</span><span className="ml-auto whitespace-nowrap">{n.receivedAt.slice(5, 10)}</span></div>
                      <div className="font-serif text-[15px] font-semibold leading-snug mt-0.5">{n.title}</div>
                      <p className="text-[12.5px] text-ink-2 mt-1 line-clamp-2">{n.aiSummary}</p>
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <ApplicabilityPill ai={n.aiApplicable} decision={n.decision?.decision} />
                        <Pill tone="muted">{n.noticeType}</Pill>
                        {n.gaps > 0 && <Pill tone="red">{n.gaps} gap{n.gaps > 1 ? 's' : ''}</Pill>}
                        <span className={`ml-auto text-[11.5px] font-semibold ${days <= 90 && n.aiApplicable !== false ? 'text-redline' : 'text-muted'}`}>{days} d to effective</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="hidden lg:block panel p-5 min-h-[400px]" aria-label="Reading pane">
          {!selected ? <EmptyState title="Select a notice" body="Its AI assessment, obligations and mapping open here." />
            : detail.error ? <ErrorState error={detail.error} />
            : !detail.data || detail.data.notice.noticeId !== selected ? <div className="space-y-3"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-32" /><Skeleton className="h-24" /><Skeleton className="h-48" /></div>
            : pane}
        </section>
      </div>

      {drawer && selected && (
        <Drawer title={detail.data?.notice.title ?? 'Notice'} eyebrow={selected} onClose={() => setDrawer(false)}>
          {detail.error ? <ErrorState error={detail.error} /> : !detail.data || detail.data.notice.noticeId !== selected ? <Skeleton className="h-64" /> : pane}
        </Drawer>
      )}
    </div>
  );
}
