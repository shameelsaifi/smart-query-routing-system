-- Migration 005: Categories, routing rules and assignment history
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Check that the existing Accounts desks are available.
DO $migration$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM public.accounts_desks
        WHERE desk_code IN ('FEE_BILLING', 'SCHOLARSHIP', 'REFUNDS')
    ) <> 3 THEN
        RAISE EXCEPTION
            'Expected FEE_BILLING, SCHOLARSHIP and REFUNDS desks. Migration cancelled.';
    END IF;
END;
$migration$;

-- 1. Controlled query categories.
CREATE TABLE IF NOT EXISTS public.query_categories (
    category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code VARCHAR(40) UNIQUE NOT NULL,
    category_name VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    default_priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT query_categories_code_check
        CHECK (category_code ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT query_categories_name_check
        CHECK (btrim(category_name) <> ''),
    CONSTRAINT query_categories_priority_check
        CHECK (default_priority IN ('LOW', 'MEDIUM', 'HIGH'))
);

-- Needed for foreign keys that keep a desk in its own department.
CREATE UNIQUE INDEX IF NOT EXISTS uq_accounts_desks_id_department
    ON public.accounts_desks (desk_id, department_id);

-- 2. Configurable routing destinations.
CREATE TABLE IF NOT EXISTS public.routing_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code VARCHAR(60) UNIQUE NOT NULL,
    category_id UUID NOT NULL
        REFERENCES public.query_categories(category_id) ON DELETE RESTRICT,
    department_id UUID NOT NULL
        REFERENCES public.departments(department_id) ON DELETE RESTRICT,
    desk_id UUID,
    target_role VARCHAR(30) NOT NULL DEFAULT 'DEPARTMENT_STAFF',
    rule_expression JSONB NOT NULL DEFAULT '{}'::jsonb,
    priority_order INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT routing_rules_code_check
        CHECK (rule_code ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT routing_rules_target_role_check
        CHECK (
            target_role IN ('INSTRUCTOR', 'DEPARTMENT_STAFF', 'HOD', 'ADMIN')
        ),
    CONSTRAINT routing_rules_expression_check
        CHECK (jsonb_typeof(rule_expression) = 'object'),
    CONSTRAINT routing_rules_priority_check
        CHECK (priority_order > 0),
    CONSTRAINT routing_rules_desk_department_fk
        FOREIGN KEY (desk_id, department_id)
        REFERENCES public.accounts_desks(desk_id, department_id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_routing_rules_active_category
    ON public.routing_rules (category_id, priority_order, rule_id)
    WHERE is_active = TRUE;

-- 3. Assignment history, linked to the existing tickets table.
CREATE TABLE IF NOT EXISTS public.query_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL
        REFERENCES public.tickets(ticket_id) ON DELETE RESTRICT,
    department_id UUID NOT NULL
        REFERENCES public.departments(department_id) ON DELETE RESTRICT,
    desk_id UUID,
    assigned_user_id UUID
        REFERENCES public.users(user_id) ON DELETE RESTRICT,
    assigned_by_user_id UUID
        REFERENCES public.users(user_id) ON DELETE RESTRICT,
    rule_id UUID
        REFERENCES public.routing_rules(rule_id) ON DELETE RESTRICT,
    assignment_method VARCHAR(30) NOT NULL,
    assignment_reason TEXT,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT query_assignments_method_check
        CHECK (
            assignment_method IN (
                'AI_ASSISTED', 'RULE_BASED', 'MANUAL', 'ESCALATION'
            )
        ),
    CONSTRAINT query_assignments_manual_actor_check
        CHECK (
            assignment_method <> 'MANUAL'
            OR assigned_by_user_id IS NOT NULL
        ),
    CONSTRAINT query_assignments_desk_department_fk
        FOREIGN KEY (desk_id, department_id)
        REFERENCES public.accounts_desks(desk_id, department_id)
        ON DELETE RESTRICT
);

-- At most one current assignment per ticket.
CREATE UNIQUE INDEX IF NOT EXISTS uq_query_assignments_current_ticket
    ON public.query_assignments (ticket_id)
    WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_query_assignments_ticket_history
    ON public.query_assignments (ticket_id, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_query_assignments_current_department
    ON public.query_assignments (department_id)
    WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_query_assignments_current_user
    ON public.query_assignments (assigned_user_id)
    WHERE is_current = TRUE AND assigned_user_id IS NOT NULL;

-- The backend will populate category_id during the integration step.
ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS category_id UUID
        REFERENCES public.query_categories(category_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_tickets_category_id
    ON public.tickets (category_id);

-- 4. Initial categories. Existing category names are retained.
INSERT INTO public.query_categories (
    category_code, category_name, description
)
VALUES
    ('FEE_BILLING', 'Fee Verification & Billing',
     'Fee challans, payment verification, billing and dues.'),
    ('SCHOLARSHIP', 'Scholarship',
     'Scholarships and financial assistance.'),
    ('REFUNDS', 'Refunds',
     'Refund requests, excess payments and reimbursements.'),
    ('EXAM_RESULT', 'Examination/Result',
     'Examination results, rechecking and result corrections.'),
    ('COURSE_ACADEMIC', 'Course/Academic',
     'Course content, assignments, lectures and academic guidance.'),
    ('ATTENDANCE', 'Attendance',
     'Attendance records and corrections.'),
    ('DEGREE_RECORDS', 'Degree/Records',
     'Degrees, transcripts and academic records.'),
    ('ENROLLMENT', 'Enrollment',
     'Enrollment confirmation, registration and deadlines.'),
    ('IT_TECHNICAL', 'IT/Technical',
     'Portal access, university email and technical issues.'),
    ('GENERAL', 'General',
     'Queries requiring general guidance or manual review.')
ON CONFLICT (category_code) DO NOTHING;

-- 5. Preserve the three existing Accounts routing destinations.
-- Other departments will receive rules when their setup is completed.
INSERT INTO public.routing_rules (
    rule_code,
    category_id,
    department_id,
    desk_id,
    target_role,
    is_active
)
SELECT
    'DEFAULT_' || c.category_code,
    c.category_id,
    d.department_id,
    d.desk_id,
    'DEPARTMENT_STAFF',
    c.is_active AND d.is_active AND dep.is_active
FROM public.query_categories c
JOIN public.accounts_desks d
    ON d.desk_code = c.category_code
JOIN public.departments dep
    ON dep.department_id = d.department_id
WHERE c.category_code IN ('FEE_BILLING', 'SCHOLARSHIP', 'REFUNDS')
ON CONFLICT (rule_code) DO NOTHING;

-- 6. Keep database access behind the FastAPI backend.
ALTER TABLE public.query_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.query_categories,
    public.routing_rules,
    public.query_assignments
FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.routing_rules.rule_expression IS
    'Structured JSON conditions validated by the backend; never executable SQL or Python.';

COMMENT ON COLUMN public.query_assignments.assigned_at IS
    'Time of the recorded assignment event. Original prototype assignment times are not inferred.';

COMMIT;