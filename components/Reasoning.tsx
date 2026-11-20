'use client';

// Staged progress for AI calls. The steps mirror what the live path actually does; they advance on a
// timer and the last one holds until the real (or sample) answer arrives.
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SAMPLE_DELAY_MS } from '@/lib/sample-timing';

export type ReasoningKind = 'assess' | 'ask' | 'extract' | 'remap';

export function Reasoning({ kind, steps }: { kind: ReasoningKind; steps: string[] }) {
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const per = SAMPLE_DELAY_MS[kind] / steps.length;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const ms = Date.now() - t0;
      setElapsed(ms);
      setStep(Math.min(steps.length - 1, Math.floor(ms / per)));
    }, 100);
    return () => window.clearInterval(id);
  }, [kind, steps.length]);

  return (
    <div className="rounded-lg border border-quill/25 bg-quill-soft/60 p-3.5" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <span className="eyebrow !text-quill">Working</span>
        <span className="id text-[11px] text-muted tabular-nums">{(elapsed / 1000).toFixed(1)} s</span>
      </div>
      <ol className="space-y-1.5">
        {steps.map((s, i) => {
          const state = i < step ? 'done' : i === step ? 'active' : 'todo';
          return (
            <li key={s} className={`flex items-center gap-2 text-[12.5px] transition-opacity ${state === 'todo' ? 'opacity-45' : ''}`}>
              {state === 'done' ? <Check className="w-3.5 h-3.5 text-approve" aria-hidden />
                : state === 'active' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-quill" aria-hidden />
                : <span className="w-3.5 h-3.5 rounded-full border border-rule" aria-hidden />}
              <span className={state === 'active' ? 'font-semibold' : ''}>{s}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 h-1 rounded-full bg-white/70 overflow-hidden" aria-hidden>
        <span className="block h-full bg-quill transition-[width] duration-100" style={{ width: `${Math.min(96, (elapsed / SAMPLE_DELAY_MS[kind]) * 100)}%` }} />
      </div>
    </div>
  );
}
