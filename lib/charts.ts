// Shared chart styling for Recharts (docs/DESIGN.md: hairline grid, ink and redline series).
export const C = { ink: '#17191E', ink2: '#474B54', red: '#B42318', green: '#1F6F4A', amber: '#8A5300', quill: '#2C4A8C', rule: '#DCD6CA', muted: '#656973', marker: '#F7DC6F' };
export const axis = { tick: { fill: C.muted, fontSize: 11 }, axisLine: { stroke: C.rule }, tickLine: false } as const;
export const tooltip = {
  contentStyle: { background: '#fff', border: `1px solid ${C.rule}`, borderRadius: 8, fontSize: 12, boxShadow: '0 6px 18px -10px rgba(23,25,30,.3)' },
  labelStyle: { fontWeight: 700, color: C.ink }, cursor: { fill: 'rgba(23,25,30,.04)' },
} as const;
export const AS_OF = '2026-11-18';
export const daysUntil = (d: string) => Math.round((Date.parse(d) - Date.parse(AS_OF)) / 864e5);
