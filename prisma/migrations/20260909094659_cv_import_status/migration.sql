-- AlterTable
ALTER TABLE "CvImport" ADD COLUMN     "error" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'done';
