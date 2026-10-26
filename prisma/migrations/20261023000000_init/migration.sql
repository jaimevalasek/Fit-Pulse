-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "sales_channel" TEXT NOT NULL,
    "annual_revenue_range" TEXT,
    "cnpj" TEXT,
    "archived_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "diagnoses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "archived_at" DATETIME,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "calculator" JSONB NOT NULL DEFAULT '{}',
    "current_block" INTEGER NOT NULL DEFAULT 1,
    "rules_version" INTEGER,
    "result" JSONB,
    "stage" INTEGER,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "diagnoses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "preferences" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "diagnoses_company_id_status_idx" ON "diagnoses"("company_id", "status");

