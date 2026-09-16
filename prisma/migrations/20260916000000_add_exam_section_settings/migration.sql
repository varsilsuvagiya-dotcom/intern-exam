-- Per-section on/off state for paper generation.
--
-- The blueprint (names, ordinals, question counts, marks) stays defined in
-- code; this table only tracks whether each currently active section takes
-- part in drawing a new paper. Seeded enabled for every section the
-- blueprint currently defines, so existing behaviour is unchanged until an
-- admin actually flips one off.
CREATE TABLE "exam_section_settings" (
    "code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_section_settings_pkey" PRIMARY KEY ("code")
);

INSERT INTO "exam_section_settings" ("code", "enabled", "updated_at")
VALUES
  ('JS',  true,  now()),
  ('BUG', true,  now()),
  ('LRN', true,  now()),
  ('LOG', false, now()),
  ('NUM', false, now()),
  ('OUT', false, now()),
  ('STP', false, now());
