import re
from typing import Any, Self
from urllib.parse import quote, urlsplit, urlunsplit

import httpx

from app.core.config import settings


ATTACHMENT_BUCKET = "query-attachments"
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

ALLOWED_ATTACHMENT_TYPES = (
    "application/pdf",
    "image/png",
    "image/jpeg",
)


class StorageError(RuntimeError):
    def __init__(
        self,
        message: str,
        status_code: int | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code


class StorageObjectNotFound(StorageError):
    pass


class AttachmentStorage:
    def __init__(self) -> None:
        secret = settings.supabase_secret_key
        key = secret.get_secret_value().strip() if secret else ""

        if (
            not key.startswith("sb_secret_")
            or not key.isascii()
            or any(character.isspace() for character in key)
            or any(ord(character) < 33 or ord(character) > 126 for character in key)
        ):
            raise StorageError(
                "Set SUPABASE_SECRET_KEY in backend/.env to a valid "
                "Supabase secret key starting with sb_secret_."
            )

        try:
            parsed = urlsplit(settings.supabase_url.strip())

            valid_origin = (
                parsed.scheme == "https"
                and bool(parsed.hostname)
                and parsed.username is None
                and parsed.password is None
                and parsed.path in ("", "/")
                and not parsed.query
                and not parsed.fragment
            )

            if not valid_origin:
                raise ValueError("Invalid project origin.")

            self.origin = urlunsplit(
                (parsed.scheme, parsed.netloc, "", "", "")
            )
        except ValueError as exc:
            raise StorageError(
                "SUPABASE_URL must be the HTTPS project URL without "
                "credentials, a query string, or an additional path."
            ) from exc

        self.client = httpx.Client(
            base_url=f"{self.origin}/storage/v1/",
            headers={"apikey": key},
            timeout=httpx.Timeout(30.0, connect=5.0, pool=5.0),
            follow_redirects=False,
        )

    def __enter__(self) -> Self:
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        self.client.close()

    def _request(
        self,
        method: str,
        path: str,
        **kwargs: Any,
    ) -> httpx.Response:
        try:
            return self.client.request(method, path, **kwargs)
        except httpx.HTTPError as exc:
            raise StorageError(
                "Storage network request failed. Check the connection and retry."
            ) from exc

    @staticmethod
    def _require_success(
        response: httpx.Response,
        operation: str,
    ) -> None:
        if response.status_code not in (200, 201, 204):
            raise StorageError(
                f"{operation} failed (HTTP {response.status_code}).",
                response.status_code,
            )

    @staticmethod
    def _is_missing(response: httpx.Response) -> bool:
        if response.status_code == 404:
            return True

        if response.status_code != 400:
            return False

        try:
            data = response.json()
        except ValueError:
            return False

        if not isinstance(data, dict):
            return False

        return (
            str(data.get("statusCode")) == "404"
            or data.get("code") in ("NoSuchBucket", "NoSuchKey")
        )

    @staticmethod
    def _safe_object_path(path: str) -> str:
        if (
            not isinstance(path, str)
            or not re.fullmatch(r"[A-Za-z0-9._/-]{1,1024}", path)
            or any(part in ("", ".", "..") for part in path.split("/"))
        ):
            raise StorageError("Invalid attachment storage path.")

        return quote(path, safe="/")

    @staticmethod
    def _bucket_matches(bucket: dict[str, Any]) -> bool:
        allowed_types = bucket.get("allowed_mime_types")

        return (
            bucket.get("id") == ATTACHMENT_BUCKET
            and bucket.get("public") is False
            and bucket.get("file_size_limit") in (
                MAX_ATTACHMENT_BYTES,
                str(MAX_ATTACHMENT_BYTES),
            )
            and isinstance(allowed_types, list)
            and all(isinstance(value, str) for value in allowed_types)
            and set(allowed_types) == set(ALLOWED_ATTACHMENT_TYPES)
        )

    def get_bucket(self) -> dict[str, Any] | None:
        response = self._request(
            "GET",
            f"bucket/{ATTACHMENT_BUCKET}",
            headers={"Cache-Control": "no-cache"},
        )

        if self._is_missing(response):
            return None

        self._require_success(response, "Bucket lookup")

        try:
            data = response.json()
        except ValueError as exc:
            raise StorageError("Bucket lookup returned invalid JSON.") from exc

        if (
            not isinstance(data, dict)
            or data.get("id") != ATTACHMENT_BUCKET
        ):
            raise StorageError("Bucket lookup returned an unexpected response.")

        return data

    def ensure_bucket(self) -> dict[str, Any]:
        """Configure the application bucket during administrative setup."""
        desired = {
            "public": False,
            "file_size_limit": MAX_ATTACHMENT_BYTES,
            "allowed_mime_types": list(ALLOWED_ATTACHMENT_TYPES),
        }

        bucket = self.get_bucket()

        if bucket is None:
            response = self._request(
                "POST",
                "bucket",
                json={
                    "id": ATTACHMENT_BUCKET,
                    "name": ATTACHMENT_BUCKET,
                    **desired,
                },
            )

            if response.status_code not in (200, 201):
                # Another setup request may have created the same bucket.
                bucket = self.get_bucket()

                if bucket is None:
                    self._require_success(response, "Bucket creation")
            else:
                bucket = self.get_bucket()

        if bucket is None:
            raise StorageError("The attachment bucket could not be confirmed.")

        if not self._bucket_matches(bucket):
            response = self._request(
                "PUT",
                f"bucket/{ATTACHMENT_BUCKET}",
                json=desired,
            )
            self._require_success(response, "Bucket configuration")
            bucket = self.get_bucket()

        if bucket is None or not self._bucket_matches(bucket):
            raise StorageError(
                "The attachment bucket must be private, allow PDF/PNG/JPEG, "
                "and have a 5242880-byte file size limit."
            )

        return bucket

    def upload_new(
        self,
        path: str,
        content: bytes,
        mime_type: str,
    ) -> None:
        object_path = self._safe_object_path(path)

        if not isinstance(content, bytes):
            raise StorageError("Attachment content must be bytes.")

        if not 1 <= len(content) <= MAX_ATTACHMENT_BYTES:
            raise StorageError(
                "Attachment size must be between 1 and 5242880 bytes."
            )

        if mime_type not in ALLOWED_ATTACHMENT_TYPES:
            raise StorageError("Only PDF, PNG and JPEG attachments are allowed.")

        response = self._request(
            "POST",
            f"object/{ATTACHMENT_BUCKET}/{object_path}",
            content=content,
            headers={
                "Content-Type": mime_type,
                "Cache-Control": "max-age=0",
                "x-upsert": "false",
            },
        )
        self._require_success(response, "File upload")

    def download(self, path: str) -> bytes:
        object_path = self._safe_object_path(path)

        try:
            with self.client.stream(
                "GET",
                f"object/authenticated/{ATTACHMENT_BUCKET}/{object_path}",
                headers={
                    "Cache-Control": "no-cache",
                    "Accept-Encoding": "identity",
                },
            ) as response:
                if response.status_code != 200:
                    response.read()

                    if self._is_missing(response):
                        raise StorageObjectNotFound(
                            "The stored attachment was not found.",
                            404,
                        )

                    self._require_success(response, "File download")

                content = bytearray()

                for chunk in response.iter_bytes(chunk_size=65536):
                    if len(content) + len(chunk) > MAX_ATTACHMENT_BYTES:
                        raise StorageError(
                            "The stored attachment exceeds the permitted size."
                        )
                    content.extend(chunk)

                if not content:
                    raise StorageError("The stored attachment is empty.")

                return bytes(content)

        except httpx.HTTPError as exc:
            raise StorageError(
                "Storage download failed. Check the connection and retry."
            ) from exc

    def remove(self, path: str) -> None:
        self._safe_object_path(path)

        response = self._request(
            "DELETE",
            f"object/{ATTACHMENT_BUCKET}",
            json={"prefixes": [path]},
        )

        if self._is_missing(response):
            return

        self._require_success(response, "File removal")