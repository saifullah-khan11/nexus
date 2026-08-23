from __future__ import annotations

import json
import os
from urllib import error as urllib_error
from urllib import request as urllib_request


SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "",
)
SUPABASE_STORAGE_BUCKET = os.getenv(
    "SUPABASE_STORAGE_BUCKET",
    "student-verification",
)


def upload_generated_pdf(
    *,
    storage_path: str,
    pdf_bytes: bytes,
) -> None:
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL is not configured.")

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is not configured."
        )

    url = (
        f"{SUPABASE_URL}/storage/v1/object/"
        f"{SUPABASE_STORAGE_BUCKET}/{storage_path}"
    )

    req = urllib_request.Request(
        url,
        data=pdf_bytes,
        method="POST",
        headers={
            "Authorization": (
                f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
            ),
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "application/pdf",
            "x-upsert": "true",
        },
    )

    try:
        with urllib_request.urlopen(
            req,
            timeout=30,
        ) as response:
            if response.status not in {200, 201}:
                raise RuntimeError(
                    "Supabase Storage returned an unexpected "
                    f"status: {response.status}"
                )

    except urllib_error.HTTPError as exc:
        provider_detail = "Storage upload failed."

        try:
            raw = exc.read().decode(
                "utf-8",
                errors="replace",
            )
            if raw:
                try:
                    parsed = json.loads(raw)
                    provider_detail = (
                        parsed.get("message")
                        or parsed.get("error")
                        or raw[:1000]
                    )
                except json.JSONDecodeError:
                    provider_detail = raw[:1000]
        except Exception:
            pass

        raise RuntimeError(
            f"Supabase Storage upload failed: {provider_detail}"
        ) from exc

    except urllib_error.URLError as exc:
        raise RuntimeError(
            "Unable to reach Supabase Storage: "
            f"{exc.reason}"
        ) from exc