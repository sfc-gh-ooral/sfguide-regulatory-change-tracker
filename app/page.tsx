'use client';

// Change inbox: every new regulatory publication with an AI applicability assessment and summary.
import { ArrowRight, Workflow } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ApplicabilityPill, Card, Kpi, PoweredBy, SampleAiBadge, SourceBadge, Thinking } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { NoticeRow } from '@/lib/types';

type Filter = 'all' | 'review' | 'applicable' | 'dismissed';
const pending = (n: NoticeRow) => !n.decision;
const applicable = (n: NoticeRow) => (n.decision ? n.decision.decision === 'Applicable' : n.aiApplicable === true);

export default function InboxPage() {
  const { data: inbox, error, loading } = useAsync(() => data.inbox(), []);
  const { data: gaps } = useAsync(() => data.gaps(), []);
  const [filter, setFilter] = useState<Filter>('all');
  const rows = useMemo(() => (inbox?.notices ?? []).filter((n) =>
    filter === 'all' || (filter === 'review' && pending(n)) || (filter === 'applicable' && applicable(n)) || (filter === 'dismissed' && !applicable(n))), [inbox, filter]);

  if (loading) return <Thinking label="Loading the change inbox" />;
  if (error || !inbox) return <Card title="Could not load the inbox"><p className="text-sm">{error}</p></Card>;
  const all = inbox.notices;
  const obligations = all.reduce((s, n) => s + n.obligations, 0);
  const open = (gaps?.gaps ?? []).filter((g) => g.status !== 'Closed');
  const byReg = Object.values(all.reduce<Record<string, { regulator: string; Applicable: number; 'Not applicable': number }>>((m, n) => {
    const k = n.regulator;
    m[k] ??= { regulator: k, Applicable: 0, 'Not applicable': 0 };
    m[k][applicable(n) ? 'Applicable' : 'Not applicable']++;
    return m;
  }, {})).sort((a, b) => b.Applicable + b['Not applicable'] - a.Applicable - a['Not applicable']);
  const short = (r: string) => r.split(/[\s-]+/).map((w) => w[0]).join('');
  const viaTask = all.filter((n) => n.processedBy === 'PROCESS_NOTICES_TASK').length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Change inbox</h1>
          <p className="text-sm muted">New notices land on a stage; a stream and task parse each one, extract its obligations and assess whether it applies to {inbox.firm}.</p>
        </div>
        <div className="flex gap-2 flex-wrap"><PoweredBy>stage + stream + task</PoweredBy><SourceBadge p={inbox.provenance} /></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Notices received" value={String(all.length)} sub={viaTask ? `${viaTask} picked up by the task after setup` : 'Since August 2026'} />
        <Kpi label="Awaiting analyst review" value={String(all.filter(pending).length)} sub={`${all.filter((n) => n.aiApplicable === false).length} auto-dismissed by AI`} />
        <Kpi label="Obligations extracted" value={String(obligations)} sub="AI_EXTRACT, one per numbered requirement" />
        <Kpi label="Open gaps" value={String(open.length)} sub={`${open.filter((g) => g.source === 'AI mapping').length} from new notices`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Notices by regulator" right={<PoweredBy>AI_COMPLETE</PoweredBy>} className="min-w-0">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byReg.map((b) => ({ ...b, short: short(b.regulator) }))} layout="vertical" margin={{ left: 0, right: 12 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <YAxis type="category" dataKey="short" width={48} tick={{ fontSize: 11, fill: 'var(--text-2)' }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12 }}
                  labelFormatter={(_l, p) => p?.[0]?.payload?.regulator ?? ''} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Applicable" stackId="a" fill="var(--chart-1)" />
                <Bar dataKey="Not applicable" stackId="a" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] muted mt-2">All regulators here are fictional.</p>
        </Card>

        <Card className="lg:col-span-2 min-w-0" title="New publications"
          right={<>
            <select aria-label="Filter notices" className="input text-xs" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="all">All notices</option>
              <option value="review">Awaiting review</option>
              <option value="applicable">Applicable</option>
              <option value="dismissed">Not applicable</option>
            </select>
            {inbox.provenance.source === 'mock' && <SampleAiBadge />}
          </>}>
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {rows.map((n) => (
              <li key={n.noticeId}>
                <Link href={`/notice?id=${n.noticeId}`} className="block py-3 px-1 -mx-1 rounded-lg no-underline row-hover">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-[11px] muted">{n.noticeId} · {n.regulator} · {n.noticeType}</div>
                      <div className="text-sm font-semibold">{n.title}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {n.processedBy === 'PROCESS_NOTICES_TASK' && <span className="text-[11px] muted inline-flex items-center gap-1"><Workflow className="w-3 h-3" aria-hidden />via task</span>}
                      <ApplicabilityPill ai={n.aiApplicable} decision={n.decision?.decision} />
                    </div>
                  </div>
                  <p className="text-xs text-2 mt-1 line-clamp-2">{n.aiApplicable === false ? n.aiReason : n.aiSummary}</p>
                  <div className="text-[11px] muted mt-1 flex gap-3 flex-wrap">
                    <span>Effective {n.effective}</span><span>{n.obligations} obligation{n.obligations === 1 ? '' : 's'}</span>
                    {n.gaps > 0 && <span style={{ color: 'var(--negative)' }}>{n.gaps} gap{n.gaps === 1 ? '' : 's'}</span>}
                    <span className="ml-auto inline-flex items-center gap-1">Review<ArrowRight className="w-3 h-3" aria-hidden /></span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
