'use client';

// Small shared UI pieces: badges, cards, KPI tiles, similarity bars, and a tiny markdown renderer for AI text.
import { Bot, Database, Sparkles, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Provenance } from '@/lib/types';

export function Card({ title, right, children, className = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 ${className}`}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export const VERDICT_COLOR: Record<string, string> = {
  Meets: 'var(--positive)', 'Partially meets': 'var(--warning)', 'Does not meet': 'var(--negative)', 'Not assessed': 'var(--muted)',
};
export function VerdictPill({ verdict }: { verdict: string }) {
  const c = VERDICT_COLOR[verdict] ?? 'var(--muted)';
  return <Pill color={c} bg={`color-mix(in srgb, ${c} 14%, transparent)`}>{verdict}</Pill>;
}
export const GAP_COLOR: Record<string, string> = {
  'Requirement not met': 'var(--negative)', 'No control': 'var(--negative)', 'Policy conflict': 'var(--warning)', 'Prior review': 'var(--accent)',
};
export function GapPill({ type }: { type: string }) {
  const c = GAP_COLOR[type] ?? 'var(--muted)';
  return <Pill color={c} bg={`color-mix(in srgb, ${c} 14%, transparent)`}>{type}</Pill>;
}
export const STATUS_COLOR: Record<string, string> = {
  Open: 'var(--negative)', 'In progress': 'var(--accent)', 'Ready for review': 'var(--warning)', Closed: 'var(--positive)',
};
export function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? 'var(--muted)';
  return <Pill color={c} bg={`color-mix(in srgb, ${c} 14%, transparent)`}>{status}</Pill>;
}
/** AI applicability, plus the analyst's decision when one has been recorded. */
export function ApplicabilityPill({ ai, decision }: { ai: boolean | null; decision?: string | null }) {
  if (decision) {
    const c = decision === 'Applicable' ? 'var(--accent)' : 'var(--muted)';
    return <Pill color={c} bg={`color-mix(in srgb, ${c} 14%, transparent)`} title="Recorded by a compliance analyst">{decision} · confirmed</Pill>;
  }
  if (ai === null) return <Pill color="var(--muted)" bg="var(--surface-2)">Not assessed</Pill>;
  const c = ai ? 'var(--warning)' : 'var(--muted)';
  return <Pill color={c} bg={`color-mix(in srgb, ${c} 14%, transparent)`} title="AI_COMPLETE assessment, awaiting analyst review">
    <Bot className="w-3 h-3" aria-hidden />{ai ? 'AI: applicable' : 'AI: auto-dismissed'}</Pill>;
}
export function Flag({ children }: { children: ReactNode }) {
  return <Pill color="var(--negative)" bg="color-mix(in srgb, var(--negative) 12%, transparent)">{children}</Pill>;
}
/** Cosine similarity from AI_EMBED vectors, as a small bar. */
export function Score({ value, low = 0.55 }: { value: number; low?: number }) {
  const c = value >= 0.65 ? 'var(--positive)' : value >= low ? 'var(--accent)' : 'var(--negative)';
  return (
    <span className="inline-flex items-center gap-1.5" title="Cosine similarity of AI_EMBED vectors">
      <span className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <span className="block h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, value * 100))}%`, background: c }} />
      </span>
      <span className="text-[11px] tabular" style={{ color: c }}>{value.toFixed(2)}</span>
    </span>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card kpi card-hover p-4">
      <div className="text-[11px] uppercase tracking-wider muted mb-1 font-semibold">{label}</div>
      <div className="kpi-value text-[26px] font-bold tabular tracking-tight">{value}</div>
      {sub && <div className="text-xs muted mt-1">{sub}</div>}
    </div>
  );
}

function Pill({ children, color, bg, title }: { children: ReactNode; color: string; bg: string; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap" style={{ color, background: bg }}>
      {children}
    </span>
  );
}

/** Names the Snowflake capability behind a component. */
export function PoweredBy({ children }: { children: ReactNode }) {
  return <Pill color="var(--accent)" bg="var(--accent-soft)"><Sparkles className="w-3 h-3" aria-hidden />Powered by {children}</Pill>;
}

export function SampleAiBadge() {
  return <Pill color="var(--sample)" bg="var(--sample-soft)" title="Scripted answer in no-account mode, not live Cortex output"><Bot className="w-3 h-3" aria-hidden />Sample AI response</Pill>;
}

/** Shows where data came from; latency only when measured in live mode. */
export function SourceBadge({ p }: { p?: Provenance }) {
  if (!p) return null;
  if (p.source === 'mock') return <Pill color="var(--muted)" bg="var(--surface-2)"><Database className="w-3 h-3" aria-hidden />Sample data</Pill>;
  return (
    <Pill color="var(--text-2)" bg="var(--surface-2)" title="Measured round trip from the app server to Snowflake">
      <Timer className="w-3 h-3" aria-hidden />Live{p.latencyMs !== undefined ? ` · ${p.latencyMs.toLocaleString()} ms` : ''}
    </Pill>
  );
}

export function Thinking({ label = 'Thinking' }: { label?: string }) {
  return <div className="thinking text-xs muted flex items-center gap-2" role="status"><span /><span /><span />{label}…</div>;
}

// Minimal markdown: headings by bold, lists, tables, bold/italic. Text is escaped by React.
function inline(s: string, key: number): ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*)/g).filter(Boolean);
  return <span key={key}>{parts.map((p, i) =>
    p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong>
      : (p.startsWith('_') && p.endsWith('_')) || (p.startsWith('*') && p.endsWith('*')) ? <em key={i}>{p.slice(1, -1)}</em>
        : p)}</span>;
}
export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim())); i++; }
      const body = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
      out.push(<table key={k++}><thead><tr>{body[0].map((c, j) => <th key={j}>{inline(c, j)}</th>)}</tr></thead>
        <tbody>{body.slice(1).map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, j)}</td>)}</tr>)}</tbody></table>);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items: string[] = [];
      while (i < lines.length) {
        if (/^\s*([-*]|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '')); i++; continue; }
        // A blank line between items keeps the same list (and its numbering).
        if (!lines[i].trim() && i + 1 < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i + 1])) { i++; continue; }
        break;
      }
      const li = items.map((t, j) => <li key={j}>{inline(t, j)}</li>);
      out.push(ordered ? <ol key={k++}>{li}</ol> : <ul key={k++}>{li}</ul>);
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(l)) { i++; continue; } // horizontal rule
    if (/^#{1,4}\s/.test(l)) { out.push(<p key={k++}><strong>{l.replace(/^#+\s/, '')}</strong></p>); i++; continue; }
    if (l.trim()) out.push(<p key={k++}>{inline(l, 0)}</p>);
    i++;
  }
  return <div className="prose-ai text-sm leading-relaxed">{out}</div>;
}
