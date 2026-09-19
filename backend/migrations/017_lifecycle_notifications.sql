BEGIN;


-- ============================================================
-- 1. STUDENT TICKET STATUS NOTIFICATIONS
--
-- Generates:
--   IN_PROGRESS -> STATUS_UPDATED
--   RESOLVED    -> STATUS_UPDATED
--   ESCALATED   -> QUERY_ESCALATED
--
-- NEEDS_INFORMATION is intentionally handled by the response
-- delivery trigger below, so the student is notified only when
-- the actual information request has been sent.
-- ============================================================

CREATE OR REPLACE FUNCTION
public.notify_ticket_status_in_app()
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
    notification_message TEXT;
    notification_event_key VARCHAR(200);
BEGIN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;


    CASE NEW.status

        WHEN 'IN_PROGRESS' THEN
            notification_kind :=
                'STATUS_UPDATED';

            notification_title :=
                'Query in progress';

            notification_message :=
                (
                    'Your query '
                    || NEW.ticket_number
                    || ' is now being worked on.'
                );

            notification_event_key :=
                (
                    'status-updated:'
                    || NEW.ticket_id::text
                    || ':in-progress'
                );


        WHEN 'RESOLVED' THEN
            notification_kind :=
                'STATUS_UPDATED';

            notification_title :=
                'Query resolved';

            notification_message :=
                (
                    'Your query '
                    || NEW.ticket_number
                    || ' has been resolved.'
                );

            notification_event_key :=
                (
                    'status-updated:'
                    || NEW.ticket_id::text
                    || ':resolved'
                );


        WHEN 'ESCALATED' THEN
            notification_kind :=
                'QUERY_ESCALATED';

            notification_title :=
                'Query escalated';

            notification_message :=
                (
                    'Your query '
                    || NEW.ticket_number
                    || ' has been escalated for further review.'
                );

            notification_event_key :=
                (
                    'query-escalated-student:'
                    || NEW.ticket_id::text
                );


        ELSE
            RETURN NEW;

    END CASE;


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

        notification_event_key,
        notification_kind,

        notification_title,
        notification_message,

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
    trg_ticket_status_in_app
ON public.tickets;


CREATE TRIGGER
    trg_ticket_status_in_app
AFTER UPDATE OF status
ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION
    public.notify_ticket_status_in_app();



-- ============================================================
-- 2. RESPONSE DELIVERY NOTIFICATIONS
--
-- Notification is created only after Gmail delivery has been
-- confirmed and responses.delivery_status changes to SENT.
--
-- FINAL
--   -> RESPONSE_SENT
--
-- INFORMATION_REQUEST
--   -> INFORMATION_REQUESTED
-- ============================================================

CREATE OR REPLACE FUNCTION
public.notify_response_sent_in_app()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    event_at TIMESTAMPTZ :=
        clock_timestamp();

    student_user_id UUID;
    current_ticket_number VARCHAR;

    notification_kind VARCHAR(40);
    notification_title VARCHAR(200);
    notification_message TEXT;
    notification_event_key VARCHAR(200);
BEGIN
    IF NEW.delivery_status <> 'SENT' THEN
        RETURN NEW;
    END IF;


    IF OLD.delivery_status IS NOT DISTINCT
       FROM NEW.delivery_status THEN
        RETURN NEW;
    END IF;


    SELECT
        t.student_id,
        t.ticket_number
    INTO
        student_user_id,
        current_ticket_number
    FROM public.tickets t
    WHERE t.ticket_id = NEW.ticket_id;


    IF student_user_id IS NULL THEN
        RETURN NEW;
    END IF;


    CASE NEW.response_type

        WHEN 'FINAL' THEN
            notification_kind :=
                'RESPONSE_SENT';

            notification_title :=
                'Response sent';

            notification_message :=
                (
                    'A response for query '
                    || current_ticket_number
                    || ' has been sent to your email.'
                );

            notification_event_key :=
                (
                    'response-sent:'
                    || NEW.response_id::text
                );


        WHEN 'INFORMATION_REQUEST' THEN
            notification_kind :=
                'INFORMATION_REQUESTED';

            notification_title :=
                'Additional information required';

            notification_message :=
                (
                    'Additional information has been requested '
                    || 'for query '
                    || current_ticket_number
                    || '. Please check your email.'
                );

            notification_event_key :=
                (
                    'information-requested:'
                    || NEW.response_id::text
                );


        ELSE
            RETURN NEW;

    END CASE;


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
        NEW.response_id,
        student_user_id,

        notification_event_key,
        notification_kind,

        notification_title,
        notification_message,

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
    trg_response_sent_in_app
ON public.responses;


CREATE TRIGGER
    trg_response_sent_in_app
AFTER UPDATE OF delivery_status
ON public.responses
FOR EACH ROW
EXECUTE FUNCTION
    public.notify_response_sent_in_app();



-- ============================================================
-- 3. HOD ESCALATION NOTIFICATION
--
-- escalated_to_user_id is already the exact HOD recipient.
-- This avoids guessing from department membership.
-- ============================================================

CREATE OR REPLACE FUNCTION
public.notify_hod_escalation_in_app()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    event_at TIMESTAMPTZ :=
        clock_timestamp();

    current_ticket_number VARCHAR;
BEGIN
    IF NEW.target_role <> 'HOD' THEN
        RETURN NEW;
    END IF;


    IF NEW.escalation_status <> 'OPEN' THEN
        RETURN NEW;
    END IF;


    SELECT
        t.ticket_number
    INTO
        current_ticket_number
    FROM public.tickets t
    WHERE t.ticket_id = NEW.ticket_id;


    IF current_ticket_number IS NULL THEN
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
        NEW.escalated_to_user_id,

        (
            'query-escalated-hod:'
            || NEW.escalation_id::text
        ),

        'QUERY_ESCALATED',

        'Escalated query requires attention',

        (
            'Query '
            || current_ticket_number
            || ' has been escalated and requires HOD review.'
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
    trg_hod_escalation_in_app
ON public.escalations;


CREATE TRIGGER
    trg_hod_escalation_in_app
AFTER INSERT
ON public.escalations
FOR EACH ROW
EXECUTE FUNCTION
    public.notify_hod_escalation_in_app();



-- ============================================================
-- SECURITY
-- Trigger functions should not be manually executable by
-- ordinary PUBLIC roles.
-- ============================================================

REVOKE ALL
ON FUNCTION
    public.notify_ticket_status_in_app()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION
    public.notify_response_sent_in_app()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION
    public.notify_hod_escalation_in_app()
FROM PUBLIC;


COMMIT;