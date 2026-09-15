import json
import struct
import sys
import zlib
from uuid import uuid4

import httpx
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.attachment_storage_service import (
    ALLOWED_ATTACHMENT_TYPES,
    ATTACHMENT_BUCKET,
    MAX_ATTACHMENT_BYTES,
    AttachmentStorage,
    StorageError,
    StorageObjectNotFound,
)


POLICY_NAME = "sq_query_attachments_server_only"
DENIED_STATUSES = {400, 401, 403, 404}


def verify_database_policy() -> None:
    with SessionLocal() as db:
        row = db.execute(
            text("""
                SELECT
                    c.relrowsecurity AS rls_enabled,
                    p.permissive,
                    p.cmd,
                    p.roles::text[] AS roles,
                    p.qual,
                    p.with_check
                FROM pg_class c
                LEFT JOIN pg_policies p
                  ON p.schemaname = 'storage'
                 AND p.tablename = 'objects'
                 AND p.policyname = :policy_name
                WHERE c.oid = to_regclass('storage.objects')
            """),
            {"policy_name": POLICY_NAME},
        ).mappings().first()

    if row is None or row["rls_enabled"] is not True:
        raise StorageError("Supabase storage.objects must have RLS enabled.")

    expected_guards = {
        "(bucket_id <> 'query-attachments'::text)",
        "((bucket_id)::text <> 'query-attachments'::text)",
    }

    using_guard = " ".join((row["qual"] or "").split())
    check_guard = " ".join((row["with_check"] or "").split())

    if (
        row["permissive"] != "RESTRICTIVE"
        or row["cmd"] != "ALL"
        or set(row["roles"] or []) != {"anon", "authenticated"}
        or using_guard not in expected_guards
        or check_guard not in expected_guards
    ):
        raise StorageError(
            "The attachment storage policy is missing or does not match "
            "009_attachment_storage_policy.sql."
        )


def object_visible_in_database(path: str) -> bool:
    with SessionLocal() as db:
        return bool(
            db.execute(
                text("""
                    SELECT EXISTS (
                        SELECT 1
                        FROM storage.objects
                        WHERE bucket_id = :bucket
                          AND name = :path
                    )
                """),
                {
                    "bucket": ATTACHMENT_BUCKET,
                    "path": path,
                },
            ).scalar_one()
        )


def make_test_png() -> bytes:
    def chunk(tag: bytes, payload: bytes) -> bytes:
        checksum = zlib.crc32(tag + payload) & 0xFFFFFFFF
        return (
            struct.pack(">I", len(payload))
            + tag
            + payload
            + struct.pack(">I", checksum)
        )

    header = struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0)
    pixels = zlib.compress(b"\x00\x30\x90\xff\xff")

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", pixels)
        + chunk(b"IEND", b"")
    )


def main() -> int:
    result = {
        "bucket": ATTACHMENT_BUCKET,
        "passed": False,
        "stage": "database_policy",
    }

    try:
        verify_database_policy()
        result["storage_rls_enabled"] = True
        result["backend_only_policy"] = True

        with AttachmentStorage() as storage:
            result["stage"] = "bucket_configuration"
            bucket = storage.ensure_bucket()

            result["bucket_private"] = bucket["public"] is False
            result["file_size_limit"] = MAX_ATTACHMENT_BYTES
            result["allowed_mime_types"] = list(ALLOWED_ATTACHMENT_TYPES)

            probe_path = f"setup-probes/{uuid4().hex}.png"
            probe_content = make_test_png()

            try:
                result["stage"] = "upload"
                storage.upload_new(
                    probe_path,
                    probe_content,
                    "image/png",
                )
                result["uploaded"] = True

                result["stage"] = "download"
                downloaded = storage.download(probe_path)
                result["download_matches"] = downloaded == probe_content

                if not result["download_matches"]:
                    raise StorageError(
                        "Downloaded test content did not match the uploaded file."
                    )

                result["stage"] = "database_connection"
                result["object_visible_in_database"] = (
                    object_visible_in_database(probe_path)
                )

                if not result["object_visible_in_database"]:
                    raise StorageError(
                        "The test object was not found in DATABASE_URL's "
                        "storage metadata. Check that DATABASE_URL and "
                        "SUPABASE_URL use the same Supabase project."
                    )

                result["stage"] = "private_access"
                storage_base = f"{storage.origin}/storage/v1"

                with httpx.Client(
                    timeout=httpx.Timeout(15.0, connect=5.0),
                    follow_redirects=False,
                ) as anonymous_client:
                    public_response = anonymous_client.get(
                        f"{storage_base}/object/public/"
                        f"{ATTACHMENT_BUCKET}/{probe_path}"
                    )

                    anonymous_response = anonymous_client.get(
                        f"{storage_base}/object/authenticated/"
                        f"{ATTACHMENT_BUCKET}/{probe_path}",
                        headers={
                            "apikey": settings.supabase_publishable_key,
                        },
                    )

                result["public_read_status"] = public_response.status_code
                result["anonymous_read_status"] = anonymous_response.status_code

                result["public_read_blocked"] = (
                    public_response.status_code in DENIED_STATUSES
                )
                result["anonymous_read_blocked"] = (
                    anonymous_response.status_code in DENIED_STATUSES
                )

                if (
                    not result["public_read_blocked"]
                    or not result["anonymous_read_blocked"]
                ):
                    raise StorageError(
                        "Private storage verification failed. "
                        "Check the bucket settings and access policy."
                    )

            finally:
                result["cleanup_verified"] = False

                try:
                    storage.remove(probe_path)

                    try:
                        storage.download(probe_path)
                    except StorageObjectNotFound:
                        result["cleanup_verified"] = True

                    if not result["cleanup_verified"]:
                        result["cleanup_error"] = (
                            "The temporary test file was still readable "
                            "after removal."
                        )
                        result["temporary_file_path"] = probe_path

                except StorageError as cleanup_error:
                    result["cleanup_error"] = str(cleanup_error)
                    result["temporary_file_path"] = probe_path

        required_checks = (
            "storage_rls_enabled",
            "backend_only_policy",
            "bucket_private",
            "uploaded",
            "download_matches",
            "object_visible_in_database",
            "public_read_blocked",
            "anonymous_read_blocked",
            "cleanup_verified",
        )

        result["passed"] = all(
            result.get(check) is True
            for check in required_checks
        )
        result["stage"] = "complete"

    except StorageError as exc:
        result["error"] = str(exc)
        if exc.status_code is not None:
            result["http_status"] = exc.status_code

    except SQLAlchemyError as exc:
        result["error"] = (
            "Database verification failed. Check DATABASE_URL, "
            "database permissions, and the SQL migration."
        )
        sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
        if (
            isinstance(sqlstate, str)
            and len(sqlstate) == 5
            and sqlstate.isalnum()
        ):
            result["sqlstate"] = sqlstate

    except httpx.HTTPError:
        result["error"] = (
            "The anonymous storage connectivity check failed. "
            "Check the connection and retry."
        )

    except Exception as exc:
        result["error"] = (
            f"Unexpected setup error ({type(exc).__name__})."
        )

    print(json.dumps(result, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())