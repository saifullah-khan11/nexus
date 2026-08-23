"use client";

import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Download,
  ExternalLink,
  Loader2,
  ShieldAlert,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const API_URL = "http://localhost:8000";

type GeneratedDocument = {
  id: string;
  type: string;
  title: string;
  file_name: string;
  mime_type?: string | null;
  download_url?: string | null;
  view_url?: string | null;
};

type RequestDetail = {
  id: string;
  service_name: string;
  status: string;
  priority: string;
  user_input: string;
  transaction_id: string | null;
  ai_confidence: number | null;
  risk_score: number | null;
  certificate_required?: boolean;
  ready_for_completion?: boolean;
  document?: GeneratedDocument | null;
  created_at: string;
  updated_at: string;
};

type AuditLog = {
  id: string;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  reason: string | null;
  created_at: string;
};

type WorkflowState =
  | "complete"
  | "active"
  | "waiting"
  | "rejected";

type WorkflowStep = {
  id: string;
  title: string;
  description: string;
  state: WorkflowState;
};

// =========================================================
// PAGE
// =========================================================

export default function RequestDetailPage() {
  const router = useRouter();
  const params = useParams();

  const requestId = params.id as string;

  const [request, setRequest] =
    useState<RequestDetail | null>(null);

  const [auditLogs, setAuditLogs] =
    useState<AuditLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [auditLoading, setAuditLoading] =
    useState(true);

  const [auditError, setAuditError] =
    useState("");

  const [actionLoading, setActionLoading] =
    useState<"process" | "evaluate" | "reject" | null>(null);

  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState("");

  // =======================================================
  // FETCH AUDIT LOGS
  // =======================================================

  async function fetchAuditLogs(
    id: string,
    token: string
  ) {
    try {
      setAuditLoading(true);
      setAuditError("");

      const response = await fetch(
        `${API_URL}/api/requests/${id}/audit-logs`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        router.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to load request history."
        );
      }

      setAuditLogs(data);
    } catch (err) {
      console.error("AUDIT LOG ERROR:", err);

      setAuditError(
        err instanceof Error
          ? err.message
          : "Unable to load request history."
      );
    } finally {
      setAuditLoading(false);
    }
  }

  // =======================================================
  // FETCH REQUEST
  // =======================================================

  useEffect(() => {
    async function fetchRequest() {
      const token =
        localStorage.getItem("access_token");

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_URL}/api/requests/${requestId}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          localStorage.removeItem(
            "access_token"
          );

          router.replace("/login");
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Unable to load request."
          );
        }

        setRequest(data);

        await fetchAuditLogs(
          requestId,
          token
        );
      } catch (err) {
        console.error(
          "REQUEST DETAIL ERROR:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load request."
        );
      } finally {
        setLoading(false);
      }
    }

    if (requestId) {
      fetchRequest();
    }
  }, [requestId, router]);

  // =======================================================
  // WORKFLOW ACTIONS
  // =======================================================

  async function refreshRequestData() {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    const response = await fetch(
      `${API_URL}/api/requests/${requestId}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.status === 401) {
      localStorage.removeItem("access_token");
      router.replace("/login");
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || "Unable to refresh request."
      );
    }

    setRequest(data);
    await fetchAuditLogs(requestId, token);
  }

  async function runWorkflowAction(
    action: "process" | "evaluate"
  ) {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      setActionLoading(action);
      setActionError("");
      setActionSuccess("");

      const response = await fetch(
        `${API_URL}/api/requests/${requestId}/${action}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        router.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            `Unable to ${action} this request.`
        );
      }

      setActionSuccess(
        data.message ||
          (action === "process"
            ? "Request processing started."
            : "Request evaluated successfully.")
      );

      await refreshRequestData();
    } catch (err) {
      console.error(
        `${action.toUpperCase()} REQUEST ERROR:`,
        err
      );

      setActionError(
        err instanceof Error
          ? err.message
          : `Unable to ${action} this request.`
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectRequest() {
    const reason = rejectReason.trim();

    if (!reason) {
      setActionError(
        "Please provide a reason for rejecting the request."
      );
      return;
    }

    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      setActionLoading("reject");
      setActionError("");
      setActionSuccess("");

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

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        router.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to reject this request."
        );
      }

      setRejectReason("");
      setShowRejectModal(false);
      setActionSuccess(
        data.message || "Request rejected successfully."
      );

      await refreshRequestData();
    } catch (err) {
      console.error("REJECT REQUEST ERROR:", err);

      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to reject this request."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // =======================================================
  // GENERATED DOCUMENT
  // =======================================================

  async function openGeneratedDocument() {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      setDocumentLoading(true);
      setDocumentError("");

      const response = await fetch(
        `${API_URL}/api/documents/requests/${requestId}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to open the generated document."
        );
      }

      if (!data.url) {
        throw new Error(
          "The document is available, but no secure download URL was returned."
        );
      }

      window.open(
        data.url,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      console.error(
        "GENERATED DOCUMENT ERROR:",
        error
      );

      setDocumentError(
        error instanceof Error
          ? error.message
          : "Unable to open the generated document."
      );
    } finally {
      setDocumentLoading(false);
    }
  }

  // =======================================================
  // FORMATTERS
  // =======================================================

  function formatServiceName(
    serviceName: string
  ) {
    return serviceName
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  function formatStatus(status: string) {
    return status.replaceAll("_", " ");
  }

  function formatAuditAction(
    action: string
  ) {
    return action
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString(
      "en-IN",
      {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  }

  // =======================================================
  // STATUS STYLES
  // =======================================================

  function getStatusStyle(status: string) {
    switch (status) {
      case "PENDING":
        return `
          border-cyan-400/20
          bg-gradient-to-r
          from-cyan-400/10
          to-blue-500/10
          text-cyan-200
        `;

      case "APPROVAL_REQUIRED":
        return `
          border-amber-400/20
          bg-gradient-to-r
          from-amber-400/10
          to-orange-500/10
          text-amber-200
        `;

      case "PROCESSING":
        return `
          border-cyan-400/25
          bg-gradient-to-r
          from-cyan-400/10
          to-violet-500/10
          text-cyan-200
        `;

      case "COMPLETED":
        return `
          border-emerald-400/20
          bg-gradient-to-r
          from-emerald-400/10
          to-cyan-400/10
          text-emerald-200
        `;

      case "REJECTED":
        return `
          border-rose-400/20
          bg-gradient-to-r
          from-rose-400/10
          to-orange-400/10
          text-rose-200
        `;

      default:
        return `
          border-white/[0.08]
          bg-white/[0.04]
          text-white/60
        `;
    }
  }

  // =======================================================
  // REJECTION REASON
  // =======================================================

  const rejectionReason = useMemo(() => {
    const rejectionLog = [...auditLogs]
      .reverse()
      .find(
        (log) =>
          log.action === "REQUEST_REJECTED" ||
          log.action === "PROCESSING_REJECTED" ||
          log.new_status === "REJECTED"
      );

    return (
      rejectionLog?.reason?.trim() ||
      "No rejection reason was provided."
    );
  }, [auditLogs]);

  // =======================================================
  // WORKFLOW
  // =======================================================

  const workflowSteps =
    useMemo<WorkflowStep[]>(() => {
      if (!request) {
        return [];
      }

      const actions = new Set(
        auditLogs.map((log) => log.action)
      );

      const approvalNeeded =
        request.status ===
          "APPROVAL_REQUIRED" ||
        actions.has("REQUEST_APPROVED");

      const processingStarted =
        request.status === "PROCESSING" ||
        request.status === "COMPLETED" ||
        request.status === "REJECTED" ||
        actions.has("PROCESSING_STARTED");

      const completed =
        request.status === "COMPLETED";

      const rejected =
        request.status === "REJECTED";

      const steps: WorkflowStep[] = [
        {
          id: "received",
          title: "Request received",
          description:
            "Your request was securely received by NEXUS.",
          state: "complete",
        },
      ];

      if (approvalNeeded) {
        steps.push({
          id: "approval",
          title:
            request.status ===
            "APPROVAL_REQUIRED"
              ? "Awaiting approval"
              : "Approval granted",
          description:
            request.status ===
            "APPROVAL_REQUIRED"
              ? "This service requires authorization before processing can begin."
              : "The required authorization was successfully granted.",
          state:
            request.status ===
            "APPROVAL_REQUIRED"
              ? "active"
              : "complete",
        });
      }

      steps.push({
        id: "processing",
        title: processingStarted
          ? "Processing"
          : "Waiting for processing",
        description: processingStarted
          ? "NEXUS has moved your request into the processing workflow."
          : "Your request is queued and waiting to enter processing.",
        state: processingStarted
          ? completed || rejected
            ? "complete"
            : "active"
          : request.status === "PENDING"
            ? "active"
            : "waiting",
      });

      if (completed) {
        steps.push({
          id: "completed",
          title: "Request completed",
          description:
            "Your request successfully completed the NEXUS workflow.",
          state: "complete",
        });
      } else if (rejected) {
        steps.push({
          id: "rejected",
          title: "Request rejected",
          description: rejectionReason,
          state: "rejected",
        });
      } else {
        steps.push({
          id: "decision",
          title: "Final decision",
          description:
            "The final outcome will appear here once processing is complete.",
          state: "waiting",
        });
      }

      return steps;
    }, [request, auditLogs]);

  // =======================================================
  // WORKFLOW ICON
  // =======================================================

  function WorkflowIcon({
    state,
  }: {
    state: WorkflowState;
  }) {
    if (state === "complete") {
      return (
        <Check
          size={15}
          strokeWidth={2.5}
        />
      );
    }

    if (state === "rejected") {
      return (
        <XCircle
          size={15}
          strokeWidth={2.2}
        />
      );
    }

    if (state === "active") {
      return (
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-40" />

          <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-300" />
        </span>
      );
    }

    return (
      <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
    );
  }

  function workflowCircleStyle(
    state: WorkflowState
  ) {
    switch (state) {
      case "complete":
        return `
          border-emerald-400/25
          bg-gradient-to-br
          from-emerald-400/20
          to-cyan-400/15
          text-emerald-200
          shadow-[0_0_25px_rgba(52,211,153,0.08)]
        `;

      case "active":
        return `
          border-cyan-400/30
          bg-gradient-to-br
          from-cyan-400/20
          to-violet-500/15
          text-cyan-200
          shadow-[0_0_30px_rgba(34,211,238,0.12)]
        `;

      case "rejected":
        return `
          border-rose-400/25
          bg-gradient-to-br
          from-rose-400/20
          to-orange-400/10
          text-rose-200
        `;

      default:
        return `
          border-white/[0.08]
          bg-white/[0.025]
          text-white/20
        `;
    }
  }

  // =======================================================
  // LOADING
  // =======================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090d] text-white">

        <div className="relative">

          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/20 to-violet-500/20 blur-2xl" />

          <div className="relative flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-6 py-4 text-sm text-white/50 backdrop-blur-xl">

            <Loader2
              size={18}
              className="animate-spin text-cyan-300"
            />

            Loading request...

          </div>

        </div>

      </main>
    );
  }

  // =======================================================
  // ERROR
  // =======================================================

  if (error || !request) {
    return (
      <main className="min-h-screen bg-[#07090d] px-5 py-20 text-white">

        <div className="mx-auto max-w-xl rounded-[24px] border border-rose-400/15 bg-rose-400/[0.06] p-7">

          <XCircle
            size={24}
            className="text-rose-300"
          />

          <h1 className="mt-5 text-xl font-semibold">
            Unable to load request
          </h1>

          <p className="mt-2 text-sm leading-6 text-white/40">
            {error ||
              "The requested service request could not be found."}
          </p>

          <button
            onClick={() =>
              router.push("/requests")
            }
            className="group relative mt-6 overflow-hidden rounded-xl p-[1px]"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 transition duration-500 group-hover:scale-110" />

            <span className="relative block rounded-[11px] bg-[#0b0e13] px-5 py-2.5 text-sm font-medium text-white transition group-hover:bg-[#0d1118]">
              Back to requests
            </span>
          </button>

        </div>

      </main>
    );
  }

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <main className="min-h-screen overflow-hidden bg-[#07090d] text-white">

      {/* Ambient premium background */}

      <div className="pointer-events-none fixed inset-0">

        <div className="absolute left-[15%] top-[-150px] h-[400px] w-[400px] rounded-full bg-cyan-500/[0.045] blur-[130px]" />

        <div className="absolute right-[5%] top-[20%] h-[450px] w-[450px] rounded-full bg-violet-500/[0.04] blur-[150px]" />

      </div>

      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07090d]/80 backdrop-blur-2xl">

        <div className="mx-auto flex h-[76px] max-w-[1100px] items-center justify-between px-5 sm:px-8">

          {/* Premium dual-color button */}

          <button
            onClick={() =>
              router.push("/requests")
            }
            className="group relative overflow-hidden rounded-xl p-[1px]"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-cyan-400/70 via-blue-500/50 to-violet-500/70 opacity-40 transition duration-500 group-hover:opacity-100" />

            <span className="relative flex items-center gap-2 rounded-[11px] bg-[#090c11] px-3.5 py-2 text-sm text-white/55 transition duration-300 group-hover:text-white">

              <ArrowLeft
                size={16}
                className="transition-transform duration-300 group-hover:-translate-x-0.5"
              />

              My Requests

            </span>
          </button>

          {/* NEXUS Logo */}

          <div className="group flex items-center gap-3">

            <div className="relative">

              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-cyan-400/25 to-violet-500/25 opacity-50 blur-lg transition duration-700 group-hover:opacity-90" />

              <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#0d1118]">

                <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-cyan-400/15 via-transparent to-violet-500/20" />

                <Sparkles
                  size={18}
                  className="relative text-cyan-200"
                />

              </div>

            </div>

            <div>

              <div className="bg-gradient-to-r from-cyan-200 via-blue-200 to-violet-300 bg-clip-text text-sm font-bold tracking-[0.16em] text-transparent">
                NEXUS
              </div>

              <p className="mt-0.5 text-[9px] tracking-[0.18em] text-white/20">
                UNIVERSITY AI
              </p>

            </div>

          </div>

        </div>

      </header>

      {/* ===================================================
          CONTENT
      =================================================== */}

      <div className="relative mx-auto max-w-[950px] px-5 py-10 sm:px-8 sm:py-14">

        {/* Heading */}

        <section className="mb-9">

          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/10 bg-gradient-to-br from-cyan-400/10 to-violet-500/10">

            <FileText
              size={21}
              className="text-cyan-100/70"
            />

          </div>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-200/30">
                Service Request
              </p>

              <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">

                {formatServiceName(
                  request.service_name
                )}

              </h1>

            </div>

            <div
              className={`flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium ${getStatusStyle(
                request.status
              )}`}
            >

              {request.status ===
                "PROCESSING" && (
                <span className="relative flex h-2 w-2">

                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-50" />

                  <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />

                </span>
              )}

              {request.status ===
                "COMPLETED" && (
                <CheckCircle2 size={14} />
              )}

              {request.status ===
                "REJECTED" && (
                <XCircle size={14} />
              )}

              {request.status ===
                "APPROVAL_REQUIRED" && (
                <ShieldAlert size={14} />
              )}

              {formatStatus(request.status)}

            </div>

          </div>

        </section>

        {/* =================================================
            REQUEST INFORMATION
        ================================================= */}

        <section className="overflow-hidden rounded-[26px] border border-white/[0.075] bg-white/[0.025] shadow-2xl shadow-black/20">

          <div className="grid gap-px bg-white/[0.055] sm:grid-cols-2">

            <InfoCell
              label="Priority"
              value={request.priority}
            />

            <InfoCell
              label="Submitted"
              value={formatDate(
                request.created_at
              )}
              icon={<Clock3 size={14} />}
            />

            <InfoCell
              label="Last updated"
              value={formatDate(
                request.updated_at
              )}
            />

            <InfoCell
              label="Request ID"
              value={request.id}
              mono
            />

            {request.transaction_id && (
              <div className="sm:col-span-2">
                <InfoCell
                  label="Transaction ID / UTR"
                  value={request.transaction_id}
                  mono
                />
              </div>
            )}

          </div>

          <div className="border-t border-white/[0.07] p-6 sm:p-7">

            <div className="mb-4 flex items-center gap-2">

              <Sparkles
                size={15}
                className="text-cyan-200/70"
              />

              <h2 className="text-sm font-medium">
                Your request
              </h2>

            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">

              <p className="text-sm leading-7 text-white/55">
                {request.user_input}
              </p>

            </div>

          </div>

        </section>

        {/* =================================================
            NEXUS WORKFLOW
        ================================================= */}

        <section className="relative mt-6 overflow-hidden rounded-[26px] border border-white/[0.075] bg-white/[0.025] p-6 sm:p-7">

          <div className="pointer-events-none absolute right-[-80px] top-[-80px] h-52 w-52 rounded-full bg-gradient-to-br from-cyan-400/[0.06] to-violet-500/[0.06] blur-3xl" />

          <div className="relative">

            <div className="mb-8 flex items-center gap-3">

              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/15 to-violet-500/15">

                {request.status ===
                "PROCESSING" ? (
                  <Zap
                    size={17}
                    className="animate-pulse text-cyan-200"
                  />
                ) : (
                  <Sparkles
                    size={17}
                    className="text-cyan-200"
                  />
                )}

              </div>

              <div>

                <h2 className="text-sm font-semibold">
                  NEXUS workflow
                </h2>

                <p className="mt-1 text-xs text-white/30">
                  Live request processing status
                </p>

              </div>

            </div>

            <div>

              {workflowSteps.map(
                (step, index) => (
                  <div
                    key={step.id}
                    className="flex gap-4"
                  >

                    {/* Indicator */}

                    <div className="flex flex-col items-center">

                      <div
                        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ${workflowCircleStyle(
                          step.state
                        )}`}
                      >

                        <WorkflowIcon
                          state={step.state}
                        />

                      </div>

                      {index <
                        workflowSteps.length -
                          1 && (
                        <div
                          className={`my-1 min-h-[52px] w-px flex-1 ${
                            step.state ===
                            "complete"
                              ? "bg-gradient-to-b from-emerald-400/35 to-cyan-400/10"
                              : "bg-white/[0.08]"
                          }`}
                        />
                      )}

                    </div>

                    {/* Text */}

                    <div className="pb-7 pt-1">

                      <div className="flex flex-wrap items-center gap-2">

                        <p
                          className={`text-sm font-medium ${
                            step.state ===
                            "waiting"
                              ? "text-white/35"
                              : "text-white"
                          }`}
                        >
                          {step.title}
                        </p>

                        {step.state ===
                          "active" && (
                          <span className="rounded-full border border-cyan-400/15 bg-cyan-400/[0.07] px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-cyan-200/70">
                            Active
                          </span>
                        )}

                      </div>

                      <p className="mt-1.5 max-w-lg text-xs leading-5 text-white/30">
                        {step.description}
                      </p>

                    </div>

                  </div>
                )
              )}

            </div>

          </div>

        </section>

        {/* =================================================
            FINAL OUTCOME
        ================================================= */}

        {(request.status === "COMPLETED" ||
          request.status === "REJECTED") && (
          <section
            className={`mt-6 overflow-hidden rounded-[26px] border p-6 sm:p-7 ${
              request.status === "COMPLETED"
                ? "border-emerald-400/15 bg-emerald-400/[0.035]"
                : "border-rose-400/15 bg-rose-400/[0.035]"
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                  request.status === "COMPLETED"
                    ? "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200"
                    : "border-rose-300/15 bg-rose-300/[0.06] text-rose-200"
                }`}
              >
                {request.status === "COMPLETED" ? (
                  <CheckCircle2 size={19} />
                ) : (
                  <XCircle size={19} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-[10px] font-medium uppercase tracking-[0.18em] ${
                    request.status === "COMPLETED"
                      ? "text-emerald-200/45"
                      : "text-rose-200/45"
                  }`}
                >
                  Final outcome
                </p>

                <h2 className="mt-1 text-lg font-semibold text-white">
                  {request.status === "COMPLETED"
                    ? "Request completed successfully"
                    : "Request rejected"}
                </h2>

                <p className="mt-2 max-w-2xl text-xs leading-5 text-white/35">
                  {request.status === "COMPLETED"
                    ? "Your request has successfully completed the NEXUS workflow."
                    : "Your request could not proceed through the NEXUS workflow."}
                </p>

                {request.status === "REJECTED" && (
                  <div className="mt-4 rounded-xl border border-rose-300/10 bg-black/10 p-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-rose-200/40">
                      Rejection reason
                    </p>

                    <p className="mt-2 text-xs leading-5 text-white/50">
                      {rejectionReason}
                    </p>
                  </div>
                )}

                {request.status === "COMPLETED" && (
                  <div className="mt-4 rounded-xl border border-emerald-300/10 bg-black/10 p-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-200/40">
                      Status
                    </p>

                    <p className="mt-2 text-xs leading-5 text-white/45">
                      This request has completed all required workflow steps.
                    </p>
                  </div>
                )}

                {request.status === "COMPLETED" &&
                  request.certificate_required === true && (
                    <div className="mt-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.025] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/10 bg-cyan-300/[0.05] text-cyan-200/80">
                          <FileCheck2 size={16} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/60">
                            Certificate available
                          </p>

                          <p className="mt-1 text-xs leading-5 text-white/45">
                            Your {formatServiceName(request.service_name)} has
                            been generated and is securely available.
                          </p>

                          <button
                            type="button"
                            disabled={documentLoading}
                            onClick={openGeneratedDocument}
                            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 px-4 text-xs font-semibold text-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {documentLoading ? (
                              <>
                                <Loader2
                                  size={14}
                                  className="animate-spin"
                                />
                                Preparing document...
                              </>
                            ) : (
                              <>
                                <Download size={14} />
                                View / Download Certificate
                                <ExternalLink size={13} />
                              </>
                            )}
                          </button>

                          {documentError && (
                            <p className="mt-2 text-[11px] leading-5 text-rose-200/70">
                              {documentError}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </section>
        )}

        {/* =================================================
            AI ANALYSIS
        ================================================= */}

        <section className="mt-6">

          <div className="mb-4 flex items-center gap-2">

            <Sparkles
              size={14}
              className="text-cyan-200/60"
            />

            <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-white/35">
              NEXUS Analysis
            </h2>

          </div>

          <div className="grid gap-3 sm:grid-cols-2">

            <AnalysisCard
              label="AI confidence"
              value={
                request.ai_confidence !==
                null
                  ? `${(
                      request.ai_confidence *
                      100
                    ).toFixed(0)}%`
                  : "—"
              }
              description={
                request.ai_confidence !==
                null
                  ? "Confidence in the automated request evaluation."
                  : "Analysis has not been performed yet."
              }
            />

            <AnalysisCard
              label="Risk score"
              value={
                request.risk_score !== null
                  ? request.risk_score.toFixed(
                      2
                    )
                  : "—"
              }
              description={
                request.risk_score !== null
                  ? getRiskDescription(
                      request.risk_score
                    )
                  : "Risk analysis has not been performed yet."
              }
            />

          </div>

        </section>

        {/* =================================================
            AUDIT TIMELINE
        ================================================= */}

        <section className="mt-6 rounded-[26px] border border-white/[0.075] bg-white/[0.025] p-6 sm:p-7">

          <div className="mb-7 flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/10 bg-gradient-to-br from-cyan-400/10 to-violet-500/10">

              <Clock3
                size={17}
                className="text-cyan-100/70"
              />

            </div>

            <div>

              <h2 className="text-sm font-semibold">
                Request timeline
              </h2>

              <p className="mt-1 text-xs text-white/30">
                Verified activity and status history
              </p>

            </div>

          </div>

          {auditLoading && (
            <div className="flex items-center gap-3 py-4 text-sm text-white/35">

              <Loader2
                size={16}
                className="animate-spin text-cyan-300"
              />

              Loading request history...

            </div>
          )}

          {!auditLoading &&
            auditError && (
              <div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.06] p-4">

                <p className="text-xs text-rose-200">
                  {auditError}
                </p>

              </div>
            )}

          {!auditLoading &&
            !auditError &&
            auditLogs.length === 0 && (
              <p className="text-sm text-white/30">
                No activity has been recorded yet.
              </p>
            )}

          {!auditLoading &&
            !auditError &&
            auditLogs.length > 0 && (
              <div>

                {auditLogs.map(
                  (log, index) => (
                    <div
                      key={log.id}
                      className="flex gap-4"
                    >

                      <div className="flex flex-col items-center">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-400/15 bg-gradient-to-br from-cyan-400/10 to-violet-500/10">

                          <Check
                            size={14}
                            className="text-cyan-200/80"
                          />

                        </div>

                        {index <
                          auditLogs.length -
                            1 && (
                          <div className="my-1 min-h-[65px] w-px flex-1 bg-gradient-to-b from-cyan-400/15 to-white/[0.05]" />
                        )}

                      </div>

                      <div className="pb-8">

                        <p className="text-sm font-medium">
                          {formatAuditAction(
                            log.action
                          )}
                        </p>

                        {(log.previous_status ||
                          log.new_status) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">

                            {log.previous_status && (
                              <span className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-white/35">
                                {formatStatus(
                                  log.previous_status
                                )}
                              </span>
                            )}

                            {log.previous_status &&
                              log.new_status && (
                                <span className="text-white/20">
                                  →
                                </span>
                              )}

                            {log.new_status && (
                              <span className="rounded-lg border border-cyan-400/10 bg-cyan-400/[0.05] px-2 py-1 text-cyan-100/55">
                                {formatStatus(
                                  log.new_status
                                )}
                              </span>
                            )}

                          </div>
                        )}

                        {log.reason && (
                          <p className="mt-3 max-w-xl text-xs leading-5 text-white/30">
                            {log.reason}
                          </p>
                        )}

                        <p className="mt-2 text-[11px] text-white/20">
                          {formatDate(
                            log.created_at
                          )}
                        </p>

                      </div>

                    </div>
                  )
                )}

              </div>
            )}

        </section>

      </div>

    </main>
  );
}

// =========================================================
// GRADIENT ACTION BUTTON
// =========================================================

function GradientActionButton({
  children,
  onClick,
  loading = false,
  disabled = false,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative overflow-hidden rounded-xl p-[1px] disabled:cursor-not-allowed"
    >
      <span className="absolute -inset-[120%] animate-[spin_5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(34,211,238,0.95)_80deg,rgba(59,130,246,0.95)_170deg,rgba(139,92,246,0.95)_250deg,transparent_330deg)] opacity-80 transition duration-500 group-hover:opacity-100" />

      <span className="relative flex items-center justify-center gap-2 rounded-[11px] bg-[#090c11] px-5 py-3 text-sm font-medium text-white transition duration-300 group-hover:bg-[#0d1118] group-disabled:bg-[#090c11]">
        {loading ? (
          <Loader2
            size={16}
            className="animate-spin text-cyan-200"
          />
        ) : (
          icon
        )}

        {loading ? "Processing..." : children}
      </span>
    </button>
  );
}

// =========================================================
// INFORMATION CELL
// =========================================================

function InfoCell({
  label,
  value,
  icon,
  mono = false,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="bg-[#0b0e13] p-5 transition duration-300 hover:bg-[#0d1117]">

      <p className="text-xs text-white/28">
        {label}
      </p>

      <div
        className={`mt-2 flex items-center gap-2 ${
          mono
            ? "break-all font-mono text-xs text-white/45"
            : "text-sm font-medium text-white/80"
        }`}
      >

        {icon && (
          <span className="text-cyan-100/30">
            {icon}
          </span>
        )}

        {value}

      </div>

    </div>
  );
}

// =========================================================
// ANALYSIS CARD
// =========================================================

function AnalysisCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[22px] border border-white/[0.075] bg-white/[0.025] p-5 transition duration-300 hover:border-cyan-400/15 hover:bg-white/[0.035]">

      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-cyan-400/[0.07] to-violet-500/[0.07] blur-2xl transition duration-500 group-hover:scale-125" />

      <div className="relative">

        <p className="text-xs text-white/30">
          {label}
        </p>

        <p className="mt-3 bg-gradient-to-r from-cyan-100 to-violet-200 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
          {value}
        </p>

        <p className="mt-2 text-xs leading-5 text-white/25">
          {description}
        </p>

      </div>

    </div>
  );
}

// =========================================================
// RISK DESCRIPTION
// =========================================================

function getRiskDescription(
  riskScore: number
) {
  if (riskScore < 0.3) {
    return "Low-risk request based on the current evaluation.";
  }

  if (riskScore < 0.7) {
    return "Moderate risk detected. Additional review may be appropriate.";
  }

  return "High risk detected during the request evaluation.";
}