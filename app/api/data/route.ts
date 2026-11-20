import { NextResponse } from 'next/server';
import { GAP_ID, GAP_STATUSES, NOTICE_ID, type RctData } from '@/lib/rct-data';
import { mockData } from '@/lib/mock-data';
import { isSnowflakeConfigured } from '@/lib/snowflake';

// One entry point for every screen. Uses Snowflake when .env.local is configured and the user
// hasn't switched to Sample mode (x-rct-mode: sample); otherwise the bundled synthetic data.
// Live failures are returned as errors, never silently replaced with sample data.
const OPS = new Set<keyof RctData>(['inbox', 'notice', 'map', 'gaps', 'assess', 'ask', 'decide', 'updateGap']);
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

function validate(op: string, args: unknown[]): string | null {
  const a = args[0] as Record<string, unknown> | string | undefined;
  if ((op === 'notice' || op === 'assess') && !NOTICE_ID.test(String(a))) return 'Unknown notice';
  if (op === 'ask' && (typeof a !== 'string' || !a.trim() || a.length > 500)) return 'Question must be 1 to 500 characters';
  if (op === 'decide') {
    const d = a as Record<string, unknown>;
    if (!NOTICE_ID.test(String(d?.noticeId)) || !['Applicable', 'Not applicable'].includes(String(d?.decision))) return 'Invalid decision';
    if (typeof d.reason !== 'string' || !d.reason.trim() || d.reason.length > 1000) return 'Give a reason (up to 1,000 characters)';
  }
  if (op === 'updateGap') {
    const g = a as Record<string, unknown>;
    if (!GAP_ID.test(String(g?.gapId)) || !(GAP_STATUSES as readonly string[]).includes(String(g?.status))) return 'Invalid gap update';
    if (typeof g.ownerName !== 'string' || g.ownerName.length > 100 || typeof g.note !== 'string' || g.note.length > 1000) return 'Invalid gap update';
    if (typeof g.evidenceUrl !== 'string' || (g.evidenceUrl && !/^https:\/\/[^\s]{3,300}$/.test(g.evidenceUrl))) return 'Evidence link must be an https:// URL';
  }
  return null;
}

export async function POST(request: Request) {
  const { op, args } = await request.json();
  if (!OPS.has(op) || !Array.isArray(args)) return bad('Unknown operation');
  const err = validate(op, args);
  if (err) return bad(err);

  const wantSample = request.headers.get('x-rct-mode') === 'sample';
  const impl: RctData = isSnowflakeConfigured() && !wantSample ? (await import('@/lib/live-data')).liveData : mockData;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (impl[op as keyof RctData] as (...a: any[]) => Promise<unknown>)(...args);
    return NextResponse.json(result ?? { notFound: true });
  } catch (error) {
    console.error(`${op} failed:`, error);
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 502 });
  }
}
