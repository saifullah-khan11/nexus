from __future__ import annotations

import json
import os
from urllib import error as urllib_error
from urllib import request as urllib_request
from urllib.parse import quote


DOCX_MIME = (
    "application/vnd.openxmlformats-officedocument."
    "wordprocessingml.document"
)

PDF_MIME = "application/pdf"

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "",
)

SUPABASE_TEMPLATE_BUCKET = os.getenv(
    "SUPABASE_TEMPLATE_BUCKET",
    "service-templates",
)

SUPABASE_DOCUMENT_BUCKET = os.getenv(
    "SUPABASE_DOCUMENT_BUCKET",
    "generated-documents",
)


def _headers(content_type: str | None = None) -> dict[str, str]:
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL is not configured.")

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is not configured."
        )

    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
    }

    if content_type:
        headers["Content-Type"] = content_type

    return headers


def _storage_object_url(
    *,
    bucket: str,
    storage_path: str,
) -> str:
    return (
        f"{SUPABASE_URL}/storage/v1/object/"
        f"{quote(bucket, safe='')}/"
        f"{quote(storage_path, safe='/')}"
    )


def _parse_error(
    exc: urllib_error.HTTPError,
    fallback: str,
) -> str:
    detail = fallback

    try:
        raw = exc.read().decode(
            "utf-8",
            errors="replace",
        )

        if raw:
            try:
                parsed = json.loads(raw)

                detail = (
                    parsed.get("message")
                    or parsed.get("error_description")
                    or parsed.get("error")
                    or raw[:1000]
                )

            except json.JSONDecodeError:
                detail = raw[:1000]

    except Exception:
        pass

    return detail


def upload_generated_pdf(
    *,
    storage_path: str,
    pdf_bytes: bytes,
) -> None:
    if not pdf_bytes:
        raise RuntimeError(
            "Cannot upload an empty generated PDF."
        )

    request = urllib_request.Request(
        _storage_object_url(
            bucket=SUPABASE_DOCUMENT_BUCKET,
            storage_path=storage_path,
        ),
        data=pdf_bytes,
        method="POST",
        headers={
            **_headers(PDF_MIME),
            "x-upsert": "true",
        },
    )

    try:
        with urllib_request.urlopen(
            request,
            timeout=30,
        ) as response:

            if response.status not in {200, 201}:
                raise RuntimeError(
                    "Supabase Storage returned an unexpected "
                    f"status: {response.status}."
                )

    except urllib_error.HTTPError as exc:
        raise RuntimeError(
            "Supabase generated-document upload failed: "
            + _parse_error(
                exc,
                "Generated PDF upload failed.",
            )
        ) from exc

    except urllib_error.URLError as exc:
        raise RuntimeError(
            f"Unable to reach Supabase Storage: {exc.reason}"
        ) from exc


def download_template_docx(
    *,
    storage_path: str,
) -> bytes:
    request = urllib_request.Request(
        _storage_object_url(
            bucket=SUPABASE_TEMPLATE_BUCKET,
            storage_path=storage_path,
        ),
        method="GET",
        headers=_headers(),
    )

    try:
        with urllib_request.urlopen(
            request,
            timeout=30,
        ) as response:

            data = response.read()

            if not data:
                raise RuntimeError(
                    "Supabase returned an empty DOCX template."
                )

            return data

    except urllib_error.HTTPError as exc:
        raise RuntimeError(
            "Supabase template download failed: "
            + _parse_error(
                exc,
                "Template download failed.",
            )
        ) from exc

    except urllib_error.URLError as exc:
        raise RuntimeError(
            f"Unable to reach Supabase Storage: {exc.reason}"
        ) from exc


def create_signed_document_url(
    *,
    storage_path: str,
    expires_in: int = 600,
) -> str:
    if expires_in <= 0:
        raise ValueError(
            "expires_in must be greater than zero."
        )

    request = urllib_request.Request(
        (
            f"{SUPABASE_URL}/storage/v1/object/sign/"
            f"{quote(SUPABASE_DOCUMENT_BUCKET, safe='')}/"
            f"{quote(storage_path, safe='/')}"
        ),
        data=json.dumps(
            {"expiresIn": int(expires_in)}
        ).encode("utf-8"),
        method="POST",
        headers=_headers("application/json"),
    )

    try:
        with urllib_request.urlopen(
            request,
            timeout=30,
        ) as response:

            raw = response.read().decode(
                "utf-8",
                errors="replace",
            )

    except urllib_error.HTTPError as exc:
        raise RuntimeError(
            "Supabase signed URL creation failed: "
            + _parse_error(
                exc,
                "Signed URL creation failed.",
            )
        ) from exc

    except urllib_error.URLError as exc:
        raise RuntimeError(
            f"Unable to reach Supabase Storage: {exc.reason}"
        ) from exc

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "Supabase returned an invalid signed URL response."
        ) from exc

    signed_path = (
        parsed.get("signedURL")
        or parsed.get("signedUrl")
        or parsed.get("path")
    )

    if not signed_path:
        raise RuntimeError(
            "Supabase did not return a signed document URL."
        )

    if signed_path.startswith(
        ("http://", "https://")
    ):
        return signed_path

    if not signed_path.startswith("/"):
        signed_path = f"/{signed_path}"

    return f"{SUPABASE_URL}/storage/v1{signed_path}"