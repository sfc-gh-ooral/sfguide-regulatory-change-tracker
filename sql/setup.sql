-- =============================================================================
-- Regulatory Change Tracker: Snowflake setup
-- Synthetic data only. Fictional regulators, rules and firm. Illustrative logic;
-- not legal, regulatory, or compliance advice.
--
-- Run top to bottom in a Snowsight SQL worksheet (about 5 minutes on an XSMALL
-- warehouse; most of it is the first pass of the AI pipeline over 24 notices).
-- Requirements (see README): a Snowflake account where Cortex AI functions, Cortex
-- Search and Cortex Agents are available natively or through cross-region inference,
-- and ACCOUNTADMIN (or a role that can create roles, warehouses, databases and API
-- integrations, and grant EXECUTE TASK).
--
-- Creates (and sql/cleanup.sql drops):
--   role         REG_CHANGE_DEMO_ROLE (owns everything below)
--   warehouse    REG_CHANGE_WH (XSMALL, AUTO_SUSPEND = 60)
--   database     REG_CHANGE_DEMO (schemas RCT, APP)
--   integration  REG_CHANGE_GIT_API (read-only access to the public example repository)
-- It changes nothing that already exists: an owner check at the start stops the script if
-- any of these names is already taken by an object with a different owner.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Part 1. Account-level objects (ACCOUNTADMIN)
-- -----------------------------------------------------------------------------
USE ROLE ACCOUNTADMIN;

-- Owner check. Re-running this script is safe: everything below uses IF NOT EXISTS or
-- CREATE OR REPLACE inside the example's own database. But if an object with one of these
-- names already exists under a different owner, it isn't ours, so stop rather than take
-- it over. Expected owners: the role, the integration -> ACCOUNTADMIN; the warehouse and
-- database -> REG_CHANGE_DEMO_ROLE.
EXECUTE IMMEDIATE $$
DECLARE
  o STRING;
  role_taken EXCEPTION (-20101, 'Setup stopped: role REG_CHANGE_DEMO_ROLE already exists and is not owned by ACCOUNTADMIN. It is not from this example; rename the example objects or remove that role first.');
  wh_taken EXCEPTION (-20102, 'Setup stopped: warehouse REG_CHANGE_WH already exists and is owned by a role other than REG_CHANGE_DEMO_ROLE. It is not from this example; rename the example objects or remove that warehouse first.');
  db_taken EXCEPTION (-20103, 'Setup stopped: database REG_CHANGE_DEMO already exists and is owned by a role other than REG_CHANGE_DEMO_ROLE. It is not from this example; rename the example objects or remove that database first.');
  int_taken EXCEPTION (-20104, 'Setup stopped: integration REG_CHANGE_GIT_API already exists and is not owned by ACCOUNTADMIN. It is not from this example; rename the example objects or remove that integration first.');
BEGIN
  SHOW ROLES LIKE 'REG_CHANGE_DEMO_ROLE';
  SELECT MAX("owner") INTO :o FROM TABLE(RESULT_SCAN(LAST_QUERY_ID())) WHERE "name" = 'REG_CHANGE_DEMO_ROLE';
  IF (o IS NOT NULL AND o <> 'ACCOUNTADMIN') THEN RAISE role_taken; END IF;

  SHOW WAREHOUSES LIKE 'REG_CHANGE_WH';
  SELECT MAX("owner") INTO :o FROM TABLE(RESULT_SCAN(LAST_QUERY_ID())) WHERE "name" = 'REG_CHANGE_WH';
  IF (o IS NOT NULL AND o <> 'REG_CHANGE_DEMO_ROLE') THEN RAISE wh_taken; END IF;

  SHOW DATABASES LIKE 'REG_CHANGE_DEMO';
  SELECT MAX("owner") INTO :o FROM TABLE(RESULT_SCAN(LAST_QUERY_ID())) WHERE "name" = 'REG_CHANGE_DEMO';
  IF (o IS NOT NULL AND o <> 'REG_CHANGE_DEMO_ROLE') THEN RAISE db_taken; END IF;

  -- SHOW INTEGRATIONS has no owner column, so read the OWNERSHIP grant when it exists.
  SHOW INTEGRATIONS LIKE 'REG_CHANGE_GIT_API';
  SELECT COUNT(*)::STRING INTO :o FROM TABLE(RESULT_SCAN(LAST_QUERY_ID())) WHERE "name" = 'REG_CHANGE_GIT_API';
  IF (o <> '0') THEN
    SHOW GRANTS ON INTEGRATION REG_CHANGE_GIT_API;
    SELECT MAX("grantee_name") INTO :o FROM TABLE(RESULT_SCAN(LAST_QUERY_ID())) WHERE "privilege" = 'OWNERSHIP';
    IF (o IS NULL OR o <> 'ACCOUNTADMIN') THEN RAISE int_taken; END IF;
  END IF;

  RETURN 'Owner check passed';
END;
$$;

CREATE ROLE IF NOT EXISTS REG_CHANGE_DEMO_ROLE COMMENT = 'Regulatory Change Tracker example: least-privilege owner role';
GRANT ROLE REG_CHANGE_DEMO_ROLE TO ROLE SYSADMIN;
SET my_user = CURRENT_USER();
GRANT ROLE REG_CHANGE_DEMO_ROLE TO USER IDENTIFIER($my_user);

CREATE WAREHOUSE IF NOT EXISTS REG_CHANGE_WH
  WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE INITIALLY_SUSPENDED = TRUE
  COMMENT = 'Regulatory Change Tracker example';
GRANT OWNERSHIP ON WAREHOUSE REG_CHANGE_WH TO ROLE REG_CHANGE_DEMO_ROLE;

CREATE DATABASE IF NOT EXISTS REG_CHANGE_DEMO COMMENT = 'Regulatory Change Tracker example (synthetic data)';
GRANT OWNERSHIP ON DATABASE REG_CHANGE_DEMO TO ROLE REG_CHANGE_DEMO_ROLE;

-- Cortex AI functions, Cortex Search and Cortex Agents, and the right to run the pipeline task.
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE REG_CHANGE_DEMO_ROLE;
GRANT EXECUTE TASK ON ACCOUNT TO ROLE REG_CHANGE_DEMO_ROLE;

-- Read-only access to the public GitHub repository that holds the synthetic files.
CREATE API INTEGRATION IF NOT EXISTS REG_CHANGE_GIT_API
  API_PROVIDER = git_https_api
  API_ALLOWED_PREFIXES = ('https://github.com/sfc-gh-ooral/')
  ENABLED = TRUE
  COMMENT = 'Regulatory Change Tracker example: public repo, no credentials';
GRANT USAGE ON INTEGRATION REG_CHANGE_GIT_API TO ROLE REG_CHANGE_DEMO_ROLE;

-- -----------------------------------------------------------------------------
-- Part 2. Everything else runs as the least-privilege owner role.
-- -----------------------------------------------------------------------------
USE ROLE REG_CHANGE_DEMO_ROLE;
USE WAREHOUSE REG_CHANGE_WH;
USE DATABASE REG_CHANGE_DEMO;
CREATE SCHEMA IF NOT EXISTS RCT COMMENT = 'Notices, policy library, controls and AI pipeline output (synthetic)';
CREATE SCHEMA IF NOT EXISTS APP COMMENT = 'Decisions and gap updates written by the app';
USE SCHEMA RCT;

-- 2a. Reference tables from the public repository ----------------------------
CREATE OR REPLACE GIT REPOSITORY RCT_REPO
  API_INTEGRATION = REG_CHANGE_GIT_API
  ORIGIN = 'https://github.com/sfc-gh-ooral/sfguide-regulatory-change-tracker.git';
ALTER GIT REPOSITORY RCT_REPO FETCH;
CREATE OR REPLACE STAGE RCT_SEED COMMENT = 'Synthetic CSVs copied from the repository';
COPY FILES INTO @RCT_SEED FROM @RCT_REPO/branches/main/data/csv/;

CREATE OR REPLACE FILE FORMAT RCT_CSV TYPE = CSV PARSE_HEADER = TRUE FIELD_OPTIONALLY_ENCLOSED_BY = '"'
  NULL_IF = ('') EMPTY_FIELD_AS_NULL = TRUE;

-- The firm the example is about, and the business date the app treats as today.
CREATE OR REPLACE TABLE CONFIG (key STRING, value STRING);
INSERT INTO CONFIG VALUES
  ('firm_name', 'Brivanta Bank'),
  ('as_of_date', '2026-11-18'),
  ('firm_profile', 'Brivanta Bank is a fictional retail and small-business bank with 18 billion in total assets. '
    || 'It offers consumer checking and savings accounts with an overdraft service, debit and credit cards, personal loans, '
    || 'residential mortgages that it originates and services, small business loans and deposit accounts, and instant '
    || 'account-to-account payments in its mobile app. It collects its own consumer debts and sends electronic marketing. '
    || 'It does not sell or recommend insurance or annuities, does not operate a broker-dealer or route securities orders, '
    || 'and does not offer crypto-asset services.');

CREATE OR REPLACE TABLE POLICIES (policy_id STRING, title STRING, owner_team STRING, owner_name STRING,
  policy_text STRING, last_reviewed DATE);
CREATE OR REPLACE TABLE CONTROLS (control_id STRING, policy_id STRING, description STRING, frequency STRING,
  owner_name STRING, owner_team STRING);
CREATE OR REPLACE TABLE OWNERS (team STRING, owner_name STRING);
CREATE OR REPLACE TABLE PRIOR_GAPS (gap_id STRING, notice_id STRING, gap_type STRING, description STRING,
  owner_team STRING, due_date DATE, status STRING, evidence_url STRING);
-- Intake register: when each notice file arrived and from which feed.
CREATE OR REPLACE TABLE NOTICE_FILES (notice_id STRING, file_name STRING, received_at TIMESTAMP_NTZ, feed STRING);

COPY INTO POLICIES     FROM @RCT_SEED/policies.csv     FILE_FORMAT = (FORMAT_NAME = RCT_CSV) MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;
COPY INTO CONTROLS     FROM @RCT_SEED/controls.csv     FILE_FORMAT = (FORMAT_NAME = RCT_CSV) MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;
COPY INTO OWNERS       FROM @RCT_SEED/owners.csv       FILE_FORMAT = (FORMAT_NAME = RCT_CSV) MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;
COPY INTO PRIOR_GAPS   FROM @RCT_SEED/prior_gaps.csv   FILE_FORMAT = (FORMAT_NAME = RCT_CSV) MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;
COPY INTO NOTICE_FILES FROM @RCT_SEED/notice_files.csv FILE_FORMAT = (FORMAT_NAME = RCT_CSV) MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;

-- 2b. Embeddings of the policy library and controls, for mapping obligations -----
-- One vector per policy sentence, so a short obligation can match the one sentence that covers it.
CREATE OR REPLACE TABLE POLICY_VECTORS AS
SELECT p.policy_id, s.index AS sentence_no, TRIM(s.value::STRING) AS sentence,
       AI_EMBED('snowflake-arctic-embed-l-v2.0', p.title || ': ' || TRIM(s.value::STRING)) AS v
FROM POLICIES p, LATERAL FLATTEN(input => SPLIT(p.policy_text, '. ')) s
WHERE LENGTH(TRIM(s.value::STRING)) > 0;
CREATE OR REPLACE TABLE CONTROL_VECTORS AS
SELECT control_id, AI_EMBED('snowflake-arctic-embed-l-v2.0', description) AS v FROM CONTROLS;

-- 2c. Notice pipeline: stage + directory table + stream + task -----------------
-- New notices land on NOTICE_DOCS; the stream on its directory table queues them, and the task
-- runs PROCESS_NEW_NOTICES whenever the stream has data.
CREATE OR REPLACE STAGE NOTICE_DOCS ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE') DIRECTORY = (ENABLE = TRUE)
  COMMENT = 'Incoming regulatory notices (PDF)';
CREATE OR REPLACE STREAM NOTICE_DOCS_STREAM ON STAGE NOTICE_DOCS;

CREATE OR REPLACE TABLE NOTICE_QUEUE (relative_path STRING, queued_at TIMESTAMP_NTZ, processed BOOLEAN);
CREATE OR REPLACE TABLE NOTICES (
  notice_id STRING, file_name STRING, received_at TIMESTAMP_NTZ, feed STRING, parsed_text STRING, page_count NUMBER,
  regulator STRING, notice_type STRING, title STRING, published_date DATE, effective_date DATE, extracted VARIANT,
  ai_summary STRING, ai_applicable BOOLEAN, ai_products ARRAY, ai_reason STRING, model STRING,
  processed_at TIMESTAMP_NTZ, processed_by STRING);
CREATE OR REPLACE TABLE OBLIGATIONS (obligation_id STRING, notice_id STRING, ref STRING, obligation_text STRING,
  v VECTOR(FLOAT, 1024));
CREATE OR REPLACE TABLE OBLIGATION_MAP (
  obligation_id STRING, notice_id STRING,
  policy_id STRING, policy_score FLOAT, policy2_id STRING, policy2_score FLOAT,
  control_id STRING, control_score FLOAT, control2_id STRING, control2_score FLOAT,
  verdict STRING, control_covers BOOLEAN, verdict_reason STRING,
  conflict BOOLEAN, conflict_reason STRING, mapped_at TIMESTAMP_NTZ);
CREATE OR REPLACE TABLE GAPS (
  gap_id STRING, obligation_id STRING, notice_id STRING, gap_type STRING, description STRING,
  owner_team STRING, owner_name STRING, due_date DATE, status STRING, evidence_url STRING,
  source STRING, created_at TIMESTAMP_NTZ, updated_by STRING, updated_at TIMESTAMP_NTZ);
INSERT INTO GAPS
SELECT gap_id, NULL, notice_id, gap_type, description, SPLIT_PART(owner_team, ' · ', 1), SPLIT_PART(owner_team, ' · ', 2),
       due_date, status, evidence_url, 'Prior review', '2026-09-01'::TIMESTAMP_NTZ, NULL, NULL
FROM PRIOR_GAPS;

CREATE TABLE IF NOT EXISTS APP.NOTICE_DECISIONS (decision_id STRING DEFAULT UUID_STRING(), notice_id STRING,
  decision STRING, reason STRING, decided_by STRING DEFAULT CURRENT_USER(), decided_at TIMESTAMP_NTZ DEFAULT SYSDATE());
CREATE TABLE IF NOT EXISTS APP.GAP_UPDATES (update_id STRING DEFAULT UUID_STRING(), gap_id STRING, status STRING,
  owner_name STRING, evidence_url STRING, note STRING, updated_by STRING DEFAULT CURRENT_USER(),
  updated_at TIMESTAMP_NTZ DEFAULT SYSDATE());

-- What AI_EXTRACT pulls from every notice: header fields and the numbered requirements as a table.
CREATE OR REPLACE TABLE EXTRACTION_SCHEMA (response_format VARIANT);
INSERT INTO EXTRACTION_SCHEMA SELECT PARSE_JSON('{"schema":{"type":"object","properties":{
  "notice_number":{"description":"What is the notice number?","type":"string"},
  "regulator":{"description":"Which regulator issued the notice?","type":"string"},
  "notice_type":{"description":"What type of publication is it (for example Final rule, Guidance, Consultation, Bulletin)?","type":"string"},
  "title":{"description":"What is the title of the notice, without the publication type?","type":"string"},
  "published_date":{"description":"What is the published date, as YYYY-MM-DD?","type":"string"},
  "effective_date":{"description":"What is the effective date, as YYYY-MM-DD?","type":"string"},
  "obligations":{"description":"Each numbered requirement in the Requirements section that firms must meet","type":"object",
    "column_ordering":["ref","requirement"],
    "properties":{"ref":{"description":"Requirement number such as 3.1","type":"array"},
                  "requirement":{"description":"Full text of the requirement","type":"array"}}}}}}');

-- The pipeline step. Called by the task; setup also calls it once for the bundled notices.
-- Every step skips work already done, so a rerun after a failed AI call picks up where it stopped.
CREATE OR REPLACE PROCEDURE PROCESS_NEW_NOTICES()
RETURNS STRING
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
DECLARE
  n INTEGER;
  profile STRING;
BEGIN
  SELECT value INTO :profile FROM CONFIG WHERE key = 'firm_profile';
  -- 1. Consume the stream (new files only).
  INSERT INTO NOTICE_QUEUE SELECT relative_path, SYSDATE(), FALSE
    FROM NOTICE_DOCS_STREAM WHERE METADATA$ACTION = 'INSERT';
  -- Retry notices whose AI steps came back empty on an earlier run (calls can fail under load).
  DELETE FROM NOTICES WHERE parsed_text IS NULL OR extracted:obligations IS NULL;
  UPDATE NOTICE_QUEUE SET processed = FALSE WHERE relative_path NOT IN (SELECT file_name FROM NOTICES);
  SELECT COUNT(*) INTO :n FROM NOTICE_QUEUE WHERE NOT processed;

  -- 2. AI_PARSE_DOCUMENT (OCR) for the full text; AI_EXTRACT for header fields and obligations.
  INSERT INTO NOTICES (notice_id, file_name, received_at, feed, parsed_text, page_count, regulator, notice_type, title,
                       published_date, effective_date, extracted, processed_at, processed_by)
  WITH q AS (
    SELECT DISTINCT q.relative_path, f.notice_id, f.received_at, f.feed
    FROM NOTICE_QUEUE q LEFT JOIN NOTICE_FILES f ON f.file_name = q.relative_path
    WHERE NOT q.processed AND q.relative_path NOT IN (SELECT file_name FROM NOTICES)
  ), a AS (
    SELECT q.*, AI_PARSE_DOCUMENT(TO_FILE('@NOTICE_DOCS', relative_path), {'mode': 'OCR'}) AS parsed,
           AI_EXTRACT(file => TO_FILE('@NOTICE_DOCS', relative_path), responseFormat => (SELECT response_format FROM EXTRACTION_SCHEMA)):response AS x
    FROM q
  )
  SELECT COALESCE(notice_id, x:notice_number::STRING), relative_path, COALESCE(received_at, SYSDATE()), COALESCE(feed, 'Manual upload'),
         parsed:content::STRING, parsed:metadata:pageCount::NUMBER,
         x:regulator::STRING, x:notice_type::STRING, x:title::STRING,
         TRY_TO_DATE(x:published_date::STRING), TRY_TO_DATE(x:effective_date::STRING), x, SYSDATE(),
         IFF(NULLIF(SYSTEM$CURRENT_USER_TASK_NAME(), '') IS NULL, 'Setup', 'PROCESS_NOTICES_TASK')
  FROM a;
  UPDATE NOTICE_QUEUE SET processed = TRUE WHERE relative_path IN (SELECT file_name FROM NOTICES);

  -- 3. One row per extracted obligation, with its embedding.
  INSERT INTO OBLIGATIONS
  SELECT nt.notice_id || '-' || r.value::STRING, nt.notice_id, r.value::STRING, t.value::STRING,
         AI_EMBED('snowflake-arctic-embed-l-v2.0', t.value::STRING)
  FROM NOTICES nt,
       LATERAL FLATTEN(input => nt.extracted:obligations:ref) r,
       LATERAL FLATTEN(input => nt.extracted:obligations:requirement) t
  WHERE r.index = t.index AND nt.notice_id NOT IN (SELECT notice_id FROM OBLIGATIONS);

  -- 4. Applicability and plain-language summary with AI_COMPLETE (structured output).
  UPDATE NOTICES nt SET ai_summary = s.r:summary::STRING, ai_applicable = s.r:applicable::BOOLEAN,
         ai_products = s.r:products_affected::ARRAY, ai_reason = s.r:reason::STRING, model = 'claude-sonnet-4-5'
  FROM (
    SELECT notice_id, TRY_PARSE_JSON(TO_VARCHAR(AI_COMPLETE(
      model => 'claude-sonnet-4-5',
      prompt => 'You help a bank compliance team triage new regulatory publications. Firm profile: ' || :profile
        || ' Read the notice below. Decide whether it applies to this firm, based on who the notice says it applies to and the firm''s products. '
        || 'Write summary as 2 plain sentences on what changes and by when. List the firm''s products or functions affected (empty if not applicable). '
        || 'Give reason as one sentence that names the scope in the notice and why the firm is or is not in it. Notice: ' || parsed_text,
      response_format => TYPE OBJECT(summary STRING, applicable BOOLEAN, products_affected ARRAY(STRING), reason STRING)))) AS r
    FROM NOTICES WHERE ai_summary IS NULL AND parsed_text IS NOT NULL
  ) s
  WHERE nt.notice_id = s.notice_id;

  -- 5. Map each new obligation to its closest two policies and closest control (cosine similarity).
  INSERT INTO OBLIGATION_MAP (obligation_id, notice_id, policy_id, policy_score, policy2_id, policy2_score,
                              control_id, control_score, control2_id, control2_score, mapped_at)
  WITH p AS (
    SELECT o.obligation_id, o.notice_id, pv.policy_id, MAX(VECTOR_COSINE_SIMILARITY(o.v, pv.v)) AS s
    FROM OBLIGATIONS o, POLICY_VECTORS pv
    WHERE o.obligation_id NOT IN (SELECT obligation_id FROM OBLIGATION_MAP)
    GROUP BY o.obligation_id, o.notice_id, pv.policy_id
    QUALIFY ROW_NUMBER() OVER (PARTITION BY o.obligation_id ORDER BY s DESC) <= 2
  ), pr AS (SELECT p.*, ROW_NUMBER() OVER (PARTITION BY obligation_id ORDER BY s DESC) AS rk FROM p),
  c AS (
    SELECT o.obligation_id, cv.control_id, VECTOR_COSINE_SIMILARITY(o.v, cv.v) AS s,
           ROW_NUMBER() OVER (PARTITION BY o.obligation_id ORDER BY s DESC) AS rk
    FROM OBLIGATIONS o, CONTROL_VECTORS cv
    WHERE o.obligation_id NOT IN (SELECT obligation_id FROM OBLIGATION_MAP)
    QUALIFY rk <= 2
  )
  SELECT p1.obligation_id, p1.notice_id, p1.policy_id, ROUND(p1.s, 3), p2.policy_id, ROUND(p2.s, 3),
         c1.control_id, ROUND(c1.s, 3), c2.control_id, ROUND(c2.s, 3), SYSDATE()
  FROM pr p1 JOIN pr p2 ON p2.obligation_id = p1.obligation_id AND p2.rk = 2
  JOIN c c1 ON c1.obligation_id = p1.obligation_id AND c1.rk = 1
  JOIN c c2 ON c2.obligation_id = p1.obligation_id AND c2.rk = 2
  WHERE p1.rk = 1;

  -- 6. Coverage verdict with AI_COMPLETE: do the two closest policies and controls meet the obligation?
  --    Obligations of notices the AI found not applicable are not assessed.
  UPDATE OBLIGATION_MAP m SET verdict = v.r:verdict::STRING, control_covers = v.r:control_covers::BOOLEAN, verdict_reason = v.r:reason::STRING
  FROM (
    SELECT m.obligation_id, TRY_PARSE_JSON(TO_VARCHAR(AI_COMPLETE(
      model => 'claude-sonnet-4-5',
      prompt => 'You check whether a bank''s policy and control meet a new regulatory obligation. Compare deadlines, frequencies, '
        || 'thresholds and scope exactly; a longer deadline, lower frequency or narrower scope than the obligation does not meet it. '
        || 'verdict is one of "Meets", "Partially meets", "Does not meet". control_covers is true only if the control would '
        || 'detect or prevent a breach of this specific obligation. reason is one sentence quoting the decisive wording. '
        || 'Judge the policies and controls together: the obligation is met if either policy meets it. '
        || 'Obligation: ' || o.obligation_text
        || ' Policy ' || p.policy_id || ' (' || p.title || '): ' || p.policy_text
        || ' Policy ' || p2.policy_id || ' (' || p2.title || '): ' || p2.policy_text
        || ' Control ' || c.control_id || ': ' || c.description || ' Control ' || c2.control_id || ': ' || c2.description,
      response_format => TYPE OBJECT(verdict STRING, control_covers BOOLEAN, reason STRING)))) AS r
    FROM OBLIGATION_MAP m
    JOIN OBLIGATIONS o ON o.obligation_id = m.obligation_id
    JOIN NOTICES nt ON nt.notice_id = m.notice_id
    JOIN POLICIES p ON p.policy_id = m.policy_id
    JOIN POLICIES p2 ON p2.policy_id = m.policy2_id
    JOIN CONTROLS c ON c.control_id = m.control_id
    JOIN CONTROLS c2 ON c2.control_id = m.control2_id
    WHERE m.verdict IS NULL AND nt.ai_applicable
  ) v
  WHERE m.obligation_id = v.obligation_id;
  UPDATE OBLIGATION_MAP m SET verdict = 'Not assessed'
  FROM NOTICES nt WHERE nt.notice_id = m.notice_id AND m.verdict IS NULL AND NOT nt.ai_applicable;

  -- 7. Policy conflicts: when two policies both match an obligation closely, ask whether they disagree.
  UPDATE OBLIGATION_MAP m SET conflict = k.r:conflict::BOOLEAN, conflict_reason = k.r:reason::STRING
  FROM (
    SELECT m.obligation_id, TRY_PARSE_JSON(TO_VARCHAR(AI_COMPLETE(
      model => 'claude-sonnet-4-5',
      prompt => 'Two bank policies both relate to this regulatory obligation. conflict is true only if following one policy '
        || 'would break the other or the obligation for the same records or activity (for example different retention periods '
        || 'or deadlines for the same item). reason is one sentence naming the conflicting wording, or why they are consistent. '
        || 'Obligation: ' || o.obligation_text || ' Policy A ' || a.policy_id || ' (' || a.title || '): ' || a.policy_text
        || ' Policy B ' || b.policy_id || ' (' || b.title || '): ' || b.policy_text,
      response_format => TYPE OBJECT(conflict BOOLEAN, reason STRING)))) AS r
    FROM OBLIGATION_MAP m
    JOIN OBLIGATIONS o ON o.obligation_id = m.obligation_id
    JOIN POLICIES a ON a.policy_id = m.policy_id
    JOIN POLICIES b ON b.policy_id = m.policy2_id
    WHERE m.conflict IS NULL AND m.verdict <> 'Not assessed' AND m.policy2_score >= 0.6
  ) k
  WHERE m.obligation_id = k.obligation_id;
  UPDATE OBLIGATION_MAP SET conflict = FALSE WHERE conflict IS NULL AND verdict IS NOT NULL;

  -- 8. Open one gap per obligation that sits on conflicting policies, has no control, or is not met.
  --    Owner: the team that owns the closest policy. Due: 30 days before the effective date.
  INSERT INTO GAPS
  WITH g AS (
    SELECT m.obligation_id, m.notice_id, m.policy_id,
           CASE WHEN m.conflict THEN 'Policy conflict'
                WHEN m.verdict IN ('Partially meets', 'Does not meet') AND NOT m.control_covers AND m.control_score < 0.55 THEN 'No control'
                WHEN m.verdict = 'Does not meet' THEN 'Requirement not met' END AS gap_type,
           IFF(m.conflict, m.conflict_reason, m.verdict_reason) AS description
    FROM OBLIGATION_MAP m
  )
  SELECT 'GAP-' || LPAD((SELECT COUNT(*) FROM GAPS WHERE source = 'AI mapping') + ROW_NUMBER() OVER (ORDER BY g.obligation_id) + 200, 4, '0'),
         g.obligation_id, g.notice_id, g.gap_type, g.description, p.owner_team, p.owner_name,
         GREATEST(DATEADD('day', -30, nt.effective_date), DATEADD('day', 14, (SELECT value FROM CONFIG WHERE key = 'as_of_date')::DATE)),
         'Open', NULL, 'AI mapping', SYSDATE(), NULL, NULL
  FROM g JOIN POLICIES p ON p.policy_id = g.policy_id JOIN NOTICES nt ON nt.notice_id = g.notice_id
  WHERE g.gap_type IS NOT NULL AND NOT EXISTS (SELECT 1 FROM GAPS x WHERE x.obligation_id = g.obligation_id);

  RETURN n || ' notices processed';
END;
$$;

-- First pass: copy the bundled notices onto the stage and process them.
COPY FILES INTO @NOTICE_DOCS FROM @RCT_REPO/branches/main/data/notices/;
ALTER STAGE NOTICE_DOCS REFRESH;
CALL PROCESS_NEW_NOTICES();

CREATE OR REPLACE TASK PROCESS_NOTICES_TASK
  WAREHOUSE = REG_CHANGE_WH
  SCHEDULE = '5 MINUTE'
  WHEN SYSTEM$STREAM_HAS_DATA('NOTICE_DOCS_STREAM')
  AS CALL PROCESS_NEW_NOTICES();
ALTER TASK PROCESS_NOTICES_TASK RESUME;  -- the WHEN check costs no warehouse time while no files arrive

-- 2d. Cortex Search over the rulebook (notice text, policies, controls) --------
CREATE OR REPLACE VIEW RULEBOOK_CHUNKS AS
SELECT nt.notice_id AS source_id, 'notice' AS source_type,
       nt.notice_id || ' · ' || nt.regulator || ' · ' || nt.title AS source_name,
       c.value::STRING AS chunk
FROM NOTICES nt, LATERAL FLATTEN(input => SNOWFLAKE.CORTEX.SPLIT_TEXT_RECURSIVE_CHARACTER(nt.parsed_text, 'markdown', 1500, 150)) c
UNION ALL
SELECT policy_id, 'policy', policy_id || ' · ' || title, title || ' (owner: ' || owner_team || '). ' || policy_text FROM POLICIES
UNION ALL
SELECT control_id, 'control', control_id || ' · control for ' || policy_id,
       'Control ' || control_id || ' (' || frequency || ', owner ' || owner_name || ') for policy ' || policy_id || ': ' || description
FROM CONTROLS;

CREATE OR REPLACE CORTEX SEARCH SERVICE RULEBOOK_SEARCH
  ON chunk
  ATTRIBUTES source_type
  WAREHOUSE = REG_CHANGE_WH
  TARGET_LAG = '1 hour'
  AS SELECT source_id, source_type, source_name, chunk FROM RULEBOOK_CHUNKS;

-- 2e. The rulebook agent: answers with citations from Cortex Search --------------
CREATE OR REPLACE AGENT RULEBOOK_AGENT
  COMMENT = 'Regulatory Change Tracker: Q&A across regulations and the policy library'
  FROM SPECIFICATION
$$
models:
  orchestration: auto
instructions:
  orchestration: >
    You answer questions from the compliance team of Brivanta Bank, a fictional retail bank, about new regulatory
    notices and the bank's own policies and controls. Always search the rulebook first. When a question compares a
    rule with the bank's policy, search for both.
  response: >
    Answer in under 160 words, in plain language. Quote deadlines and numbers exactly as written. After each claim
    put the source id in square brackets, for example [RCN-2026-004] or [POL-CMP-01]. If the sources do not answer
    the question, say so. This is not legal advice.
tools:
  - tool_spec:
      type: cortex_search
      name: rulebook_search
      description: "Regulatory notices (fictional regulators), the bank's policies, and its controls"
tool_resources:
  rulebook_search:
    search_service: REG_CHANGE_DEMO.RCT.RULEBOOK_SEARCH
    max_results: 8
    title_column: source_name
    id_column: source_id
$$;

-- To watch the task process a new notice, copy the held-back file onto the stage. The task runs
-- within 5 minutes and the notice appears at the top of the Change inbox:
--   COPY FILES INTO @REG_CHANGE_DEMO.RCT.NOTICE_DOCS FROM @REG_CHANGE_DEMO.RCT.RCT_REPO/branches/main/data/incoming/;
--   ALTER STAGE REG_CHANGE_DEMO.RCT.NOTICE_DOCS REFRESH;

-- 2f. Check the result -----------------------------------------------------------
SELECT COUNT(*) AS notices, COUNT_IF(ai_applicable) AS applicable, COUNT_IF(NOT ai_applicable) AS not_applicable FROM NOTICES;
SELECT verdict, COUNT(*) AS obligations FROM OBLIGATION_MAP GROUP BY verdict ORDER BY obligations DESC;
SELECT gap_id, notice_id, obligation_id, gap_type, owner_team, due_date FROM GAPS WHERE source = 'AI mapping' ORDER BY gap_id;
