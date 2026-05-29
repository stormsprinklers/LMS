-- CreateTable
CREATE TABLE "LibraryTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryAssetTag" (
    "assetId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "LibraryAssetTag_pkey" PRIMARY KEY ("assetId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryTag_name_key" ON "LibraryTag"("name");
CREATE UNIQUE INDEX "LibraryTag_slug_key" ON "LibraryTag"("slug");
CREATE INDEX "LibraryAssetTag_tagId_idx" ON "LibraryAssetTag"("tagId");

-- AddForeignKey
ALTER TABLE "LibraryAssetTag" ADD CONSTRAINT "LibraryAssetTag_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "LibraryAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryAssetTag" ADD CONSTRAINT "LibraryAssetTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "LibraryTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
