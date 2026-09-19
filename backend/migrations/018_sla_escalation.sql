BEGIN;


-- ============================================================
-- 018 - SLA ESCALATION FOUNDATION
--
-- Responsibilities:
--
-- 1. Every submitted/non-draft ticket receives a 24-hour SLA.
-- 2. Existing open legacy tickets receive a fresh 24-hour
--    window so the migration does not instantly escalate them.
-- 3. Email tickets without submitted_at receive a valid
--    submission timestamp.
-- 4. Escalation notifications support both HOD and ADMIN.
--
-- Actual overdue detection will be performed by the backend
-- SLA escalation worker added after this migration is verified.
-- ============================================================



-- ============================================================
-- 1. SLA DEADLINE FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION
public.sq_set_ticket_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    event_at TIMESTAMPTZ :=
        clock_timestamp();

    submission_time TIMESTAMPTZ;
BEGIN

    -- Drafts do not have an active SLA yet.
    IF NEW.status = 'DRAFT' THEN
        RETURN NEW;
    END IF;


    -- --------------------------------------------------------
    -- Determine when the query entered the submitted lifecycle.
    --
    -- Web submissions normally already provide submitted_at.
    -- Email-created tickets may not, so created_at/event time
    -- becomes the submission time.
    -- --------------------------------------------------------

    submission_time :=
        COALESCE(
            NEW.submitted_at,
            NEW.created_at,
            event_at
        );


    IF NEW.submitted_at IS NULL THEN
        NEW.submitted_at :=
            submission_time;
    END IF;


    -- --------------------------------------------------------
    -- Preserve an existing SLA deadline.
    --
    -- Once assigned, normal status changes must not restart
    -- the 24-hour clock.
    -- --------------------------------------------------------

    IF NEW.sla_due_at IS NULL THEN
        NEW.sla_due_at :=
            submission_time
            + INTERVAL '24 hours';
    END IF;


    RETURN NEW;
END;
$$;



-- ============================================================
-- 2. SLA TRIGGER
--
-- INSERT:
--   Handles direct PENDING/email tickets.
--
-- UPDATE OF status:
--   Handles DRAFT -> PENDING submission and repairs any old
--   ticket that reaches a new status without an SLA.
-- ============================================================

DROP TRIGGER IF EXISTS
    trg_ticket_sla
ON public.tickets;


CREATE TRIGGER
    trg_ticket_sla

BEFORE INSERT
OR UPDATE OF status

ON public.tickets

FOR EACH ROW

EXECUTE FUNCTION
    public.sq_set_ticket_sla();



-- ============================================================
-- 3. SAFE LEGACY BACKFILL
--
-- Do NOT calculate SLA from the original historical submission
-- time for currently open tickets. Some are already more than
-- 24 hours old and would all escalate immediately.
--
-- Give existing open tickets a fresh 24-hour window starting
-- when this migration is installed.
--
-- resolved / closed tickets remain historical and are not
-- modified.
-- ============================================================

UPDATE public.tickets

SET
    submitted_at =
        COALESCE(
            submitted_at,
            created_at,
            clock_timestamp()
        ),

    sla_due_at =
        clock_timestamp()
        + INTERVAL '24 hours',

    updated_at =
        clock_timestamp()

WHERE status NOT IN (
    'DRAFT',
    'RESOLVED',
    'CLOSED'
)

  AND sla_due_at IS NULL;



-- ============================================================
-- 4. HOD / ADMIN ESCALATION NOTIFICATION
--
-- Previous migration notified only HOD.
--
-- The escalation worker will use:
--
-- Department has active HOD
--     -> target_role = HOD
--
-- Department has no active HOD
--     -> target_role = ADMIN
--
-- escalated_to_user_id always contains the exact recipient.
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

    target_label TEXT;

    notification_message TEXT;
BEGIN

    IF NEW.target_role NOT IN (
        'HOD',
        'ADMIN'
    ) THEN
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

    WHERE t.ticket_id =
          NEW.ticket_id;


    IF current_ticket_number IS NULL THEN
        RETURN NEW;
    END IF;


    target_label :=
        CASE NEW.target_role
            WHEN 'HOD'
                THEN 'HOD'
            WHEN 'ADMIN'
                THEN 'administrator'
            ELSE 'reviewer'
        END;


    notification_message :=
        (
            'Query '
            || current_ticket_number
            || ' has been escalated and requires '
            || target_label
            || ' review.'
        );


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
            'query-escalated-recipient:'
            || NEW.escalation_id::text
        ),

        'QUERY_ESCALATED',

        'Escalated query requires attention',

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



-- Existing trigger already calls this function.
-- Recreate it explicitly so final migration state is clear.

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
-- 5. SECURITY
-- ============================================================

REVOKE ALL
ON FUNCTION
    public.sq_set_ticket_sla()
FROM PUBLIC;


REVOKE ALL
ON FUNCTION
    public.notify_hod_escalation_in_app()
FROM PUBLIC;


COMMIT;