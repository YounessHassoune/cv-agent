-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'mono';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'mono';
