-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "template" TEXT NOT NULL DEFAULT 'modern';

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "template" TEXT NOT NULL DEFAULT 'modern';
