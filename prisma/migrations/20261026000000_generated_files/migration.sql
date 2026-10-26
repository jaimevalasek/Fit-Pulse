-- CreateTable
CREATE TABLE "generated_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT,
    "kind" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "directory" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "generated_files_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "generated_files_company_id_kind_created_at_idx" ON "generated_files"("company_id", "kind", "created_at");

