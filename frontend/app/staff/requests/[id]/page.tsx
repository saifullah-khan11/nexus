"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  

type GeneratedDocument = {
  id: string;
  type: string;
  title: string;
  file_name: string;
  mime_type: string | null;
  download_url: string | null;
  view_url: string | null;
};

type RequestData = {
  id: string;
  service_name: string;
  status: string;
  priority: string;
  user_input: string;
  transaction_id: string | null;
  ai_confidence: number | null;
  risk_score: number | null;
  certificate_required: boolean;
  ready_for_completion: boolean;
  document: GeneratedDocument | null;
  created_at: string;
  updated_at: string;
};

type StaffRequest = RequestData & {
  user_id: string;
  student_name: string;
  student_email: string;
  service_id: string;
};

type AuditLog = {
  id: string;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  reason: string | null;
  created_at: string;
};

type ActionType =
  | "approve"
  | "process"
  | "evaluate"
  | "complete"
  | "reject"
  | "refresh"
  | null;

export default function StaffRequestDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params.id;

  const [request, setRequest] =
    useState<StaffRequest | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [action, setAction] =
    useState<ActionType>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function fetchDetails() {
    const token =
      localStorage.getItem("access_token");

    const role =
      localStorage.getItem("user_role");

    if (!token) {
      router.replace("/login");
      return;
    }

    if (
      role !== "STAFF" &&
      role !== "ADMIN"
    ) {
      router.replace("/");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      };

      const [requestResponse, auditResponse, queueResponse] =
        await Promise.all([
          fetch(
            `${API_URL}/api/requests/${requestId}`,
            {
              headers,
              cache: "no-store",
            }
          ),
          fetch(
            `${API_URL}/api/requests/${requestId}/audit-logs`,
            {
              headers,
              cache: "no-store",
            }
          ),
          fetch(
            `${API_URL}/api/requests/staff/all`,
            {
              headers,
              cache: "no-store",
            }
          ),
        ]);

      if (
        requestResponse.status === 401 ||
        auditResponse.status === 401 ||
        queueResponse.status === 401
      ) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.replace("/login");
        return;
      }

      if (
        requestResponse.status === 403 ||
        auditResponse.status === 403 ||
        queueResponse.status === 403
      ) {
        setError(
          "You do not have staff or administrator access."
        );
        return;
      }

      const requestData =
        await requestResponse.json();

      const auditData = await auditResponse.json();
      const queueData = await queueResponse.json();

      if (!requestResponse.ok) {
        throw new Error(
          requestData?.detail ||
            "Unable to load this request."
        );
      }

      if (!auditResponse.ok) {
        throw new Error(
          auditData?.detail ||
            "Unable to load the audit history."
        );
      }

      if (!queueResponse.ok) {
        throw new Error(
          queueData?.detail ||
            "Unable to load staff request information."
        );
      }

      const queueRequest = Array.isArray(queueData)
        ? queueData.find(
            (item: StaffRequest) =>
              item.id === requestId
          )
        : null;

      setRequest({
        ...requestData,
        ...(queueRequest
          ? {
              user_id: queueRequest.user_id,
              student_name:
                queueRequest.student_name,
              student_email:
                queueRequest.student_email,
              service_id: queueRequest.service_id,
            }
          : {
              user_id: "",
              student_name: "Student",
              student_email: "",
              service_id: "",
            }),
      });

      setAuditLogs(
        Array.isArray(auditData)
          ? auditData
          : []
      );
    } catch (err) {
      console.error(
        "STAFF REQUEST DETAILS ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load request details."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (requestId) {
      fetchDetails();
    }
  }, [requestId]);

  useEffect(() => {
    if (!request || !requestId) return;

    const activeStatuses = new Set([
      "APPROVAL_REQUIRED",
      "PENDING",
      "PROCESSING",
    ]);

    if (!activeStatuses.has(request.status)) return;

    const interval = window.setInterval(() => {
      fetchDetails();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [request?.status, requestId]);

  function formatServiceName(name: string) {
    return name
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  function formatStatus(status: string) {
    return status.replaceAll("_", " ");
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function statusStyle(status: string) {
    switch (status) {
      case "APPROVAL_REQUIRED":
        return "border-amber-400/20 bg-amber-400/10 text-amber-200";
      case "PENDING":
        return "border-white/[0.09] bg-white/[0.05] text-white/60";
      case "PROCESSING":
        return "border-cyan-400/20 bg-gradient-to-r from-cyan-400/10 to-violet-400/10 text-cyan-100";
      case "COMPLETED":
        return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
      case "REJECTED":
        return "border-rose-400/20 bg-rose-400/10 text-rose-200";
      default:
        return "border-white/[0.08] bg-white/[0.04] text-white/50";
    }
  }

  function getActionLabel(type: Exclude<ActionType, null>) {
    switch (type) {
      case "approve":
        return "Approve Request";
      case "process":
        return "Start Processing";
      case "evaluate":
        return "Evaluate Request";
      case "complete":
        return "Generate Certificate & Complete";
      case "reject":
        return "Reject Request";
    }
  }

  async function refreshDetails() {
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("user_role");

    if (!token) {
      router.replace("/login");
      return;
    }

    if (
      role !== "STAFF" &&
      role !== "ADMIN"
    ) {
      router.replace("/");
      return;
    }

    setAction("refresh");
    setError("");
    setSuccess("");

    try {
      await fetchDetails();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to refresh request."
      );
    } finally {
      setAction(null);
    }
  }

  async function performAction(
    type: Exclude<ActionType, "reject" | null>
  ) {
    const token =
      localStorage.getItem("access_token");
    const role =
      localStorage.getItem("user_role");

    if (!token) {
      router.replace("/login");
      return;
    }

    if (
      role !== "STAFF" &&
      role !== "ADMIN"
    ) {
      router.replace("/");
      return;
    }

    setAction(type);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/api/requests/${requestId}/${type}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            `Unable to ${type} this request.`
        );
      }

      setSuccess(
        data?.message ||
          `${getActionLabel(type)} completed successfully.`
      );

      await fetchDetails();
    } catch (err) {
      console.error(
        `REQUEST ${type.toUpperCase()} ERROR:`,
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "The request action failed."
      );
    } finally {
      setAction(null);
    }
  }

  async function rejectRequest() {
    const reason = rejectReason.trim();

    if (!reason) {
      setError(
        "Please provide a reason for rejecting this request."
      );
      return;
    }

    const token =
      localStorage.getItem("access_token");
    const role =
      localStorage.getItem("user_role");

    if (!token) {
      router.replace("/login");
      return;
    }

    if (
      role !== "STAFF" &&
      role !== "ADMIN"
    ) {
      router.replace("/");
      return;
    }

    setAction("reject");
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/api/requests/${requestId}/reject`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reason,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Unable to reject this request."
        );
      }

      setRejectOpen(false);
      setRejectReason("");

      setSuccess(
        data?.message ||
          "Request rejected successfully."
      );

      await fetchDetails();
    } catch (err) {
      console.error(
        "REQUEST REJECT ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to reject this request."
      );
    } finally {
      setAction(null);
    }
  }

  const availableAction = useMemo(() => {
    if (!request) return null;

    switch (request.status) {
      case "APPROVAL_REQUIRED":
        return "approve" as const;
      case "PENDING":
        return "process" as const;
      case "PROCESSING":
        return request.ready_for_completion
          ? "complete" as const
          : "evaluate" as const;
      default:
        return null;
    }
  }, [request]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090d] text-white">
        <div className="flex items-center gap-3 text-sm text-white/35">
          <Loader2
            size={18}
            className="animate-spin"
          />
          Loading request...
        </div>
      </main>
    );
  }

  if (error && !request) {
    return (
      <main className="min-h-screen bg-[#07090d] px-5 py-10 text-white">
        <div className="mx-auto max-w-[1050px]">
          <button
            onClick={() => router.push("/staff")}
            className="mb-8 flex items-center gap-2 text-sm text-white/40 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Staff Dashboard
          </button>

          <div className="rounded-2xl border border-rose-400/15 bg-rose-400/[0.06] p-6">
            <div className="flex items-start gap-3">
              <AlertCircle
                size={18}
                className="mt-0.5 text-rose-200"
              />
              <div>
                <p className="text-sm font-medium text-rose-100">
                  Unable to load request
                </p>
                <p className="mt-1 text-xs text-rose-200/55">
                  {error}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!request) return null;

  return (
    <main className="min-h-screen overflow-hidden bg-[#07090d] text-white">
      {/* Ambient gradients */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-cyan-400/[0.045] blur-[120px]" />
        <div className="absolute -right-40 top-[20%] h-[480px] w-[480px] rounded-full bg-violet-500/[0.045] blur-[130px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#07090d]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1100px] items-center justify-between px-5 sm:px-8">
          <button
            onClick={() => router.push("/staff")}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/45 transition hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft size={17} />
            Staff Dashboard
          </button>

          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white text-black">
              <div className="absolute -inset-6 animate-[spin_5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(34,211,238,0.9)_90deg,rgba(139,92,246,0.9)_210deg,transparent_320deg)] opacity-50" />
              <div className="relative flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#f7f8fa]">
                <Sparkles size={16} />
              </div>
            </div>

            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold">
                NEXUS
              </p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/25">
                Staff Workspace
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-[1100px] px-5 py-9 sm:px-8">
        {/* Breadcrumb / title */}
        <div className="mb-7">
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/40">
            Request Review
          </p>

          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {formatServiceName(
                  request.service_name
                )}
              </h1>

              <p className="mt-2 text-xs text-white/30">
                Request ID{" "}
                <span className="font-mono text-white/40">
                  {request.id}
                </span>
              </p>
              {(request.status === "APPROVAL_REQUIRED" ||
                request.status === "PENDING" ||
                request.status === "PROCESSING") && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-cyan-200/30">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300/70" />
                  Live status monitoring
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refreshDetails}
                disabled={action !== null}
                title="Refresh request"
                className="group relative overflow-hidden rounded-full p-[1px] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 opacity-60 transition group-hover:opacity-100" />
                <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#0b0e13] text-white/45 transition group-hover:text-cyan-100">
                  <RefreshCw
                    size={14}
                    className={
                      action === "refresh"
                        ? "animate-spin text-cyan-200"
                        : "transition-transform duration-500 group-hover:rotate-180"
                    }
                  />
                </span>
              </button>

              <span
                className={`w-fit rounded-full border px-3.5 py-2 text-[11px] font-medium ${statusStyle(
                  request.status
                )}`}
              >
                {formatStatus(request.status)}
              </span>
            </div>
          </div>
        </div>

        {/* Feedback */}
        {(error || success) && (
          <div
            className={`mb-5 rounded-2xl border p-4 ${
              error
                ? "border-rose-400/15 bg-rose-400/[0.055]"
                : "border-emerald-400/15 bg-emerald-400/[0.055]"
            }`}
          >
            <div className="flex items-start gap-3">
              {error ? (
                <AlertCircle
                  size={17}
                  className="mt-0.5 text-rose-200"
                />
              ) : (
                <CheckCircle2
                  size={17}
                  className="mt-0.5 text-emerald-200"
                />
              )}

              <p
                className={`text-xs leading-5 ${
                  error
                    ? "text-rose-200/70"
                    : "text-emerald-200/70"
                }`}
              >
                {error || success}
              </p>

              <button
                onClick={() => {
                  setError("");
                  setSuccess("");
                }}
                className="ml-auto text-white/25 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
          {/* Main information */}
          <div className="space-y-5">
            {/* Student */}
            <section className="rounded-[24px] border border-white/[0.07] bg-white/[0.018] p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/[0.12] bg-cyan-400/[0.045] text-cyan-200">
                  <UserRound size={17} />
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-[0.17em] text-white/25">
                    Student
                  </p>
                  <h2 className="mt-1 text-sm font-medium">
                    {request.student_name}
                  </h2>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoBox
                  label="Name"
                  value={request.student_name}
                />
                <InfoBox
                  label="Email"
                  value={
                    request.student_email || "—"
                  }
                />
              </div>
            </section>

            {/* Request */}
            <section className="rounded-[24px] border border-white/[0.07] bg-white/[0.018] p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white/50">
                  <FileText size={17} />
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-[0.17em] text-white/25">
                    Submitted request
                  </p>
                  <h2 className="mt-1 text-sm font-medium">
                    {formatServiceName(
                      request.service_name
                    )}
                  </h2>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
                <p className="whitespace-pre-wrap text-sm leading-7 text-white/65">
                  {request.user_input}
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoBox
                  label="Priority"
                  value={request.priority}
                />
                <InfoBox
                  label="Created"
                  value={formatDate(
                    request.created_at
                  )}
                />
                <InfoBox
                  label="Updated"
                  value={formatDate(
                    request.updated_at
                  )}
                />

                {request.transaction_id && (
                  <InfoBox
                    label="Transaction ID / UTR"
                    value={request.transaction_id}
                  />
                )}
              </div>
            </section>

            {/* AI analysis */}
            <section className="rounded-[24px] border border-white/[0.07] bg-white/[0.018] p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/[0.13] bg-gradient-to-br from-cyan-400/[0.08] to-violet-400/[0.08] text-cyan-200">
                  <Zap size={17} />
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-[0.17em] text-white/25">
                    NEXUS evaluation
                  </p>
                  <h2 className="mt-1 text-sm font-medium">
                    AI & Risk Analysis
                  </h2>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Metric
                  label="AI Confidence"
                  value={
                    request.ai_confidence !== null
                      ? `${(
                          request.ai_confidence * 100
                        ).toFixed(0)}%`
                      : "Not evaluated"
                  }
                  icon={
                    <Sparkles size={15} />
                  }
                />

                <Metric
                  label="Risk Score"
                  value={
                    request.risk_score !== null
                      ? `${(
                          request.risk_score * 100
                        ).toFixed(0)}%`
                      : "Not evaluated"
                  }
                  icon={
                    request.risk_score !== null &&
                    request.risk_score >= 0.8 ? (
                      <AlertCircle size={15} />
                    ) : (
                      <ShieldCheck size={15} />
                    )
                  }
                />
              </div>
            </section>
          </div>

          {/* Right rail */}
          <aside className="space-y-5">
            {/* Generated certificate */}
            {request.document && (
              <section className="rounded-[24px] border border-emerald-400/[0.14] bg-emerald-400/[0.035] p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/[0.14] bg-emerald-400/[0.055] text-emerald-200">
                    <FileText size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.17em] text-emerald-200/45">
                      Generated document
                    </p>
                    <h2 className="mt-1 truncate text-sm font-medium text-emerald-100">
                      {request.document.title}
                    </h2>
                  </div>
                </div>

                <p className="truncate text-[11px] text-white/35">
                  {request.document.file_name}
                </p>

                {request.document.view_url ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <a
                      href={request.document.view_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-xs font-medium text-white/70 transition hover:bg-white/[0.07] hover:text-white"
                    >
                      View PDF
                    </a>

                    <a
                      href={request.document.download_url ?? request.document.view_url}
                      download={request.document.file_name}
                      className="flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 text-xs font-semibold text-black transition hover:-translate-y-0.5"
                    >
                      Download
                    </a>
                  </div>
                ) : (
                  <p className="mt-3 text-[10px] leading-5 text-amber-200/50">
                    The certificate exists, but a secure viewing link could
                    not be created right now. Refresh the request to try again.
                  </p>
                )}
              </section>
            )}

            {/* Actions */}
            <section className="rounded-[24px] border border-white/[0.07] bg-white/[0.018] p-5">
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-[0.17em] text-white/25">
                  Workflow
                </p>

                <h2 className="mt-1 text-sm font-medium">
                  Request Actions
                </h2>
              </div>

              <div className="space-y-2.5">
                {availableAction && (
                  <ActionButton
                    type={availableAction}
                    loading={
                      action === availableAction
                    }
                    onClick={() =>
                      performAction(
                        availableAction
                      )
                    }
                  />
                )}

                {request.status === "PROCESSING" &&
                  request.ready_for_completion && (
                  <div className="rounded-xl border border-cyan-400/[0.12] bg-cyan-400/[0.035] p-3">
                    <p className="text-[11px] leading-5 text-cyan-100/55">
                      Evaluation passed. The certificate is ready to be generated.
                    </p>
                  </div>
                )}

                {(request.status === "APPROVAL_REQUIRED" ||
                  request.status === "PENDING" ||
                  request.status === "PROCESSING") && (
                  <button
                    onClick={() => {
                      setError("");
                      setSuccess("");
                      setRejectOpen(true);
                    }}
                    disabled={action !== null}
                    className="group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-rose-400/15 bg-rose-400/[0.055] text-xs font-medium text-rose-200 transition duration-300 hover:border-rose-300/25 hover:bg-rose-400/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <XCircle size={15} />
                    Reject Request
                  </button>
                )}

                {!availableAction &&
                  request.status ===
                    "COMPLETED" && (
                    <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4">
                      <div className="flex items-center gap-2 text-xs font-medium text-emerald-200">
                        <CheckCircle2 size={15} />
                        Request completed
                      </div>

                      <p className="mt-2 text-[11px] leading-5 text-emerald-200/45">
                        No further workflow action is
                        required.
                      </p>
                    </div>
                  )}

                {!availableAction &&
                  request.status ===
                    "REJECTED" && (
                    <div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.05] p-4">
                      <div className="flex items-center gap-2 text-xs font-medium text-rose-200">
                        <XCircle size={15} />
                        Request rejected
                      </div>

                      <p className="mt-2 text-[11px] leading-5 text-rose-200/45">
                        This request has reached a terminal
                        state.
                      </p>
                    </div>
                  )}
              </div>
            </section>

            {/* Timeline */}
            <section className="rounded-[24px] border border-white/[0.07] bg-white/[0.018] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.17em] text-white/25">
                    History
                  </p>
                  <h2 className="mt-1 text-sm font-medium">
                    Audit Timeline
                  </h2>
                </div>

                <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[10px] text-white/30">
                  {auditLogs.length}
                </span>
              </div>

              {auditLogs.length === 0 ? (
                <p className="text-xs text-white/25">
                  No audit events yet.
                </p>
              ) : (
                <div className="relative">
                  <div className="absolute bottom-3 left-[7px] top-3 w-px bg-gradient-to-b from-cyan-300/30 via-white/[0.08] to-violet-300/20" />

                  <div className="space-y-5">
                    {auditLogs.map(
                      (log, index) => (
                        <div
                          key={log.id}
                          className="relative flex gap-3"
                        >
                          <div className="relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border border-cyan-300/20 bg-[#0b0e13]">
                            <div
                              className={`absolute inset-[3px] rounded-full ${
                                index ===
                                auditLogs.length - 1
                                  ? "bg-cyan-200"
                                  : "bg-white/25"
                              }`}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-xs font-medium text-white/70">
                                {formatAction(
                                  log.action
                                )}
                              </p>

                              <span className="shrink-0 text-[9px] text-white/20">
                                {formatDate(
                                  log.created_at
                                )}
                              </span>
                            </div>

                            {(log.previous_status ||
                              log.new_status) && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px] text-white/25">
                                {log.previous_status && (
                                  <span>
                                    {formatStatus(
                                      log.previous_status
                                    )}
                                  </span>
                                )}

                                {log.previous_status &&
                                  log.new_status && (
                                    <ChevronRight
                                      size={10}
                                    />
                                  )}

                                {log.new_status && (
                                  <span className="text-white/40">
                                    {formatStatus(
                                      log.new_status
                                    )}
                                  </span>
                                )}
                              </div>
                            )}

                            {log.reason && (
                              <p className="mt-1.5 text-[10px] leading-5 text-white/25">
                                {log.reason}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>

      {/* Reject modal */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[26px] border border-white/[0.09] bg-[#0b0e13] p-6 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-400/15 bg-rose-400/[0.06] text-rose-200">
                  <XCircle size={17} />
                </div>

                <h2 className="mt-4 text-lg font-semibold">
                  Reject request
                </h2>

                <p className="mt-2 text-xs leading-5 text-white/30">
                  Provide a clear reason. This reason will
                  be stored in the audit history.
                </p>
              </div>

              <button
                onClick={() =>
                  setRejectOpen(false)
                }
                className="rounded-lg p-2 text-white/25 transition hover:bg-white/5 hover:text-white"
              >
                <X size={17} />
              </button>
            </div>

            <textarea
              value={rejectReason}
              onChange={(event) =>
                setRejectReason(
                  event.target.value
                )
              }
              maxLength={1000}
              rows={5}
              autoFocus
              placeholder="e.g. Required supporting document was not provided."
              className="mt-6 w-full resize-none rounded-xl border border-white/[0.08] bg-black/15 p-4 text-sm leading-6 text-white outline-none placeholder:text-white/20 focus:border-rose-300/20 focus:ring-1 focus:ring-rose-300/10"
            />

            <div className="mt-2 text-right text-[10px] text-white/20">
              {rejectReason.length}/1000
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() =>
                  setRejectOpen(false)
                }
                disabled={action !== null}
                className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-xs font-medium text-white/45 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                onClick={rejectRequest}
                disabled={
                  action !== null ||
                  !rejectReason.trim()
                }
                className="group relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-rose-300 to-violet-400 px-4 py-3 text-xs font-semibold text-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                <span className="relative">
                  {action === "reject"
                    ? "Rejecting..."
                    : "Confirm Rejection"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3.5">
      <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
        {label}
      </p>

      <p className="mt-1.5 break-words text-xs leading-5 text-white/55">
        {value}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-4">
      <div className="flex items-center gap-2 text-white/35">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.13em]">
          {label}
        </span>
      </div>

      <p className="mt-3 text-lg font-semibold text-white/80">
        {value}
      </p>
    </div>
  );
}

function ActionButton({
  type,
  loading,
  onClick,
}: {
  type: "approve" | "process" | "evaluate" | "complete";
  loading: boolean;
  onClick: () => void;
}) {
  const labels = {
    approve: "Approve Request",
    process: "Start Processing",
    evaluate: "Evaluate Request",
    complete: "Generate Certificate & Complete",
  };

  const icons = {
    approve: <ShieldCheck size={15} />,
    process: <Zap size={15} />,
    evaluate: <Sparkles size={15} />,
    complete: <FileText size={15} />,
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 text-xs font-semibold text-black shadow-lg shadow-cyan-500/10 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-500/10 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

      {loading ? (
        <Loader2
          size={15}
          className="relative animate-spin"
        />
      ) : (
        <span className="relative">
          {icons[type]}
        </span>
      )}

      <span className="relative">
        {loading
          ? "Working..."
          : labels[type]}
      </span>
    </button>
  );
}

function formatAction(action: string) {
  return action
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}   