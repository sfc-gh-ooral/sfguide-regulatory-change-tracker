import type { Metadata } from 'next';
import './globals.css';
import Shell from '@/components/Shell';

export const metadata: Metadata = {
  title: 'Regulatory Change Tracker: Snowflake example',
  description: 'Read new rules and guidance, map obligations to policies and controls, and track gaps to closure. Synthetic data, fictional regulators.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
