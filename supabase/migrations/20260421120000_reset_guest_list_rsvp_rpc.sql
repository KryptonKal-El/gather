CREATE TABLE IF NOT EXISTS public.list_audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
    actor_id uuid NOT NULL REFERENCES auth.users(id),
    event_type text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_list_audit_events_list_id_created_at
    ON public.list_audit_events (list_id, created_at DESC);

ALTER TABLE public.list_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS list_audit_events_select_owner ON public.list_audit_events;
CREATE POLICY list_audit_events_select_owner ON public.list_audit_events
    FOR SELECT
    USING (is_list_owner(list_id));

CREATE OR REPLACE FUNCTION public.reset_guest_list_rsvp(p_list_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count integer;
BEGIN
    IF NOT is_list_owner(p_list_id) THEN
        RAISE EXCEPTION 'Only the list owner can reset RSVP statuses' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.lists
        WHERE id = p_list_id
          AND type = 'guest_list'
    ) THEN
        RAISE EXCEPTION 'List is not a guest list' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.items
    SET rsvp_status = 'not_invited'
    WHERE list_id = p_list_id
      AND rsvp_status IS DISTINCT FROM 'not_invited';

    GET DIAGNOSTICS v_count = ROW_COUNT;

    INSERT INTO public.list_audit_events (list_id, actor_id, event_type, metadata)
    VALUES (
        p_list_id,
        auth.uid(),
        'guest_list_rsvp_reset',
        jsonb_build_object('affected_count', v_count)
    );

    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_guest_list_rsvp(uuid) TO authenticated;
