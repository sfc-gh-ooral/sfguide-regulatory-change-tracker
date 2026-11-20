// WCAG contrast check for the Obliqa design tokens (docs/DESIGN.md). Exits non-zero below 4.5:1.
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
const lum = (h) => { const [r, g, b] = hex(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = [
  ['ink on paper', '#17191E', '#F7F5F0'], ['ink-2 on paper', '#474B54', '#F7F5F0'], ['muted on paper', '#656973', '#F7F5F0'],
  ['muted on sheet', '#656973', '#FFFFFF'], ['ink-2 on sheet-2', '#474B54', '#EFECE4'], ['redline on redline-soft', '#B42318', '#FBEAE7'],
  ['approve on approve-soft', '#1F6F4A', '#E3F1EA'], ['caution on caution-soft', '#8A5300', '#FBF0D9'], ['quill on quill-soft', '#2C4A8C', '#E7ECF7'],
  ['white on redline', '#FFFFFF', '#B42318'], ['white on approve', '#FFFFFF', '#1F6F4A'], ['white on ink', '#FFFFFF', '#17191E'],
  ['ink on marker', '#17191E', '#F7DC6F'], ['redline on paper', '#B42318', '#F7F5F0'], ['quill on paper', '#2C4A8C', '#F7F5F0'],
];
let bad = 0;
for (const [n, f, b] of pairs) { const r = ratio(f, b); if (r < 4.5) bad++; console.log(`${r >= 4.5 ? 'pass' : 'FAIL'}  ${r.toFixed(2)}:1  ${n}`); }
process.exit(bad ? 1 : 0);
