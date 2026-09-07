-- CreateTable
CREATE TABLE "CvImport" (
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "profile" JSONB NOT NULL,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvImport_pkey" PRIMARY KEY ("userId")
);
