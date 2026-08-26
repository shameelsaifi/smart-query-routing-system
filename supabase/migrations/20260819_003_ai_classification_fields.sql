ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS ai_intent TEXT;

ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS ai_summary TEXT;

ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS ai_draft_reply TEXT;

ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN
NOT NULL DEFAULT FALSE;

ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS processing_method TEXT;