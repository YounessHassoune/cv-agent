-- One application per (user, chat session, job ad).
--
-- Two `analyze_jd` calls dispatched at the same moment both read an empty
-- table and both inserted, producing two applications for one job. The tool's
-- own check cannot see a write that has not committed yet, so the constraint
-- lives here.
--
-- Both columns are nullable and Postgres treats NULLs as distinct, so existing
-- rows are exempt from the constraint rather than in conflict with it.
ALTER TABLE "Application" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "Application" ADD COLUMN "jdHash" TEXT;

-- Backfill the session from the cursor already stored on the row, so a thread
-- opened before this migration is still protected. `jdHash` is left null: it is
-- computed in application code and cannot be reproduced faithfully in SQL.
UPDATE "Application"
SET "sessionId" = "chatSession" ->> 'sessionId'
WHERE "chatSession" IS NOT NULL;

CREATE UNIQUE INDEX "Application_userId_sessionId_jdHash_key"
  ON "Application" ("userId", "sessionId", "jdHash");
