'use client';

// Full notice: the parsed source text with each extracted obligation highlighted, beside the reading pane.
import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { NoticePane } from '@/components/NoticePane';
import { EmptyState, ErrorState, PageSkeleton, PoweredBy, SourceBadge } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function NoticePage() {
  const [id, setId] = useState<string>();
  const [reload, setReload] = useState(0);
  useEffect(() => { setId(new URLSearchParams(window.location.search).get('id') ?? 'RCN-2026-004'); }, []);
  const file = useAsync(() => (id ? data.notice(id) : new Promise<null>(() => {})), [id, reload], true);

  if (file.error) return <ErrorState error={file.error} />;
  if (!id || file.loading && !file.data) return <PageSkeleton />;
  if (!file.data) return <div className="panel"><EmptyState title="Notice not found" body={`No notice ${id}.`} /></div>;
  const f = file.data;
  const refs = new Map(f.obligations.map((o) => [o.ref, o]));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Link href={`/?id=${f.notice.noticeId}`} className="btn no-underline"><ArrowLeft className="w-4 h-4" aria-hidden />Inbox</Link>
        <span className="ml-auto flex gap-1.5 flex-wrap"><PoweredBy>AI_PARSE_DOCUMENT (OCR)</PoweredBy><SourceBadge p={f.provenance} /></span>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4 items-start">
        <article className="panel p-5 md:p-8 lg:sticky lg:top-20" aria-label="Notice text">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="eyebrow">Source document · parsed text</span>
            <a className="btn ml-auto no-underline" href={`${BASE}/notices/${f.notice.noticeId}.pdf`} target="_blank" rel="noreferrer"><Download className="w-3.5 h-3.5" aria-hidden />PDF</a>
          </div>
          <div className="font-serif text-[15.5px] leading-[1.7] space-y-2 break-words">
            {f.text.split('\n').filter(Boolean).map((line, i) => {
              const m = line.match(/^(\d+\.\d+)\s+(.*)$/);
              if (m && refs.has(m[1])) {
                const o = refs.get(m[1])!;
                return (
                  <p key={i} className={`pl-3 border-l-2 ${o.gapType ? 'border-redline' : 'border-approve'}`}>
                    <span className="id font-semibold mr-1.5">{m[1]}</span><span className="mark">{m[2]}</span>
                    {o.gapType && <span className="ml-2 align-middle pill bg-redline-soft text-redline font-sans">{o.gapType}</span>}
                  </p>
                );
              }
              if (/^\d+\.\s/.test(line)) return <h3 key={i} className="font-sans font-extrabold text-[13px] uppercase tracking-[.06em] text-ink-2 pt-3">{line}</h3>;
              if (i < 2) return <p key={i} className={i === 0 ? 'eyebrow !font-sans' : 'text-[22px] font-semibold leading-snug'}>{line}</p>;
              return <p key={i} className={/Synthetic document/.test(line) ? 'text-[12px] text-muted italic pt-3' : ''}>{line}</p>;
            })}
          </div>
        </article>
        <div className="panel p-5"><NoticePane file={f} full onChanged={() => setReload((r) => r + 1)} /></div>
      </div>
    </div>
  );
}
