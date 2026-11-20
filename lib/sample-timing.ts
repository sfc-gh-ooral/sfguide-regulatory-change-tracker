// Sample-mode response time per AI surface, in ms. Close to the live latencies measured on the
// example account (see README); a little jitter keeps it from feeling canned, and the total stays within 4 to 8 s.
export const SAMPLE_DELAY_MS = { assess: 4500, ask: 7200, extract: 6000, remap: 5500 } as const;
export const jitter = (ms: number) => Math.min(8000, Math.max(4000, ms + Math.round((Math.random() - 0.5) * 1200)));
