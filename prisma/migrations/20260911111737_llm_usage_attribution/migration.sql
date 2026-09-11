-- AlterTable
ALTER TABLE "LlmUsage" ADD COLUMN     "costSource" TEXT NOT NULL DEFAULT 'estimate',
ADD COLUMN     "sessionId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "LlmUsage_sessionId_idx" ON "LlmUsage"("sessionId");
