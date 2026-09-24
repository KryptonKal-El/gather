-- "Plan my week": each suggested slot carries the one-line reason it was picked
-- ("Haven't made this in 7 weeks", "Uses the rest of Tuesday's cilantro"), stored
-- with the slot so every household member sees the same explanation.
-- Cleared by clients whenever a person sets the slot by hand (source = 'manual').

ALTER TABLE meal_plan_entries ADD COLUMN suggestion_reason text;
