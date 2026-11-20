'use client';

// Shared UI primitives in the Obliqa design system (docs/DESIGN.md).
import { AlertTriangle, Bot, Database, Inbox as InboxIcon, Sparkles, Timer, TrendingDown, TrendingUp, X } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Provenance } from '@/lib/types';

type Tone = 'red' | 'green' | 'amber' | 'quill' | 'ink' | 'muted';
const TONE: Record<Tone, string> = {
  red: 'bg-redline-soft text-redline', green: 'bg-approve-soft text-approve', amber: 'bg-caution-soft text-caution',
  quill: 'bg-quill-soft text-quill', ink: 'bg-ink text-white', muted: 'bg-sheet-2 text-ink-2',
};
export function Pill({ tone = 'muted', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span className={`pill ${TONE[tone]}`} title={title}>{children}</span>;
}

export const VERDICT_TONE: Record<string, Tone> = { Meets: 'green', 'Partially meets': 'amber', 'Does not meet': 'red', 'Not assessed': 'muted' };
export const VerdictPill = ({ verdict }: { verdict: string }) => <Pill tone={VERDICT_TONE[verdict] ?? 'muted'}>{verdict}</Pill>;
export const GAP_TONE: Record<string, Tone> = { 'Requirement not met': 'red', 'No control': 'red', 'Policy conflict': 'amber', 'Prior review': 'quill' };
export const GapPill = ({ type }: { type: string }) => <Pill tone={GAP_TONE[type] ?? 'muted'}>{type}</Pill>;
export const STATUS_TONE: Record<string, Tone> = { Open: 'red', 'In progress': 'amber', 'Ready for review': 'quill', Closed: 'green' };
export const StatusPill = ({ status }: { status: string }) => <Pill tone={STATUS_TONE[status] ?? 'muted'}>{status}</Pill>;

export function ApplicabilityPill({ ai, decision }: { ai: boolean | null; decision?: string | null }) {
  if (decision) return <Pill tone={decision === 'Applicable' ? 'green' : 'muted'} title="Analyst decision">{decision === 'Applicable' ? '✓ Applicable' : '✕ Not applicable'}</Pill>;
  if (ai === null) return <Pill tone="muted">Not assessed</Pill>;
  return <Pill tone={ai ? 'quill' : 'amber'} title="AI suggestion, awaiting analyst decision"><Sparkles className="w-3 h-3" aria-hidden />{ai ? 'AI: applies' : 'AI: dismiss'}</Pill>;
}

/** Similarity score as a thin bar with the 0.55 review line. */
export function Score({ value, low = 0.55 }: { value: number; low?: number }) {
  const weak = value < low;
  return (
    <span className="inline-flex items-center gap-2 min-w-[92px]" title={weak ? `Below the ${low} review line` : 'Cosine similarity (VECTOR_COSINE_SIMILARITY)'}>
      <span className="relative h-1.5 w-14 rounded-full bg-sheet-2 overflow-hidden" aria-hidden>
        <span className={`absolute inset-y-0 left-0 rounded-full ${weak ? 'bg-redline' : 'bg-ink'}`} style={{ width: `${Math.max(4, value * 100)}%` }} />
        <span className="absolute inset-y-0 w-px bg-caution" style={{ left: `${low * 100}%` }} />
      </span>
      <span className={`id ${weak ? 'text-redline font-semibold' : 'text-ink-2'}`}>{value.toFixed(2)}</span>
    </span>
  );
}

/** Animated count-up (respects reduced motion). */
export function Counter({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(value); return; }
    const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / 700); setN(value * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n.toFixed(decimals)}</>;
}

export function Kpi({ label, value, sub, trend, tone = 'ink', icon }: { label: string; value: number; sub?: ReactNode; trend?: { delta: number; good: 'up' | 'down'; label: string }; tone?: 'ink' | 'red' | 'green'; icon?: ReactNode }) {
  const color = tone === 'red' ? 'text-redline' : tone === 'green' ? 'text-approve' : 'text-ink';
  const up = trend && trend.delta >= 0;
  const good = trend && (trend.good === 'up' ? up : !up);
  return (
    <div className="panel px-4 py-3.5 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-2"><span className="eyebrow">{label}</span>{icon && <span className="text-muted" aria-hidden>{icon}</span>}</div>
      <div className={`mt-1 text-[28px] leading-none font-extrabold tracking-tight tabular-nums ${color}`}><Counter value={value} /></div>
      <div className="mt-2 flex items-center gap-2 text-[11.5px] text-muted flex-wrap">
        {trend && (
          <span className={`inline-flex items-center gap-0.5 font-bold ${good ? 'text-approve' : 'text-redline'}`}>
            {up ? <TrendingUp className="w-3 h-3" aria-hidden /> : <TrendingDown className="w-3 h-3" aria-hidden />}{up ? '+' : ''}{trend.delta} {trend.label}
          </span>
        )}
        {sub}
      </div>
    </div>
  );
}

/** Names the Snowflake capability behind a component. */
export function PoweredBy({ children }: { children: ReactNode }) {
  return <span className="pill bg-sheet-2 text-ink-2 border border-rule"><Database className="w-3 h-3" aria-hidden />{children}</span>;
}
export function SampleAiBadge() {
  return <Pill tone="amber" title="Captured from the live app, not live Cortex output"><Bot className="w-3 h-3" aria-hidden />Sample AI response</Pill>;
}
export function SourceBadge({ p }: { p?: Provenance }) {
  if (!p) return null;
  if (p.source === 'mock') return <Pill tone="muted"><Database className="w-3 h-3" aria-hidden />Sample data</Pill>;
  return <Pill tone="green" title="Measured round trip from the app server to Snowflake"><Timer className="w-3 h-3" aria-hidden />Live{p.latencyMs !== undefined ? ` · ${p.latencyMs.toLocaleString()} ms` : ''}</Pill>;
}

export function Skeleton({ className = '' }: { className?: string }) { return <div className={`skeleton ${className}`} aria-hidden />; }
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[92px]" />)}</div>
      <Skeleton className="h-56" /><Skeleton className="h-80" />
    </div>
  );
}
export function ErrorState({ error }: { error: string }) {
  return (
    <div role="alert" className="panel p-5 flex gap-3 items-start border-redline/40">
      <AlertTriangle className="w-5 h-5 text-redline shrink-0" aria-hidden />
      <div><div className="font-bold">Could not load this view</div><p className="text-sm text-ink-2 mt-1 break-words">{error}</p>
        <p className="text-xs text-muted mt-2">In Live mode this is the Snowflake error; the app never swaps in sample data. Switch to Sample in the header to keep exploring.</p></div>
    </div>
  );
}
export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="py-10 px-4 text-center">
      <InboxIcon className="w-7 h-7 mx-auto text-muted" aria-hidden />
      <div className="mt-2 font-bold">{title}</div>{body && <p className="text-sm text-muted mt-1">{body}</p>}
    </div>
  );
}

/** Right-hand drawer (full screen on phones). Escape closes; focus moves in. */
export function Drawer({ title, onClose, children, eyebrow }: { title: ReactNode; eyebrow?: ReactNode; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Details'}
        className="drawer absolute right-0 top-0 h-full w-full sm:w-[520px] bg-paper border-l border-rule shadow-2xl flex flex-col">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-rule bg-sheet">
          <div className="min-w-0">{eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}<h2 className="font-serif text-lg font-semibold leading-snug">{title}</h2></div>
          <button ref={ref} className="btn ml-auto !px-2" onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
      </aside>
    </div>
  );
}

// Minimal markdown with citation chips: [RCN-2026-004] / [POL-CMP-01] / [CTL-102] become buttons.
function inline(s: string, key: number, onCite?: (id: string) => void, hot?: string): ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|\[(?:RCN|POL|CTL)-[^\]]+\])/g).filter(Boolean);
  return <Fragment key={key}>{parts.map((p, i) => {
    if (p.startsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^\[(RCN|POL|CTL)-/.test(p)) { const id = p.slice(1, -1).split(/[\s,§]/)[0];
      return <button key={i} type="button" className={`cite ${hot === id ? 'is-hot' : ''}`} onClick={() => onCite?.(id)} aria-label={`Source ${id}`}>{p.slice(1, -1)}</button>; }
    return p;
  })}</Fragment>;
}
export function Markdown({ text, onCite, hot }: { text: string; onCite?: (id: string) => void; hot?: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = []; let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim())); i++; }
      const body = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
      if (body.length) out.push(<table key={k++}><thead><tr>{body[0].map((c, j) => <th key={j}>{inline(c, j, onCite, hot)}</th>)}</tr></thead>
        <tbody>{body.slice(1).map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, j, onCite, hot)}</td>)}</tr>)}</tbody></table>);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l); const items: string[] = [];
      while (i < lines.length) {
        if (/^\s*([-*]|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '')); i++; continue; }
        if (!lines[i].trim() && i + 1 < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i + 1])) { i++; continue; }
        break;
      }
      const li = items.map((t, j) => <li key={j}>{inline(t, j, onCite, hot)}</li>);
      out.push(ordered ? <ol key={k++}>{li}</ol> : <ul key={k++}>{li}</ul>); continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(l)) { i++; continue; }
    if (/^#{1,4}\s/.test(l)) { out.push(<p key={k++}><strong>{l.replace(/^#+\s/, '')}</strong></p>); i++; continue; }
    if (l.trim()) out.push(<p key={k++}>{inline(l, 0, onCite, hot)}</p>);
    i++;
  }
  return <div className="prose-ai text-[14px] leading-relaxed">{out}</div>;
}

/** Streaming-style reveal: words appear over ~1.5 s, then the full markdown renders. */
export function StreamText({ text, onCite, hot, onDone }: { text: string; onCite?: (id: string) => void; hot?: string; onDone?: () => void }) {
  const words = text.split(/(\s+)/);
  const [n, setN] = useState(0);
  const done = n >= words.length;
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(words.length); return; }
    const step = Math.max(2, Math.ceil(words.length / 60));
    const id = window.setInterval(() => setN((x) => { const y = x + step; if (y >= words.length) window.clearInterval(id); return y; }), 28);
    return () => window.clearInterval(id);
  }, [words.length]);
  useEffect(() => { if (done) onDone?.(); }, [done, onDone]);
  if (done) return <Markdown text={text} onCite={onCite} hot={hot} />;
  return <div className="prose-ai text-[14px] leading-relaxed whitespace-pre-wrap caret" aria-live="polite">{words.slice(0, n).join('').replace(/\*\*/g, '')}</div>;
}
