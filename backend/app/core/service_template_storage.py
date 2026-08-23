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

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "",
)
SUPABASE_TEMPLATE_BUCKET = os.getenv(
    "SUPABASE_TEMPLATE_BUCKET",
    "service-templates",
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


def upload_docx_template(
    *,
    storage_path: str,
    file_bytes: bytes,
) -> None:
    url = (
        f"{SUPABASE_URL}/storage/v1/object/"
        f"{SUPABASE_TEMPLATE_BUCKET}/{quote(storage_path, safe='/')}"
    )

    request = urllib_request.Request(
        url,
        data=file_bytes,
        method="POST",
        headers={
            **_headers(DOCX_MIME),
            "x-upsert": "true",
        },
    )

    try:
        with urllib_request.urlopen(request, timeout=30) as response:
            if response.status not in {200, 201}:
                raise RuntimeError(
                    f"Supabase Storage returned status {response.status}."
                )
    except urllib_error.HTTPError as exc:
        detail = "Template upload failed."
        try:
            raw = exc.read().decode("utf-8", errors="replace")
            if raw:
                try:
                    parsed = json.loads(raw)
                    detail = (
                        parsed.get("message")
                        or parsed.get("error")
                        or raw[:1000]
                    )
                except json.JSONDecodeError:
                    detail = raw[:1000]
        except Exception:
            pass

        raise RuntimeError(
            f"Supabase template upload failed: {detail}"
        ) from exc

    except urllib_error.URLError as exc:
        raise RuntimeError(
            f"Unable to reach Supabase Storage: {exc.reason}"
        ) from exc