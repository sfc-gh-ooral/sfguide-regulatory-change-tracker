// Sample-mode response time per AI surface, in ms. Close to the live latencies measured on the
// example account (see README); a little jitter keeps it from feeling canned.
export const SAMPLE_DELAY_MS = { assess: 4500, ask: 8000 } as const;
export const jitter = (ms: number) => ms + Math.round((Math.random() - 0.5) * 1200);
