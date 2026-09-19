BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';


-- ============================================================
-- 1. ADD THE REMAINING SYSTEM DEPARTMENTS
-- ============================================================

INSERT INTO public.departments (
    department_name,
    department_email,
    description,
    is_active
)
VALUES
    (
        'Exam Department',
        'exam@vu.edu.pk',
        'Handles examination results, rechecking, grade correction and related examination queries.',
        TRUE
    ),
    (
        'Registrar Office',
        'registrar@vu.edu.pk',
        'Handles enrollment, degree verification, transcripts and academic records.',
        TRUE
    ),
    (
        'IT Department',
        'it@vu.edu.pk',
        'Handles portal access, university email, software and other technical issues.',
        TRUE
    ),
    (
        'Academic Department',
        'academic@vu.edu.pk',
        'Handles course, assignment, lecture and attendance queries routed to instructors.',
        TRUE
    ),
    (
        'Administration',
        'admin@vu.edu.pk',
        'Receives general or unmatched queries requiring administrative review.',
        TRUE
    )
ON CONFLICT (department_name)
DO UPDATE SET
    description = EXCLUDED.description,
    is_active = TRUE;


-- ============================================================
-- 2. ENSURE ALL TEN CATEGORIES HAVE ROUTING RULES
-- ============================================================

WITH desired_rules (
    rule_code,
    category_code,
    department_name,
    desk_code,
    target_role,
    priority_order
) AS (
    VALUES
        (
            'DEFAULT_FEE_BILLING',
            'FEE_BILLING',
            'Accounts Department',
            'FEE_BILLING',
            'DEPARTMENT_STAFF',
            1
        ),
        (
            'DEFAULT_SCHOLARSHIP',
            'SCHOLARSHIP',
            'Accounts Department',
            'SCHOLARSHIP',
            'DEPARTMENT_STAFF',
            1
        ),
        (
            'DEFAULT_REFUNDS',
            'REFUNDS',
            'Accounts Department',
            'REFUNDS',
            'DEPARTMENT_STAFF',
            1
        ),
        (
            'DEFAULT_EXAM_RESULT',
            'EXAM_RESULT',
            'Exam Department',
            NULL,
            'DEPARTMENT_STAFF',
            1
        ),
        (
            'DEFAULT_COURSE_ACADEMIC',
            'COURSE_ACADEMIC',
            'Academic Department',
            NULL,
            'INSTRUCTOR',
            1
        ),
        (
            'DEFAULT_ATTENDANCE',
            'ATTENDANCE',
            'Academic Department',
            NULL,
            'INSTRUCTOR',
            1
        ),
        (
            'DEFAULT_DEGREE_RECORDS',
            'DEGREE_RECORDS',
            'Registrar Office',
            NULL,
            'DEPARTMENT_STAFF',
            1
        ),
        (
            'DEFAULT_ENROLLMENT',
            'ENROLLMENT',
            'Registrar Office',
            NULL,
            'DEPARTMENT_STAFF',
            1
        ),
        (
            'DEFAULT_IT_TECHNICAL',
            'IT_TECHNICAL',
            'IT Department',
            NULL,
            'DEPARTMENT_STAFF',
            1
        ),
        (
            'DEFAULT_GENERAL',
            'GENERAL',
            'Administration',
            NULL,
            'ADMIN',
            1
        )
),
resolved_rules AS (
    SELECT
        r.rule_code,
        c.category_id,
        d.department_id,
        desk.desk_id,
        r.target_role,
        r.priority_order
    FROM desired_rules r
    JOIN public.query_categories c
      ON c.category_code = r.category_code
     AND c.is_active = TRUE
    JOIN public.departments d
      ON d.department_name = r.department_name
     AND d.is_active = TRUE
    LEFT JOIN public.accounts_desks desk
      ON r.desk_code IS NOT NULL
     AND desk.desk_code = r.desk_code
     AND desk.department_id = d.department_id
     AND desk.is_active = TRUE
)
INSERT INTO public.routing_rules (
    rule_code,
    category_id,
    department_id,
    desk_id,
    target_role,
    priority_order,
    rule_expression,
    is_active
)
SELECT
    rule_code,
    category_id,
    department_id,
    desk_id,
    target_role,
    priority_order,
    '{}'::jsonb,
    TRUE
FROM resolved_rules
ON CONFLICT (rule_code)
DO UPDATE SET
    category_id = EXCLUDED.category_id,
    department_id = EXCLUDED.department_id,
    desk_id = EXCLUDED.desk_id,
    target_role = EXCLUDED.target_role,
    priority_order = EXCLUDED.priority_order,
    rule_expression = EXCLUDED.rule_expression,
    is_active = TRUE;


-- ============================================================
-- 3. CONNECT LEGACY CATEGORY TEXT TO category_id
--
-- Existing prototype processing saved category names directly
-- in tickets.category. The final workflow also uses the FK.
-- This only fills category_id where the text already matches a
-- controlled category. It does not reclassify any ticket.
-- ============================================================

UPDATE public.tickets t
SET
    category_id = c.category_id,
    updated_at = t.updated_at
FROM public.query_categories c
WHERE t.category = c.category_name
  AND t.category_id IS DISTINCT FROM c.category_id;


-- ============================================================
-- 4. MIGRATION VALIDATION
-- ============================================================

DO $routing_checks$
DECLARE
    missing_category_rules integer;
    invalid_account_rules integer;
    required_department_count integer;
BEGIN
    SELECT count(*)
    INTO missing_category_rules
    FROM public.query_categories c
    WHERE c.is_active = TRUE
      AND NOT EXISTS (
          SELECT 1
          FROM public.routing_rules r
          WHERE r.category_id = c.category_id
            AND r.is_active = TRUE
      );

    IF missing_category_rules <> 0 THEN
        RAISE EXCEPTION
            'Routing migration failed: % active categories have no active rule.',
            missing_category_rules;
    END IF;


    SELECT count(*)
    INTO invalid_account_rules
    FROM public.routing_rules r
    JOIN public.query_categories c
      ON c.category_id = r.category_id
    WHERE c.category_code IN (
        'FEE_BILLING',
        'SCHOLARSHIP',
        'REFUNDS'
    )
      AND r.is_active = TRUE
      AND r.desk_id IS NULL;

    IF invalid_account_rules <> 0 THEN
        RAISE EXCEPTION
            'Routing migration failed: an Accounts rule has no desk.';
    END IF;


    SELECT count(*)
    INTO required_department_count
    FROM public.departments
    WHERE department_name IN (
        'Accounts Department',
        'Exam Department',
        'Registrar Office',
        'IT Department',
        'Academic Department',
        'Administration'
    )
      AND is_active = TRUE;

    IF required_department_count <> 6 THEN
        RAISE EXCEPTION
            'Routing migration failed: required departments are missing.';
    END IF;


    IF (
        SELECT count(*)
        FROM public.routing_rules r
        JOIN public.query_categories c
          ON c.category_id = r.category_id
        WHERE c.is_active = TRUE
          AND r.is_active = TRUE
    ) < 10 THEN
        RAISE EXCEPTION
            'Routing migration failed: fewer than ten active category routes exist.';
    END IF;


    RAISE NOTICE 'Full routing catalog checks: OK';
END;
$routing_checks$;

COMMIT;