# Design: Obliqa Change Desk

The Regulatory Change Tracker app is dressed as a fictional product, **Obliqa Change Desk**, used by the compliance team at the fictional Brivanta Bank. "Obliqa" is a coined name (from *obligation*); it is not a real company or product.

## Brand

- **Name:** Obliqa Change Desk. Short form "Obliqa".
- **Audience:** compliance analysts, regulatory affairs leads and control owners at a bank or insurer. They read rules for a living and distrust anything they cannot trace back to a clause.
- **Voice:** precise, calm, citation-first. Sentences name the clause, the policy and the date. No exclamation marks, no hype. Example: "RCN-2026-004 §3.2 sets 15 business days. POL-CMP-01 still allows 30 calendar days."
- **Logo mark** (inline SVG, used in the app header and the landing page): a page with a folded corner, one struck-through line in redline red and a check below it.

```svg
<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
  <rect x="5" y="3" width="22" height="26" rx="3" fill="#FFFFFF" stroke="#17191E" stroke-width="2"/>
  <path d="M21 3v6h6" fill="none" stroke="#17191E" stroke-width="2"/>
  <path d="M10 13h11" stroke="#B42318" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M10 18h6" stroke="#17191E" stroke-width="2" stroke-linecap="round" opacity=".35"/>
  <path d="M10 23l3 3 6-6" fill="none" stroke="#1F6F4A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

## Direction: paper, ink and a redline

The product looks like a well-kept legal file: warm paper, black ink, and one red pen for what changed. Red is reserved for change and risk (deadlines, gaps, conflicts), green for "meets", a highlighter yellow for the words that matter in a clause.

### Palette (light only, by design: the paper metaphor)

| Token | Hex | Use |
| --- | --- | --- |
| `--paper` | `#F7F5F0` | page background |
| `--sheet` | `#FFFFFF` | cards, panels, table rows |
| `--sheet-2` | `#EFECE4` | inset areas, hovered rows, skeletons |
| `--rule` | `#DCD6CA` | borders and gridlines |
| `--ink` | `#17191E` | text, top bar background |
| `--ink-2` | `#474B54` | secondary text |
| `--muted` | `#656973` | captions (4.9:1 on paper) |
| `--redline` | `#B42318` | change, gaps, conflicts, primary action |
| `--redline-soft` | `#FBEAE7` | red pill backgrounds |
| `--approve` | `#1F6F4A` | meets, closed, applicable |
| `--approve-soft` | `#E3F1EA` | green pill backgrounds |
| `--caution` | `#8A5300` | partial, due soon |
| `--caution-soft` | `#FBF0D9` | amber pill backgrounds |
| `--marker` | `#F7DC6F` | highlighter behind key phrases |
| `--quill` | `#2C4A8C` | AI, links, citations |
| `--quill-soft` | `#E7ECF7` | AI panel background |

All text/background pairs are checked by `scripts/check-contrast.mjs` (WCAG AA, 4.5:1 for body text).

### Typography

- **Manrope** (UI, numbers in KPI tiles), weights 400–800.
- **Source Serif 4** for regulation and policy text, notice titles and the landing headline: the "document voice".
- **IBM Plex Mono** for identifiers (RCN-2026-004, POL-CMP-01, CTL-102), clause references and similarity scores.
- Fonts are self-hosted with `next/font` in the app; the landing page uses the same woff2 files copied to `docs/fonts/` (SIL Open Font License, see `docs/fonts/OFL.txt`).

### Layout

- **Top bar, not a sidebar.** A black ink bar carries the logo, four tabs (Inbox, Obligation map, Gap tracker, Ask the rulebook), the environment badge (Sample / Live) and a user chip ("M. Adeyemi · Compliance"). On phones the tabs become a horizontal scroll strip under the bar.
- **Inbox is a docket**: a three-pane reading layout (filter rail · notice list · reading pane), like a mail client for rules. On narrow screens the reading pane opens as a full-screen sheet.
- **Obligation map** is a ledger table with inline similarity bars and a details drawer from the right.
- **Gap tracker** is a four-column board (Open · In progress · Ready for review · Closed) with a table toggle and an edit drawer.
- **Ask the rulebook** is a two-column research view: conversation on the left, the cited sources as index cards on the right.

### Density

Medium-compact: 14 px body, 13 px tables, 12 px captions. Cards have 1 px rule borders and a faint paper shadow, 10 px radius.

### Charts

Recharts with hairline gridlines in `--rule`, ink bars with redline for the risky series, no gradients, tooltips on a white sheet with a rule border. Charts: effective-date runway (notices per month, gaps in red), notices by regulator, similarity score distribution with the 0.55 review line, gaps by owner team.

### Motion

180 ms fade-and-rise on route change and drawers; skeleton loaders shimmer in `--sheet-2`; KPI counters count up over 700 ms; AI answers stream in word by word after staged reasoning steps; on the landing page "30 calendar days" is struck through and replaced by "15 business days" once. `prefers-reduced-motion` turns all of it off.

## How this differs from the live catalog

Looked at before designing: Auto Finance Portfolio Analytics, Workforce Intelligence, Market Data Discovery, Loss Triangle Analysis, Wealth Advisor Assistant, and this pack's own v1.

| Pack | Its look | Avoided here |
| --- | --- | --- |
| Auto Finance Portfolio Analytics | night navy with lime, monospace, dark dashboard | no dark UI, no neon accent, mono only for IDs |
| Workforce Intelligence | cream and plum, serif display headlines, left sidebar | no sidebar, no plum; serif only for document text |
| Market Data Discovery | harbor blue on cool grey, Space Grotesk | no blue-led palette; quill blue is a minor AI accent |
| Loss Triangle Analysis | purple gradient accents, system sans | no gradients, no purple |
| Wealth Advisor Assistant and v1 of this pack | Snowflake-blue sidebar template, glass header | no sidebar, no glass, no Snowflake-blue brand |

Unique to Obliqa: warm paper + single redline red, top ink bar with tabs, a mail-style three-pane docket, highlighter marks inside clause text, and a redline strike animation as the landing hero.
