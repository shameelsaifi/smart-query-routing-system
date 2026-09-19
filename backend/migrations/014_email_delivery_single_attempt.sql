BEGIN;

ALTER TABLE public.email_delivery_jobs
ALTER COLUMN max_attempts
SET DEFAULT 1;

UPDATE public.email_delivery_jobs
SET
    max_attempts = 1,
    updated_at = clock_timestamp()
WHERE job_status <> 'COMPLETED'
  AND max_attempts <> 1;

COMMIT;