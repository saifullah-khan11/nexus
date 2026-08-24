"use client";

import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCircle,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  

type StudentProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  student_number: string;
  program: string;
  department: string;
  year: number;
  semester: number;
  academic_session: string | null;
  enrollment_status: string;
  created_at: string;
};


function errorMessage(detail: unknown, fallback: string) {
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (
          typeof item === "object" &&
          item !== null &&
          "msg" in item
        ) {
          return String((item as { msg: unknown }).msg);
        }

        return String(item);
      })
      .join(", ");
  }

  return fallback;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusClass(status: string) {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200";
    case "REJECTED":
      return "border-rose-400/20 bg-rose-400/[0.08] text-rose-200";
    case "APPROVAL_REQUIRED":
      return "border-amber-400/20 bg-amber-400/[0.08] text-amber-200";
    case "PROCESSING":
      return "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-100";
    default:
      return "border-white/[0.08] bg-white/[0.04] text-white/55";
  }
}

export default function StudentDashboardPage() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  function getToken() {
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("user_role");

    if (!token) {
      router.replace("/login");
      return null;
    }

    if (role !== "STUDENT") {
      router.replace(
        role === "STAFF" || role === "ADMIN"
          ? "/staff"
          : "/login",
      );
      return null;
    }

    return token;
  }

  async function loadDashboard(showRefresh = false) {
    const token = getToken();
    if (!token) return;

    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const profileResponse = await fetch(
        `${API_URL}/api/student/profile`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        },
      );

      const profileData =
        await profileResponse.json().catch(() => null);

      if (profileResponse.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.replace("/login");
        return;
      }

      if (profileResponse.status === 403) {
        router.replace("/login");
        return;
      }

      if (!profileResponse.ok) {
        throw new Error(
          errorMessage(
            profileData?.detail,
            "Unable to load student profile.",
          ),
        );
      }

      setProfile(profileData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load student dashboard.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.replace("/login");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#07090d] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-cyan-400/[0.045] blur-[120px]" />
        <div className="absolute -right-40 top-[18%] h-[480px] w-[480px] rounded-full bg-violet-500/[0.045] blur-[130px]" />
        <div className="absolute bottom-[-220px] left-[30%] h-[420px] w-[420px] rounded-full bg-blue-500/[0.035] blur-[120px]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#07090d]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1250px] items-center justify-between px-5 sm:px-8">
          <button
            type="button"
            onClick={() => router.push("/student")}
            className="group flex items-center gap-3"
          >
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white text-black shadow-lg shadow-cyan-500/10">
              <div className="absolute -inset-4 animate-[spin_5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(34,211,238,0.9)_90deg,rgba(139,92,246,0.9)_210deg,transparent_320deg)] opacity-50" />
              <div className="relative flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#f7f8fa]">
                <Sparkles size={17} strokeWidth={2.3} />
              </div>
            </div>

            <div className="text-left">
              <p className="text-sm font-semibold tracking-tight">
                NEXUS
              </p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/25">
                Student Workspace
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2">

            <button
              type="button"
              onClick={() => undefined}
              className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-2 transition hover:border-violet-300/15 hover:bg-white/[0.05]"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[10px] font-semibold text-black">
                {profile?.name?.slice(0, 1).toUpperCase() || "S"}
              </div>
              <span className="hidden text-xs text-white/45 sm:inline">
                Student
              </span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-white/35 transition hover:border-rose-300/15 hover:bg-rose-400/[0.05] hover:text-rose-100"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-[1250px] px-5 py-9 sm:px-8 sm:py-11">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 text-xs font-semibold text-white/65 transition hover:border-cyan-300/20 hover:bg-white/[0.045] hover:text-white"
        >
          <ArrowLeft size={14} />
          Back to dashboard
        </button>

        <section className="mb-8">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-200/40">
            <ShieldCheck size={13} />
            Student workspace
          </div>

          <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {loading
                  ? "Welcome"
                  : `Welcome, ${profile?.name || "Student"}`}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">
                View your personal, student, academic, and account
                information from one workspace.
              </p>
            </div>

            <button
              type="button"
              disabled={refreshing}
              onClick={() => loadDashboard(true)}
              className="inline-flex items-center gap-2 self-start rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-2.5 text-xs font-medium text-white/50 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40 lg:self-auto"
            >
              <RefreshCw
                size={14}
                className={
                  refreshing ? "animate-spin" : ""
                }
              />
              Refresh
            </button>
          </div>
        </section>

        {error && (
          <section className="mb-7 rounded-2xl border border-rose-400/15 bg-rose-400/[0.055] p-5">
            <div className="flex items-start gap-3">
              <AlertCircle
                size={18}
                className="mt-0.5 text-rose-200"
              />
              <div>
                <p className="text-sm font-medium text-rose-100">
                  Unable to load student workspace
                </p>
                <p className="mt-1 text-xs text-rose-200/55">
                  {error}
                </p>
              </div>
            </div>
          </section>
        )}

        {loading ? (
          <div className="flex min-h-[380px] items-center justify-center rounded-[24px] border border-white/[0.07] bg-white/[0.018]">
            <div className="flex items-center gap-3 text-sm text-white/35">
              <Loader2
                size={18}
                className="animate-spin"
              />
              Loading student workspace...
            </div>
          </div>
        ) : profile ? (
          <>
            <section className="grid gap-5 lg:grid-cols-2">
              <InfoCard
                label="Personal information"
                rows={[
                  ["Full name", profile.name],
                  ["Email", profile.email],
                  ["Phone", profile.phone || "Not provided"],
                ]}
              />

              <InfoCard
                label="Student information"
                rows={[
                  ["Registration No.", profile.student_number],
                  ["Role", profile.role],
                  ["Enrollment status", profile.enrollment_status],
                ]}
              />

              <InfoCard
                label="Academic information"
                rows={[
                  ["Program", profile.program],
                  ["Department", profile.department],
                  [
                    "Year / Semester",
                    `Year ${profile.year} / Semester ${profile.semester}`,
                  ],
                  [
                    "Academic year",
                    profile.academic_session || "Not provided",
                  ],
                ]}
              />

              <InfoCard
                label="Account information"
                rows={[
                  [
                    "Account status",
                    profile.is_active ? "Active" : "Inactive",
                  ],
                  ["Registered", formatDate(profile.created_at)],
                ]}
              />
            </section>

          </>
       ) : null}

        <p className="mt-8 text-center text-[10px] text-white/15">
          NEXUS • Student workspace
        </p>
      </div>

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
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] py-2.5 last:border-0 last:pb-0">
      <span className="text-[10px] text-white/20">
        {label}
      </span>
      <span className="text-right text-[11px] text-white/60">
        {value}
      </span>
    </div>
  );
}

function InfoCard({
  label,
  rows,
}: {
  label: string;
  rows: [string, string][];
}) {
  return (
    <div className="rounded-2xl border border-cyan-300/[0.08] bg-gradient-to-br from-white/[0.025] to-cyan-300/[0.018] p-5 shadow-lg shadow-black/10">
      <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
        {label}
      </p>

      <div className="mt-3 space-y-2">
        {rows.map(([key, value]) => (
          <div
            key={key}
            className="flex items-start justify-between gap-4"
          >
            <span className="text-[10px] text-white/20">
              {key}
            </span>
            <span className="text-right text-[11px] text-white/60">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}