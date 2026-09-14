-- Migration 007: Notifications, escalations, status history and audit
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- 1. Notifications belong to individual recipients.
CREATE UNIQUE INDEX IF NOT EXISTS uq_responses_id_ticket
    ON public.responses (response_id, ticket_id);

CREATE TABLE IF NOT EXISTS public.notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.tickets(ticket_id) ON DELETE RESTRICT,
    response_id UUID,
    recipient_user_id UUID NOT NULL
        REFERENCES public.users(user_id) ON DELETE RESTRICT,
    event_key VARCHAR(200) NOT NULL,
    notification_type VARCHAR(40) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    channel VARCHAR(20) NOT NULL,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    recipient_email VARCHAR(255),
    gmail_account_email VARCHAR(255),
    gmail_message_id VARCHAR(255),
    failure_reason TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,

    CONSTRAINT notifications_response_ticket_fk
        FOREIGN KEY (response_id, ticket_id)
        REFERENCES public.responses(response_id, ticket_id) ON DELETE RESTRICT,
    CONSTRAINT notifications_type_check CHECK (
        notification_type IN (
            'QUERY_SUBMITTED', 'QUERY_ASSIGNED', 'STATUS_UPDATED',
            'RESPONSE_SENT', 'QUERY_ESCALATED', 'QUERY_REASSIGNED',
            'ANNOUNCEMENT', 'INFORMATION_REQUESTED', 'INFORMATION_RECEIVED',
            'MANUAL_REVIEW_REQUIRED', 'AVAILABILITY_ACKNOWLEDGEMENT',
            'SLA_REMINDER', 'DAILY_SUMMARY'
        )
    ),
    CONSTRAINT notifications_text_check CHECK (
        event_key ~ '[^[:space:]]'
        AND title ~ '[^[:space:]]'
        AND message ~ '[^[:space:]]'
    ),
    CONSTRAINT notifications_context_check CHECK (
        (notification_type IN ('ANNOUNCEMENT', 'DAILY_SUMMARY') OR ticket_id IS NOT NULL)
        AND (
            (notification_type IN ('RESPONSE_SENT', 'INFORMATION_REQUESTED') AND response_id IS NOT NULL)
            OR (notification_type NOT IN ('RESPONSE_SENT', 'INFORMATION_REQUESTED') AND response_id IS NULL)
        )
    ),
    CONSTRAINT notifications_channel_check CHECK (channel IN ('EMAIL', 'IN_APP')),
    CONSTRAINT notifications_delivery_status_check CHECK (
        delivery_status IN ('PENDING', 'SENT', 'FAILED')
    ),
    CONSTRAINT notifications_email_check CHECK (
        (recipient_email IS NULL OR
            (recipient_email = lower(btrim(recipient_email)) AND recipient_email <> ''))
        AND (gmail_account_email IS NULL OR
            (gmail_account_email = lower(btrim(gmail_account_email)) AND gmail_account_email <> ''))
        AND (
            (channel = 'EMAIL' AND recipient_email IS NOT NULL)
            OR (channel = 'IN_APP' AND recipient_email IS NULL
                AND gmail_account_email IS NULL AND gmail_message_id IS NULL)
        )
    ),
    CONSTRAINT notifications_sent_check CHECK (
        (delivery_status = 'SENT' AND sent_at IS NOT NULL)
        OR (delivery_status <> 'SENT' AND sent_at IS NULL)
    ),
    CONSTRAINT notifications_gmail_proof_check CHECK (
        (
            channel = 'EMAIL' AND delivery_status = 'SENT'
            AND gmail_account_email IS NOT NULL
            AND gmail_message_id IS NOT NULL AND btrim(gmail_message_id) <> ''
        )
        OR (
            (channel <> 'EMAIL' OR delivery_status <> 'SENT')
            AND gmail_message_id IS NULL
        )
    ),
    CONSTRAINT notifications_failure_check CHECK (
        (delivery_status = 'FAILED' AND failure_reason IS NOT NULL
            AND failure_reason ~ '[^[:space:]]')
        OR (delivery_status <> 'FAILED' AND failure_reason IS NULL)
    ),
    CONSTRAINT notifications_read_check CHECK (
        read_at IS NULL
        OR (channel = 'IN_APP' AND delivery_status = 'SENT'
            AND read_at >= sent_at)
    ),
    CONSTRAINT notifications_dates_check CHECK (
        sent_at IS NULL OR sent_at >= created_at
    ),
    CONSTRAINT notifications_event_unique
        UNIQUE (recipient_user_id, channel, event_key),
    CONSTRAINT notifications_gmail_message_unique
        UNIQUE (gmail_account_email, gmail_message_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
    ON public.notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON public.notifications (recipient_user_id, created_at DESC)
    WHERE channel = 'IN_APP' AND delivery_status = 'SENT' AND read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_pending_email
    ON public.notifications (created_at, notification_id)
    WHERE channel = 'EMAIL' AND delivery_status = 'PENDING';

-- 2. Escalation events for HOD and Admin.
CREATE TABLE IF NOT EXISTS public.escalations (
    escalation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL
        REFERENCES public.tickets(ticket_id) ON DELETE RESTRICT,
    department_id UUID
        REFERENCES public.departments(department_id) ON DELETE RESTRICT,
    escalated_from_user_id UUID
        REFERENCES public.users(user_id) ON DELETE RESTRICT,
    escalated_to_user_id UUID NOT NULL
        REFERENCES public.users(user_id) ON DELETE RESTRICT,
    escalated_by_user_id UUID
        REFERENCES public.users(user_id) ON DELETE RESTRICT,
    escalated_by_service VARCHAR(100),
    target_role VARCHAR(30) NOT NULL,
    escalation_type VARCHAR(30) NOT NULL DEFAULT 'SLA_BREACH',
    event_key VARCHAR(200) UNIQUE NOT NULL,
    reason TEXT NOT NULL,
    escalation_status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    escalated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,

    CONSTRAINT escalations_target_check CHECK (
        target_role IN ('HOD', 'ADMIN')
        AND (target_role <> 'HOD' OR department_id IS NOT NULL)
        AND (escalated_from_user_id IS NULL
            OR escalated_from_user_id <> escalated_to_user_id)
    ),
    CONSTRAINT escalations_actor_check CHECK (
        num_nonnulls(escalated_by_user_id, escalated_by_service) = 1
        AND (escalated_by_service IS NULL OR escalated_by_service ~ '[^[:space:]]')
    ),
    CONSTRAINT escalations_type_check CHECK (
        escalation_type IN ('SLA_BREACH', 'MANUAL')
    ),
    CONSTRAINT escalations_manual_actor_check CHECK (
        escalation_type <> 'MANUAL' OR escalated_by_user_id IS NOT NULL
    ),
    CONSTRAINT escalations_text_check CHECK (
        reason ~ '[^[:space:]]' AND event_key ~ '[^[:space:]]'
    ),
    CONSTRAINT escalations_status_check CHECK (
        escalation_status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')
    ),
    CONSTRAINT escalations_status_dates_check CHECK (
        (escalation_status = 'OPEN' AND acknowledged_at IS NULL AND resolved_at IS NULL)
        OR (escalation_status = 'ACKNOWLEDGED' AND acknowledged_at IS NOT NULL AND resolved_at IS NULL)
        OR (escalation_status = 'RESOLVED' AND resolved_at IS NOT NULL)
    ),
    CONSTRAINT escalations_dates_check CHECK (
        (acknowledged_at IS NULL OR acknowledged_at >= escalated_at)
        AND (resolved_at IS NULL OR resolved_at >= escalated_at)
        AND (acknowledged_at IS NULL OR resolved_at IS NULL OR resolved_at >= acknowledged_at)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_escalations_active_ticket_role
    ON public.escalations (ticket_id, target_role)
    WHERE escalation_status IN ('OPEN', 'ACKNOWLEDGED');

CREATE INDEX IF NOT EXISTS idx_escalations_target_status
    ON public.escalations (escalated_to_user_id, escalation_status, escalated_at DESC);

CREATE INDEX IF NOT EXISTS idx_escalations_department_created
    ON public.escalations (department_id, escalated_at DESC);

-- 3. Status history. A service name identifies automated changes.
CREATE TABLE IF NOT EXISTS public.query_status_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    ticket_id UUID NOT NULL
        REFERENCES public.tickets(ticket_id) ON DELETE RESTRICT,
    changed_by_user_id UUID
        REFERENCES public.users(user_id) ON DELETE RESTRICT,
    changed_by_service VARCHAR(100),
    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    change_note TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT history_actor_check CHECK (
        num_nonnulls(changed_by_user_id, changed_by_service) = 1
        AND (changed_by_service IS NULL OR changed_by_service ~ '[^[:space:]]')
    ),
    CONSTRAINT history_previous_status_check CHECK (
        previous_status IS NULL OR previous_status IN (
            'DRAFT', 'PENDING', 'CLASSIFIED', 'ROUTED', 'IN_PROGRESS',
            'NEEDS_INFORMATION', 'ESCALATED', 'RESOLVED', 'CLOSED'
        )
    ),
    CONSTRAINT history_new_status_check CHECK (
        new_status IN (
            'DRAFT', 'PENDING', 'CLASSIFIED', 'ROUTED', 'IN_PROGRESS',
            'NEEDS_INFORMATION', 'ESCALATED', 'RESOLVED', 'CLOSED'
        )
    ),
    CONSTRAINT history_transition_check CHECK (
        previous_status IS DISTINCT FROM new_status
    )
);

CREATE INDEX IF NOT EXISTS idx_status_history_ticket_sequence
    ON public.query_status_history (ticket_id, event_sequence DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_status_history_initial_ticket
    ON public.query_status_history (ticket_id)
    WHERE previous_status IS NULL;

-- 4. Audit events with user or service attribution.
CREATE TABLE IF NOT EXISTS public.audit_logs (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    actor_user_id UUID
        REFERENCES public.users(user_id) ON DELETE RESTRICT,
    actor_service VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    outcome VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    old_values JSONB,
    new_values JSONB,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    request_id UUID,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT audit_actor_check CHECK (
        num_nonnulls(actor_user_id, actor_service) = 1
        AND (actor_service IS NULL OR actor_service ~ '[^[:space:]]')
    ),
    CONSTRAINT audit_text_check CHECK (
        action ~ '[^[:space:]]' AND entity_type ~ '[^[:space:]]'
    ),
    CONSTRAINT audit_outcome_check CHECK (outcome IN ('SUCCESS', 'FAILED', 'DENIED')),
    CONSTRAINT audit_json_check CHECK (
        (old_values IS NULL OR jsonb_typeof(old_values) = 'object')
        AND (new_values IS NULL OR jsonb_typeof(new_values) = 'object')
        AND jsonb_typeof(details) = 'object'
    )
);

CREATE INDEX IF NOT EXISTS idx_audit_entity_sequence
    ON public.audit_logs (entity_type, entity_id, event_sequence DESC);

CREATE INDEX IF NOT EXISTS idx_audit_actor_sequence
    ON public.audit_logs (actor_user_id, event_sequence DESC);

-- 5. History and audit are append-only during normal operation.
CREATE OR REPLACE FUNCTION public.block_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
    RAISE EXCEPTION 'History and audit records are append-only.'
        USING ERRCODE = '23514';
    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_status_history_append_only
    ON public.query_status_history;

CREATE TRIGGER trg_status_history_append_only
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.query_status_history
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON public.audit_logs;

CREATE TRIGGER trg_audit_logs_append_only
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_mutation();

-- 6. FastAPI remains the controlled access layer.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.notifications, public.escalations,
    public.query_status_history, public.audit_logs
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON SEQUENCE
    public.query_status_history_event_sequence_seq,
    public.audit_logs_event_sequence_seq
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.block_history_mutation()
FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.notifications.event_key IS
    'Stable event identifier supplied by the backend and reused on retries. Each recipient/channel receives one record per event.';

COMMENT ON COLUMN public.notifications.response_id IS
    'Links a reply notification to its parent response. Outgoing replies must use the approved response text.';

COMMENT ON COLUMN public.escalations.target_role IS
    'Role at escalation time. The backend must validate the target user role, active state and department before insertion.';

COMMENT ON TABLE public.query_status_history IS
    'Actual status changes recorded by the backend in the same transaction as the ticket update. No legacy history is inferred.';

COMMENT ON TABLE public.audit_logs IS
    'Append-only operational audit. The backend must exclude credentials and full message bodies from audit payloads.';

COMMIT;