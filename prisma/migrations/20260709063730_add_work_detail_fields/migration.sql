-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Work" (
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
    "heroImage" TEXT NOT NULL DEFAULT '',
    "experienceImage" TEXT NOT NULL DEFAULT '',
    "heroQuote" TEXT NOT NULL DEFAULT '',
    "story" TEXT NOT NULL DEFAULT '',
    "gallery" TEXT NOT NULL DEFAULT '[]',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "showOnHome" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Work" ("afterImage", "beforeImage", "category", "categorySlug", "createdAt", "duration", "excerpt", "id", "isPublished", "showOnHome", "slug", "technique", "title", "updatedAt") SELECT "afterImage", "beforeImage", "category", "categorySlug", "createdAt", "duration", "excerpt", "id", "isPublished", "showOnHome", "slug", "technique", "title", "updatedAt" FROM "Work";
DROP TABLE "Work";
ALTER TABLE "new_Work" RENAME TO "Work";
CREATE UNIQUE INDEX "Work_slug_key" ON "Work"("slug");
CREATE INDEX "Work_isPublished_idx" ON "Work"("isPublished");
CREATE INDEX "Work_showOnHome_idx" ON "Work"("showOnHome");
CREATE INDEX "Work_categorySlug_idx" ON "Work"("categorySlug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
