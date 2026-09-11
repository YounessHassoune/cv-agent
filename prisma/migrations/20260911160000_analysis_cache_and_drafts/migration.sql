-- The job analysis, stored so the same job is analysed once and scored
-- against the same must-haves every run; and per-language CV drafts, so the
-- writer's output goes to the database instead of through the orchestrator.
ALTER TABLE "Application" ADD COLUMN "jdExtraction" JSONB;
ALTER TABLE "Application" ADD COLUMN "drafts" JSONB;
