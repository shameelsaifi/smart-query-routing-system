-- =========================================================
-- Prototype seed data
-- Accounts Department + Accounts sub-desks
-- =========================================================


-- 1. Accounts Department
INSERT INTO public.departments (
    department_name,
    department_email,
    description
)
VALUES (
    'Accounts Department',
    'accounts@vu.edu.pk',
    'Handles student financial queries for the prototype.'
)
ON CONFLICT (department_name)
DO UPDATE SET
    department_email = EXCLUDED.department_email,
    description = EXCLUDED.description,
    is_active = TRUE;


-- 2. Fee & Billing Desk
INSERT INTO public.accounts_desks (
    department_id,
    desk_code,
    desk_name,
    description
)
SELECT
    department_id,
    'FEE_BILLING',
    'Fee & Billing Desk',
    'Handles fee verification, billing and related payment queries.'
FROM public.departments
WHERE department_name = 'Accounts Department'
ON CONFLICT (desk_code)
DO UPDATE SET
    desk_name = EXCLUDED.desk_name,
    description = EXCLUDED.description,
    is_active = TRUE;


-- 3. Scholarship Desk
INSERT INTO public.accounts_desks (
    department_id,
    desk_code,
    desk_name,
    description
)
SELECT
    department_id,
    'SCHOLARSHIP',
    'Scholarship Desk',
    'Handles scholarship and financial assistance related queries.'
FROM public.departments
WHERE department_name = 'Accounts Department'
ON CONFLICT (desk_code)
DO UPDATE SET
    desk_name = EXCLUDED.desk_name,
    description = EXCLUDED.description,
    is_active = TRUE;


-- 4. Refunds Desk
INSERT INTO public.accounts_desks (
    department_id,
    desk_code,
    desk_name,
    description
)
SELECT
    department_id,
    'REFUNDS',
    'Refunds Desk',
    'Handles refund requests and refund status related queries.'
FROM public.departments
WHERE department_name = 'Accounts Department'
ON CONFLICT (desk_code)
DO UPDATE SET
    desk_name = EXCLUDED.desk_name,
    description = EXCLUDED.description,
    is_active = TRUE;