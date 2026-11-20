-- =============================================================================
-- Regulatory Change Tracker: cleanup
-- Drops everything sql/setup.sql created. The database drop removes its tables, views,
-- stage and files, stream, task, procedure, Cortex Search service, agent, and Git
-- repository clone.
-- =============================================================================
-- Objects are owned by the example role, so drop them as that role first.
USE ROLE REG_CHANGE_DEMO_ROLE;
ALTER TASK IF EXISTS REG_CHANGE_DEMO.RCT.PROCESS_NOTICES_TASK SUSPEND;
DROP DATABASE IF EXISTS REG_CHANGE_DEMO;
DROP WAREHOUSE IF EXISTS REG_CHANGE_WH;

USE ROLE ACCOUNTADMIN;
DROP INTEGRATION IF EXISTS REG_CHANGE_GIT_API;
DROP ROLE IF EXISTS REG_CHANGE_DEMO_ROLE;
