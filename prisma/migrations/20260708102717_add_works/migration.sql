-- CreateTable
CREATE TABLE "Work" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Работа',
    "categorySlug" TEXT NOT NULL DEFAULT 'airtouch',
    "beforeImage" TEXT NOT NULL,
    "afterImage" TEXT NOT NULL,
    "technique" TEXT NOT NULL DEFAULT '',
    "duration" TEXT NOT NULL DEFAULT '',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "showOnHome" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Work_slug_key" ON "Work"("slug");

-- CreateIndex
CREATE INDEX "Work_isPublished_idx" ON "Work"("isPublished");

-- CreateIndex
CREATE INDEX "Work_showOnHome_idx" ON "Work"("showOnHome");

-- CreateIndex
CREATE INDEX "Work_categorySlug_idx" ON "Work"("categorySlug");
