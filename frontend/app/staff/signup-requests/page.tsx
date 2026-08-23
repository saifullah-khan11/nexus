"use client";

import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileImage,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://localhost:8000";

type SignupRequest = {
  id: string;
  name: string;
  email: string;
  phone: string;
  registration_number: string;
  program: string | null;
  department: string | null;
  year: number | null;
  semester: number | null;
  academic_session: string | null;
  proof_original_name: string | null;
  proof_content_type: string | null;
  proof_size_bytes: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  review_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type SignupDetail = SignupRequest & {
  proof_url: string | null;
};

function getErrorMessage(
  detail: unknown,
  fallback: string,
): string {
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (
          typeof item === "object" &&
          item !== null &&
          "msg" in item
        ) {
          return String(
            (item as { msg: unknown }).msg,
          );
        }

        return String(item);
      })
      .join(", ");
  }

  return fallback;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function statusStyle(status: string) {
  switch (status) {
    case "PENDING":
      return "border-amber-400/20 bg-amber-400/[0.08] text-amber-200";
    case "APPROVED":
      return "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200";
    case "REJECTED":
      return "border-rose-400/20 bg-rose-400/[0.08] text-rose-200";
    default:
      return "border-white/[0.08] bg-white/[0.04] text-white/50";
  }
}

export default function StudentSignupRequestsPage() {
  const router = useRouter();

  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [selected, setSelected] =
    useState<SignupDetail | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [action, setAction] = useState<
    "approve" | "reject" | null
  >(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [rejectReason, setRejectReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);

  function getToken() {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return null;
    }

    const role = localStorage.getItem("user_role");

    if (role !== "STAFF" && role !== "ADMIN") {
      router.replace("/");
      return null;
    }

    return token;
  }

  async function fetchRequests(
    isRefresh = false,
  ) {
    const token = getToken();
    if (!token) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const query =
        statusFilter === "ALL"
          ? ""
          : `?status_filter=${encodeURIComponent(
              statusFilter,
            )}`;

      const response = await fetch(
        `${API_URL}/api/admin/student-signups${query}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        },
      );

      const data = await response
        .json()
        .catch(() => null);

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        router.replace("/staff");
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data?.detail,
            "Unable to load signup requests.",
          ),
        );
      }

      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load signup requests.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function openRequest(id: string) {
    const token = getToken();
    if (!token) return;

    try {
      setDetailLoading(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/api/admin/student-signups/${id}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        },
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data?.detail,
            "Unable to load signup request.",
          ),
        );
      }

      setSelected(data);
      setRejectReason("");
      setRejectOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load signup request.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function approveRequest() {
    if (!selected) return;

    const token = getToken();
    if (!token) return;

    try {
      setAction("approve");
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/api/admin/student-signups/${selected.id}/approve`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response
        .json()
        .catch(() => null);

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data?.detail,
            "Unable to approve signup.",
          ),
        );
      }

      setSuccess(
        "Student registration approved successfully.",
      );
      setSelected(null);
      await fetchRequests(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to approve signup.",
      );
    } finally {
      setAction(null);
    }
  }

  async function rejectRequest() {
    if (!selected) return;

    const reason = rejectReason.trim();

    if (!reason) {
      setError(
        "Please provide a reason for rejection.",
      );
      return;
    }

    const token = getToken();
    if (!token) return;

    try {
      setAction("reject");
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/api/admin/student-signups/${selected.id}/reject`,
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
        },
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data?.detail,
            "Unable to reject signup.",
          ),
        );
      }

      setSuccess(
        "Student registration rejected.",
      );
      setSelected(null);
      setRejectOpen(false);
      setRejectReason("");
      await fetchRequests(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reject signup.",
      );
    } finally {
      setAction(null);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return requests;
    }

    return requests.filter((request) =>
      [
        request.name,
        request.email,
        request.phone,
        request.registration_number,
      ].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [requests, search]);

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto w-full max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => router.back()}
              className="mb-3 inline-flex items-center gap-2 text-xs text-white/35 transition hover:text-white/70"
            >
              <ArrowLeft size={14} />
              Back
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/[0.11] bg-gradient-to-br from-cyan-400/[0.06] to-violet-400/[0.06] text-cyan-200">
                <ShieldCheck size={19} />
              </div>

              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  Student Signup Requests
                </h1>
                <p className="mt-1 text-xs text-white/30">
                  Review and verify student registration applications.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => fetchRequests(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-2.5 text-xs font-medium text-white/55 transition hover:bg-white/[0.045] hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-100">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
            <button
              type="button"
              className="ml-auto text-white/30 hover:text-white"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm text-emerald-100">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <p>{success}</p>
            <button
              type="button"
              className="ml-auto text-white/30 hover:text-white"
              onClick={() => setSuccess("")}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="rounded-[24px] border border-white/[0.07] bg-white/[0.018] p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-md">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/20"
              />
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search name, email or registration number..."
                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.02] px-10 py-2.5 text-xs text-white outline-none placeholder:text-white/20 focus:border-cyan-300/25"
              />
            </div>

            <div className="flex items-center gap-2">
              {["PENDING", "APPROVED", "REJECTED", "ALL"].map(
                (filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() =>
                      setStatusFilter(filter)
                    }
                    className={`rounded-lg px-3 py-2 text-[10px] font-medium transition ${
                      statusFilter === filter
                        ? "bg-white/[0.08] text-white"
                        : "text-white/30 hover:bg-white/[0.04] hover:text-white/60"
                    }`}
                  >
                    {filter}
                  </button>
                ),
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center gap-2 text-xs text-white/30">
              <Loader2
                size={16}
                className="animate-spin"
              />
              Loading signup requests...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-white/20">
                <Clock3 size={18} />
              </div>
              <p className="mt-4 text-sm font-medium text-white/45">
                No signup requests found
              </p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-white/20">
                New student registrations awaiting
                verification will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRequests.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => openRequest(request.id)}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-white/[0.06] bg-black/10 p-4 text-left transition hover:border-white/[0.10] hover:bg-white/[0.025]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/[0.10] bg-gradient-to-br from-cyan-400/[0.05] to-violet-400/[0.05] text-cyan-200/75">
                    {request.proof_content_type ===
                    "application/pdf" ? (
                      <FileText size={17} />
                    ) : (
                      <FileImage size={17} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-white/80">
                        {request.name}
                      </p>

                      <span
                        className={`rounded-full border px-2 py-1 text-[9px] font-medium ${statusStyle(
                          request.status,
                        )}`}
                      >
                        {request.status}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/25">
                      <span>{request.registration_number}</span>
                      <span>{request.email}</span>
                      <span>{request.phone}</span>
                    </div>
                  </div>

                  <div className="hidden text-right sm:block">
                    <p className="text-[9px] uppercase tracking-[0.14em] text-white/15">
                      Submitted
                    </p>
                    <p className="mt-1 text-[10px] text-white/30">
                      {formatDate(request.created_at)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {detailLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0b0e13] px-5 py-4 text-sm text-white/50">
            <Loader2
              size={17}
              className="animate-spin"
            />
            Loading application...
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-3xl rounded-[28px] border border-white/[0.08] bg-[#0b0e13] shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/20">
                  Student Registration
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  {selected.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl p-2 text-white/30 transition hover:bg-white/5 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-5 p-6 lg:grid-cols-[1fr_1.1fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                    Applicant
                  </p>

                  <div className="mt-4 space-y-3">
                    <InfoRow
                      label="Name"
                      value={selected.name}
                    />
                    <InfoRow
                      label="Email"
                      value={selected.email}
                    />
                    <InfoRow
                      label="Phone"
                      value={selected.phone}
                    />
                    <InfoRow
                      label="Registration"
                      value={selected.registration_number}
                    />
                    <InfoRow
                      label="Submitted"
                      value={formatDate(selected.created_at)}
                    />
                    <InfoRow
                      label="Status"
                      value={selected.status}
                    />
                  </div>
                </div>

                {selected.proof_original_name && (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/[0.10] bg-cyan-400/[0.04] text-cyan-100/70">
                        {selected.proof_content_type ===
                        "application/pdf" ? (
                          <FileText size={16} />
                        ) : (
                          <FileImage size={16} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                          Admission proof
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="truncate text-xs text-white/55">
                            {selected.proof_original_name}
                          </p>
                          <span className="shrink-0 text-[10px] text-white/20">
                            {formatSize(
                              selected.proof_size_bytes,
                            )}
                          </span>
                        </div>
                      </div>

                      {selected.proof_url && (
                        <a
                          href={selected.proof_url}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 rounded-lg p-2 text-white/25 transition hover:bg-white/5 hover:text-white"
                          title="Open proof in new tab"
                        >
                          <ExternalLink size={15} />
                        </a>
                      )}
                    </div>

                    {selected.proof_url ? (
                      selected.proof_content_type?.startsWith(
                        "image/",
                      ) ? (
                        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
                          <img
                            src={selected.proof_url}
                            alt="Submitted admission proof"
                            className="max-h-[360px] w-full object-contain"
                          />
                        </div>
                      ) : selected.proof_content_type ===
                        "application/pdf" ? (
                        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
                          <iframe
                            src={selected.proof_url}
                            title="Submitted admission proof"
                            className="h-[360px] w-full"
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-6 text-center text-xs text-white/25">
                          Preview unavailable for this file type. Use the
                          open button above to view the document.
                        </div>
                      )
                    ) : (
                      <div className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-6 text-center text-xs text-white/25">
                        Proof preview is unavailable.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selected.status === "PENDING" ? (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="mb-5">
                    <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                      Submitted academic details
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/35">
                      These details were entered by the student during signup
                      and will be used to create the student profile.
                    </p>
                  </div>

                  <div className="space-y-3 rounded-xl border border-white/[0.06] bg-black/10 p-4">
                    <InfoRow
                      label="Program"
                      value={selected.program || "Not provided"}
                    />
                    <InfoRow
                      label="Department"
                      value={selected.department || "Not provided"}
                    />
                    <InfoRow
                      label="Year / Semester"
                      value={
                        selected.year && selected.semester
                          ? `Year ${selected.year} / Semester ${selected.semester}`
                          : "Not provided"
                      }
                    />
                    <InfoRow
                      label="Academic year"
                      value={
                        selected.academic_session ||
                        "Not provided"
                      }
                    />
                  </div>

                  <button
                    type="button"
                    disabled={action !== null}
                    onClick={approveRequest}
                    className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 text-sm font-semibold text-black shadow-lg shadow-cyan-500/10 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {action === "approve" ? (
                      <>
                        <Loader2
                          size={16}
                          className="animate-spin"
                        />
                        Approving...
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        Approve student
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={action !== null}
                    onClick={() => setRejectOpen(true)}
                    className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-400/15 bg-rose-400/[0.035] text-sm font-medium text-rose-200/75 transition hover:bg-rose-400/[0.07] disabled:opacity-50"
                  >
                    <XCircle size={16} />
                    Reject application
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                    Review
                  </p>

                  <div
                    className={`mt-4 rounded-xl border px-4 py-3 ${statusStyle(
                      selected.status,
                    )}`}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {selected.status === "APPROVED" ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <XCircle size={16} />
                      )}
                      {selected.status}
                    </div>

                    {selected.review_reason && (
                      <p className="mt-2 text-xs leading-5 opacity-70">
                        {selected.review_reason}
                      </p>
                    )}

                    {selected.reviewed_at && (
                      <p className="mt-2 text-[10px] opacity-50">
                        Reviewed {formatDate(selected.reviewed_at)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {rejectOpen && selected && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 px-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] border border-white/[0.08] bg-[#0b0e13] p-6 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.14em] text-rose-200/45">
                  Reject application
                </p>
                <h3 className="mt-1 text-base font-semibold">
                  {selected.name}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setRejectOpen(false)}
                className="rounded-xl p-2 text-white/30 hover:bg-white/5 hover:text-white"
              >
                <X size={17} />
              </button>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-xs font-medium text-white/50">
                Reason
              </span>
              <textarea
                value={rejectReason}
                onChange={(event) =>
                  setRejectReason(event.target.value)
                }
                rows={5}
                placeholder="Explain why this registration could not be approved..."
                className="w-full resize-none rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-rose-300/20"
              />
            </label>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setRejectOpen(false)}
                className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-xs font-medium text-white/45 hover:text-white/70"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  action !== null ||
                  !rejectReason.trim()
                }
                onClick={rejectRequest}
                className="flex-1 rounded-xl border border-rose-400/20 bg-rose-400/[0.08] px-4 py-3 text-xs font-semibold text-rose-100 hover:bg-rose-400/[0.12] disabled:opacity-50"
              >
                {action === "reject"
                  ? "Rejecting..."
                  : "Reject application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-[10px] text-white/20">
        {label}
      </span>
      <span className="text-right text-[11px] text-white/60">
        {value}
      </span>
    </div>
  );
}