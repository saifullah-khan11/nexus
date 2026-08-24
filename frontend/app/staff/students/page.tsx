"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UserX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  ;

type Student = {
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
  enrollment_status: string;
  created_at: string;
};

function getErrorMessage(
  detail: unknown,
  fallback: string,
): string {
  if (typeof detail === "string") return detail;

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

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function StudentsManagementPage() {
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState("");

  const [selected, setSelected] = useState<Student | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function getToken() {
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("user_role");

    if (!token) {
      router.replace("/login");
      return null;
    }

    if (role !== "STAFF" && role !== "ADMIN") {
      router.replace("/");
      return null;
    }

    return token;
  }

  async function fetchStudents(isRefresh = false) {
    const token = getToken();
    if (!token) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await fetch(
        `${API_URL}/api/admin/students`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
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

      if (response.status === 403) {
        router.replace("/staff");
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data?.detail,
            "Unable to load students.",
          ),
        );
      }

      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load students.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function toggleStudentStatus(student: Student) {
    const token = getToken();
    if (!token) return;

    try {
      setUpdatingId(student.id);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/api/admin/students/${student.id}/status`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            is_active: !student.is_active,
          }),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data?.detail,
            "Unable to update student status.",
          ),
        );
      }

      setSuccess(
        student.is_active
          ? "Student account deactivated successfully."
          : "Student account activated successfully.",
      );

      setSelected(null);
      await fetchStudents(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update student status.",
      );
    } finally {
      setUpdatingId("");
    }
  }

  useEffect(() => {
    fetchStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        !query ||
        student.name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query) ||
        (student.phone || "")
          .toLowerCase()
          .includes(query) ||
        student.student_number.toLowerCase().includes(query) ||
        student.program.toLowerCase().includes(query) ||
        student.department.toLowerCase().includes(query);

      const matchesStatus =
        activeFilter === "ALL" ||
        (activeFilter === "ACTIVE" && student.is_active) ||
        (activeFilter === "INACTIVE" && !student.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [students, search, activeFilter]);

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto w-full max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => router.back()}
              className="mb-3 inline-flex items-center gap-2 text-xs text-white/35 transition hover:text-white/70"
            >
              <ArrowLeft size={14} />
              Back
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/[0.11] bg-gradient-to-br from-cyan-400/[0.06] to-violet-400/[0.06] text-cyan-200">
                <UsersIcon />
              </div>

              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  Students
                </h1>
                <p className="mt-1 text-xs text-white/30">
                  View and manage approved student accounts.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => fetchStudents(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-2.5 text-xs font-medium text-white/55 transition hover:bg-white/[0.045] hover:text-white disabled:opacity-50"
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
            <X size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              className="ml-auto text-white/30 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm text-emerald-100">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0"
            />
            <p>{success}</p>
            <button
              type="button"
              onClick={() => setSuccess("")}
              className="ml-auto text-white/30 hover:text-white"
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
                placeholder="Search name, email, registration number..."
                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.02] px-10 py-2.5 text-xs text-white outline-none placeholder:text-white/20 focus:border-cyan-300/25"
              />
            </div>

            <div className="flex items-center gap-2">
              {["ALL", "ACTIVE", "INACTIVE"].map(
                (filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() =>
                      setActiveFilter(filter)
                    }
                    className={`rounded-lg px-3 py-2 text-[10px] font-medium transition ${
                      activeFilter === filter
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
            <div className="flex min-h-[280px] items-center justify-center gap-2 text-xs text-white/30">
              <Loader2
                size={16}
                className="animate-spin"
              />
              Loading students...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-white/20">
                <UserRound size={18} />
              </div>
              <p className="mt-4 text-sm font-medium text-white/45">
                No students found
              </p>
              <p className="mt-1 text-xs text-white/20">
                Try changing the search or status filter.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => setSelected(student)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.06] bg-black/10 p-4 text-left transition hover:border-white/[0.10] hover:bg-white/[0.025]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/[0.10] bg-gradient-to-br from-cyan-400/[0.05] to-violet-400/[0.05] text-cyan-200/75">
                    <UserRound size={17} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-white/80">
                        {student.name}
                      </p>

                      <span
                        className={`rounded-full border px-2 py-1 text-[9px] font-medium ${
                          student.is_active
                            ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200"
                            : "border-rose-400/20 bg-rose-400/[0.08] text-rose-200"
                        }`}
                      >
                        {student.is_active
                          ? "ACTIVE"
                          : "INACTIVE"}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/25">
                      <span>
                        {student.student_number}
                      </span>
                      <span>{student.email}</span>
                      <span>{student.program}</span>
                    </div>
                  </div>

                  <div className="hidden text-right sm:block">
                    <p className="text-[9px] uppercase tracking-[0.14em] text-white/15">
                      Academic
                    </p>
                    <p className="mt-1 text-[10px] text-white/30">
                      Year {student.year} · Sem{" "}
                      {student.semester}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/[0.08] bg-[#0b0e13] shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/[0.11] bg-gradient-to-br from-cyan-400/[0.06] to-violet-400/[0.06] text-cyan-200">
                  <ShieldCheck size={18} />
                </div>

                <div>
                  <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                    Student profile
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {selected.name}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl p-2 text-white/30 hover:bg-white/5 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <InfoCard
                label="Contact"
                rows={[
                  ["Email", selected.email],
                  [
                    "Phone",
                    selected.phone || "Not provided",
                  ],
                ]}
              />

              <InfoCard
                label="Academic"
                rows={[
                  [
                    "Registration",
                    selected.student_number,
                  ],
                  ["Program", selected.program],
                  ["Department", selected.department],
                  [
                    "Year / Semester",
                    `Year ${selected.year} · Semester ${selected.semester}`,
                  ],
                ]}
              />

              <InfoCard
                label="Account"
                rows={[
                  ["Role", selected.role],
                  [
                    "Status",
                    selected.is_active
                      ? "Active"
                      : "Inactive",
                  ],
                  [
                    "Enrollment",
                    selected.enrollment_status,
                  ],
                  [
                    "Created",
                    formatDate(selected.created_at),
                  ],
                ]}
              />

              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                  Account action
                </p>

                <p className="mt-2 text-xs leading-5 text-white/30">
                  {selected.is_active
                    ? "Deactivating this account prevents the student from using it while keeping their records intact."
                    : "Activating this account allows the student to log in again."}
                </p>

                <button
                  type="button"
                  disabled={updatingId === selected.id}
                  onClick={() =>
                    toggleStudentStatus(selected)
                  }
                  className={`mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${
                    selected.is_active
                      ? "border border-rose-400/15 bg-rose-400/[0.06] text-rose-200 hover:bg-rose-400/[0.10]"
                      : "bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 text-black shadow-lg shadow-cyan-500/10 hover:-translate-y-0.5"
                  }`}
                >
                  {updatingId === selected.id ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : selected.is_active ? (
                    <>
                      <UserX size={16} />
                      Deactivate account
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Activate account
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function UsersIcon() {
  return (
    <div className="relative">
      <UserRound size={17} />
      <span className="absolute -right-2 -bottom-1 block h-2 w-2 rounded-full bg-cyan-300/70" />
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
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
        {label}
      </p>

      <div className="mt-4 space-y-3">
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