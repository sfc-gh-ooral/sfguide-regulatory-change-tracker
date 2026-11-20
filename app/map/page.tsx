'use client';

// Obligation map: every extracted obligation, its closest policies and control by AI_EMBED similarity,
// and the AI_COMPLETE coverage verdict. Gaps are highlighted.
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Card, GapPill, Kpi, PoweredBy, SampleAiBadge, Score, SourceBadge, Thinking, VerdictPill } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';

type Filter = 'all' | 'gaps' | 'review' | 'met' | 'na';

export default function MapPage() {
  const { data: map, error, loading } = useAsync(() => data.map(), []);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const rows = useMemo(() => (map?.rows ?? []).filter((r) =>
    (filter === 'all' || (filter === 'gaps' && r.gapId) || (filter === 'review' && r.verdict === 'Partially meets' && !r.gapId)
      || (filter === 'met' && r.verdict === 'Meets') || (filter === 'na' && r.verdict === 'Not assessed'))
    && (!q || `${r.obligationId} ${r.text} ${r.policyId} ${r.policyTitle} ${r.controlId}`.toLowerCase().includes(q.toLowerCase()))), [map, filter, q]);

  if (loading) return <Thinking label="Loading the obligation map" />;
  if (error || !map) return <Card title="Could not load the obligation map"><p className="text-sm">{error}</p></Card>;
  const all = map.rows;
  const count = (v: string) => all.filter((r) => r.verdict === v).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Obligation map</h1>
          <p className="text-sm muted">Each obligation is matched to the closest policy sentences and controls by vector similarity, then checked for coverage. Low-similarity matches and partial coverage are flagged for review.</p>
        </div>
        <div className="flex gap-2 flex-wrap"><PoweredBy>AI_EMBED</PoweredBy><PoweredBy>AI_COMPLETE</PoweredBy><SourceBadge p={map.provenance} /></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Obligations mapped" value={String(all.length)} sub="To 40 policies and 58 controls" />
        <Kpi label="Covered" value={String(count('Meets'))} sub="Policy and control meet the obligation" />
        <Kpi label="Gaps" value={String(all.filter((r) => r.gapId).length)} sub="Not met, no control, or conflicting policies" />
        <Kpi label="For review" value={String(all.filter((r) => r.verdict === 'Partially meets' && !r.gapId).length)} sub={`${count('Not assessed')} not assessed: notice not applicable`} />
      </div>

      <Card className="min-w-0" title="Obligations to policies and controls"
        right={<>
          <input className="input text-xs" placeholder="Search obligations, policies…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search obligations" />
          <select aria-label="Filter obligations" className="input text-xs" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">All obligations</option>
            <option value="gaps">Gaps only</option>
            <option value="review">Partially met (review)</option>
            <option value="met">Covered</option>
            <option value="na">Not assessed</option>
          </select>
          {map.provenance.source === 'mock' && <SampleAiBadge />}
        </>}>
        <div className="relative overflow-x-auto">
          <table className="data-table w-full text-xs">
            <thead><tr><th className="text-left">Obligation</th><th className="text-left">Closest policies</th><th className="text-left">Closest control</th><th className="text-left">Coverage</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.obligationId} className={r.gapId ? 'gap-row' : ''} style={r.verdict === 'Not assessed' ? { opacity: 0.6 } : undefined}>
                  <td className="align-top min-w-[220px] max-w-[360px]">
                    <Link className="underline muted" href={`/notice?id=${r.noticeId}`}>{r.noticeId} · {r.ref}</Link>
                    <div className="text-[11px] muted">{r.noticeTitle}</div>
                    <div className="mt-1">{r.text}</div>
                  </td>
                  <td className="align-top min-w-[180px]">
                    <div><strong>{r.policyId}</strong> {r.policyTitle}</div><Score value={r.policyScore} />
                    <div className="mt-1.5 muted"><strong>{r.policy2Id}</strong> {r.policy2Title}</div><Score value={r.policy2Score} />
                  </td>
                  <td className="align-top min-w-[180px] max-w-[260px]">
                    <div><strong>{r.controlId}</strong> · {r.controlOwner}</div><Score value={r.controlScore} />
                    <div className="text-2 mt-1 line-clamp-3">{r.controlDesc}</div>
                  </td>
                  <td className="align-top min-w-[200px] max-w-[320px]">
                    <div className="flex gap-1.5 flex-wrap"><VerdictPill verdict={r.verdict} />{r.gapType && <GapPill type={r.gapType} />}</div>
                    <div className="text-2 mt-1">{r.conflict ? r.conflictReason : r.reason || 'The notice does not apply to the firm, so coverage was not assessed.'}</div>
                    {r.gapId && <Link className="underline text-[11px]" href={`/gaps?id=${r.gapId}`}>{r.gapId} in the gap tracker</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
