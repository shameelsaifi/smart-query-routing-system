-- =========================================================
-- Smart Query Routing & Email Automation System
-- Prototype Ticket Foundation
-- =========================================================


-- ---------------------------------------------------------
-- 1. Sequence for human-readable ticket numbers
-- Example: ACT-1001, ACT-1002, ...
-- ---------------------------------------------------------
CREATE SEQUENCE public.ticket_number_seq
    START WITH 1001
    INCREMENT BY 1;


-- ---------------------------------------------------------
-- 2. Tickets
-- Stores web/email queries and later classification,
-- routing and assignment results.
-- ---------------------------------------------------------
CREATE TABLE public.tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ticket_number VARCHAR(20)
        UNIQUE
        NOT NULL
        DEFAULT (
            'ACT-' ||
            LPAD(
                nextval('public.ticket_number_seq')::TEXT,
                4,
                '0'
            )
        ),

    student_id UUID NOT NULL
        REFERENCES public.users(user_id)
        ON DELETE RESTRICT,

    subject VARCHAR(200) NOT NULL,

    message TEXT NOT NULL,

    source VARCHAR(20) NOT NULL DEFAULT 'WEB',

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    category VARCHAR(150),

    priority VARCHAR(20),

    confidence NUMERIC(5, 2),

    routed_desk_id UUID
        REFERENCES public.accounts_desks(desk_id)
        ON DELETE RESTRICT,

    assigned_officer_id UUID
        REFERENCES public.users(user_id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT tickets_source_check
        CHECK (
            source IN (
                'WEB',
                'EMAIL'
            )
        ),

    CONSTRAINT tickets_status_check
        CHECK (
            status IN (
                'PENDING',
                'CLASSIFIED',
                'ROUTED',
                'IN_PROGRESS',
                'RESOLVED',
                'CLOSED'
            )
        ),

    CONSTRAINT tickets_priority_check
        CHECK (
            priority IS NULL
            OR priority IN (
                'LOW',
                'MEDIUM',
                'HIGH'
            )
        ),

    CONSTRAINT tickets_confidence_check
        CHECK (
            confidence IS NULL
            OR (
                confidence >= 0
                AND confidence <= 100
            )
        )
);


-- ---------------------------------------------------------
-- 3. Helpful indexes
-- ---------------------------------------------------------
CREATE INDEX idx_tickets_student_id
    ON public.tickets(student_id);

CREATE INDEX idx_tickets_status
    ON public.tickets(status);

CREATE INDEX idx_tickets_routed_desk_id
    ON public.tickets(routed_desk_id);

CREATE INDEX idx_tickets_assigned_officer_id
    ON public.tickets(assigned_officer_id);

CREATE INDEX idx_tickets_created_at
    ON public.tickets(created_at DESC);


-- ---------------------------------------------------------
-- 4. Row Level Security
-- FastAPI remains the controlled database-access layer.
-- ---------------------------------------------------------
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;