-- AlterTable
ALTER TABLE "Application" DROP COLUMN "atsReport",
DROP COLUMN "cvJson",
DROP COLUMN "cvText",
DROP COLUMN "language",
DROP COLUMN "pdfBytes",
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
ADD COLUMN     "variants" JSONB;

-- CreateTable
CREATE TABLE "CvPdf" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvPdf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CvPdf_applicationId_language_key" ON "CvPdf"("applicationId", "language");

-- AddForeignKey
ALTER TABLE "CvPdf" ADD CONSTRAINT "CvPdf_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

