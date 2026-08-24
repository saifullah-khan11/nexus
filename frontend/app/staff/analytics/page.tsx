"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  LogOut,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  

type RequestStatus =
  | "PENDING"
  | "APPROVAL_REQUIRED"
  | "PROCESSING"
  | "COMPLETED"
  | "REJECTED"
  | string;

type StaffRequest = {
  id: string;
  user_id: string;
  student_name: string;
  student_email: string;
  service_id: string;
  service_name: string;
  status: RequestStatus;
  priority: string;
  user_input: string;
  ai_confidence: number | null;
  risk_score: number | null;
  created_at: string;
  updated_at: string;
};

const STATUS_ORDER = [
  "PENDING",
  "APPROVAL_REQUIRED",
  "PROCESSING",
  "COMPLETED",
  "REJECTED",
];

const PRIORITY_ORDER = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
];

export default function StaffAnalyticsPage() {
  const router = useRouter();

  const [requests, setRequests] = useState<StaffRequest[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function fetchRequests() {
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

      const response = await fetch(
        `${API_URL}/api/requests/staff/all`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        throw new Error(
          data?.detail ||
            "You do not have staff or administrator access."
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Unable to load analytics data."
        );
      }

      setRequests(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("ANALYTICS ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load analytics."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = window.setInterval(
      fetchRequests,
      30000
    );

    return () => window.clearInterval(interval);
  }, [autoRefresh]);

  const metrics = useMemo(() => {
    const total = requests.length;

    const countStatus = (status: string) =>
      requests.filter(
        (request) => request.status === status
      ).length;

    const evaluated = requests.filter(
      (request) =>
        request.ai_confidence !== null ||
        request.risk_score !== null
    );

    const avgConfidence =
      evaluated.length > 0
        ? evaluated.reduce(
            (sum, request) =>
              sum + (request.ai_confidence ?? 0),
            0
          ) / evaluated.filter(
            (request) =>
              request.ai_confidence !== null
          ).length
        : null;

    const riskEvaluated = requests.filter(
      (request) => request.risk_score !== null
    );

    const avgRisk =
      riskEvaluated.length > 0
        ? riskEvaluated.reduce(
            (sum, request) =>
              sum + (request.risk_score ?? 0),
            0
          ) / riskEvaluated.length
        : null;

    const highRisk = requests.filter(
      (request) =>
        request.risk_score !== null &&
        request.risk_score >= 0.8
    ).length;

    const completed = countStatus("COMPLETED");
    const rejected = countStatus("REJECTED");

    return {
      total,
      pending: countStatus("PENDING"),
      approval: countStatus("APPROVAL_REQUIRED"),
      processing: countStatus("PROCESSING"),
      completed,
      rejected,
      avgConfidence,
      avgRisk,
      highRisk,
      evaluatedCount: evaluated.length,
      completionRate:
        total > 0 ? completed / total : 0,
    };
  }, [requests]);

  const statusData = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        count: requests.filter(
          (request) => request.status === status
        ).length,
      })),
    [requests]
  );

  const priorityData = useMemo(
    () =>
      PRIORITY_ORDER.map((priority) => ({
        priority,
        count: requests.filter(
          (request) => request.priority === priority
        ).length,
      })),
    [requests]
  );

  const serviceData = useMemo(() => {
    const map = new Map<string, number>();

    for (const request of requests) {
      map.set(
        request.service_name,
        (map.get(request.service_name) ?? 0) + 1
      );
    }

    return [...map.entries()]
      .map(([service, count]) => ({
        service,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [requests]);

  const recentActivity = useMemo(
    () =>
      [...requests]
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime()
        )
        .slice(0, 6),
    [requests]
  );

  function formatName(name: string) {
    return name
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function statusColor(status: string) {
    switch (status) {
      case "PENDING":
        return "bg-white/35";
      case "APPROVAL_REQUIRED":
        return "bg-amber-300";
      case "PROCESSING":
        return "bg-cyan-300";
      case "COMPLETED":
        return "bg-emerald-300";
      case "REJECTED":
        return "bg-rose-300";
      default:
        return "bg-white/25";
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.replace("/login");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#07090d] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-cyan-400/[0.045] blur-[120px]" />
        <div className="absolute -right-40 top-[15%] h-[500px] w-[500px] rounded-full bg-violet-500/[0.045] blur-[130px]" />
        <div className="absolute bottom-[-220px] left-[30%] h-[420px] w-[420px] rounded-full bg-blue-500/[0.035] blur-[120px]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#07090d]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1250px] items-center justify-between px-5 sm:px-8">
          <button
            onClick={() => router.push("/staff")}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
            title="Back to Staff Dashboard"
          >
            <ArrowLeft size={17} />
            Staff Dashboard
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`hidden items-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] sm:flex ${
                autoRefresh
                  ? "border-cyan-300/15 bg-cyan-300/[0.045] text-cyan-100/70"
                  : "border-white/[0.07] bg-white/[0.025] text-white/30"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  autoRefresh
                    ? "animate-pulse bg-cyan-200"
                    : "bg-white/25"
                }`}
              />
              Auto refresh
            </button>

            <button
              onClick={fetchRequests}
              disabled={loading}
              className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5 text-white/40 transition hover:border-cyan-300/20 hover:text-white disabled:opacity-40"
              title="Refresh"
            >
              <Activity
                size={17}
                className={
                  loading ? "animate-pulse" : ""
                }
              />
            </button>

            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-xs text-white/40 transition hover:border-violet-300/15 hover:text-white"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">
                Sign out
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-[1250px] px-5 py-9 sm:px-8 sm:py-11">
        <section className="mb-8">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-200/40">
            <BarChart3 size={13} />
            Intelligence overview
          </div>

          <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Service Analytics
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/35">
                Operational insights calculated directly
                from the live NEXUS request queue.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] text-white/35">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString(
                    "en-IN"
                  )}`
                : "Live analytics"}
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-rose-400/15 bg-rose-400/[0.055] p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={18}
                className="mt-0.5 text-rose-200"
              />
              <div>
                <p className="text-sm font-medium text-rose-100">
                  Unable to load analytics
                </p>
                <p className="mt-1 text-xs text-rose-200/55">
                  {error}
                </p>
                <button
                  onClick={fetchRequests}
                  className="mt-4 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black"
                >
                  Try again
                </button>
              </div>
            </div>
          </section>
        ) : loading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-white/[0.07] bg-white/[0.018]">
            <div className="flex items-center gap-3 text-sm text-white/35">
              <Loader2
                size={18}
                className="animate-spin"
              />
              Building analytics...
            </div>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <MetricCard
                label="Total Requests"
                value={metrics.total}
                icon={<FileText size={17} />}
                tone="cyan"
              />
              <MetricCard
                label="Processing"
                value={metrics.processing}
                icon={<Zap size={17} />}
                tone="blue"
              />
              <MetricCard
                label="Completed"
                value={metrics.completed}
                icon={<CheckCircle2 size={17} />}
                tone="green"
              />
              <MetricCard
                label="Approval Queue"
                value={metrics.approval}
                icon={<ShieldCheck size={17} />}
                tone="amber"
              />
              <MetricCard
                label="High Risk"
                value={metrics.highRisk}
                icon={<AlertTriangle size={17} />}
                tone="rose"
              />
              <MetricCard
                label="Completion Rate"
                value={`${(
                  metrics.completionRate * 100
                ).toFixed(0)}%`}
                icon={<TrendingUp size={17} />}
                tone="violet"
              />
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-2">
              <AnalyticsPanel
                title="Request Status"
                eyebrow="Workflow distribution"
                icon={<Activity size={16} />}
              >
                <div className="space-y-4">
                  {statusData.map((item) => {
                    const percentage =
                      metrics.total > 0
                        ? (item.count /
                            metrics.total) *
                          100
                        : 0;

                    return (
                      <BarRow
                        key={item.status}
                        label={formatName(item.status)}
                        count={item.count}
                        percentage={percentage}
                        dotClass={statusColor(
                          item.status
                        )}
                      />
                    );
                  })}
                </div>
              </AnalyticsPanel>

              <AnalyticsPanel
                title="Priority Distribution"
                eyebrow="Operational load"
                icon={<Clock3 size={16} />}
              >
                <div className="space-y-4">
                  {priorityData.map((item) => {
                    const percentage =
                      metrics.total > 0
                        ? (item.count /
                            metrics.total) *
                          100
                        : 0;

                    return (
                      <BarRow
                        key={item.priority}
                        label={item.priority}
                        count={item.count}
                        percentage={percentage}
                        dotClass={
                          item.priority ===
                          "URGENT"
                            ? "bg-rose-300"
                            : item.priority ===
                              "HIGH"
                            ? "bg-amber-300"
                            : item.priority ===
                              "LOW"
                            ? "bg-cyan-300"
                            : "bg-white/30"
                        }
                      />
                    );
                  })}
                </div>
              </AnalyticsPanel>
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <AnalyticsPanel
                title="Most Requested Services"
                eyebrow="Service demand"
                icon={<FileText size={16} />}
              >
                {serviceData.length === 0 ? (
                  <p className="text-xs text-white/25">
                    No service data available.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {serviceData.map(
                      (item, index) => {
                        const percentage =
                          metrics.total > 0
                            ? (item.count /
                                metrics.total) *
                              100
                            : 0;

                        return (
                          <div
                            key={item.service}
                            className="group rounded-xl border border-white/[0.055] bg-black/10 p-3.5 transition hover:border-cyan-300/10 hover:bg-white/[0.02]"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.025] text-[10px] text-white/30">
                                  {index + 1}
                                </span>
                                <span className="truncate text-xs text-white/60">
                                  {formatName(
                                    item.service
                                  )}
                                </span>
                              </div>

                              <span className="text-xs font-medium text-white/50">
                                {item.count}
                              </span>
                            </div>

                            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.04]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-300/70 via-blue-400/70 to-violet-400/70 transition-all duration-700"
                                style={{
                                  width: `${Math.max(
                                    percentage,
                                    item.count
                                      ? 4
                                      : 0
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </AnalyticsPanel>

              <AnalyticsPanel
                title="AI Evaluation"
                eyebrow="Decision intelligence"
                icon={<Sparkles size={16} />}
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <InsightCard
                    label="Average Confidence"
                    value={
                      metrics.avgConfidence !==
                      null &&
                      Number.isFinite(
                        metrics.avgConfidence
                      )
                        ? `${(
                            metrics.avgConfidence *
                            100
                          ).toFixed(1)}%`
                        : "—"
                    }
                    description={`${metrics.evaluatedCount} evaluated request${
                      metrics.evaluatedCount ===
                      1
                        ? ""
                        : "s"
                    }`}
                    icon={<Sparkles size={15} />}
                  />

                  <InsightCard
                    label="Average Risk"
                    value={
                      metrics.avgRisk !== null
                        ? `${(
                            metrics.avgRisk * 100
                          ).toFixed(1)}%`
                        : "—"
                    }
                    description={
                      metrics.highRisk > 0
                        ? `${metrics.highRisk} high-risk request${
                            metrics.highRisk === 1
                              ? ""
                              : "s"
                          }`
                        : "No high-risk requests"
                    }
                    icon={
                      metrics.highRisk > 0 ? (
                        <AlertTriangle
                          size={15}
                        />
                      ) : (
                        <ShieldCheck
                          size={15}
                        />
                      )
                    }
                  />
                </div>
              </AnalyticsPanel>
            </section>

            <section className="mt-5 rounded-[24px] border border-white/[0.07] bg-white/[0.018] p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.17em] text-white/25">
                    Latest changes
                  </p>
                  <h2 className="mt-1 text-sm font-medium">
                    Recent Request Activity
                  </h2>
                </div>

                <button
                  onClick={() => router.push("/staff")}
                  className="text-[10px] text-cyan-200/50 transition hover:text-cyan-200"
                >
                  View all requests →
                </button>
              </div>

              <div className="space-y-2">
                {recentActivity.map(
                  (request) => (
                    <button
                      key={request.id}
                      onClick={() =>
                        router.push(
                          `/staff/requests/${request.id}`
                        )
                      }
                      className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.055] bg-black/10 p-3 text-left transition hover:border-cyan-300/10 hover:bg-white/[0.02]"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${statusColor(
                          request.status
                        )}`}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-xs font-medium text-white/60">
                            {formatName(
                              request.service_name
                            )}
                          </span>
                          <span className="text-[10px] text-white/25">
                            {request.student_name}
                          </span>
                        </div>

                        <p className="mt-1 text-[10px] text-white/20">
                          {formatName(
                            request.status
                          )}
                          {" • "}
                          {formatDate(
                            request.updated_at
                          )}
                        </p>
                      </div>

                      <span className="text-[10px] text-white/15 transition group-hover:text-cyan-200/50">
                        →
                      </span>
                    </button>
                  )
                )}
              </div>
            </section>
          </>
        )}

        <p className="mt-8 text-center text-[10px] text-white/15">
          NEXUS • Staff intelligence workspace
        </p>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone:
    | "cyan"
    | "blue"
    | "green"
    | "amber"
    | "rose"
    | "violet";
}) {
  const tones = {
    cyan:
      "border-cyan-400/[0.12] bg-cyan-400/[0.045] text-cyan-200",
    blue:
      "border-blue-400/[0.12] bg-blue-400/[0.045] text-blue-200",
    green:
      "border-emerald-400/[0.12] bg-emerald-400/[0.045] text-emerald-200",
    amber:
      "border-amber-400/[0.12] bg-amber-400/[0.045] text-amber-200",
    rose:
      "border-rose-400/[0.12] bg-rose-400/[0.045] text-rose-200",
    violet:
      "border-violet-400/[0.12] bg-violet-400/[0.045] text-violet-200",
  };

  return (
    <div className="group relative overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.018] p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.11]">
      <div className="pointer-events-none absolute -right-12 -top-12 h-24 w-24 rounded-full bg-cyan-400/[0.04] blur-2xl transition duration-500 group-hover:scale-125" />

      <div
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border ${tones[tone]}`}
      >
        {icon}
      </div>

      <p className="relative mt-4 text-[10px] uppercase tracking-[0.15em] text-white/25">
        {label}
      </p>

      <p className="relative mt-1 text-2xl font-semibold tracking-tight">
        {value}
      </p>
    </div>
  );
}

function AnalyticsPanel({
  title,
  eyebrow,
  icon,
  children,
}: {
  title: string;
  eyebrow: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-white/[0.07] bg-white/[0.018] p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/[0.11] bg-gradient-to-br from-cyan-400/[0.06] to-violet-400/[0.06] text-cyan-200">
          {icon}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.17em] text-white/25">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-sm font-medium">
            {title}
          </h2>
        </div>
      </div>

      {children}
    </section>
  );
}

function BarRow({
  label,
  count,
  percentage,
  dotClass,
}: {
  label: string;
  count: number;
  percentage: number;
  dotClass: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`}
          />
          <span className="truncate text-xs text-white/50">
            {label}
          </span>
        </div>

        <span className="text-xs font-medium text-white/45">
          {count}
        </span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300/70 via-blue-400/65 to-violet-400/70 transition-all duration-700"
          style={{
            width: `${Math.max(
              percentage,
              count ? 3 : 0
            )}%`,
          }}
        />
      </div>

      <p className="mt-1 text-right text-[9px] text-white/15">
        {percentage.toFixed(0)}%
      </p>
    </div>
  );
}

function InsightCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-4">
      <div className="flex items-center gap-2 text-cyan-200/60">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.13em]">
          {label}
        </span>
      </div>

      <p className="mt-3 text-2xl font-semibold text-white/80">
        {value}
      </p>

      <p className="mt-1 text-[10px] text-white/25">
        {description}
      </p>
    </div>
  );
}