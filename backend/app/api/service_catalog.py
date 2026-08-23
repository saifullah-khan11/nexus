import json
import re
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.docx_template_validator import validate_docx_template
from app.core.service_template_storage import (
    DOCX_MIME,
    upload_docx_template,
)
from app.models.service import Service
from app.models.user import User
from app.models.service_catalog import (
    CertificateTemplate,
    ServiceDomain,
    ServiceFieldDefinition,
)


router = APIRouter(
    prefix="/api/admin/catalog",
    tags=["Service Catalog"],
)


def require_catalog_manager(current_user: User):
    if current_user.role not in {"ADMIN", "STAFF"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff or admin access required.",
        )


def slugify(value: str) -> str:
    value = re.sub(
        r"[^a-zA-Z0-9]+",
        "-",
        value.strip().lower(),
    )
    return value.strip("-") or "domain"


class DomainCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    requires_approval: bool = True
    certificate_required: bool = False


class DomainUpdate(DomainCreate):
    is_active: bool = True


class FieldInput(BaseModel):
    field_key: str = Field(min_length=2, max_length=80)
    label: str = Field(min_length=1, max_length=150)
    field_type: str = Field(default="TEXT", max_length=30)
    placeholder: str | None = Field(default=None, max_length=250)
    help_text: str | None = Field(default=None, max_length=2000)
    is_required: bool = True
    is_student_editable: bool = True
    sort_order: int = 0
    options: list[str] | None = None


class ServiceCreate(BaseModel):
    domain_id: UUID
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=1, max_length=500)
    requires_approval: bool = True


class ServiceUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=1, max_length=500)
    domain_id: UUID
    requires_approval: bool
    is_active: bool


class TemplateInput(BaseModel):
    template_name: str = Field(min_length=2, max_length=180)
    version: str = Field(default="v1", max_length=40)
    body_template: str = Field(min_length=1, max_length=50000)
    footer_template: str | None = Field(
        default=None,
        max_length=10000,
    )
    is_active: bool = True



def _service_key_for_domain(domain: ServiceDomain) -> str:
    return slugify(domain.name).replace("-", "_").upper()


def _ensure_backing_service(
    *,
    domain: ServiceDomain,
    db: Session,
) -> Service:
    """
    Keep the internal Service row that the existing request/template
    architecture uses, while the admin UI treats the Domain itself as
    the configurable university service.
    """

    service_key = _service_key_for_domain(domain)

    service = (
        db.query(Service)
        .filter(
            Service.domain_id == domain.id,
        )
        .first()
    )

    if service:
        service.name = service_key
        service.description = (
            domain.description.strip()
            if domain.description
            else domain.name.strip()
        )
        service.requires_approval = bool(
            domain.requires_approval
            if hasattr(domain, "requires_approval")
            else False
        )
        service.is_active = domain.is_active
        return service

    # Backward-compatible fallback for domains created before this
    # simplified catalog workflow existed.
    service = (
        db.query(Service)
        .filter(Service.name == service_key)
        .first()
    )

    if service:
        service.domain_id = domain.id
        service.description = (
            domain.description.strip()
            if domain.description
            else domain.name.strip()
        )
        service.requires_approval = getattr(
            domain,
            "requires_approval",
            False,
        )
        service.is_active = domain.is_active
        return service

    service = Service(
        name=service_key,
        description=(
            domain.description.strip()
            if domain.description
            else domain.name.strip()
        ),
        requires_approval=getattr(
            domain,
            "requires_approval",
            False,
        ),
        is_active=domain.is_active,
        domain_id=domain.id,
    )
    db.add(service)
    db.flush()
    return service


@router.get("/domains")
def get_domains(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_catalog_manager(current_user)

    domains = (
        db.query(ServiceDomain)
        .order_by(ServiceDomain.name.asc())
        .all()
    )

    changed = False
    response = []

    for domain in domains:
        # Existing databases can contain domains created before the
        # user-facing Service layer was simplified. Ensure every domain
        # has one backing Service used by requests/templates.
        service = _ensure_backing_service(
            domain=domain,
            db=db,
        )
        changed = True

        response.append(
            {
                "id": str(domain.id),
                "name": domain.name,
                "slug": domain.slug,
                "description": domain.description,
                "is_active": domain.is_active,
                "service_id": str(service.id),
                "requires_approval": service.requires_approval,
                "certificate_required": bool(
                    domain.certificate_required
                ),
                "template_configured": bool(
                    db.query(CertificateTemplate)
                    .filter(
                        CertificateTemplate.service_id == service.id,
                        CertificateTemplate.is_active.is_(True),
                    )
                    .first()
                ),
            }
        )

    if changed:
        db.commit()

    return response


@router.post(
    "/domains",
    status_code=status.HTTP_201_CREATED,
)
def create_domain(
    payload: DomainCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_catalog_manager(current_user)

    slug = slugify(payload.slug or payload.name)
    clean_name = payload.name.strip()
    clean_description = (
        payload.description.strip()
        if payload.description
        else None
    )

    if db.query(ServiceDomain).filter(
        ServiceDomain.name == clean_name
    ).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A domain with this name already exists.",
        )

    if db.query(ServiceDomain).filter(
        ServiceDomain.slug == slug
    ).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A domain with this slug already exists.",
        )

    domain = ServiceDomain(
        name=clean_name,
        slug=slug,
        description=clean_description,
        is_active=True,
        certificate_required=payload.certificate_required,
    )
    db.add(domain)
    db.flush()

    # The domain is the user-facing configuration. Create its hidden
    # backing Service so the existing request/template architecture
    # remains unchanged.
    service = Service(
        name=slugify(clean_name).replace("-", "_").upper(),
        description=clean_description or clean_name,
        requires_approval=payload.requires_approval,
        is_active=True,
        domain_id=domain.id,
    )
    db.add(service)

    db.commit()
    db.refresh(domain)
    db.refresh(service)

    return {
        "id": str(domain.id),
        "name": domain.name,
        "slug": domain.slug,
        "description": domain.description,
        "is_active": domain.is_active,
        "service_id": str(service.id),
        "requires_approval": service.requires_approval,
        "certificate_required": bool(domain.certificate_required),
        "template_configured": False,
    }


@router.patch("/domains/{domain_id}")
def update_domain(
    domain_id: UUID,
    payload: DomainUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_catalog_manager(current_user)

    domain = (
        db.query(ServiceDomain)
        .filter(ServiceDomain.id == domain_id)
        .first()
    )

    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found.",
        )

    clean_name = payload.name.strip()
    clean_description = (
        payload.description.strip()
        if payload.description
        else None
    )
    slug = slugify(payload.slug or clean_name)

    duplicate_name = (
        db.query(ServiceDomain)
        .filter(
            ServiceDomain.name == clean_name,
            ServiceDomain.id != domain_id,
        )
        .first()
    )
    if duplicate_name:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A domain with this name already exists.",
        )

    duplicate_slug = (
        db.query(ServiceDomain)
        .filter(
            ServiceDomain.slug == slug,
            ServiceDomain.id != domain_id,
        )
        .first()
    )
    if duplicate_slug:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A domain with this slug already exists.",
        )

    domain.name = clean_name
    domain.slug = slug
    domain.description = clean_description
    domain.is_active = payload.is_active
    domain.certificate_required = payload.certificate_required

    service = _ensure_backing_service(
        domain=domain,
        db=db,
    )
    service.name = slugify(clean_name).replace("-", "_").upper()
    service.description = clean_description or clean_name
    service.requires_approval = payload.requires_approval
    service.is_active = payload.is_active

    db.commit()
    db.refresh(domain)
    db.refresh(service)

    return {
        "id": str(domain.id),
        "name": domain.name,
        "slug": domain.slug,
        "description": domain.description,
        "is_active": domain.is_active,
        "service_id": str(service.id),
        "requires_approval": service.requires_approval,
        "certificate_required": bool(domain.certificate_required),
        "template_configured": bool(
            db.query(CertificateTemplate)
            .filter(
                CertificateTemplate.service_id == service.id,
                CertificateTemplate.is_active.is_(True),
            )
            .first()
        ),
    }


@router.post(
    "/services",
    status_code=status.HTTP_201_CREATED,
)
def create_service(
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_catalog_manager(current_user)

    domain = (
        db.query(ServiceDomain)
        .filter(ServiceDomain.id == payload.domain_id)
        .first()
    )

    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found.",
        )

    service_key = slugify(payload.name).replace("-", "_").upper()

    if db.query(Service).filter(
        Service.name == service_key
    ).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A service with this name already exists.",
        )

    service = Service(
        name=service_key,
        description=payload.description.strip(),
        requires_approval=payload.requires_approval,
        is_active=True,
        domain_id=domain.id,
    )

    db.add(service)
    db.commit()
    db.refresh(service)

    return {
        "id": str(service.id),
        "name": service.name,
        "description": service.description,
        "domain_id": str(domain.id),
        "domain_name": domain.name,
        "requires_approval": service.requires_approval,
        "is_active": service.is_active,
    }


@router.patch("/services/{service_id}")
def update_service(
    service_id: UUID,
    payload: ServiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_catalog_manager(current_user)

    service = (
        db.query(Service)
        .filter(Service.id == service_id)
        .first()
    )

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found.",
        )

    domain = (
        db.query(ServiceDomain)
        .filter(ServiceDomain.id == payload.domain_id)
        .first()
    )

    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found.",
        )

    service.name = slugify(payload.name).replace(
        "-",
        "_",
    ).upper()
    service.description = payload.description.strip()
    service.domain_id = domain.id
    service.requires_approval = payload.requires_approval
    service.is_active = payload.is_active

    db.commit()
    db.refresh(service)

    return {
        "id": str(service.id),
        "name": service.name,
        "description": service.description,
        "domain_id": str(domain.id),
        "domain_name": domain.name,
        "requires_approval": service.requires_approval,
        "is_active": service.is_active,
    }


@router.get("/services/{service_id}/fields")
def get_service_fields(
    service_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_catalog_manager(current_user)

    fields = (
        db.query(ServiceFieldDefinition)
        .filter(
            ServiceFieldDefinition.service_id == service_id,
        )
        .order_by(ServiceFieldDefinition.sort_order.asc())
        .all()
    )

    return [
        {
            "id": str(field.id),
            "field_key": field.field_key,
            "label": field.label,
            "field_type": field.field_type,
            "placeholder": field.placeholder,
            "help_text": field.help_text,
            "is_required": field.is_required,
            "is_student_editable": field.is_student_editable,
            "sort_order": field.sort_order,
            "options": (
                json.loads(field.options_json)
                if field.options_json
                else []
            ),
            "is_active": field.is_active,
        }
        for field in fields
    ]


@router.post(
    "/services/{service_id}/fields",
    status_code=status.HTTP_201_CREATED,
)
def create_service_field(
    service_id: UUID,
    payload: FieldInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_catalog_manager(current_user)

    if not db.query(Service).filter(
        Service.id == service_id
    ).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found.",
        )

    if db.query(ServiceFieldDefinition).filter(
        ServiceFieldDefinition.service_id == service_id,
        ServiceFieldDefinition.field_key == payload.field_key,
    ).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This field key already exists for the service.",
        )

    field = ServiceFieldDefinition(
        service_id=service_id,
        field_key=payload.field_key.strip(),
        label=payload.label.strip(),
        field_type=payload.field_type.upper(),
        placeholder=payload.placeholder,
        help_text=payload.help_text,
        is_required=payload.is_required,
        is_student_editable=payload.is_student_editable,
        sort_order=payload.sort_order,
        options_json=json.dumps(payload.options or []),
        is_active=True,
    )

    db.add(field)
    db.commit()
    db.refresh(field)

    return {
        "id": str(field.id),
        "field_key": field.field_key,
        "label": field.label,
        "field_type": field.field_type,
        "placeholder": field.placeholder,
        "help_text": field.help_text,
        "is_required": field.is_required,
        "is_student_editable": field.is_student_editable,
        "sort_order": field.sort_order,
        "options": payload.options or [],
        "is_active": field.is_active,
    }


@router.patch("/fields/{field_id}")
def update_service_field(
    field_id: UUID,
    payload: FieldInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_catalog_manager(current_user)

    field = (
        db.query(ServiceFieldDefinition)
        .filter(ServiceFieldDefinition.id == field_id)
        .first()
    )

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service field not found.",
        )

    field.field_key = payload.field_key.strip()
    field.label = payload.label.strip()
    field.field_type = payload.field_type.upper()
    field.placeholder = payload.placeholder
    field.help_text = payload.help_text
    field.is_required = payload.is_required
    field.is_student_editable = payload.is_student_editable
    field.sort_order = payload.sort_order
    field.options_json = json.dumps(payload.options or [])

    db.commit()
    db.refresh(field)

    return {
        "id": str(field.id),
        "field_key": field.field_key,
        "label": field.label,
        "field_type": field.field_type,
        "placeholder": field.placeholder,
        "help_text": field.help_text,
        "is_required": field.is_required,
        "is_student_editable": field.is_student_editable,
        "sort_order": field.sort_order,
        "options": payload.options or [],
        "is_active": field.is_active,
    }


@router.get("/services/{service_id}/template")
def get_certificate_template(
    service_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_catalog_manager(current_user)

    template = (
        db.query(CertificateTemplate)
        .filter(
            CertificateTemplate.service_id == service_id,
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate template not configured.",
        )

    validation = None
    if template.body_template:
        try:
            parsed = json.loads(template.body_template)
            if isinstance(parsed, dict) and "placeholders" in parsed:
                validation = parsed
        except (TypeError, json.JSONDecodeError):
            pass

    return {
        "id": str(template.id),
        "service_id": str(template.service_id),
        "template_name": template.template_name,
        "version": template.version,
        "body_template": template.body_template,
        "footer_template": template.footer_template,
        "template_type": getattr(template, "template_type", None),
        "storage_path": getattr(template, "storage_path", None),
        "original_file_name": getattr(template, "original_file_name", None),
        "mime_type": getattr(template, "mime_type", None),
        "validation": validation,
        "is_active": template.is_active,
    }


@router.post(
    "/services/{service_id}/template/upload",
    status_code=status.HTTP_201_CREATED,
)
async def upload_certificate_template(
    service_id: UUID,
    template_name: str = Form(...),
    version: str = Form(default="v1"),
    is_active: bool = Form(default=True),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_catalog_manager(current_user)

    service = (
        db.query(Service)
        .filter(Service.id == service_id)
        .first()
    )

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found.",
        )

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select a DOCX template.",
        )

    filename = file.filename.strip()

    if not filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .docx certificate templates are supported.",
        )

    if file.content_type not in {
        DOCX_MIME,
        "application/octet-stream",
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file must be a DOCX document.",
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded DOCX file is empty.",
        )

    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Certificate templates must be 10 MB or smaller.",
        )

    service_fields = (
        db.query(ServiceFieldDefinition)
        .filter(
            ServiceFieldDefinition.service_id == service_id,
            ServiceFieldDefinition.is_active.is_(True),
        )
        .order_by(
            ServiceFieldDefinition.sort_order.asc(),
            ServiceFieldDefinition.id.asc(),
        )
        .all()
    )

    validation = validate_docx_template(
        file_bytes=file_bytes,
        configured_field_keys=[
            field.field_key
            for field in service_fields
        ],
        required_field_keys=[
            field.field_key
            for field in service_fields
            if field.is_required
        ],
    )

    if not validation.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": (
                    "The DOCX template contains placeholders "
                    "that do not match the service configuration."
                ),
                "unknown_placeholders": validation.unknown_placeholders,
                "missing_required_fields": validation.missing_required_fields,
                "placeholders_found": validation.placeholders,
                "duplicate_placeholders": validation.duplicate_placeholders,
            },
        )

    clean_version = version.strip() or "v1"
    storage_path = (
        f"templates/{service.id}/{clean_version}/template.docx"
    )

    try:
        upload_docx_template(
            storage_path=storage_path,
            file_bytes=file_bytes,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    validation_snapshot = {
        "placeholders": validation.placeholders,
        "known_placeholders": validation.known_placeholders,
        "duplicate_placeholders": validation.duplicate_placeholders,
    }

    template = (
        db.query(CertificateTemplate)
        .filter(CertificateTemplate.service_id == service_id)
        .first()
    )

    if template:
        template.template_name = template_name.strip()
        template.version = clean_version
        template.body_template = json.dumps(
            validation_snapshot,
            ensure_ascii=False,
        )
        template.footer_template = None
        template.template_type = "DOCX"
        template.storage_path = storage_path
        template.mime_type = DOCX_MIME
        template.original_file_name = filename
        template.is_active = is_active
        template.updated_by = current_user.id
    else:
        template = CertificateTemplate(
            service_id=service_id,
            template_name=template_name.strip(),
            version=clean_version,
            body_template=json.dumps(
                validation_snapshot,
                ensure_ascii=False,
            ),
            footer_template=None,
            template_type="DOCX",
            storage_path=storage_path,
            mime_type=DOCX_MIME,
            original_file_name=filename,
            is_active=is_active,
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        db.add(template)

    db.commit()
    db.refresh(template)

    return {
        "id": str(template.id),
        "service_id": str(template.service_id),
        "template_name": template.template_name,
        "version": template.version,
        "template_type": template.template_type,
        "storage_path": template.storage_path,
        "original_file_name": template.original_file_name,
        "mime_type": template.mime_type,
        "validation": validation_snapshot,
        "is_active": template.is_active,
    }


@router.put("/services/{service_id}/template")
def upsert_certificate_template(
    service_id: UUID,
    payload: TemplateInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_catalog_manager(current_user)

    service = (
        db.query(Service)
        .filter(Service.id == service_id)
        .first()
    )

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found.",
        )

    template = (
        db.query(CertificateTemplate)
        .filter(
            CertificateTemplate.service_id == service_id,
        )
        .first()
    )

    if template:
        template.template_name = payload.template_name.strip()
        template.version = payload.version.strip()
        template.body_template = payload.body_template
        template.footer_template = payload.footer_template
        template.is_active = payload.is_active
        template.updated_by = current_user.id
    else:
        template = CertificateTemplate(
            service_id=service_id,
            template_name=payload.template_name.strip(),
            version=payload.version.strip(),
            body_template=payload.body_template,
            footer_template=payload.footer_template,
            is_active=payload.is_active,
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        db.add(template)

    db.commit()
    db.refresh(template)

    return {
        "id": str(template.id),
        "service_id": str(template.service_id),
        "template_name": template.template_name,
        "version": template.version,
        "body_template": template.body_template,
        "footer_template": template.footer_template,
        "is_active": template.is_active,
    }
@router.get("/services")
def get_services(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_catalog_manager(current_user)

    services = (
        db.query(Service, ServiceDomain)
        .join(
            ServiceDomain,
            Service.domain_id == ServiceDomain.id,
            isouter=True,
        )
        .order_by(
            ServiceDomain.name.asc(),
            Service.name.asc(),
        )
        .all()
    )

    return [
        {
            "id": str(service.id),
            "name": service.name,
            "description": service.description,
            "domain_id": (
                str(service.domain_id)
                if service.domain_id
                else None
            ),
            "domain_name": (
                domain.name
                if domain
                else "Uncategorized"
            ),
            "requires_approval": service.requires_approval,
            "is_active": service.is_active,
        }
        for service, domain in services
    ]