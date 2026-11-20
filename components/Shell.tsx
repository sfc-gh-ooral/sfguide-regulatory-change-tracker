'use client';

// App frame: ink top bar with logo, tabs, environment badge and user chip; sample-mode notice; disclaimer.
import { ClipboardList, Inbox, MessageSquareQuote, Network } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { LogoMark } from '@/components/Logo';
import { ModeChip } from '@/components/ModeChip';
import { HOSTED_EXAMPLE } from '@/lib/hosted';

const NAV = [
  { href: '/', label: 'Change inbox', icon: Inbox },
  { href: '/map', label: 'Obligation map', icon: Network },
  { href: '/gaps', label: 'Gap tracker', icon: ClipboardList },
  { href: '/ask', label: 'Ask the rulebook', icon: MessageSquareQuote },
];
const REPO = 'https://github.com/sfc-gh-ooral/sfguide-regulatory-change-tracker';

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname().replace(/\/$/, '') || '/';
  const active = (href: string) => (href === '/' ? pathname === '/' || pathname.startsWith('/notice') : pathname === href);

  return (
    <div className="min-h-screen flex flex-col">
      {HOSTED_EXAMPLE && (
        <div role="note" className="bg-caution-soft text-ink-2 text-xs px-4 md:px-6 py-2 border-b border-rule">
          <strong className="text-ink">Sample data mode.</strong> Runs in your browser on synthetic data, no Snowflake account needed. AI answers were captured from the live app.{' '}
          <a href={REPO} className="underline underline-offset-2 font-semibold">Run it in your own account</a>
        </div>
      )}
      <header className="bg-ink text-white sticky top-0 z-30">
        <div className="flex items-center gap-3 px-4 md:px-6 h-14">
          <Link href="/" className="flex items-center gap-2.5 no-underline shrink-0" aria-label="Obliqa Change Desk home">
            <LogoMark />
            <span className="leading-tight">
              <span className="block font-extrabold tracking-tight text-[15px]">Obliqa</span>
              <span className="block text-[10.5px] text-white/60 font-semibold uppercase tracking-[.12em]">Change Desk</span>
            </span>
          </Link>
          <nav aria-label="Main" className="hidden lg:flex items-center gap-1 ml-6">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined}
                className={`flex items-center gap-2 px-3 h-9 rounded-md text-[13px] font-semibold no-underline transition-colors ${active(href) ? 'bg-white text-ink' : 'text-white/75 hover:text-white hover:bg-white/10'}`}>
                <Icon className="w-4 h-4" aria-hidden />{label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 min-w-0">
            <ModeChip />
            <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-white/15" title="Signed-in analyst (fictional)">
              <span className="w-8 h-8 rounded-full bg-white text-ink grid place-items-center text-[12px] font-extrabold" aria-hidden>MA</span>
              <span className="leading-tight hidden md:block">
                <span className="block text-[12.5px] font-bold">Marco Adeyemi</span>
                <span className="block text-[11px] text-white/60">Compliance · Brivanta Bank</span>
              </span>
            </div>
          </div>
        </div>
        <nav aria-label="Main (compact)" className="lg:hidden tabs-scroll flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined}
              className={`flex items-center gap-1.5 px-3 h-8 rounded-md text-[12.5px] font-semibold no-underline whitespace-nowrap ${active(href) ? 'bg-white text-ink' : 'text-white/75'}`}>
              <Icon className="w-3.5 h-3.5" aria-hidden />{label}
            </Link>
          ))}
        </nav>
      </header>
      <main key={pathname} className="rise flex-1 w-full max-w-[1480px] mx-auto px-4 md:px-6 py-5 min-w-0">{children}</main>
      <footer className="border-t border-rule text-[11.5px] text-muted px-4 md:px-6 py-4 leading-relaxed">
        Obliqa, Brivanta Bank, the regulators and every rule here are fictional; all data is synthetic. Not legal, regulatory or compliance advice.
        AI assessments and mappings are suggestions for a compliance analyst to review. A Snowflake example app.
      </footer>
    </div>
  );
}
