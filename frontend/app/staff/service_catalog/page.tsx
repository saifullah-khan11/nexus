"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  FileText,
  LayoutDashboard,
  LogOut,
  Pencil,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  

type Domain = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  service_id: string;
  requires_approval: boolean;
  certificate_required: boolean;
  template_configured?: boolean;
};

type Service = {
  id: string;
  name: string;
  description: string;
  domain_id: string;
  domain_name: string;
  requires_approval: boolean;
  is_active: boolean;
};

type ServiceField = {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  placeholder: string | null;
  help_text: string | null;
  is_required: boolean;
  is_student_editable: boolean;
  sort_order: number;
  options: string[];
  is_active: boolean;
};

type Template = {
  id: string;
  service_id: string;
  template_name: string;
  version: string;
  body_template: string;
  footer_template: string | null;
  template_type?: string;
  storage_path?: string | null;
  original_file_name?: string | null;
  is_active: boolean;
  validation?: {
    placeholders?: string[];
    known_placeholders?: string[];
    unknown_placeholders?: string[];
    missing_required_fields?: string[];
    duplicate_placeholders?: string[];
  };
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function apiRequest<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (response.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    throw new Error("SESSION_EXPIRED");
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        "Unable to complete the requested action.",
    );
  }

  return data as T;
}

export default function ServiceCatalogPage() {
  const router = useRouter();

  const [role, setRole] = useState("STAFF");

  const [domains, setDomains] = useState<Domain[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(
    null,
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );

  const [fields, setFields] = useState<ServiceField[]>([]);
  const [template, setTemplate] = useState<Template | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showDomainForm, setShowDomainForm] = useState(false);
  const [showFieldForm, setShowFieldForm] = useState(false);

  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingField, setEditingField] = useState<ServiceField | null>(null);

  const [domainName, setDomainName] = useState("");
  const [domainDescription, setDomainDescription] = useState("");
  const [domainRequiresApproval, setDomainRequiresApproval] =
    useState(true);
  const [domainCertificateRequired, setDomainCertificateRequired] =
    useState(false);

  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceRequiresApproval, setServiceRequiresApproval] =
    useState(true);

  const [fieldKey, setFieldKey] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState("TEXT");
  const [fieldPlaceholder, setFieldPlaceholder] = useState("");
  const [fieldHelp, setFieldHelp] = useState("");
  const [fieldRequired, setFieldRequired] = useState(true);
  const [fieldStudentEditable, setFieldStudentEditable] = useState(true);
  const [fieldOptions, setFieldOptions] = useState("");

  const [templateName, setTemplateName] = useState("");
  const [templateVersion, setTemplateVersion] = useState("v1");
  const [templateBody, setTemplateBody] = useState("");
  const [templateFooter, setTemplateFooter] = useState("");
  const [templateActive, setTemplateActive] = useState(true);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [templateUploadInputKey, setTemplateUploadInputKey] = useState(0);

  const selectedDomain = useMemo(
    () => domains.find((item) => item.id === selectedDomainId) ?? null,
    [domains, selectedDomainId],
  );

  const selectedService = useMemo(
    () =>
      selectedDomain?.service_id
        ? services.find((item) => item.id === selectedDomain.service_id) ?? null
        : null,
    [services, selectedDomain],
  );

  async function loadCatalog() {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [domainData, serviceData] = await Promise.all([
        apiRequest<Domain[]>("/api/admin/catalog/domains", token),
        apiRequest<Service[]>("/api/admin/catalog/services", token),
      ]);

      setDomains(Array.isArray(domainData) ? domainData : []);
      setServices(Array.isArray(serviceData) ? serviceData : []);

      if (
        selectedDomainId &&
        !domainData.some((domain) => domain.id === selectedDomainId)
      ) {
        setSelectedDomainId(domainData[0]?.id ?? null);
      } else if (!selectedDomainId) {
        setSelectedDomainId(domainData[0]?.id ?? null);
      }

      const activeDomain =
        domainData.find((domain) => domain.id === selectedDomainId) ??
        domainData[0] ??
        null;

      setSelectedServiceId(activeDomain?.service_id ?? null);
    } catch (err) {
      if (err instanceof Error && err.message === "SESSION_EXPIRED") {
        router.replace("/login");
        return;
      }

      setError(
        err instanceof Error ? err.message : "Unable to load service catalog.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadServiceDetails(serviceId: string) {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      setDetailsLoading(true);
      setError("");

      const [fieldData, templateData] = await Promise.all([
        apiRequest<ServiceField[]>(
          `/api/admin/catalog/services/${serviceId}/fields`,
          token,
        ),
        apiRequest<Template>(
          `/api/admin/catalog/services/${serviceId}/template`,
          token,
        ).catch(() => null),
      ]);

      setFields(Array.isArray(fieldData) ? fieldData : []);

      if (templateData) {
        setTemplate(templateData);
        setTemplateName(templateData.template_name);
        setTemplateVersion(templateData.version);
        setTemplateBody(
          templateData.template_type === "DOCX"
            ? ""
            : templateData.body_template || "",
        );
        setTemplateFooter(templateData.footer_template || "");
        setTemplateActive(templateData.is_active);
      } else {
        setTemplate(null);
        setTemplateName("");
        setTemplateVersion("v1");
        setTemplateBody("");
        setTemplateFooter("");
        setTemplateActive(true);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load service configuration.",
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  useEffect(() => {
    const storedRole = localStorage.getItem("user_role");
    setRole(storedRole || "STAFF");

    if (storedRole !== "ADMIN" && storedRole !== "STAFF") {
      router.replace("/");
      return;
    }

    void loadCatalog();
    // Intentionally only load once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedServiceId) {
      setFields([]);
      setTemplate(null);
      return;
    }

    void loadServiceDetails(selectedServiceId);
  }, [selectedServiceId]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function startCreateDomain() {
    clearMessages();
    setEditingDomain(null);
    setDomainName("");
    setDomainDescription("");
    setShowDomainForm(true);
  }

  function startEditDomain(domain: Domain) {
    clearMessages();
    setEditingDomain(domain);
    setDomainName(domain.name);
    setDomainDescription(domain.description || "");
    setShowDomainForm(true);
  }

  function resetFieldForm() {
    setEditingField(null);
    setFieldKey("");
    setFieldLabel("");
    setFieldType("TEXT");
    setFieldPlaceholder("");
    setFieldHelp("");
    setFieldRequired(true);
    setFieldStudentEditable(true);
    setFieldOptions("");
  }

  function startCreateField() {
    if (!selectedServiceId) {
      setError("Select a service first.");
      return;
    }

    clearMessages();
    resetFieldForm();
    setShowFieldForm(true);
  }

  function startEditField(field: ServiceField) {
    clearMessages();
    setEditingField(field);
    setFieldKey(field.field_key);
    setFieldLabel(field.label);
    setFieldType(field.field_type);
    setFieldPlaceholder(field.placeholder || "");
    setFieldHelp(field.help_text || "");
    setFieldRequired(field.is_required);
    setFieldStudentEditable(field.is_student_editable);
    setFieldOptions(field.options.join(", "));
    setShowFieldForm(true);
  }

  async function saveDomain(event: FormEvent) {
    event.preventDefault();

    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      if (!domainName.trim()) {
        throw new Error("Service name is required.");
      }

      const payload = {
        name: domainName.trim(),
        slug: slugify(domainName),
        description: domainDescription.trim() || null,
        requires_approval: domainRequiresApproval,
        certificate_required: domainCertificateRequired,
        ...(editingDomain
          ? { is_active: editingDomain.is_active }
          : {}),
      };

      const result = await apiRequest<Domain>(
        editingDomain
          ? `/api/admin/catalog/domains/${editingDomain.id}`
          : "/api/admin/catalog/domains",
        token,
        {
          method: editingDomain ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );

      setShowDomainForm(false);
      setSuccess(
        editingDomain
          ? "Service configuration updated successfully."
          : "Service added successfully.",
      );

      setSelectedDomainId(result.id);
      setSelectedServiceId(result.service_id);
      await loadCatalog();
    } catch (err) {
      if (err instanceof Error && err.message === "SESSION_EXPIRED") {
        router.replace("/login");
        return;
      }
      setError(
        err instanceof Error ? err.message : "Unable to save service.",
      );
    } finally {
      setSaving(false);
    }
  }

  // Service rows remain an internal implementation detail.
  // The admin UI now configures the domain directly.
  async function saveField(event: FormEvent) {
    event.preventDefault();

    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    if (!selectedServiceId) {
      setError("Select a service first.");
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      const options = fieldOptions
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const payload = {
        field_key: fieldKey.trim(),
        label: fieldLabel.trim(),
        field_type: fieldType,
        placeholder: fieldPlaceholder.trim() || null,
        help_text: fieldHelp.trim() || null,
        is_required: fieldRequired,
        is_student_editable: fieldStudentEditable,
        sort_order: editingField?.sort_order ?? fields.length,
        options,
      };

      if (!payload.field_key || !payload.label) {
        throw new Error("Field key and label are required.");
      }

      if (editingField) {
        await apiRequest(
          `/api/admin/catalog/fields/${editingField.id}`,
          token,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
      } else {
        await apiRequest(
          `/api/admin/catalog/services/${selectedServiceId}/fields`,
          token,
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
      }

      setShowFieldForm(false);
      resetFieldForm();
      setSuccess(
        editingField
          ? "Field updated successfully."
          : "Field added successfully.",
      );
      await loadServiceDetails(selectedServiceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save field.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocxTemplate() {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    if (!selectedServiceId) {
      setError("Select a service first.");
      return;
    }

    if (!templateFile) {
      setError("Select a DOCX template first.");
      return;
    }

    if (!templateFile.name.toLowerCase().endsWith(".docx")) {
      setError("Only .docx certificate templates are supported.");
      return;
    }

    if (templateFile.size > 10 * 1024 * 1024) {
      setError("Certificate templates must be 10 MB or smaller.");
      return;
    }

    try {
      setUploadingTemplate(true);
      clearMessages();

      const formData = new FormData();
      formData.append(
        "template_name",
        templateName.trim() || templateFile.name.replace(/\.docx$/i, ""),
      );
      formData.append(
        "version",
        templateVersion.trim() || "v1",
      );
      formData.append(
        "is_active",
        String(templateActive),
      );
      formData.append("file", templateFile);

      const response = await fetch(
        `${API_URL}/api/admin/catalog/services/${selectedServiceId}/template/upload`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: formData,
          cache: "no-store",
        },
      );

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        const detail = data?.detail;
        if (detail && typeof detail === "object") {
          const unknown = Array.isArray(detail.unknown_placeholders)
            ? detail.unknown_placeholders
            : [];
          const missing = Array.isArray(detail.missing_required_fields)
            ? detail.missing_required_fields
            : [];

          const parts: string[] = [];
          if (unknown.length) {
            parts.push(`Unknown placeholders: ${unknown.join(", ")}`);
          }
          if (missing.length) {
            parts.push(`Missing required fields: ${missing.join(", ")}`);
          }
          throw new Error(
            parts.length
              ? parts.join(" | ")
              : detail.message || "Template validation failed.",
          );
        }

        throw new Error(
          detail || data?.message || "Unable to upload certificate template.",
        );
      }

      const uploaded = data as Template;
      setTemplate(uploaded);
      setTemplateName(uploaded.template_name || templateName);
      setTemplateVersion(uploaded.version || templateVersion);
      setTemplateActive(uploaded.is_active);
      setTemplateFile(null);
      setTemplateUploadInputKey((value) => value + 1);

      const placeholders = uploaded.validation?.placeholders || [];
      setSuccess(
        placeholders.length
          ? `Template uploaded and validated successfully. ${placeholders.length} placeholder${placeholders.length === 1 ? "" : "s"} detected.`
          : "Template uploaded and validated successfully.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload certificate template.",
      );
    } finally {
      setUploadingTemplate(false);
    }
  }

  async function saveTemplate(event: FormEvent) {
    event.preventDefault();

    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    if (!selectedServiceId) {
      setError("Select a service first.");
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      if (!templateName.trim()) {
        throw new Error("Template name is required.");
      }

      if (template?.template_type === "DOCX") {
        throw new Error(
          "This service uses a DOCX template. Replace it using the DOCX upload above.",
        );
      }

      if (!templateBody.trim()) {
        throw new Error("Template body is required.");
      }

      await apiRequest(
        `/api/admin/catalog/services/${selectedServiceId}/template`,
        token,
        {
          method: "PUT",
          body: JSON.stringify({
            template_name: templateName.trim(),
            version: templateVersion.trim() || "v1",
            body_template: templateBody,
            footer_template: templateFooter.trim() || null,
            is_active: templateActive,
          }),
        },
      );

      setSuccess("Certificate template saved successfully.");
      await loadServiceDetails(selectedServiceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save template.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div>
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07090d]/88 backdrop-blur-xl">
          <div className="flex h-[72px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/staff")}
                className="hidden items-center gap-2 rounded-xl border border-white/[0.07] px-3 py-2 text-xs text-white/45 transition hover:bg-white/[0.04] hover:text-white sm:inline-flex"
              >
                <ArrowLeft size={14} />
                Staff Dashboard
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold text-white/75">
                  NEXUS {role === "ADMIN" ? "Admin" : "Staff"}
                </p>
                <p className="text-[9px] uppercase tracking-[0.16em] text-cyan-200/35">
                  Service Catalog
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
                <ShieldCheck size={17} />
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1250px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          <section className="mb-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/45">
                  <SlidersHorizontal size={13} />
                  Service Catalog
                </div>

                <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  Services & Certificates
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/38">
                  Create university services, define request fields, and maintain DOCX
                  certificate templates without changing application code.
                </p>
              </div>

              <button
                type="button"
                onClick={startCreateDomain}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 px-4 text-sm font-semibold text-black shadow-lg shadow-cyan-500/10 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-500/15"
              >
                <Plus size={16} />
                Add domain
              </button>
            </div>
          </section>

          {error && (
            <div className="mb-5 flex items-start justify-between gap-3 rounded-2xl border border-rose-300/15 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                className="text-rose-200/60 hover:text-rose-100"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {success && (
            <div className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] px-4 py-3 text-sm text-emerald-200">
              <Check size={16} />
              {success}
            </div>
          )}

          {loading ? (
            <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-8 text-center text-sm text-white/35">
              Loading service catalog...
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
              <section className="rounded-[24px] border border-white/[0.07] bg-white/[0.018] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white/70">
                      Domains
                    </p>
                    <p className="mt-1 text-[10px] text-white/25">
                      {domains.length} configured
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startCreateDomain}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-white/50 transition hover:bg-white/[0.04] hover:text-white"
                    aria-label="Add domain"
                  >
                    <Plus size={15} />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {domains.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/[0.08] p-4 text-xs leading-5 text-white/30">
                      No domains yet. Create the first service domain.
                    </div>
                  ) : (
                    domains.map((domain) => (
                      <button
                        key={domain.id}
                        type="button"
                        onClick={() => {
                          setSelectedDomainId(domain.id);
                          setSelectedServiceId(null);
                          setFields([]);
                          setTemplate(null);
                        }}
                        className={`group flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition ${
                          selectedDomainId === domain.id
                            ? "border border-cyan-300/10 bg-cyan-300/[0.06] text-white"
                            : "border border-transparent text-white/48 hover:bg-white/[0.035] hover:text-white"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">
                            {domain.name}
                          </p>
                          <p className="mt-1 truncate text-[10px] text-white/25">
                            {domain.certificate_required
                              ? "Certificate service"
                              : "University service"}
                          </p>
                        </div>

                        <ChevronRight
                          size={15}
                          className="shrink-0 text-white/20 group-hover:text-white/50"
                        />
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section className="min-w-0 rounded-[24px] border border-white/[0.07] bg-white/[0.018] p-4 sm:p-5">
                {!selectedDomain ? (
                  <div className="flex min-h-[420px] items-center justify-center text-center">
                    <div className="max-w-sm">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.05] text-cyan-200/70">
                        <SlidersHorizontal size={21} />
                      </div>
                      <h2 className="mt-4 text-lg font-semibold">
                        Select a domain
                      </h2>
                      <p className="mt-2 text-xs leading-5 text-white/28">
                        Choose a service from the left to manage its request fields and certificate.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-cyan-200/40">
                          <FileCheck2 size={13} />
                          Domain
                        </div>
                        <h2 className="mt-2 truncate text-xl font-bold">
                          {selectedDomain.name}
                        </h2>
                        {selectedDomain.description && (
                          <p className="mt-2 max-w-2xl text-xs leading-5 text-white/30">
                            {selectedDomain.description}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => startEditDomain(selectedDomain)}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.07] px-3 text-xs font-medium text-white/50 transition hover:bg-white/[0.04] hover:text-white"
                      >
                        <Pencil size={14} />
                        Edit domain
                      </button>
                    </div>

                    <div className="mt-5">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
                          <p className="text-[9px] uppercase tracking-[0.16em] text-white/25">
                            Approval
                          </p>
                          <p className="mt-2 text-sm font-semibold text-white/80">
                            {selectedDomain.requires_approval
                              ? "Required"
                              : "Not required"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
                          <p className="text-[9px] uppercase tracking-[0.16em] text-white/25">
                            Certificate
                          </p>
                          <p className="mt-2 text-sm font-semibold text-white/80">
                            {selectedDomain.certificate_required
                              ? "Required"
                              : "Not required"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
                          <p className="text-[9px] uppercase tracking-[0.16em] text-white/25">
                            Template
                          </p>
                          <p className="mt-2 text-sm font-semibold text-white/80">
                            {selectedDomain.template_configured
                              ? "Configured"
                              : "Not configured"}
                          </p>
                        </div>
                      </div>

                      {!selectedDomain.certificate_required && (
                        <div className="mt-5 rounded-2xl border border-amber-300/10 bg-amber-300/[0.04] p-4">
                          <p className="text-xs font-semibold text-amber-100/75">
                            No certificate is required for this service.
                          </p>
                          <p className="mt-1 text-[10px] leading-5 text-amber-100/40">
                            You can still define request fields below. The DOCX
                            template uploader appears when Certificate required
                            is enabled in the configuration.
                          </p>
                        </div>
                      )}

                      {detailsLoading ? (
                        <div className="mt-6 rounded-xl border border-white/[0.06] p-5 text-center text-xs text-white/30">
                          Loading service configuration...
                        </div>
                      ) : (
                        <div className="mt-6 grid gap-5 xl:grid-cols-2">
                          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-semibold text-white/75">
                                  Request fields
                                </h4>
                                <p className="mt-1 text-[10px] leading-4 text-white/25">
                                  Define the information students must provide
                                  before this service can proceed.
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={startCreateField}
                                className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.07] px-2.5 text-[10px] font-semibold text-white/50 hover:bg-white/[0.04] hover:text-white"
                              >
                                <Plus size={13} />
                                Add field
                              </button>
                            </div>

                            <div className="mt-4 space-y-2">
                              {fields.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-white/[0.07] p-4 text-xs text-white/25">
                                  No fields configured yet.
                                </div>
                              ) : (
                                fields.map((field) => (
                                  <div
                                    key={field.id}
                                    className="rounded-xl border border-white/[0.06] bg-black/10 p-3"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="truncate text-xs font-semibold text-white/72">
                                          {field.label}
                                        </p>
                                        <p className="mt-1 break-all font-mono text-[9px] text-cyan-200/35">
                                          {field.field_key}
                                        </p>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => startEditField(field)}
                                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/30 hover:bg-white/5 hover:text-white"
                                        aria-label={`Edit ${field.label}`}
                                      >
                                        <Pencil size={13} />
                                      </button>
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                      <Tag label={field.field_type} />
                                      {field.is_required && (
                                        <Tag label="Required" />
                                      )}
                                      {field.is_student_editable && (
                                        <Tag label="Student editable" />
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
                            <div>
                              <h4 className="text-sm font-semibold text-white/75">
                                Certificate template
                              </h4>
                              <p className="mt-1 text-[10px] leading-4 text-white/25">
                                Upload the DOCX design used when this service
                                generates a certificate.
                              </p>
                            </div>

                            {selectedDomain.certificate_required ? (
                              <>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                  <FieldInput
                                    label="Template name"
                                    value={templateName}
                                    onChange={setTemplateName}
                                    placeholder="Transfer Certificate"
                                  />
                                  <FieldInput
                                    label="Version"
                                    value={templateVersion}
                                    onChange={setTemplateVersion}
                                    placeholder="v1"
                                  />
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] bg-black/10 px-3 py-2.5">
                                    <FileCheck2
                                      size={16}
                                      className="shrink-0 text-cyan-200/55"
                                    />
                                    <span className="min-w-0">
                                      <span className="block truncate text-xs text-white/65">
                                        {templateFile?.name ||
                                          template?.original_file_name ||
                                          "Choose DOCX template"}
                                      </span>
                                      <span className="mt-1 block text-[9px] text-white/20">
                                        .docx only • max 10 MB
                                      </span>
                                    </span>
                                    <input
                                      key={templateUploadInputKey}
                                      type="file"
                                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                      className="hidden"
                                      onChange={(event) =>
                                        setTemplateFile(
                                          event.target.files?.[0] || null,
                                        )
                                      }
                                    />
                                  </label>

                                  <button
                                    type="button"
                                    onClick={uploadDocxTemplate}
                                    disabled={
                                      !templateFile || uploadingTemplate
                                    }
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 px-4 text-xs font-semibold text-black shadow-lg shadow-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-45"
                                  >
                                    {uploadingTemplate
                                      ? "Validating..."
                                      : "Upload & validate"}
                                    <Check size={14} />
                                  </button>
                                </div>

                                {template && (
                                  <div className="mt-4 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.035] p-3">
                                    <div className="flex items-center gap-2">
                                      <Check
                                        size={14}
                                        className="text-emerald-300"
                                      />
                                      <p className="text-xs font-semibold text-emerald-100/75">
                                        {template.original_file_name ||
                                          template.template_name}
                                      </p>
                                    </div>

                                    {template.validation?.placeholders?.length ? (
                                      <p className="mt-2 text-[10px] leading-5 text-white/35">
                                        Placeholders:{" "}
                                        {template.validation.placeholders.join(
                                          ", ",
                                        )}
                                      </p>
                                    ) : null}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="mt-4 rounded-xl border border-dashed border-white/[0.07] p-4 text-xs leading-5 text-white/25">
                                Enable <span className="text-white/50">Certificate required</span>
                                in the domain configuration to upload a DOCX
                                certificate template.
                              </div>
                            )}

                            <form
                              onSubmit={saveTemplate}
                              className="mt-5 space-y-3"
                            >
                              <textarea
                                value={templateBody}
                                disabled
                                placeholder="Legacy text template is preserved for compatibility."
                                className="min-h-[100px] w-full resize-y rounded-xl border border-white/[0.07] bg-white/[0.012] px-3 py-3 font-mono text-[10px] leading-5 text-white/25 outline-none"
                              />
                              <p className="text-[9px] text-white/20">
                                DOCX templates are the active certificate
                                design. The older text-template editor remains
                                read-only here for compatibility.
                              </p>
                            </form>
                          </div>
                        </div>
                      )}
                    </div>

                  </>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      {showDomainForm && (
        <Modal
          title={editingDomain ? "Edit domain" : "Add domain"}
          description="Configure a university service, its approval policy, and certificate requirement."
          onClose={() => setShowDomainForm(false)}
        >
          <form onSubmit={saveDomain} className="space-y-4">
            <FieldInput
              label="Domain name"
              value={domainName}
              onChange={setDomainName}
              placeholder="Academic Certificates"
            />
            <div>
              <label className="mb-2 block text-xs font-medium text-white/50">
                Description
              </label>
              <textarea
                value={domainDescription}
                onChange={(event) => setDomainDescription(event.target.value)}
                placeholder="Describe what this service provides to students."
                className="min-h-[100px] w-full resize-y rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-xs text-white outline-none placeholder:text-white/18 focus:border-cyan-300/20"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle
                checked={domainRequiresApproval}
                onChange={setDomainRequiresApproval}
                label="Require staff approval"
              />
              <Toggle
                checked={domainCertificateRequired}
                onChange={setDomainCertificateRequired}
                label="Certificate required"
              />
            </div>

            <p className="text-[10px] leading-4 text-white/25">
              This domain now represents the university service directly.
              Request fields and the DOCX certificate template are configured
              after saving.
            </p>

            <ModalActions
              loading={saving}
              submitLabel={editingDomain ? "Save changes" : "Create domain"}
              onCancel={() => setShowDomainForm(false)}
            />
          </form>
        </Modal>
      )}

      {showFieldForm && (
        <Modal
          title={editingField ? "Edit field" : "Add request field"}
          description="Define the information students must provide for this service."
          onClose={() => {
            setShowFieldForm(false);
            resetFieldForm();
          }}
        >
          <form onSubmit={saveField} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldInput
                label="Field key"
                value={fieldKey}
                onChange={setFieldKey}
                placeholder="reason_for_transfer"
              />
              <FieldInput
                label="Label"
                value={fieldLabel}
                onChange={setFieldLabel}
                placeholder="Reason for transfer"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-medium text-white/50">
                  Field type
                </label>
                <select
                  value={fieldType}
                  onChange={(event) => setFieldType(event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0b0e13] px-3 text-xs text-white outline-none focus:border-cyan-300/20"
                >
                  <option value="TEXT">Text</option>
                  <option value="TEXTAREA">Textarea</option>
                  <option value="DATE">Date</option>
                  <option value="NUMBER">Number</option>
                  <option value="SELECT">Dropdown</option>
                  <option value="EMAIL">Email</option>
                </select>
              </div>

              <FieldInput
                label="Placeholder"
                value={fieldPlaceholder}
                onChange={setFieldPlaceholder}
                placeholder="Enter value"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-white/50">
                Help text
              </label>
              <textarea
                value={fieldHelp}
                onChange={(event) => setFieldHelp(event.target.value)}
                placeholder="Explain what the student should enter."
                className="min-h-[80px] w-full resize-y rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-xs text-white outline-none placeholder:text-white/18 focus:border-cyan-300/20"
              />
            </div>

            <FieldInput
              label="Dropdown options"
              value={fieldOptions}
              onChange={setFieldOptions}
              placeholder="Option 1, Option 2, Option 3"
            />

            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle
                checked={fieldRequired}
                onChange={setFieldRequired}
                label="Required field"
              />
              <Toggle
                checked={fieldStudentEditable}
                onChange={setFieldStudentEditable}
                label="Student editable"
              />
            </div>

            <ModalActions
              loading={saving}
              submitLabel={editingField ? "Save field" : "Add field"}
              onCancel={() => {
                setShowFieldForm(false);
                resetFieldForm();
              }}
            />
          </form>
        </Modal>
      )}
    </main>
  );
}

function SidebarItem({
  icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
        active
          ? "border border-cyan-300/[0.08] bg-cyan-300/[0.055] text-cyan-100"
          : "text-white/45 hover:bg-white/[0.04] hover:text-white"
      }`}
    >
      <span className={active ? "text-cyan-200/80" : "text-white/35"}>
        {icon}
      </span>
      {label}
      {active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300" />
      )}
    </button>
  );
}

function InfoTile({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-2.5">
      <p className="text-[8px] uppercase tracking-[0.12em] text-white/20">
        {label}
      </p>
      <p className={`mt-1 text-[11px] font-semibold ${positive ? "text-emerald-200/75" : "text-white/60"}`}>
        {value}
      </p>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[8px] font-medium uppercase tracking-[0.08em] text-white/35">
      {label}
    </span>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-white/50">
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-xs text-white outline-none placeholder:text-white/18 focus:border-cyan-300/20"
      />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition ${
          checked ? "bg-cyan-300" : "bg-white/10"
        }`}
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
            checked ? "left-[18px]" : "left-0.5"
          }`}
        />
      </button>
      <span className="text-xs font-medium text-white/60">{label}</span>
    </label>
  );
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-5">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[26px] border border-white/[0.08] bg-[#0b0e13] p-5 shadow-2xl shadow-black/50 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-white/30">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-white/35 hover:bg-white/5 hover:text-white"
            aria-label="Close dialog"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  loading,
  submitLabel,
  onCancel,
}: {
  loading: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        className="h-10 rounded-xl border border-white/[0.07] px-4 text-xs font-medium text-white/45 hover:bg-white/[0.04] hover:text-white"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 px-4 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Saving..." : submitLabel}
        <Save size={14} />
      </button>
    </div>
  );
}
