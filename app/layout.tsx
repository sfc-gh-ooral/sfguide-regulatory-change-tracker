import type { Metadata } from 'next';
import { IBM_Plex_Mono, Manrope, Source_Serif_4 } from 'next/font/google';
import './globals.css';
import Shell from '@/components/Shell';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-source-serif', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Obliqa Change Desk · Regulatory Change Tracker (Snowflake example)',
  description: 'Read new rules and guidance, map obligations to policies and controls, and track gaps to closure. Synthetic data, fictional regulators.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${serif.variable} ${mono.variable}`}>
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
