BEGIN;


-- ============================================================
-- 019 - ADMIN ANNOUNCEMENTS
--
-- Admin can publish announcements to:
--
-- ALL
-- STUDENTS
-- STAFF
-- HODS
--
-- Actual recipient notifications are created by the backend
-- service. This table stores the broadcast itself.
-- ============================================================


CREATE TABLE IF NOT EXISTS public.announcements (

    announcement_id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    title VARCHAR(200)
        NOT NULL,

    message TEXT
        NOT NULL,

    audience VARCHAR(30)
        NOT NULL,

    created_by_user_id UUID
        NOT NULL,

    recipient_count INTEGER
        NOT NULL
        DEFAULT 0,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT clock_timestamp(),


    CONSTRAINT announcements_creator_fk
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES public.users (
            user_id
        )
        ON DELETE RESTRICT,


    CONSTRAINT announcements_title_check
        CHECK (
            title ~ '[^[:space:]]'
        ),


    CONSTRAINT announcements_message_check
        CHECK (
            message ~ '[^[:space:]]'
        ),


    CONSTRAINT announcements_audience_check
        CHECK (
            audience IN (
                'ALL',
                'STUDENTS',
                'STAFF',
                'HODS'
            )
        ),


    CONSTRAINT announcements_recipient_count_check
        CHECK (
            recipient_count >= 0
        )
);


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
    idx_announcements_created_at
ON public.announcements (
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    idx_announcements_active_created
ON public.announcements (
    is_active,
    created_at DESC
);


-- ============================================================
-- ROW LEVEL SECURITY
--
-- No direct browser/client policy is created.
-- Announcements are accessed through the authenticated backend.
-- ============================================================

ALTER TABLE public.announcements
ENABLE ROW LEVEL SECURITY;


COMMIT;