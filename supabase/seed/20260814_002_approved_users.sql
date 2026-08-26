-- =========================================================
-- Prototype approved / allowlisted demo users
-- Replace the placeholder emails before running.
-- Use lowercase email addresses.
-- =========================================================


-- 1. Student
INSERT INTO public.approved_users (
    email,
    full_name,
    role,
    department_id,
    desk_id
)
VALUES (
    'saifisulehri@gmail.com',
    'Demo Student',
    'STUDENT',
    NULL,
    NULL
)
ON CONFLICT (email)
DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    desk_id = EXCLUDED.desk_id,
    is_active = TRUE;


-- 2. Fee & Billing Officer
INSERT INTO public.approved_users (
    email,
    full_name,
    role,
    department_id,
    desk_id
)
SELECT
    'saifishameel@gmail.com',
    'Fee Verification Officer',
    'DEPARTMENT_STAFF',
    d.department_id,
    ad.desk_id
FROM public.departments d
JOIN public.accounts_desks ad
    ON ad.department_id = d.department_id
WHERE d.department_name = 'Accounts Department'
  AND ad.desk_code = 'FEE_BILLING'
ON CONFLICT (email)
DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    desk_id = EXCLUDED.desk_id,
    is_active = TRUE;


-- 3. Scholarship Officer
INSERT INTO public.approved_users (
    email,
    full_name,
    role,
    department_id,
    desk_id
)
SELECT
    'ahmedsaqlain497@gmail.com',
    'Scholarship Officer',
    'DEPARTMENT_STAFF',
    d.department_id,
    ad.desk_id
FROM public.departments d
JOIN public.accounts_desks ad
    ON ad.department_id = d.department_id
WHERE d.department_name = 'Accounts Department'
  AND ad.desk_code = 'SCHOLARSHIP'
ON CONFLICT (email)
DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    desk_id = EXCLUDED.desk_id,
    is_active = TRUE;


-- 4. Refunds Officer
INSERT INTO public.approved_users (
    email,
    full_name,
    role,
    department_id,
    desk_id
)
SELECT
    'zarnishparvaiz0@gmail.com',
    'Refunds Officer',
    'DEPARTMENT_STAFF',
    d.department_id,
    ad.desk_id
FROM public.departments d
JOIN public.accounts_desks ad
    ON ad.department_id = d.department_id
WHERE d.department_name = 'Accounts Department'
  AND ad.desk_code = 'REFUNDS'
ON CONFLICT (email)
DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    desk_id = EXCLUDED.desk_id,
    is_active = TRUE;