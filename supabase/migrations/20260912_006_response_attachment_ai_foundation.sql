-- Migration 006: AI logs, attachments and reviewed responses
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- 1. AI processing attempts and their outcomes.
CREATE TABLE IF NOT EXISTS public.ai_processing_logs (
    ai_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL
        REFERENCES public.tickets(ticket_id) ON DELETE RESTRICT,
    operation_type VARCHAR(30) NOT NULL,
    processing_method VARCHAR(30) NOT NULL DEFAULT 'GEMINI_AI',
    model_name VARCHAR(100),
    detected_intent VARCHAR(150),
    confidence_score NUMERIC(5, 4),
    output_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    processing_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    attempt_number INTEGER NOT NULL DEFAULT 1,
    response_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ai_logs_operation_check CHECK (
        operation_type IN ('CLASSIFICATION', 'RECLASSIFICATION', 'DRAFT_REPLY')
    ),
    CONSTRAINT ai_logs_method_check CHECK (
        processing_method IN ('GEMINI_AI', 'RULE_BASED_FALLBACK')
    ),
    CONSTRAINT ai_logs_status_check CHECK (
        processing_status IN (
            'PENDING', 'SUCCESS', 'FAILED',
            'INVALID_OUTPUT', 'MANUAL_REVIEW_REQUIRED'
        )
    ),
    CONSTRAINT ai_logs_confidence_check CHECK (
        confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1
    ),
    CONSTRAINT ai_logs_output_check CHECK (jsonb_typeof(output_data) = 'object'),
    CONSTRAINT ai_logs_attempt_check CHECK (attempt_number > 0),
    CONSTRAINT ai_logs_duration_check CHECK (
        response_time_ms IS NULL OR response_time_ms >= 0
    ),
    CONSTRAINT ai_logs_id_ticket_unique UNIQUE (ai_log_id, ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_ticket_created
    ON public.ai_processing_logs (ticket_id, created_at DESC);

-- 2. Attachment metadata. Actual files will use private storage.
CREATE TABLE IF NOT EXISTS public.query_attachments (
    attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL
        REFERENCES public.tickets(ticket_id) ON DELETE RESTRICT,
    uploaded_by_user_id UUID
        REFERENCES public.users(user_id) ON DELETE RESTRICT,
    storage_bucket VARCHAR(100) NOT NULL DEFAULT 'query-attachments',
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT attachments_name_check CHECK (btrim(file_name) <> ''),
    CONSTRAINT attachments_bucket_check CHECK (btrim(storage_bucket) <> ''),
    CONSTRAINT attachments_path_check CHECK (btrim(file_path) <> ''),
    CONSTRAINT attachments_type_check CHECK (
        mime_type IN ('application/pdf', 'image/png', 'image/jpeg')
    ),
    CONSTRAINT attachments_size_check CHECK (
        file_size BETWEEN 1 AND 5242880
    ),
    CONSTRAINT attachments_storage_unique UNIQUE (storage_bucket, file_path)
);

CREATE INDEX IF NOT EXISTS idx_attachments_ticket_uploaded
    ON public.query_attachments (ticket_id, uploaded_at DESC);

-- 3. Human-reviewed replies and separate delivery records.
CREATE TABLE IF NOT EXISTS public.responses (
    response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL
        REFERENCES public.tickets(ticket_id) ON DELETE RESTRICT,
    ai_log_id UUID,
    response_type VARCHAR(30) NOT NULL DEFAULT 'FINAL',
    responder_id UUID
        REFERENCES public.users(user_id) ON DELETE RESTRICT,
    ai_draft_text TEXT,
    final_response_text TEXT,
    approval_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
    approved_at TIMESTAMPTZ,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'NOT_QUEUED',
    recipient_email VARCHAR(255),
    gmail_account_email VARCHAR(255),
    gmail_message_id VARCHAR(255),
    gmail_thread_id VARCHAR(255),
    failure_reason TEXT,
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,

    CONSTRAINT responses_ai_log_ticket_fk
        FOREIGN KEY (ai_log_id, ticket_id)
        REFERENCES public.ai_processing_logs(ai_log_id, ticket_id)
        ON DELETE RESTRICT,
    CONSTRAINT responses_type_check CHECK (
        response_type IN ('FINAL', 'INFORMATION_REQUEST')
    ),
    CONSTRAINT responses_approval_status_check CHECK (
        approval_status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')
    ),
    CONSTRAINT responses_delivery_status_check CHECK (
        delivery_status IN ('NOT_QUEUED', 'QUEUED', 'SENT', 'FAILED')
    ),
    CONSTRAINT responses_body_check CHECK (
        (ai_draft_text IS NOT NULL OR final_response_text IS NOT NULL)
        AND (ai_draft_text IS NULL OR ai_draft_text ~ '[^[:space:]]')
        AND (final_response_text IS NULL OR final_response_text ~ '[^[:space:]]')
    ),
    CONSTRAINT responses_approval_details_check CHECK (
        (
            approval_status = 'APPROVED'
            AND responder_id IS NOT NULL
            AND final_response_text IS NOT NULL
            AND final_response_text ~ '[^[:space:]]'
            AND approved_at IS NOT NULL
        )
        OR (
            approval_status <> 'APPROVED'
            AND approved_at IS NULL
        )
    ),
    CONSTRAINT responses_delivery_approval_check CHECK (
        delivery_status = 'NOT_QUEUED' OR approval_status = 'APPROVED'
    ),
    CONSTRAINT responses_delivery_addresses_check CHECK (
        delivery_status = 'NOT_QUEUED'
        OR (recipient_email IS NOT NULL AND gmail_account_email IS NOT NULL)
    ),
    CONSTRAINT responses_recipient_check CHECK (
        recipient_email IS NULL
        OR (recipient_email = lower(btrim(recipient_email)) AND recipient_email <> '')
    ),
    CONSTRAINT responses_gmail_account_check CHECK (
        gmail_account_email IS NULL
        OR (gmail_account_email = lower(btrim(gmail_account_email)) AND gmail_account_email <> '')
    ),
    CONSTRAINT responses_delivery_proof_check CHECK (
        (
            delivery_status = 'SENT'
            AND gmail_message_id IS NOT NULL
            AND btrim(gmail_message_id) <> ''
            AND sent_at IS NOT NULL
        )
        OR (
            delivery_status <> 'SENT'
            AND gmail_message_id IS NULL
            AND gmail_thread_id IS NULL
            AND sent_at IS NULL
        )
    ),
    CONSTRAINT responses_failure_reason_check CHECK (
        (
            delivery_status = 'FAILED'
            AND failure_reason IS NOT NULL
            AND failure_reason ~ '[^[:space:]]'
        )
        OR (delivery_status <> 'FAILED' AND failure_reason IS NULL)
    ),
    CONSTRAINT responses_dates_check CHECK (
        (approved_at IS NULL OR approved_at >= created_at)
        AND (sent_at IS NULL OR sent_at >= approved_at)
    ),
    CONSTRAINT responses_revision_check CHECK (revision > 0),
    CONSTRAINT responses_gmail_message_unique
        UNIQUE (gmail_account_email, gmail_message_id)
);

CREATE INDEX IF NOT EXISTS idx_responses_ticket_created
    ON public.responses (ticket_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_responses_delivery_queue
    ON public.responses (created_at, response_id)
    WHERE delivery_status = 'QUEUED';

CREATE UNIQUE INDEX IF NOT EXISTS uq_responses_queued_final
    ON public.responses (ticket_id)
    WHERE response_type = 'FINAL' AND delivery_status = 'QUEUED';

-- 4. Preserve original drafts and bind approval to the reviewed text.
CREATE OR REPLACE FUNCTION public.guard_response_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
    IF NEW.response_id IS DISTINCT FROM OLD.response_id
       OR NEW.ticket_id IS DISTINCT FROM OLD.ticket_id
       OR NEW.ai_log_id IS DISTINCT FROM OLD.ai_log_id
       OR NEW.response_type IS DISTINCT FROM OLD.response_type
       OR NEW.ai_draft_text IS DISTINCT FROM OLD.ai_draft_text
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Original response details cannot be changed; create a new response.'
            USING ERRCODE = '23514';
    END IF;

    IF OLD.delivery_status = 'SENT' THEN
        RAISE EXCEPTION 'A delivered response cannot be edited.'
            USING ERRCODE = '23514';
    END IF;

    IF OLD.delivery_status = 'QUEUED' AND (
        NEW.delivery_status NOT IN ('QUEUED', 'SENT', 'FAILED')
        OR NEW.final_response_text IS DISTINCT FROM OLD.final_response_text
        OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
        OR NEW.responder_id IS DISTINCT FROM OLD.responder_id
        OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
        OR NEW.recipient_email IS DISTINCT FROM OLD.recipient_email
        OR NEW.gmail_account_email IS DISTINCT FROM OLD.gmail_account_email
    ) THEN
        RAISE EXCEPTION 'A queued response cannot be rewritten or redirected.'
            USING ERRCODE = '23514';
    END IF;

    IF OLD.approval_status = 'APPROVED'
       AND NEW.approval_status = 'APPROVED'
       AND (
           NEW.final_response_text IS DISTINCT FROM OLD.final_response_text
           OR NEW.responder_id IS DISTINCT FROM OLD.responder_id
           OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       ) THEN
        RAISE EXCEPTION 'Return the response to review before changing approved content.'
            USING ERRCODE = '23514';
    END IF;

    NEW.revision := OLD.revision + 1;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_responses_guard_update ON public.responses;

CREATE TRIGGER trg_responses_guard_update
BEFORE UPDATE ON public.responses
FOR EACH ROW EXECUTE FUNCTION public.guard_response_update();

-- 5. Access remains controlled by FastAPI.
ALTER TABLE public.ai_processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.ai_processing_logs,
    public.query_attachments,
    public.responses
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.guard_response_update()
FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.ai_processing_logs.confidence_score IS
    'Normalized AI confidence from 0 to 1. The existing tickets.confidence remains on its 0 to 100 scale.';

COMMENT ON COLUMN public.ai_processing_logs.model_name IS
    'Actual requested model name; may be NULL for fallback or failure before model selection.';

COMMENT ON COLUMN public.query_attachments.file_path IS
    'Private storage object key, not a public URL. Content validation occurs in the backend.';

COMMENT ON COLUMN public.responses.response_type IS
    'Only successful delivery of a FINAL response may resolve a ticket. INFORMATION_REQUEST requests more details.';

COMMIT;