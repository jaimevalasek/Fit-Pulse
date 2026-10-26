-- CreateTable
CREATE TABLE "action_progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "diagnosis_id" TEXT NOT NULL,
    "action_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "due_date" TEXT,
    "owner_role" TEXT,
    "note" TEXT,
    "inherited_from_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "action_progress_diagnosis_id_fkey" FOREIGN KEY ("diagnosis_id") REFERENCES "diagnoses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "action_progress_inherited_from_id_fkey" FOREIGN KEY ("inherited_from_id") REFERENCES "diagnoses" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "action_progress_inherited_from_id_idx" ON "action_progress"("inherited_from_id");

-- CreateIndex
CREATE UNIQUE INDEX "action_progress_diagnosis_id_action_key_key" ON "action_progress"("diagnosis_id", "action_key");

