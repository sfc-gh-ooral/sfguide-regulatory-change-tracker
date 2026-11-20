# Regulatory Change Tracker

Help compliance teams read new rules and guidance, map obligations to internal policies and controls, and track the gaps to closure.

**[Open the guide](https://sfc-gh-ooral.github.io/sfguide-regulatory-change-tracker/)** · **[Try the example in your browser](https://sfc-gh-ooral.github.io/sfguide-regulatory-change-tracker/try/)** (no account needed)

A fictional retail bank, Brivanta Bank, receives notices from fictional regulators. Each PDF that lands on a Snowflake stage is picked up by a stream and task, parsed, and assessed for applicability. Its numbered requirements become obligations, which are matched to the closest policy sentences and controls and checked for coverage. Gaps go to a tracker with an owner and a due date. A Cortex Agent answers questions across the notices, policies and controls, citing each source. Analysts confirm or override every AI suggestion.

> **Synthetic data, illustrative logic.** The bank, the regulators, the rules, the policies and every person are fictional and were written for this example. Nothing is copied from real regulatory text. This is not legal, regulatory, or compliance advice, and not a production system.

## What's in the app

| Screen | What it shows | Snowflake capability |
| --- | --- | --- |
| Change inbox | New notices with an AI applicability badge, summary, obligation and gap counts | Stage, stream and task; AI_PARSE_DOCUMENT; AI_COMPLETE |
| Notice detail | AI assessment (re-run on demand), analyst decision with reason, obligations with their mapping, source PDF and parsed text | AI_COMPLETE structured output; AI_EXTRACT; AI_EMBED |
| Obligation map | Every obligation with its two closest policies and closest control, similarity scores, coverage verdict; gaps highlighted | AI_EMBED + VECTOR_COSINE_SIMILARITY; AI_COMPLETE |
| Gap tracker | Gaps with owner, due date, status, evidence link and history; owners update them | Tables with app write-back |
| Ask the rulebook | Q&A with a citation after each claim | Cortex Agents; Cortex Search |

Planted stories (see [data/README.md](data/README.md)): a complaint deadline the procedure no longer meets, two obligations with no control, two policies that conflict, and a notice that does not apply to the bank.

## Prerequisites

- **No-account mode:** Node.js 20.19 or later.
- **Live mode:** a Snowflake account (any edition) where Cortex AI functions (AI_PARSE_DOCUMENT, AI_EXTRACT, AI_EMBED, AI_COMPLETE with `claude-sonnet-4-5`), Cortex Search and Cortex Agents are available natively or through [cross-region inference](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cross-region-inference). ACCOUNTADMIN, or a role that can create roles, warehouses, databases and API integrations and grant EXECUTE TASK. Tested in November 2026 on AWS US East 1 with Node.js 22 and Next.js 16.

## Quick start (no account)

```bash
git clone https://github.com/sfc-gh-ooral/sfguide-regulatory-change-tracker.git
cd sfguide-regulatory-change-tracker
npm install
npm run dev
```

Open http://localhost:3000. The app runs on bundled data captured from the live app on the same synthetic notices. AI answers are labeled **Sample AI response** and arrive after a short delay with the same progress steps as the live call. Decisions and gap updates are kept in memory for the session.

## Live mode: deploy to your account

1. Open a Snowsight SQL worksheet as ACCOUNTADMIN, paste [`sql/setup.sql`](sql/setup.sql) and run all. It reads the synthetic files from this public repository through a Git repository object, so there is nothing to upload.
2. Create a key pair and register it on your user (commands in [`.env.example`](.env.example)).
3. Copy `.env.example` to `.env.local` and fill in `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USERNAME` and `SNOWFLAKE_PRIVATE_KEY_PATH`. Keep `.env.local` and the key out of the repository (both are git-ignored).
4. Run `npm run dev` and switch the header to **Live**. The app connects as `REG_CHANGE_DEMO_ROLE` only.
5. To watch the task, copy the held-back notice onto the stage. Within about 5 minutes it appears at the top of the inbox, marked "via task":

   ```sql
   COPY FILES INTO @REG_CHANGE_DEMO.RCT.NOTICE_DOCS FROM @REG_CHANGE_DEMO.RCT.RCT_REPO/branches/main/data/incoming/;
   ALTER STAGE REG_CHANGE_DEMO.RCT.NOTICE_DOCS REFRESH;
   ```

6. When you're done, run [`sql/cleanup.sql`](sql/cleanup.sql).

Least-privilege path: setup uses ACCOUNTADMIN only for the account-level block (role, warehouse, database, API integration, CORTEX_USER and EXECUTE TASK grants). Everything else is created and owned by `REG_CHANGE_DEMO_ROLE`, and the app runs as that role with secondary roles off.

### Objects created

| Object | Name | Notes |
| --- | --- | --- |
| Role | `REG_CHANGE_DEMO_ROLE` | Owns everything below; granted `SNOWFLAKE.CORTEX_USER` and `EXECUTE TASK` |
| Warehouse | `REG_CHANGE_WH` | XSMALL, `AUTO_SUSPEND = 60` |
| Database | `REG_CHANGE_DEMO` | Schemas `RCT` (data, pipeline) and `APP` (decisions, gap updates) |
| API integration | `REG_CHANGE_GIT_API` | Read-only HTTPS access to `github.com/sfc-gh-ooral/` |
| Git repository | `RCT.RCT_REPO` | Clone of this repository |
| Stages | `RCT.RCT_SEED`, `RCT.NOTICE_DOCS` | Seed CSVs; incoming notices (directory table, server-side encryption) |
| Stream, task | `RCT.NOTICE_DOCS_STREAM`, `RCT.PROCESS_NOTICES_TASK` | Task runs every 5 minutes only when the stream has data |
| Procedure | `RCT.PROCESS_NEW_NOTICES` | The pipeline; resumable |
| Tables | `CONFIG`, `POLICIES`, `CONTROLS`, `OWNERS`, `NOTICE_FILES`, `PRIOR_GAPS`, `POLICY_VECTORS`, `CONTROL_VECTORS`, `NOTICE_QUEUE`, `NOTICES`, `OBLIGATIONS`, `OBLIGATION_MAP`, `GAPS`, `EXTRACTION_SCHEMA`, `APP.NOTICE_DECISIONS`, `APP.GAP_UPDATES` | |
| View | `RCT.RULEBOOK_CHUNKS` | Notice chunks, policies and controls |
| Cortex Search service | `RCT.RULEBOOK_SEARCH` | `TARGET_LAG = '1 hour'` |
| Cortex Agent | `RCT.RULEBOOK_AGENT` | One `cortex_search` tool |

### Expected cost and time

- **Setup:** 97 to 106 seconds per run in our tests (24 notices).
- **Warehouse:** 0.41 credits in total for three full setup runs plus app testing, measured with `WAREHOUSE_METERING_HISTORY`.
- **Cortex AI:** each setup run makes 24 AI_PARSE_DOCUMENT and 24 AI_EXTRACT calls, about 190 AI_EMBED calls on short texts, and about 70 AI_COMPLETE calls. Check your own usage in `SNOWFLAKE.ACCOUNT_USAGE.CORTEX_AISQL_USAGE_HISTORY` (it lags by a few hours). The Cortex Search service also bills for serving while it exists, so run cleanup when done.
- **App (live, measured):** screens load in 0.1 to 3 seconds; re-assessing a notice with AI_COMPLETE took a median 3.4 seconds; agent answers took a median 12.5 seconds (up to 16 seconds).
- **Task:** the held-back notice was processed in a 23-second task run, about 6 minutes after the file landed.

## Known limitations

- Coverage verdicts and conflict checks are AI suggestions. On this synthetic set the pipeline found the four planted gaps and no others in our runs, but wording and borderline verdicts ("Partially meets") can vary between runs. An analyst must review each one.
- Each obligation is checked against its two closest policies and two closest controls. An obligation met by a policy that ranks lower is reported as not met.
- Overriding an AI dismissal records the analyst's decision; it does not re-run the coverage check for that notice's obligations (they stay "Not assessed").
- The policy library is 40 short synthetic policies split into sentences. Real libraries need document chunking, and low-similarity matches should be reviewed.
- Evidence links are stored as text and not fetched or validated beyond requiring `https://`. The example links point to `example.com`.
- The firm profile used for applicability is one paragraph in the `CONFIG` table.
- No row access or masking policies; every user of the app role sees every gap.

## Customize with Cortex Code

- "Load my policy library from `<stage or table>` and map it to these obligations. Show low-confidence matches (similarity under 0.55) for review before opening any gaps."
- "Add a regulator feed I download weekly into a stage, and have the task process only new files. Show me how to test it with one file first."
- "Export the gap tracker for my GRC tool as a CSV with owner, due date, status and evidence link, and explain the column mapping."

## Repository layout

```text
app/, components/, lib/   Next.js app (Sample and Live modes)
sql/setup.sql             Snowflake objects, pipeline, task, Cortex Search, agent
sql/cleanup.sql           Drops everything setup created
data/                     Synthetic notices (PDF), policies, controls; data/README.md lists the stories
scripts/                  Data generator, sample capture, hosted build, screenshots
docs/                     GitHub Pages guide; docs/try/ is the hosted no-account example
```

To rebuild: `npm run generate-data` (Python 3 with reportlab), `npm run capture-sample` with Live mode running, `npm run build:example`, then `npm run capture`.

## License and disclaimer

Apache 2.0 (see [LICENSE](LICENSE)). This is an illustrative example provided as is. It is not an official Snowflake product, it isn't supported by Snowflake Support, and it contains no customer data. Review and test before any production use.

Owner: Oz Oral · Last reviewed: November 2026
