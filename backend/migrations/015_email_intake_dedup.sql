BEGIN;

ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS inbound_message_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_tickets_email_inbound_message_id
ON public.tickets (inbound_message_id)
WHERE source = 'EMAIL'
  AND inbound_message_id IS NOT NULL;

COMMIT;