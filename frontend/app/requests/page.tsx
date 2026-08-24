"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  

type ServiceRequest = {
  id: string;
  service_name: string;
  status: string;
  priority: string;
  created_at: string;
};

const STATUS_FILTERS = [
  "ALL",
  "PENDING",
  "APPROVAL_REQUIRED",
  "PROCESSING",
  "COMPLETED",
  "REJECTED",
];

const PRIORITY_FILTERS = [
  "ALL",
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
];

export default function RequestsPage() {
  const router = useRouter();

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const PAGE_SIZE = 6;

  async function fetchRequests(isRefresh = false) {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await fetch(`${API_URL}/api/requests`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to load requests."
        );
      }

      setRequests(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("REQUESTS ERROR:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to load your requests."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = window.setInterval(() => {
      fetchRequests(true);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [autoRefresh]);

  function formatServiceName(serviceName: string) {
    return serviceName
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function formatStatus(status: string) {
    return status.replaceAll("_", " ");
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case "PENDING":
        return "border-white/[0.09] bg-white/[0.045] text-white/65";

      case "APPROVAL_REQUIRED":
        return "border-amber-300/20 bg-amber-300/[0.08] text-amber-200";

      case "PROCESSING":
        return "border-cyan-300/20 bg-gradient-to-r from-cyan-300/[0.09] via-blue-400/[0.08] to-violet-400/[0.09] text-cyan-100";

      case "COMPLETED":
        return "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200";

      case "REJECTED":
        return "border-rose-300/20 bg-rose-300/[0.08] text-rose-200";

      default:
        return "border-white/[0.08] bg-white/[0.04] text-white/50";
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "PROCESSING":
        return <Zap size={13} />;
      case "COMPLETED":
        return <CheckCircle2 size={13} />;
      case "REJECTED":
        return <XCircle size={13} />;
      case "APPROVAL_REQUIRED":
        return <Clock3 size={13} />;
      default:
        return <Clock3 size={13} />;
    }
  }

  function getPriorityStyle(priority: string) {
    switch (priority) {
      case "URGENT":
        return "text-rose-200";
      case "HIGH":
        return "text-amber-200";
      case "LOW":
        return "text-cyan-200/70";
      default:
        return "text-white/30";
    }
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, priorityFilter]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        request.status === statusFilter;

      const matchesPriority =
        priorityFilter === "ALL" ||
        request.priority === priorityFilter;

      const matchesSearch =
        !query ||
        request.service_name
          .toLowerCase()
          .includes(query) ||
        request.status.toLowerCase().includes(query) ||
        request.priority.toLowerCase().includes(query) ||
        request.id.toLowerCase().includes(query);

      return (
        matchesStatus &&
        matchesPriority &&
        matchesSearch
      );
    });
  }, [requests, search, statusFilter, priorityFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRequests.length / PAGE_SIZE)
  );

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRequests.slice(start, start + PAGE_SIZE);
  }, [filteredRequests, currentPage]);

  const pageStart =
    filteredRequests.length === 0
      ? 0
      : (currentPage - 1) * PAGE_SIZE + 1;

  const pageEnd = Math.min(
    currentPage * PAGE_SIZE,
    filteredRequests.length
  );

  const stats = useMemo(() => {
    const count = (status: string) =>
      requests.filter((request) => request.status === status)
        .length;

    return {
      total: requests.length,
      pending: count("PENDING"),
      processing: count("PROCESSING"),
      completed: count("COMPLETED"),
      rejected: count("REJECTED"),
      approval: count("APPROVAL_REQUIRED"),
    };
  }, [requests]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#07090d] text-white">
      {/* Ambient NEXUS background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-cyan-400/[0.04] blur-[120px]" />
        <div className="absolute -right-40 top-[15%] h-[500px] w-[500px] rounded-full bg-violet-500/[0.04] blur-[130px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07090d]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1100px] items-center justify-between px-5 sm:px-8">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>

          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white text-black">
              <div className="absolute -inset-5 animate-[spin_5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(34,211,238,0.9)_90deg,rgba(139,92,246,0.9)_210deg,transparent_320deg)] opacity-50" />
              <div className="relative flex h-[31px] w-[31px] items-center justify-center rounded-[9px] bg-[#f7f8fa]">
                <Sparkles size={16} />
              </div>
            </div>

            <span className="text-sm font-semibold tracking-tight">
              NEXUS
            </span>
          </div>

          <button
            onClick={() => fetchRequests(true)}
            disabled={refreshing}
            className="group relative flex items-center gap-2 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] text-white/40 transition hover:border-cyan-300/20 hover:text-white disabled:opacity-40"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan-200/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <RefreshCw
              size={14}
              className={`relative ${
                refreshing ? "animate-spin" : ""
              }`}
            />
            <span className="relative hidden sm:inline">
              Refresh
            </span>
          </button>
        </div>
      </header>

      <div className="relative mx-auto max-w-[1100px] px-5 py-10 sm:px-8">
        {/* Heading */}
        <div className="mb-8">
          <p className="mb-2 text-sm text-white/30">
            Workspace
          </p>

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                My Requests
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-white/40">
                View and track all the university services
                you've requested through NEXUS.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] text-white/30 sm:self-auto">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  autoRefresh
                    ? "animate-pulse bg-cyan-200"
                    : "bg-white/20"
                }`}
              />
              {autoRefresh
                ? "Live updates"
                : "Auto refresh off"}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex min-h-[250px] items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.02]">
            <div className="flex items-center gap-3 text-sm text-white/40">
              <Loader2
                size={18}
                className="animate-spin"
              />
              Loading your requests...
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl border border-rose-400/15 bg-rose-400/[0.08] p-6">
            <p className="text-sm text-rose-200">
              {error}
            </p>

            <button
              onClick={() => fetchRequests()}
              className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard
                label="Total"
                value={stats.total}
                tone="cyan"
              />
              <StatCard
                label="Pending"
                value={stats.pending}
                tone="neutral"
              />
              <StatCard
                label="Approval"
                value={stats.approval}
                tone="amber"
              />
              <StatCard
                label="Processing"
                value={stats.processing}
                tone="blue"
                active={stats.processing > 0}
              />
              <StatCard
                label="Completed"
                value={stats.completed}
                tone="green"
              />
              <StatCard
                label="Rejected"
                value={stats.rejected}
                tone="rose"
              />
            </div>

            {/* Search + filters */}
            <section className="mt-6 rounded-[22px] border border-white/[0.07] bg-white/[0.018] p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25"
                  />

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search service, status, priority or request ID..."
                    className="h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] pl-11 pr-4 text-xs text-white outline-none transition placeholder:text-white/20 focus:border-cyan-300/20 focus:bg-white/[0.035]"
                  />
                </div>

                <div className="flex items-center gap-2 text-white/25">
                  <Filter size={14} />
                  <span className="text-[10px] uppercase tracking-[0.14em]">
                    Filter
                  </span>
                </div>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {STATUS_FILTERS.map((status) => (
                  <FilterButton
                    key={status}
                    active={statusFilter === status}
                    onClick={() => setStatusFilter(status)}
                  >
                    {status === "ALL"
                      ? "All"
                      : formatStatus(status)}
                  </FilterButton>
                ))}
              </div>

              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {PRIORITY_FILTERS.map((priority) => (
                  <FilterButton
                    key={priority}
                    active={priorityFilter === priority}
                    onClick={() =>
                      setPriorityFilter(priority)
                    }
                  >
                    {priority === "ALL"
                      ? "All priorities"
                      : priority}
                  </FilterButton>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between px-1 text-[10px] text-white/20">
                <span>
                  {filteredRequests.length} of{" "}
                  {requests.length} requests shown
                </span>

                {lastUpdated && (
                  <span className="hidden sm:block">
                    Updated{" "}
                    {lastUpdated.toLocaleTimeString(
                      "en-IN"
                    )}
                  </span>
                )}
              </div>
            </section>

            {/* Empty */}
            {requests.length === 0 && (
              <div className="mt-5 flex min-h-[300px] flex-col items-center justify-center rounded-[24px] border border-white/[0.07] bg-white/[0.018] text-center">
                <div className="relative mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/10 bg-gradient-to-br from-cyan-300/[0.06] to-violet-400/[0.06]">
                  <div className="absolute inset-0 animate-pulse bg-cyan-300/[0.025]" />
                  <FileText
                    size={22}
                    className="relative text-white/35"
                  />
                </div>

                <h2 className="text-sm font-medium">
                  No requests yet
                </h2>

                <p className="mt-2 max-w-sm text-xs leading-5 text-white/30">
                  Ask NEXUS for a university service and
                  your request will appear here.
                </p>

                <button
                  onClick={() => router.push("/")}
                  className="group relative mt-5 flex h-11 items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 px-5 text-xs font-semibold text-black shadow-lg shadow-cyan-500/10 transition hover:scale-[1.01]"
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  <span className="relative">
                    Ask NEXUS
                  </span>
                  <ChevronRight
                    size={15}
                    className="relative"
                  />
                </button>
              </div>
            )}

            {/* No filtered results */}
            {requests.length > 0 &&
              filteredRequests.length === 0 && (
                <div className="mt-5 rounded-[24px] border border-white/[0.07] bg-white/[0.018] p-10 text-center">
                  <Search
                    size={22}
                    className="mx-auto text-white/20"
                  />
                  <h2 className="mt-4 text-sm font-medium">
                    No matching requests
                  </h2>
                  <p className="mt-2 text-xs text-white/25">
                    Try changing your search or filters.
                  </p>

                  <button
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("ALL");
                      setPriorityFilter("ALL");
                    }}
                    className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-2.5 text-xs text-white/50 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    Clear filters
                  </button>
                </div>
              )}

            {/* Requests */}
            {filteredRequests.length > 0 && (
              <div className="mt-5 space-y-3">
                {paginatedRequests.map((request) => (
                  <button
                    key={request.id}
                    onClick={() =>
                      router.push(
                        `/requests/${request.id}`
                      )
                    }
                    className="group relative w-full overflow-hidden rounded-[22px] border border-white/[0.07] bg-white/[0.018] p-5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.13] hover:bg-white/[0.03]"
                  >
                    {/* Status edge */}
                    <div
                      className={`pointer-events-none absolute inset-y-0 left-0 w-1 ${
                        request.status ===
                        "PROCESSING"
                          ? "bg-gradient-to-b from-cyan-300 via-blue-400 to-violet-400"
                          : request.status ===
                            "COMPLETED"
                          ? "bg-emerald-300/70"
                          : request.status ===
                            "REJECTED"
                          ? "bg-rose-300/70"
                          : request.status ===
                            "APPROVAL_REQUIRED"
                          ? "bg-amber-300/70"
                          : "bg-white/15"
                      }`}
                    />

                    {request.status ===
                      "PROCESSING" && (
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-300/[0.025] via-transparent to-violet-400/[0.025] opacity-80" />
                    )}

                    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.035]">
                          {request.status ===
                            "PROCESSING" && (
                            <div className="absolute -inset-3 animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(34,211,238,0.5)_100deg,rgba(139,92,246,0.5)_220deg,transparent_310deg)] opacity-50" />
                          )}

                          <FileText
                            size={18}
                            className="relative text-white/50"
                          />
                        </div>

                        <div className="min-w-0">
                          <h2 className="truncate text-sm font-medium text-white">
                            {formatServiceName(
                              request.service_name
                            )}
                          </h2>

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/30">
                            <span className="flex items-center gap-1.5">
                              <Clock3 size={13} />
                              {formatDate(
                                request.created_at
                              )}
                            </span>

                            <span
                              className={getPriorityStyle(
                                request.priority
                              )}
                            >
                              Priority:{" "}
                              {request.priority}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <span
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium ${getStatusStyle(
                            request.status
                          )}`}
                        >
                          {getStatusIcon(
                            request.status
                          )}
                          {formatStatus(
                            request.status
                          )}
                        </span>

                        <ChevronRight
                          size={18}
                          className="text-white/20 transition duration-300 group-hover:translate-x-1 group-hover:text-cyan-100/60"
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {filteredRequests.length > PAGE_SIZE && (
              <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-[20px] border border-white/[0.07] bg-white/[0.018] px-4 py-3 sm:flex-row">
                <p className="text-[10px] text-white/25">
                  Page {currentPage} of {totalPages}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPage === 1}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] text-white/45 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from(
                      { length: totalPages },
                      (_, index) => index + 1
                    )
                      .slice(
                        Math.max(0, currentPage - 3),
                        Math.min(totalPages, currentPage + 2)
                      )
                      .map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`h-8 min-w-8 rounded-lg px-2 text-[10px] transition ${
                            page === currentPage
                              ? "border border-cyan-300/20 bg-cyan-300/[0.09] text-cyan-100"
                              : "border border-transparent text-white/30 hover:bg-white/[0.04] hover:text-white/60"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(totalPages, page + 1)
                      )
                    }
                    disabled={currentPage === totalPages}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] text-white/45 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <p className="mt-8 text-center text-[10px] text-white/15">
          NEXUS • University Digital Services
        </p>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
  active = false,
}: {
  label: string;
  value: number;
  tone: "cyan" | "neutral" | "amber" | "blue" | "green" | "rose";
  active?: boolean;
}) {
  const toneClasses = {
    cyan:
      "border-cyan-300/10 bg-cyan-300/[0.035] text-cyan-100",
    neutral:
      "border-white/[0.07] bg-white/[0.018] text-white",
    amber:
      "border-amber-300/10 bg-amber-300/[0.03] text-amber-100",
    blue:
      "border-blue-300/10 bg-blue-300/[0.03] text-blue-100",
    green:
      "border-emerald-300/10 bg-emerald-300/[0.03] text-emerald-100",
    rose:
      "border-rose-300/10 bg-rose-300/[0.03] text-rose-100",
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-[18px] border p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.12] ${toneClasses[tone]}`}
    >
      {active && (
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-cyan-300/[0.02] via-blue-400/[0.04] to-violet-400/[0.025]" />
      )}

      <div className="relative">
        <p className="text-[9px] uppercase tracking-[0.15em] text-white/25">
          {label}
        </p>

        <p className="mt-2 text-2xl font-semibold tracking-tight">
          {value}
        </p>
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-xl border px-3 py-2 text-[10px] transition ${
        active
          ? "border-cyan-300/20 bg-gradient-to-r from-cyan-300/[0.09] to-violet-400/[0.09] text-cyan-100"
          : "border-white/[0.06] bg-white/[0.02] text-white/30 hover:border-white/[0.1] hover:text-white/60"
      }`}
    >
      {children}
    </button>
  );
}