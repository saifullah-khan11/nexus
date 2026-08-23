from __future__ import annotations

import io
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from docxtpl import DocxTemplate


def render_certificate_docx(
    *,
    template_bytes: bytes,
    values: dict[str, Any],
) -> bytes:
    document = DocxTemplate(
        io.BytesIO(template_bytes)
    )

    context = {
        key: "" if value is None else str(value)
        for key, value in values.items()
    }

    document.render(context)

    output = io.BytesIO()
    document.save(output)
    return output.getvalue()


def convert_docx_to_pdf(
    *,
    docx_bytes: bytes,
) -> bytes:
    """
    Convert the rendered DOCX to PDF using LibreOffice.

    This keeps the uploaded Word template's visual design as the
    source of truth. The production Docker image must include
    LibreOffice.
    """

    libreoffice = (
        os.getenv("LIBREOFFICE_BIN")
        or shutil.which("libreoffice")
        or shutil.which("soffice")
    )

    if not libreoffice:
        raise RuntimeError(
            "LibreOffice is not installed. "
            "Add LibreOffice to the backend Docker image "
            "or set LIBREOFFICE_BIN."
        )

    with tempfile.TemporaryDirectory(
        prefix="nexus-cert-"
    ) as temp_dir:
        temp_path = Path(temp_dir)

        source = temp_path / "certificate.docx"
        source.write_bytes(docx_bytes)

        command = [
            libreoffice,
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(temp_path),
            str(source),
        ]

        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=60,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(
                "Certificate PDF conversion timed out."
            ) from exc

        if completed.returncode != 0:
            raise RuntimeError(
                "LibreOffice failed to convert the certificate: "
                + (
                    completed.stderr.strip()
                    or completed.stdout.strip()
                    or "unknown conversion error"
                )
            )

        pdf_path = temp_path / "certificate.pdf"

        if not pdf_path.exists():
            raise RuntimeError(
                "LibreOffice completed without producing a PDF."
            )

        return pdf_path.read_bytes()