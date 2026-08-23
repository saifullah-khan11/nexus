from __future__ import annotations

from datetime import datetime
from io import BytesIO
from pathlib import Path

from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


BASE_DIR = Path(__file__).resolve().parents[1]
FONT_DIR = BASE_DIR / "templates" / "fonts"


def _register_font(name: str, filename: str) -> bool:
    font_path = FONT_DIR / filename
    if not font_path.exists():
        return False

    try:
        TTFont(name, str(font_path))
        return True
    except Exception:
        return False


def generate_bonafide_certificate(
    *,
    student_name: str,
    registration_number: str,
    program: str,
    department: str,
    year: int,
    semester: int,
    academic_session: str | None,
    issue_date: datetime | None = None,
) -> bytes:
    """
    Generate a university-branded Bonafide Certificate.

    This is an NEXUS-owned demo template. It does not claim to be
    an official SOA/ITER document. The actual university template
    can be substituted later without changing the workflow.
    """

    issue_date = issue_date or datetime.now()

    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=A4)
    page_width, page_height = A4

    regular_font = "Helvetica"
    bold_font = "Helvetica-Bold"

    # Optional custom fonts can be added later under:
    # backend/app/templates/fonts/
    _register_font("NexusSans", "NexusSans-Regular.ttf")
    _register_font("NexusSansBold", "NexusSans-Bold.ttf")

    if "NexusSans" in pdf.getAvailableFonts():
        regular_font = "NexusSans"
    if "NexusSansBold" in pdf.getAvailableFonts():
        bold_font = "NexusSansBold"

    margin_x = 22 * mm
    top = page_height - 22 * mm

    # Border
    pdf.setLineWidth(1.1)
    pdf.roundRect(
        margin_x - 7 * mm,
        15 * mm,
        page_width - 2 * margin_x + 14 * mm,
        page_height - 30 * mm,
        5 * mm,
    )

    # NEXUS header mark
    pdf.setFillColorRGB(0.05, 0.06, 0.08)
    pdf.roundRect(
        margin_x,
        top - 12 * mm,
        12 * mm,
        12 * mm,
        3 * mm,
        fill=1,
        stroke=0,
    )

    pdf.setFillColorRGB(1, 1, 1)
    pdf.setFont(bold_font, 9)
    pdf.drawCentredString(
        margin_x + 6 * mm,
        top - 7.2 * mm,
        "N",
    )

    pdf.setFillColorRGB(0.05, 0.06, 0.08)
    pdf.setFont(bold_font, 15)
    pdf.drawString(
        margin_x + 16 * mm,
        top - 4.5 * mm,
        "NEXUS UNIVERSITY SERVICES",
    )

    pdf.setFillColorRGB(0.35, 0.38, 0.42)
    pdf.setFont(regular_font, 7.5)
    pdf.drawString(
        margin_x + 16 * mm,
        top - 9 * mm,
        "Autonomous University Service Agent",
    )

    # Divider
    divider_y = top - 19 * mm
    pdf.setStrokeColorRGB(0.72, 0.75, 0.80)
    pdf.setLineWidth(0.5)
    pdf.line(
        margin_x,
        divider_y,
        page_width - margin_x,
        divider_y,
    )

    # Certificate title
    pdf.setFillColorRGB(0.08, 0.09, 0.11)
    pdf.setFont(bold_font, 20)
    pdf.drawCentredString(
        page_width / 2,
        divider_y - 17 * mm,
        "BONAFIDE CERTIFICATE",
    )

    # Reference and date
    ref_y = divider_y - 28 * mm
    pdf.setFont(regular_font, 8)
    pdf.setFillColorRGB(0.38, 0.40, 0.44)

    pdf.drawString(
        margin_x,
        ref_y,
        f"Reference: NEXUS-BONAFIDE-{registration_number}",
    )

    pdf.drawRightString(
        page_width - margin_x,
        ref_y,
        f"Date: {issue_date.strftime('%d %B %Y')}",
    )

    # Body
    body_y = ref_y - 20 * mm

    body_width = page_width - 2 * margin_x
    body_style = ParagraphStyle(
        "body",
        fontName=regular_font,
        fontSize=11,
        leading=18,
        textColor="#25282D",
        alignment=0,
    )

    from reportlab.platypus import Paragraph

    paragraph = Paragraph(
        (
            "This is to certify that <b>"
            f"{student_name}"
            "</b>, bearing Registration Number <b>"
            f"{registration_number}"
            "</b>, is a bona fide student of the university."
        ),
        body_style,
    )

    _, height = paragraph.wrap(body_width, 50 * mm)
    paragraph.drawOn(
        pdf,
        margin_x,
        body_y - height,
    )

    details_y = body_y - height - 18 * mm

    rows = [
        ("Program", program),
        ("Department", department),
        ("Year / Semester", f"Year {year} / Semester {semester}"),
        ("Academic Session", academic_session or "Not provided"),
        ("Enrollment Status", "ACTIVE"),
    ]

    row_height = 13 * mm
    label_width = 48 * mm
    box_width = page_width - 2 * margin_x

    for index, (label, value) in enumerate(rows):
        y = details_y - index * row_height

        if index % 2 == 0:
            pdf.setFillColorRGB(0.965, 0.97, 0.975)
            pdf.roundRect(
                margin_x,
                y - 8 * mm,
                box_width,
                10 * mm,
                2 * mm,
                fill=1,
                stroke=0,
            )

        pdf.setFillColorRGB(0.35, 0.37, 0.40)
        pdf.setFont(bold_font, 8.5)
        pdf.drawString(
            margin_x + 4 * mm,
            y - 4.5 * mm,
            label,
        )

        pdf.setFillColorRGB(0.10, 0.11, 0.13)
        pdf.setFont(regular_font, 9)
        pdf.drawString(
            margin_x + label_width,
            y - 4.5 * mm,
            value[:88],
        )

    signature_y = 52 * mm

    pdf.setStrokeColorRGB(0.30, 0.32, 0.35)
    pdf.line(
        page_width - margin_x - 48 * mm,
        signature_y,
        page_width - margin_x,
        signature_y,
    )

    pdf.setFillColorRGB(0.25, 0.27, 0.30)
    pdf.setFont(bold_font, 8)
    pdf.drawRightString(
        page_width - margin_x,
        signature_y - 5 * mm,
        "Authorized University Office",
    )

    pdf.setFont(regular_font, 7)
    pdf.setFillColorRGB(0.45, 0.47, 0.50)
    pdf.drawRightString(
        page_width - margin_x,
        signature_y - 9 * mm,
        "Generated through NEXUS",
    )

    # Footer
    pdf.setFont(regular_font, 6.8)
    pdf.setFillColorRGB(0.48, 0.50, 0.53)
    pdf.drawCentredString(
        page_width / 2,
        22 * mm,
        (
            "This document is a NEXUS-generated service artifact. "
            "Final institutional validity depends on university approval."
        ),
    )

    pdf.save()
    return output.getvalue()