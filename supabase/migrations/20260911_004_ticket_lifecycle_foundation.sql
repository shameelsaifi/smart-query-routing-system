-- =========================================================
-- Migration 004: Ticket lifecycle foundation
-- Extends the existing prototype for the final deliverable.
-- =========================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';


-- ---------------------------------------------------------
-- 1. Add workflow timestamps.
-- Nullable fields allow the existing backend to keep working.
-- ---------------------------------------------------------

ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;


-- ---------------------------------------------------------
-- 2. Preserve known submission times for prototype tickets.
-- The prototype created tickets directly upon submission.
-- ---------------------------------------------------------

UPDATE public.tickets
SET submitted_at = created_at
WHERE submitted_at IS NULL
  AND status <> 'DRAFT';


-- ---------------------------------------------------------
-- 3. Extend status and priority constraints.
-- Existing values remain valid.
-- ---------------------------------------------------------

ALTER TABLE public.tickets
    DROP CONSTRAINT IF EXISTS tickets_status_check,
    DROP CONSTRAINT IF EXISTS tickets_priority_check,
    DROP CONSTRAINT IF EXISTS tickets_sla_due_at_check;

ALTER TABLE public.tickets
    ADD CONSTRAINT tickets_status_check
        CHECK (
            status IN (
                'DRAFT',
                'PENDING',
                'CLASSIFIED',
                'ROUTED',
                'IN_PROGRESS',
                'NEEDS_INFORMATION',
                'ESCALATED',
                'RESOLVED',
                'CLOSED'
            )
        ),

    ADD CONSTRAINT tickets_priority_check
        CHECK (
            priority IS NULL
            OR priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'URGENT'
            )
        ),

    ADD CONSTRAINT tickets_sla_due_at_check
        CHECK (
            sla_due_at IS NULL
            OR (
                submitted_at IS NOT NULL
                AND sla_due_at > submitted_at
            )
        );


-- ---------------------------------------------------------
-- 4. Index deadlines for the later overdue-ticket checks.
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tickets_open_sla_due_at
    ON public.tickets (sla_due_at)
    WHERE sla_due_at IS NOT NULL
      AND status NOT IN (
          'DRAFT',
          'RESOLVED',
          'CLOSED'
      );


-- ---------------------------------------------------------
-- 5. Document the meaning of the new timestamps.
-- ---------------------------------------------------------

COMMENT ON COLUMN public.tickets.submitted_at IS
    'When a query was submitted to the application. NULL for an unsubmitted draft.';

COMMENT ON COLUMN public.tickets.sla_due_at IS
    'Deadline calculated by the backend using the configured SLA policy.';

COMMENT ON COLUMN public.tickets.resolved_at IS
    'Recorded when an approved final response has been successfully delivered. Historical values are not inferred.';

COMMENT ON COLUMN public.tickets.closed_at IS
    'Recorded when the query is closed by the authorized workflow. Historical values are not inferred.';


COMMIT;