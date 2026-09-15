BEGIN;

SET LOCAL lock_timeout = '5s';

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_class
        WHERE oid = to_regclass('storage.objects')
          AND relrowsecurity
    ) THEN
        RAISE EXCEPTION
            'Supabase storage.objects must exist with RLS enabled.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'sq_query_attachments_server_only'
    ) THEN
        CREATE POLICY sq_query_attachments_server_only
            ON storage.objects
            AS RESTRICTIVE
            FOR ALL
            TO anon, authenticated
            USING (bucket_id <> 'query-attachments')
            WITH CHECK (bucket_id <> 'query-attachments');
    END IF;
END;
$migration$;

COMMIT;

SELECT jsonb_build_object(
    'storage_rls_enabled',
    (
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'storage.objects'::regclass
    ),

    'policy',
    (
        SELECT jsonb_build_object(
            'name', policyname,
            'mode', permissive,
            'roles', roles,
            'command', cmd,
            'using', qual,
            'with_check', with_check
        )
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'sq_query_attachments_server_only'
    ),

    'ticket_count',
    (SELECT COUNT(*) FROM public.tickets),

    'attachment_count',
    (SELECT COUNT(*) FROM public.query_attachments)
) AS verification;