'use client';

// Ask the rulebook: questions across notices, policies and controls, answered by a Cortex Agent that
// searches them with Cortex Search and cites each source. Sources show as index cards beside the answer.
import { BookOpenText, CornerDownLeft, FileText, Gavel, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Reasoning } from '@/components/Reasoning';
import { PoweredBy, SampleAiBadge, StreamText } from '@/components/ui';
import { data } from '@/lib/client';
import { SUGGESTED } from '@/lib/rct-data';
import type { Answer, Citation } from '@/lib/types';

type Turn = { q: string; a?: Answer; error?: string };
const ASK_STEPS = [
  'Planning with the RULEBOOK_AGENT Cortex Agent',
  'Searching 25 notices, 40 policies and 58 controls with Cortex Search',
  'Reading the top passages and checking dates and limits',
  'Drafting an answer that cites each source',
];
const ICON: Record<string, typeof FileText> = { notice: Gavel, policy: BookOpenText, control: ShieldCheck };

function SourceCard({ c, hot, onHover }: { c: Citation; hot: boolean; onHover: (id: string) => void }) {
  const Icon = ICON[c.type] ?? FileText;
  return (
    <li id={`src-${c.id}`} onMouseEnter={() => onHover(c.id)}
      className={`panel p-3.5 transition-all ${hot ? 'ring-2 ring-quill -translate-y-0.5' : ''}`}>
      <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-quill" aria-hidden /><span className="id font-semibold">{c.id}</span><span className="eyebrow ml-auto">{c.type}</span></div>
      <div className="text-[12.5px] font-semibold mt-1 leading-snug">{c.name.replace(`${c.id} · `, '')}</div>
      <p className="font-serif text-[13px] text-ink-2 mt-1.5 line-clamp-4 leading-snug">{c.text.replace(/\s+/g, ' ')}</p>
      {c.type === 'notice' && <Link href={`/notice?id=${c.id}`} className="text-[12px] underline mt-1.5 inline-block">Open notice</Link>}
    </li>
  );
}

export default function Ask() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [hot, setHot] = useState<string>();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns.length, busy]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true); setQ(''); setHot(undefined);
    setTurns((t) => [...t, { q: question }]);
    try { const a = await data.ask(question); setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, a } : x))); }
    catch (e) { setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: String((e as Error).message) } : x))); }
    finally { setBusy(false); }
  };
  const cite = (id: string) => { setHot(id); document.getElementById(`src-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
  const last = [...turns].reverse().find((t) => t.a);
  const sources = last?.a?.citations ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="eyebrow">Research</div>
          <h1 className="font-serif text-[28px] font-semibold tracking-tight leading-tight">Ask the rulebook</h1>
          <p className="text-ink-2 text-[13.5px] mt-0.5">Questions across the new notices, Brivanta Bank&apos;s policies and its controls. Every claim cites its source.</p>
        </div>
        <div className="flex gap-1.5 flex-wrap"><PoweredBy>Cortex Agent</PoweredBy><PoweredBy>Cortex Search</PoweredBy></div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 items-start">
        <section className="panel flex flex-col min-h-[520px]" aria-label="Conversation">
          <div className="flex-1 p-4 md:p-5 space-y-5">
            {turns.length === 0 && (
              <div className="py-6">
                <p className="font-serif text-[18px] leading-snug max-w-xl">Ask about a deadline, a retention period or whether a rule applies. The answer quotes the clause and the policy it relies on.</p>
                <div className="eyebrow mt-5 mb-2">Try one</div>
                <div className="grid gap-2">{SUGGESTED.map((s) => (
                  <button key={s} className="text-left panel px-3.5 py-2.5 text-[13.5px] hover:bg-sheet-2 transition-colors flex items-center gap-2" onClick={() => ask(s)}>
                    <CornerDownLeft className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden />{s}</button>))}</div>
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className="space-y-3 rise">
                <div className="flex justify-end"><div className="bg-ink text-white rounded-2xl rounded-br-md px-4 py-2.5 text-[13.5px] max-w-[85%]">{t.q}</div></div>
                {!t.a && !t.error && <Reasoning kind="ask" steps={ASK_STEPS} />}
                {t.error && <p role="alert" className="text-[13px] text-redline">{t.error}</p>}
                {t.a && (
                  <div className="border-l-2 border-quill pl-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap"><span className="eyebrow !text-quill">Rulebook agent</span>{t.a.provenance.source === 'mock' && <SampleAiBadge />}
                      {t.a.provenance.latencyMs !== undefined && <span className="id text-muted text-[11px]">{(t.a.provenance.latencyMs / 1000).toFixed(1)} s</span>}</div>
                    <StreamText text={t.a.answer} onCite={cite} hot={hot} />
                    {t.a.citations.length > 0 && <div className="mt-2 text-[11.5px] text-muted">{t.a.citations.length} sources · hover or click a citation to find it</div>}
                  </div>
                )}
              </div>
            ))}
            <div ref={end} />
          </div>
          <form className="border-t border-rule p-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <label htmlFor="ask" className="sr-only">Your question</label>
            <input id="ask" className="field" maxLength={500} placeholder="Ask about any rule, policy or control" value={q} onChange={(e) => setQ(e.target.value)} disabled={busy} />
            <button className="btn btn-ink shrink-0" disabled={busy || !q.trim()}>Ask</button>
          </form>
        </section>

        <aside className="lg:sticky lg:top-20 space-y-2" aria-label="Sources">
          <div className="eyebrow">Sources {sources.length ? `· ${sources.length}` : ''}</div>
          {sources.length === 0 ? <div className="panel p-5 text-[13px] text-muted">Cited notices, policies and controls appear here as index cards.</div> : (
            <ul className="space-y-2">{sources.map((c) => <SourceCard key={c.id} c={c} hot={hot === c.id} onHover={setHot} />)}</ul>
          )}
        </aside>
      </div>
    </div>
  );
}
