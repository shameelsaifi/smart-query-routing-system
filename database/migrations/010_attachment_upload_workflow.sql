BEGIN;

SET LOCAL lock_timeout = '10s';

CREATE TEMP TABLE sq_attachment_migration_baseline
ON COMMIT DROP
AS
SELECT
    (SELECT count(*) FROM public.tickets) AS ticket_count,
    (SELECT count(*) FROM public.query_attachments) AS attachment_count;

ALTER TABLE public.query_attachments
    ADD COLUMN IF NOT EXISTS upload_state varchar(12)
        NOT NULL DEFAULT 'READY',
    ADD COLUMN IF NOT EXISTS content_sha256 varchar(64),
    ADD COLUMN IF NOT EXISTS removed_at timestamptz;

-- Existing files would need their actual content hashes.
-- Never invent a hash or remove existing attachment records.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.query_attachments
        WHERE content_sha256 IS NULL
    ) THEN
        RAISE EXCEPTION
            'Existing attachments need a content hash backfill. Migration rolled back.';
    END IF;
END;
$$;

ALTER TABLE public.query_attachments
    ALTER COLUMN content_sha256 SET NOT NULL;

ALTER TABLE public.query_attachments
    DROP CONSTRAINT IF EXISTS attachments_upload_state_check,
    DROP CONSTRAINT IF EXISTS attachments_content_sha256_check,
    DROP CONSTRAINT IF EXISTS attachments_removed_at_check;

ALTER TABLE public.query_attachments
    ADD CONSTRAINT attachments_upload_state_check
        CHECK (
            upload_state IN (
                'PENDING',
                'READY',
                'REMOVING',
                'REMOVED'
            )
        ),
    ADD CONSTRAINT attachments_content_sha256_check
        CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT attachments_removed_at_check
        CHECK (
            (upload_state = 'REMOVED' AND removed_at IS NOT NULL)
            OR
            (upload_state <> 'REMOVED' AND removed_at IS NULL)
        );

CREATE INDEX IF NOT EXISTS idx_attachments_incomplete_ticket
    ON public.query_attachments (ticket_id)
    WHERE upload_state IN ('PENDING', 'REMOVING');

CREATE OR REPLACE FUNCTION public.sq_guard_ticket_attachment_submission()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF OLD.status = 'DRAFT'
       AND NEW.status <> 'DRAFT'
       AND EXISTS (
           SELECT 1
           FROM public.query_attachments a
           WHERE a.ticket_id = OLD.ticket_id
             AND a.upload_state IN ('PENDING', 'REMOVING')
       )
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            CONSTRAINT = 'sq_ticket_attachments_complete',
            MESSAGE =
                'Finish or remove pending attachments before submitting this draft.';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL
ON FUNCTION public.sq_guard_ticket_attachment_submission()
FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_ticket_attachment_submission_guard
ON public.tickets;

CREATE TRIGGER trg_ticket_attachment_submission_guard
BEFORE UPDATE OF status
ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.sq_guard_ticket_attachment_submission();

DO $$
BEGIN
    IF (SELECT count(*) FROM public.tickets)
       <> (
           SELECT ticket_count
           FROM sq_attachment_migration_baseline
       )
    THEN
        RAISE EXCEPTION 'Ticket count changed. Migration rolled back.';
    END IF;

    IF (SELECT count(*) FROM public.query_attachments)
       <> (
           SELECT attachment_count
           FROM sq_attachment_migration_baseline
       )
    THEN
        RAISE EXCEPTION 'Attachment count changed. Migration rolled back.';
    END IF;
END;
$$;

COMMIT;