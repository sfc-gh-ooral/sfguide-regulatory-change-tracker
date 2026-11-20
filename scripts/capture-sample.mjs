// Captures the no-account sample data from the running app in Live mode, so Sample mode shows
// exactly what the live pipeline and agent produced on this synthetic data.
// Usage: start `npm run dev` with .env.local configured, then `node scripts/capture-sample.mjs`.
import { mkdirSync, writeFileSync } from 'node:fs';

const APP = process.env.APP_URL ?? 'http://localhost:3000';
const SUGGESTED = [
  'Does our complaint procedure meet the new final response deadline?',
  'How long must we keep complaint records, and do our policies agree?',
  'What do we need to do about third-party AI models in credit decisions?',
  'Does the annuity suitability rule apply to us?',
  'Which new rules set deadlines for reporting to a regulator?',
];

async function call(op, args = []) {
  const res = await fetch(`${APP}/api/data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, args }) });
  const json = await res.json();
  if (!res.ok) throw new Error(`${op} ${JSON.stringify(args)}: ${json.error}`);
  if (json.provenance?.source !== 'live') throw new Error(`${op} did not come from Live mode`);
  return json;
}
// Sample mode shows "Sample data"; the user who ran setup is replaced so no real name ships.
const scrub = (x) => JSON.parse(JSON.stringify(x).replace(/"(decidedBy|updatedBy)":"[^"]*"/g, '"$1":"analyst"'));
const strip = (x) => { const { provenance, ...rest } = x; return scrub({ provenance: { source: 'mock' }, ...rest, _liveLatencyMs: provenance?.latencyMs }); };

mkdirSync('public/mock/notices', { recursive: true });
mkdirSync('lib/mock', { recursive: true });
const inbox = await call('inbox');
writeFileSync('lib/mock/inbox.json', JSON.stringify(strip(inbox)));
writeFileSync('lib/mock/map.json', JSON.stringify(strip(await call('map'))));
writeFileSync('lib/mock/gaps.json', JSON.stringify(strip(await call('gaps'))));
for (const n of inbox.notices) writeFileSync(`public/mock/notices/${n.noticeId}.json`, JSON.stringify(strip(await call('notice', [n.noticeId]))));
console.log(`Captured inbox, map, gaps and ${inbox.notices.length} notices`);

const assessments = {}, al = [];
for (let i = 0; i < inbox.notices.length; i += 5) {
  await Promise.all(inbox.notices.slice(i, i + 5).map(async (n) => {
    const { provenance, ...a } = await call('assess', [n.noticeId]);
    al.push(provenance.latencyMs); assessments[n.noticeId] = a;
  }));
}
writeFileSync('public/mock/assessments.json', JSON.stringify(assessments));

const answers = {}, ql = [];
for (const q of SUGGESTED) {
  const { provenance, ...a } = await call('ask', [q]);
  ql.push(provenance.latencyMs); answers[q] = a;
}
writeFileSync('public/mock/answers.json', JSON.stringify(answers));
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`assess median ${med(al)} ms (max ${Math.max(...al)}); ask median ${med(ql)} ms (max ${Math.max(...ql)})`);
