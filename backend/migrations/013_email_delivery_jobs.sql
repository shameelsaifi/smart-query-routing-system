BEGIN;


CREATE TABLE IF NOT EXISTS public.email_delivery_jobs (
    delivery_job_id uuid
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    response_id uuid
        NOT NULL,

    ticket_id uuid
        NOT NULL,

    job_status varchar(20)
        NOT NULL
        DEFAULT 'QUEUED',

    attempt_count integer
        NOT NULL
        DEFAULT 0,

    max_attempts integer
        NOT NULL
        DEFAULT 3,

    available_at timestamptz
        NOT NULL
        DEFAULT now(),

    lease_token uuid
        NULL,

    leased_at timestamptz
        NULL,

    lease_expires_at timestamptz
        NULL,

    last_error text
        NULL,

    created_at timestamptz
        NOT NULL
        DEFAULT now(),

    updated_at timestamptz
        NOT NULL
        DEFAULT now(),

    CONSTRAINT email_delivery_jobs_response_unique
        UNIQUE (response_id),

    CONSTRAINT email_delivery_jobs_response_ticket_fk
        FOREIGN KEY (
            response_id,
            ticket_id
        )
        REFERENCES public.responses (
            response_id,
            ticket_id
        )
        ON DELETE RESTRICT,

    CONSTRAINT email_delivery_jobs_status_check
        CHECK (
            job_status IN (
                'QUEUED',
                'LEASED',
                'COMPLETED',
                'FAILED'
            )
        ),

    CONSTRAINT email_delivery_jobs_attempt_count_check
        CHECK (
            attempt_count >= 0
        ),

    CONSTRAINT email_delivery_jobs_max_attempts_check
        CHECK (
            max_attempts >= 1
            AND max_attempts <= 20
        ),

    CONSTRAINT email_delivery_jobs_lease_check
        CHECK (
            (
                job_status = 'LEASED'
                AND lease_token IS NOT NULL
                AND leased_at IS NOT NULL
                AND lease_expires_at IS NOT NULL
                AND lease_expires_at > leased_at
            )
            OR
            (
                job_status <> 'LEASED'
                AND lease_token IS NULL
                AND leased_at IS NULL
                AND lease_expires_at IS NULL
            )
        )
);


CREATE INDEX IF NOT EXISTS
    idx_email_delivery_jobs_ready
ON public.email_delivery_jobs (
    available_at,
    created_at,
    delivery_job_id
)
WHERE job_status = 'QUEUED';


CREATE INDEX IF NOT EXISTS
    idx_email_delivery_jobs_expired_lease
ON public.email_delivery_jobs (
    lease_expires_at
)
WHERE job_status = 'LEASED';


CREATE INDEX IF NOT EXISTS
    idx_email_delivery_jobs_ticket
ON public.email_delivery_jobs (
    ticket_id,
    created_at DESC
);


ALTER TABLE public.email_delivery_jobs
ENABLE ROW LEVEL SECURITY;


REVOKE ALL
ON TABLE public.email_delivery_jobs
FROM anon;


REVOKE ALL
ON TABLE public.email_delivery_jobs
FROM authenticated;


GRANT ALL
ON TABLE public.email_delivery_jobs
TO service_role;


COMMIT;