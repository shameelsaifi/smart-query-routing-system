BEGIN;


-- ============================================================
-- 020 - Instructor Leave Auto Reply
--
-- Adds a dedicated response type for predefined instructor
-- leave acknowledgements.
--
-- Important:
--   AUTO_REPLY is NOT a FINAL response.
--   It must never be used as proof that a ticket is resolved.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Extend allowed response types
-- ------------------------------------------------------------

ALTER TABLE public.responses
DROP CONSTRAINT IF EXISTS responses_type_check;


ALTER TABLE public.responses
ADD CONSTRAINT responses_type_check
CHECK (
    response_type IN (
        'FINAL',
        'INFORMATION_REQUEST',
        'AUTO_REPLY'
    )
);


-- ------------------------------------------------------------
-- 2. Duplicate protection
--
-- At most one leave auto-reply may be created for one ticket.
-- This protects against:
--   - worker retries
--   - application restarts
--   - repeated processing attempts
-- ------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS
uq_responses_ticket_auto_reply
ON public.responses (ticket_id)
WHERE response_type = 'AUTO_REPLY';


COMMIT;