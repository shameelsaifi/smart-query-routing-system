BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

LOCK TABLE public.tickets IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE public.ticket_processing_jobs (
    job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    ticket_id uuid NOT NULL
        REFERENCES public.tickets(ticket_id)
        ON DELETE RESTRICT,

    job_status varchar(20) NOT NULL DEFAULT 'QUEUED',

    attempt_count integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 3,

    available_at timestamptz NOT NULL DEFAULT now(),

    lease_token uuid,
    lease_expires_at timestamptz,
    last_started_at timestamptz,
    finished_at timestamptz,

    last_error_code varchar(100),
    last_error_message text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT processing_jobs_ticket_unique
        UNIQUE (ticket_id),

    CONSTRAINT processing_jobs_status_check
        CHECK (
            job_status IN (
                'QUEUED',
                'RUNNING',
                'RETRY',
                'COMPLETED',
                'FAILED',
                'SKIPPED'
            )
        ),

    CONSTRAINT processing_jobs_attempts_check
        CHECK (
            max_attempts BETWEEN 1 AND 10
            AND attempt_count BETWEEN 0 AND max_attempts
        ),

    CONSTRAINT processing_jobs_attempt_state_check
        CHECK (
            (job_status <> 'QUEUED' OR attempt_count = 0)
            AND (
                job_status NOT IN ('RUNNING', 'RETRY', 'COMPLETED')
                OR attempt_count > 0
            )
            AND (
                job_status <> 'RETRY'
                OR attempt_count < max_attempts
            )
            AND (
                (attempt_count = 0 AND last_started_at IS NULL)
                OR
                (attempt_count > 0 AND last_started_at IS NOT NULL)
            )
        ),

    CONSTRAINT processing_jobs_lease_check
        CHECK (
            (
                job_status = 'RUNNING'
                AND lease_token IS NOT NULL
                AND lease_expires_at IS NOT NULL
                AND last_started_at IS NOT NULL
                AND lease_expires_at > last_started_at
            )
            OR
            (
                job_status <> 'RUNNING'
                AND lease_token IS NULL
                AND lease_expires_at IS NULL
            )
        ),

    CONSTRAINT processing_jobs_finished_check
        CHECK (
            (
                job_status IN ('COMPLETED', 'FAILED', 'SKIPPED')
                AND finished_at IS NOT NULL
            )
            OR
            (
                job_status NOT IN ('COMPLETED', 'FAILED', 'SKIPPED')
                AND finished_at IS NULL
            )
        ),

    CONSTRAINT processing_jobs_dates_check
        CHECK (
            updated_at >= created_at
            AND (
                last_started_at IS NULL
                OR last_started_at >= created_at
            )
            AND (
                finished_at IS NULL
                OR finished_at >= COALESCE(last_started_at, created_at)
            )
        ),

    CONSTRAINT processing_jobs_error_check
        CHECK (
            (
                last_error_code IS NULL
                OR btrim(last_error_code) <> ''
            )
            AND (
                last_error_message IS NULL
                OR (
                    btrim(last_error_message) <> ''
                    AND char_length(last_error_message) <= 2000
                )
            )
        )
);

CREATE INDEX idx_processing_jobs_ready
    ON public.ticket_processing_jobs (
        available_at,
        created_at,
        job_id
    )
    WHERE job_status IN ('QUEUED', 'RETRY');

CREATE INDEX idx_processing_jobs_expired_lease
    ON public.ticket_processing_jobs (
        lease_expires_at,
        job_id
    )
    WHERE job_status = 'RUNNING';

ALTER TABLE public.ticket_processing_jobs
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
    ON TABLE public.ticket_processing_jobs
    FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE
    ON TABLE public.ticket_processing_jobs
    TO service_role;

COMMENT ON TABLE public.ticket_processing_jobs IS
    'Backend-only queue for initial ticket processing. '
    'Workers must verify the current ticket state and lease ownership '
    'before committing processing results.';

CREATE FUNCTION public.sq_sync_ticket_processing_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
    event_at timestamptz := clock_timestamp();
BEGIN
    IF NEW.status = 'PENDING' THEN
        INSERT INTO public.ticket_processing_jobs (
            ticket_id,
            available_at,
            created_at,
            updated_at
        )
        VALUES (
            NEW.ticket_id,
            event_at,
            event_at,
            event_at
        )
        ON CONFLICT (ticket_id) DO NOTHING;
    ELSE
        -- The existing pipeline or a human action may advance a ticket
        -- before a queue worker claims it.
        UPDATE public.ticket_processing_jobs
        SET
            job_status = 'SKIPPED',
            finished_at = event_at,
            updated_at = event_at
        WHERE ticket_id = NEW.ticket_id
          AND job_status IN ('QUEUED', 'RETRY');

        -- RUNNING jobs belong to their lease holder.
        -- That worker must recheck ticket status before saving results.
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL PRIVILEGES
    ON FUNCTION public.sq_sync_ticket_processing_job()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.sq_sync_ticket_processing_job()
    TO service_role;

CREATE TRIGGER trg_ticket_processing_queue
AFTER INSERT OR UPDATE OF status
ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.sq_sync_ticket_processing_job();

-- Queue existing pending tickets without changing their contents/status.
INSERT INTO public.ticket_processing_jobs (ticket_id)
SELECT ticket_id
FROM public.tickets
WHERE status = 'PENDING'
ON CONFLICT (ticket_id) DO NOTHING;

-- Functional checks run inside a subtransaction.
-- All probe tickets and their queue entries are rolled back.
DO $queue_checks$
DECLARE
    probe_student_id uuid;
    probe_draft_id uuid := gen_random_uuid();
    probe_direct_id uuid := gen_random_uuid();
    original_job_id uuid;
BEGIN
    SELECT student_id
    INTO probe_student_id
    FROM public.tickets
    ORDER BY created_at, ticket_id
    LIMIT 1;

    IF probe_student_id IS NULL THEN
        RAISE EXCEPTION
            'Queue checks require an existing ticket with a student.';
    END IF;

    BEGIN
        INSERT INTO public.tickets (
            ticket_id,
            ticket_number,
            student_id,
            subject,
            message,
            source,
            status
        )
        VALUES (
            probe_draft_id,
            'QTEST-' || left(
                replace(probe_draft_id::text, '-', ''), 14
            ),
            probe_student_id,
            'Queue migration check',
            'Temporary draft used for queue verification.',
            'WEB',
            'DRAFT'
        );

        IF EXISTS (
            SELECT 1
            FROM public.ticket_processing_jobs
            WHERE ticket_id = probe_draft_id
        ) THEN
            RAISE EXCEPTION 'Queue check failed: draft was queued.';
        END IF;

        UPDATE public.tickets
        SET
            status = 'PENDING',
            submitted_at = clock_timestamp()
        WHERE ticket_id = probe_draft_id;

        SELECT job_id
        INTO original_job_id
        FROM public.ticket_processing_jobs
        WHERE ticket_id = probe_draft_id
          AND job_status = 'QUEUED';

        IF original_job_id IS NULL THEN
            RAISE EXCEPTION
                'Queue check failed: submitted draft was not queued.';
        END IF;

        -- Repeating the status update must preserve the same job.
        UPDATE public.tickets
        SET status = 'PENDING'
        WHERE ticket_id = probe_draft_id;

        IF (
            SELECT count(*)
            FROM public.ticket_processing_jobs
            WHERE ticket_id = probe_draft_id
        ) <> 1 OR NOT EXISTS (
            SELECT 1
            FROM public.ticket_processing_jobs
            WHERE ticket_id = probe_draft_id
              AND job_id = original_job_id
              AND job_status = 'QUEUED'
              AND attempt_count = 0
        ) THEN
            RAISE EXCEPTION
                'Queue check failed: duplicate or replaced job.';
        END IF;

        -- Direct submission must also create a queue entry.
        INSERT INTO public.tickets (
            ticket_id,
            ticket_number,
            student_id,
            subject,
            message,
            source,
            status,
            submitted_at
        )
        VALUES (
            probe_direct_id,
            'QTEST-' || left(
                replace(probe_direct_id::text, '-', ''), 14
            ),
            probe_student_id,
            'Queue migration check',
            'Temporary direct submission used for queue verification.',
            'WEB',
            'PENDING',
            clock_timestamp()
        );

        IF NOT EXISTS (
            SELECT 1
            FROM public.ticket_processing_jobs
            WHERE ticket_id = probe_direct_id
              AND job_status = 'QUEUED'
        ) THEN
            RAISE EXCEPTION
                'Queue check failed: direct submission was not queued.';
        END IF;

        -- Simulate the existing pipeline advancing the ticket.
        UPDATE public.tickets
        SET status = 'CLASSIFIED'
        WHERE ticket_id = probe_draft_id;

        IF NOT EXISTS (
            SELECT 1
            FROM public.ticket_processing_jobs
            WHERE ticket_id = probe_draft_id
              AND job_status = 'SKIPPED'
              AND finished_at IS NOT NULL
        ) THEN
            RAISE EXCEPTION
                'Queue check failed: obsolete waiting job was not skipped.';
        END IF;

        -- Intentionally roll back only the probe records.
        RAISE EXCEPTION USING
            ERRCODE = 'ZQ001',
            MESSAGE = 'Rollback successful queue probes';

    EXCEPTION
        WHEN SQLSTATE 'ZQ001' THEN
            NULL;
    END;

    IF EXISTS (
        SELECT 1
        FROM public.tickets
        WHERE ticket_id IN (probe_draft_id, probe_direct_id)
    ) OR EXISTS (
        SELECT 1
        FROM public.ticket_processing_jobs
        WHERE ticket_id IN (probe_draft_id, probe_direct_id)
    ) THEN
        RAISE EXCEPTION
            'Queue check failed: probe records were not rolled back.';
    END IF;

    RAISE NOTICE 'Queue functional checks: OK';
END;
$queue_checks$;

COMMIT;