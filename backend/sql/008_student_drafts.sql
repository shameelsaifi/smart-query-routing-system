BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

LOCK TABLE public.tickets IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE sq_draft_migration_baseline
ON COMMIT DROP
AS
SELECT COUNT(*) AS ticket_count
FROM public.tickets;

ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS draft_revision INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS draft_request_id UUID,
    ADD COLUMN IF NOT EXISTS draft_request_hash TEXT;

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.tickets'::regclass
          AND conname = 'tickets_draft_revision_check'
    ) THEN
        ALTER TABLE public.tickets
            ADD CONSTRAINT tickets_draft_revision_check
            CHECK (draft_revision >= 1);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.tickets'::regclass
          AND conname = 'tickets_draft_request_check'
    ) THEN
        ALTER TABLE public.tickets
            ADD CONSTRAINT tickets_draft_request_check
            CHECK (
                (
                    draft_request_id IS NULL
                    AND draft_request_hash IS NULL
                )
                OR
                (
                    draft_request_id IS NOT NULL
                    AND draft_request_hash IS NOT NULL
                    AND draft_request_hash ~ '^[0-9a-f]{64}$'
                    AND source = 'WEB'
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.tickets'::regclass
          AND conname = 'tickets_draft_state_check'
    ) THEN
        ALTER TABLE public.tickets
            ADD CONSTRAINT tickets_draft_state_check
            CHECK (
                status <> 'DRAFT'
                OR (
                    source = 'WEB'
                    AND student_id IS NOT NULL
                    AND submitted_at IS NULL
                    AND sla_due_at IS NULL
                    AND resolved_at IS NULL
                    AND closed_at IS NULL
                    AND routed_desk_id IS NULL
                    AND assigned_officer_id IS NULL
                )
            );
    END IF;
END;
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tickets_student_draft_request
    ON public.tickets (student_id, draft_request_id)
    WHERE draft_request_id IS NOT NULL;

DO $verification$
BEGIN
    IF (
        SELECT COUNT(*) FROM public.tickets
    ) <> (
        SELECT ticket_count FROM sq_draft_migration_baseline
    ) THEN
        RAISE EXCEPTION 'Ticket count changed during the migration.';
    END IF;
END;
$verification$;

COMMIT;

SELECT jsonb_build_object(
    'ticket_count',
    (SELECT COUNT(*) FROM public.tickets),

    'new_columns',
    (
        SELECT jsonb_object_agg(column_name, data_type)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tickets'
          AND column_name IN (
              'draft_revision',
              'draft_request_id',
              'draft_request_hash'
          )
    ),

    'checks_validated',
    (
        SELECT COUNT(*) = 3
            AND COALESCE(bool_and(convalidated), FALSE)
        FROM pg_constraint
        WHERE conrelid = 'public.tickets'::regclass
          AND conname IN (
              'tickets_draft_revision_check',
              'tickets_draft_request_check',
              'tickets_draft_state_check'
          )
    ),

    'idempotency_index_valid',
    EXISTS (
        SELECT 1
        FROM pg_index
        WHERE indexrelid = to_regclass(
            'public.uq_tickets_student_draft_request'
        )
          AND indisunique
          AND indisvalid
    )
) AS verification;