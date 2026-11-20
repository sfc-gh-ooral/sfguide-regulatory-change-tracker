'use client';

// Ask the rulebook: questions across the notices, the policy library and controls, answered by a
// Cortex Agent that searches them with Cortex Search and cites each source.
import { Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Reasoning } from '@/components/Reasoning';
import { Card, Markdown, PoweredBy, SampleAiBadge, SourceBadge } from '@/components/ui';
import { data } from '@/lib/client';
import { SUGGESTED } from '@/lib/rct-data';
import type { Answer } from '@/lib/types';

type Turn = { q: string; a?: Answer; error?: string };
const TYPE_LABEL: Record<string, string> = { notice: 'Notice', policy: 'Policy', control: 'Control' };

export default function AskPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true); setQ('');
    setTurns((t) => [...t, { q: question }]);
    try { const a = await data.ask(question); setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, a } : x))); }
    catch (e) { setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: String((e as Error).message) } : x))); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Ask the rulebook</h1>
          <p className="text-sm muted">Ask across the new notices, the bank&apos;s policies and its controls. Every claim in the answer cites its source.</p>
        </div>
        <div className="flex gap-2 flex-wrap"><PoweredBy>Cortex Agents</PoweredBy><PoweredBy>Cortex Search</PoweredBy></div>
      </div>
      <Card>
        <div className="text-xs muted mb-2">Try a question</div>
        <div className="flex gap-2 flex-wrap">
          {SUGGESTED.map((s) => <button key={s} className="btn btn-ai text-xs" disabled={busy} onClick={() => ask(s)}>{s}</button>)}
        </div>
      </Card>

      {turns.map((t, i) => (
        <div key={i} className="space-y-2">
          <div className="card p-3 text-sm font-medium ml-auto max-w-[85%] w-fit" style={{ background: 'var(--accent-soft)' }}>{t.q}</div>
          <Card right={t.a && <>{t.a.provenance.source === 'mock' && <SampleAiBadge />}<SourceBadge p={t.a.provenance} /></>}>
            {t.error ? <p className="text-sm" style={{ color: 'var(--negative)' }}>{t.error}</p> : !t.a ? <Reasoning kind="ask" /> : (
              <>
                <Markdown text={t.a.answer} />
                {t.a.citations.length > 0 && (
                  <ol className="mt-3 space-y-1.5 text-xs border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                    {t.a.citations.map((c) => (
                      <li key={c.id}>
                        <strong>[{c.id}]</strong> {TYPE_LABEL[c.type] ?? c.type} · {c.type === 'notice'
                          ? <Link className="underline" href={`/notice?id=${c.id}`}>{c.name}</Link> : c.name}
                        <div className="muted line-clamp-2">{c.text}</div>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </Card>
        </div>
      ))}

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input className="input flex-1 min-w-0 !py-2" placeholder="Ask about a rule, a policy or a control…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Question" maxLength={500} />
        <button className="btn btn-primary" disabled={busy || !q.trim()} type="submit"><Send className="w-4 h-4" />Ask</button>
      </form>
      <p className="text-[11px] muted">Answers are generated from fictional sources and are not legal advice.</p>
    </div>
  );
}
