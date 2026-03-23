-- Auto-generate next occurrence when a recurring item is checked off
-- Migration: add_recurrence_trigger
-- Created: 2026-03-23

-- ============================================================================
-- FUNCTION: calculate_next_due_date
-- ============================================================================
-- Calculates the next due date based on recurrence_rule and a starting date.
-- Replicates the client-side recurrence engine logic in PL/pgSQL.

CREATE OR REPLACE FUNCTION calculate_next_due_date(rule jsonb, from_date date)
RETURNS date AS $$
DECLARE
  rule_type text;
  rule_interval int;
  rule_frequency text;
  days_of_week int[];
  next_date date;
  candidate date;
  candidate_dow int;
  i int;
BEGIN
  IF rule IS NULL OR from_date IS NULL THEN
    RETURN NULL;
  END IF;

  rule_type := rule->>'type';
  
  CASE rule_type
    WHEN 'daily' THEN
      next_date := from_date + INTERVAL '1 day';
    WHEN 'weekly' THEN
      next_date := from_date + INTERVAL '7 days';
    WHEN 'biweekly' THEN
      next_date := from_date + INTERVAL '14 days';
    WHEN 'monthly' THEN
      next_date := (from_date + INTERVAL '1 month')::date;
    WHEN 'yearly' THEN
      next_date := (from_date + INTERVAL '1 year')::date;
    WHEN 'custom' THEN
      rule_interval := COALESCE((rule->>'interval')::int, 1);
      rule_frequency := rule->>'frequency';
      
      IF rule_frequency = 'day' THEN
        next_date := from_date + (rule_interval || ' days')::interval;
      ELSIF rule_frequency = 'week' THEN
        IF rule->'daysOfWeek' IS NOT NULL AND jsonb_array_length(rule->'daysOfWeek') > 0 THEN
          SELECT array_agg(elem::int)
          INTO days_of_week
          FROM jsonb_array_elements_text(rule->'daysOfWeek') AS elem;
          
          candidate := from_date + INTERVAL '1 day';
          FOR i IN 1..(rule_interval * 7) LOOP
            candidate_dow := EXTRACT(DOW FROM candidate)::int;
            IF candidate_dow = ANY(days_of_week) THEN
              next_date := candidate;
              EXIT;
            END IF;
            candidate := candidate + INTERVAL '1 day';
          END LOOP;
          
          IF next_date IS NULL THEN
            next_date := from_date + (rule_interval * 7 || ' days')::interval;
          END IF;
        ELSE
          next_date := from_date + (rule_interval * 7 || ' days')::interval;
        END IF;
      ELSIF rule_frequency = 'month' THEN
        next_date := (from_date + (rule_interval || ' months')::interval)::date;
      ELSIF rule_frequency = 'year' THEN
        next_date := (from_date + (rule_interval || ' years')::interval)::date;
      ELSE
        RETURN NULL;
      END IF;
    ELSE
      RETURN NULL;
  END CASE;
  
  RETURN next_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- FUNCTION: handle_recurring_item_checkoff
-- ============================================================================
-- Trigger function that creates the next occurrence when a recurring item
-- is checked off. Uses BEFORE UPDATE so we can modify NEW.checked_at.

CREATE OR REPLACE FUNCTION handle_recurring_item_checkoff()
RETURNS trigger AS $$
DECLARE
  next_due date;
BEGIN
  -- Only fire when is_checked changes from false to true
  -- and the item has a recurrence rule
  IF NEW.is_checked = true AND OLD.is_checked = false AND NEW.recurrence_rule IS NOT NULL THEN
    NEW.checked_at := NOW();
    
    next_due := calculate_next_due_date(
      NEW.recurrence_rule,
      COALESCE(NEW.due_date, CURRENT_DATE)
    );
    
    INSERT INTO items (
      list_id,
      name,
      category,
      is_checked,
      store_id,
      quantity,
      price,
      image_url,
      unit,
      rsvp_status,
      due_date,
      recurrence_rule,
      reminder_days_before,
      checked_at,
      parent_item_id,
      reminder_sent_at
    ) VALUES (
      NEW.list_id,
      NEW.name,
      NEW.category,
      false,
      NEW.store_id,
      NEW.quantity,
      NEW.price,
      NEW.image_url,
      NEW.unit,
      NEW.rsvp_status,
      next_due,
      NEW.recurrence_rule,
      NEW.reminder_days_before,
      NULL,
      NEW.id,
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: on_recurring_item_checkoff
-- ============================================================================

CREATE TRIGGER on_recurring_item_checkoff
  BEFORE UPDATE OF is_checked ON items
  FOR EACH ROW
  EXECUTE FUNCTION handle_recurring_item_checkoff();
