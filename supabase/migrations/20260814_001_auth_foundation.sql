-- =========================================================
-- Smart Query Routing & Email Automation System
-- Prototype Authentication / RBAC Foundation
-- =========================================================


-- ---------------------------------------------------------
-- 1. University departments
-- Based on the SDD departments entity.
-- ---------------------------------------------------------
CREATE TABLE public.departments (
    department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_name VARCHAR(150) UNIQUE NOT NULL,
    department_email VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------
-- 2. Accounts sub-desks
-- Prototype-specific extension for Accounts Department.
-- ---------------------------------------------------------
CREATE TABLE public.accounts_desks (
    desk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    department_id UUID NOT NULL
        REFERENCES public.departments(department_id)
        ON DELETE RESTRICT,

    desk_code VARCHAR(40) UNIQUE NOT NULL,

    desk_name VARCHAR(150) UNIQUE NOT NULL,

    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT accounts_desks_code_check
        CHECK (
            desk_code IN (
                'FEE_BILLING',
                'SCHOLARSHIP',
                'REFUNDS'
            )
        )
);


-- ---------------------------------------------------------
-- 3. Approved / allowlisted users
-- Exists BEFORE the user's first Google login.
-- ---------------------------------------------------------
CREATE TABLE public.approved_users (
    approved_user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email VARCHAR(255) UNIQUE NOT NULL,

    full_name VARCHAR(150),

    role VARCHAR(30) NOT NULL,

    department_id UUID
        REFERENCES public.departments(department_id)
        ON DELETE RESTRICT,

    desk_id UUID
        REFERENCES public.accounts_desks(desk_id)
        ON DELETE RESTRICT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT approved_users_email_lowercase_check
        CHECK (email = LOWER(email)),

    CONSTRAINT approved_users_role_check
        CHECK (
            role IN (
                'STUDENT',
                'INSTRUCTOR',
                'DEPARTMENT_STAFF',
                'HOD',
                'ADMIN'
            )
        ),

    CONSTRAINT approved_students_no_desk_check
        CHECK (
            role <> 'STUDENT'
            OR desk_id IS NULL
        )
);


-- ---------------------------------------------------------
-- 4. Application users
-- Created/linked after successful Google authentication.
-- user_id matches Supabase auth.users.id.
-- ---------------------------------------------------------
CREATE TABLE public.users (
    user_id UUID PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    approved_user_id UUID UNIQUE
        REFERENCES public.approved_users(approved_user_id)
        ON DELETE SET NULL,

    department_id UUID
        REFERENCES public.departments(department_id)
        ON DELETE RESTRICT,

    desk_id UUID
        REFERENCES public.accounts_desks(desk_id)
        ON DELETE RESTRICT,

    full_name VARCHAR(150) NOT NULL,

    email VARCHAR(255) UNIQUE NOT NULL,

    role VARCHAR(30) NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    is_available BOOLEAN NOT NULL DEFAULT TRUE,

    auto_reply_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_lowercase_check
        CHECK (email = LOWER(email)),

    CONSTRAINT users_role_check
        CHECK (
            role IN (
                'STUDENT',
                'INSTRUCTOR',
                'DEPARTMENT_STAFF',
                'HOD',
                'ADMIN'
            )
        ),

    CONSTRAINT users_students_no_desk_check
        CHECK (
            role <> 'STUDENT'
            OR desk_id IS NULL
        )
);


-- ---------------------------------------------------------
-- 5. Helpful indexes for authentication / RBAC lookups
-- ---------------------------------------------------------
CREATE INDEX idx_approved_users_role
    ON public.approved_users(role);

CREATE INDEX idx_approved_users_desk_id
    ON public.approved_users(desk_id);

CREATE INDEX idx_users_role
    ON public.users(role);

CREATE INDEX idx_users_department_id
    ON public.users(department_id);

CREATE INDEX idx_users_desk_id
    ON public.users(desk_id);


-- ---------------------------------------------------------
-- 6. Row Level Security
-- FastAPI remains the controlled database-access layer.
-- ---------------------------------------------------------
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_desks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approved_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;