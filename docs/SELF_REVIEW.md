# Self-review

Taken from the self-review in the catalog pull request ([sfc-gh-ooral/snow-packs#46](https://github.com/sfc-gh-ooral/snow-packs/pull/46)), November 2026.

Build standard, "Before you call it done":

| Item | Status |
| --- | --- |
| Mock mode from a fresh clone | Pass in part: the static `/try/` build from this commit, including both new actions, ran at 390 and 1440 px with no overflow or console errors. A from-scratch clone + `npm ci` + `npm run dev` was not repeated this round; it passed in the earlier build. |
| setup → live → cleanup in a clean role | Pass (table above, pack role `REG_CHANGE_DEMO_ROLE`) |
| Grep files and history for secrets, account ids, user names | Pass: the full history of `origin/main` matches only the public GitHub owner in repo links. All 8 commits signed (G). New capture files scanned for real firm names: none. |
| Pages URL and `/try/` signed out, phone width | Pass: guide 200, 6 images 200, 11 `/try/` assets 200; Extract again and Re-map work on the published `/try/` at 390 px |
| Dark mode | Skipped: the Obliqa design has a single paper theme (docs/DESIGN.md) |
| Every story beat visible in a screenshot | Pass: deadline gap (card 2 drawer), policy conflict and no-control gaps (card 3), not-applicable dismissal (card 6), task-processed notice (inbox) |

CONTRIBUTING Musts:

| Must | Status |
| --- | --- |
| Business problem first; one industry and one function | Pass |
| Public `sfguide-` repo, Apache 2.0 LICENSE, Pages on with `docs/.nojekyll` | Pass |
| Problem and outcome on the first screen; screenshots of the running app | Pass |
| Caption names the capability, plus alt text | Pass (re-read against the recaptured cards; the content shown didn't change) |
| Only claim capabilities used and tested | Pass after this round: every listed function is called by the app in Live mode, or labeled pipeline-only where it is (stream, task) |
| Visible disclaimer; links to repo and docs; no Snowflake logo; no sales motions | Pass |
| End-user app with a real workflow; no-account mode; Sample labels; live mode | Pass |
| Synthetic, deterministic data | Pass (the generator gives identical output when run twice, as the reviewer confirmed in round 1) |
| Self-contained setup; cleanup removes everything | Pass |
| No credentials, account ids or internal hostnames; user names redacted | Pass |
| No customer names, deals or internal programs | Pass |
| GA or labeled preview features | Pass |
| README Musts (prerequisites, steps and objects, cost and time, limitations, Customize with Cortex Code, owner and date, license and disclaimer) | Pass (cost and time updated with this run) |
| Outcomes as possibilities; synthetic results qualified | Pass |


## Polish pass, November 20, 2026

- Fresh clone, `npm ci`, `npm run dev`: pass (home page returns 200).
- Dark mode: not applicable (single light theme by design).
- `npm run lint` failed from a fresh clone (ESLint 9 found no `eslint.config.*`). Added the flat config with the Next core-web-vitals and TypeScript presets (the two React Compiler advisory rules off, as the app does not use the compiler) and fixed what it reported; lint and `tsc --noEmit` now pass.
