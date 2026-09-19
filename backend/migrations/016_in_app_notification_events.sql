BEGIN;


-- ============================================================
-- QUERY_SUBMITTED
--
-- Covers:
--   1. New WEB ticket inserted directly as PENDING
--   2. New EMAIL ticket inserted directly as PENDING
--   3. Saved WEB draft changing from DRAFT -> PENDING
--
-- event_key + existing unique constraint make this idempotent.
-- ============================================================

CREATE OR REPLACE FUNCTION
public.notify_ticket_submitted_in_app()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    event_at TIMESTAMPTZ :=
        clock_timestamp();

    should_notify BOOLEAN :=
        FALSE;
BEGIN
    IF TG_OP = 'INSERT' THEN
        should_notify :=
            NEW.status = 'PENDING';

    ELSIF TG_OP = 'UPDATE' THEN
        should_notify :=
            NEW.status = 'PENDING'
            AND OLD.status IS DISTINCT
                FROM NEW.status;
    END IF;


    IF NOT should_notify THEN
        RETURN NEW;
    END IF;


    INSERT INTO public.notifications (
        ticket_id,
        response_id,
        recipient_user_id,

        event_key,
        notification_type,

        title,
        message,

        channel,
        delivery_status,

        recipient_email,
        gmail_account_email,
        gmail_message_id,
        failure_reason,

        read_at,
        created_at,
        sent_at
    )
    VALUES (
        NEW.ticket_id,
        NULL,
        NEW.student_id,

        (
            'query-submitted:'
            || NEW.ticket_id::text
        ),
        'QUERY_SUBMITTED',

        'Query submitted',
        (
            'Your query '
            || NEW.ticket_number
            || ' has been submitted successfully.'
        ),

        'IN_APP',
        'SENT',

        NULL,
        NULL,
        NULL,
        NULL,

        NULL,
        event_at,
        event_at
    )
    ON CONFLICT ON CONSTRAINT
        notifications_event_unique
    DO NOTHING;


    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS
    trg_ticket_submitted_in_app
ON public.tickets;


CREATE TRIGGER
    trg_ticket_submitted_in_app
AFTER INSERT OR UPDATE OF status
ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION
    public.notify_ticket_submitted_in_app();


-- ============================================================
-- QUERY_ASSIGNED / QUERY_REASSIGNED
--
-- Fires only when assigned_officer_id receives a new
-- non-null user.
--
-- Initial assignment:
--     NULL -> user
--     QUERY_ASSIGNED
--
-- Reassignment:
--     old user -> new user
--     QUERY_REASSIGNED
-- ============================================================

CREATE OR REPLACE FUNCTION
public.notify_ticket_assignment_in_app()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    event_at TIMESTAMPTZ :=
        clock_timestamp();

    notification_kind VARCHAR(40);

    notification_title VARCHAR(200);

    notification_event_key VARCHAR(200);
BEGIN
    IF NEW.assigned_officer_id IS NULL THEN
        RETURN NEW;
    END IF;


    IF OLD.assigned_officer_id
       IS NOT DISTINCT FROM
       NEW.assigned_officer_id THEN
        RETURN NEW;
    END IF;


    IF OLD.assigned_officer_id IS NULL THEN
        notification_kind :=
            'QUERY_ASSIGNED';

        notification_title :=
            'New query assigned';

        notification_event_key :=
            (
                'query-assigned:'
                || NEW.ticket_id::text
                || ':'
                || NEW.assigned_officer_id::text
            );

    ELSE
        notification_kind :=
            'QUERY_REASSIGNED';

        notification_title :=
            'Query reassigned to you';

        notification_event_key :=
            (
                'query-reassigned:'
                || NEW.ticket_id::text
                || ':'
                || NEW.assigned_officer_id::text
            );
    END IF;


    INSERT INTO public.notifications (
        ticket_id,
        response_id,
        recipient_user_id,

        event_key,
        notification_type,

        title,
        message,

        channel,
        delivery_status,

        recipient_email,
        gmail_account_email,
        gmail_message_id,
        failure_reason,

        read_at,
        created_at,
        sent_at
    )
    VALUES (
        NEW.ticket_id,
        NULL,
        NEW.assigned_officer_id,

        notification_event_key,
        notification_kind,

        notification_title,
        (
            'Query '
            || NEW.ticket_number
            || ' has been assigned to you.'
        ),

        'IN_APP',
        'SENT',

        NULL,
        NULL,
        NULL,
        NULL,

        NULL,
        event_at,
        event_at
    )
    ON CONFLICT ON CONSTRAINT
        notifications_event_unique
    DO NOTHING;


    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS
    trg_ticket_assignment_in_app
ON public.tickets;


CREATE TRIGGER
    trg_ticket_assignment_in_app
AFTER UPDATE OF assigned_officer_id
ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION
    public.notify_ticket_assignment_in_app();


-- Trigger functions do not need to be directly callable
-- by browser/client roles.

REVOKE ALL
ON FUNCTION
    public.notify_ticket_submitted_in_app()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION
    public.notify_ticket_assignment_in_app()
FROM PUBLIC;


COMMIT;