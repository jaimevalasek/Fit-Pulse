-- CreateTable
CREATE TABLE "questionnaire_sends" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "sent_at" DATETIME NOT NULL,
    "answered_at" DATETIME,
    "client_saved_at" DATETIME,
    "draft_id" TEXT,
    CONSTRAINT "questionnaire_sends_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "questionnaire_sends_company_id_answered_at_idx" ON "questionnaire_sends"("company_id", "answered_at");

-- CreateIndex
CREATE INDEX "questionnaire_sends_draft_id_idx" ON "questionnaire_sends"("draft_id");

