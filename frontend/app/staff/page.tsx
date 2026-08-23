"use client";

import {
  Activity,
  Bell,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Clock3,
  FileText,
  Filter,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  XCircle,
  Zap,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://localhost:8000";

type RequestStatus =
  | "PENDING"
  | "APPROVAL_REQUIRED"
  | "PROCESSING"
  | "COMPLETED"
  | "REJECTED";

type StaffRequest = {
  id: string;
  user_id: string;
  student_name: string;
  student_email: string;
  service_id: string;
  service_name: string;
  status: RequestStatus | string;
  priority: string;
  user_input: string;
  ai_confidence: number | null;
  risk_score: number | null;
  created_at: string;
  updated_at: string;
};

type StaffNotification = {
  id: string;
  request_id?: string | null;
  signup_request_id?: string | null;
  title: string;
  message: string;
  notification_type?: string;
  is_read: boolean;
  created_at: string;
};

const statuses = [
  "ALL",
  "PENDING",
  "APPROVAL_REQUIRED",
  "PROCESSING",
  "COMPLETED",
  "REJECTED",
];

const priorities = [
  "ALL",
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
];

export default function StaffPage() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const PAGE_SIZE = 8;
  const [showOnlyActionable, setShowOnlyActionable] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountRole, setAccountRole] = useState("STAFF");

  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [markingNotificationsRead, setMarkingNotificationsRead] =
    useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  async function fetchNotifications() {
    const token = localStorage.getItem("access_token");

    if (!token) return;

    try {
      setNotificationsLoading(true);

      const response = await fetch(
        `${API_URL}/api/notifications`,
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

      if (!response.ok) {
        throw new Error("Unable to load notifications.");
      }

      const data = await response.json();

      const nextNotifications = Array.isArray(data)
        ? data
        : Array.isArray(data?.notifications)
          ? data.notifications
          : [];

      setNotifications(nextNotifications);
      setUnreadNotifications(
        typeof data?.unread_count === "number"
          ? data.unread_count
          : nextNotifications.filter(
              (item: StaffNotification) => !item.is_read
            ).length
      );
    } catch (error) {
      console.error("STAFF NOTIFICATIONS ERROR:", error);
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function markAllNotificationsRead() {
    const token = localStorage.getItem("access_token");

    if (
      !token ||
      markingNotificationsRead ||
      unreadNotifications === 0
    ) {
      return;
    }

    try {
      setMarkingNotificationsRead(true);

      const response = await fetch(
        `${API_URL}/api/notifications/read-all`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Unable to mark notifications as read.");
      }

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          is_read: true,
        }))
      );
      setUnreadNotifications(0);
    } catch (error) {
      console.error(
        "STAFF MARK ALL NOTIFICATIONS ERROR:",
        error
      );
    } finally {
      setMarkingNotificationsRead(false);
    }
  }

  async function openNotification(
    notification: StaffNotification
  ) {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    if (!notification.is_read) {
      try {
        const response = await fetch(
          `${API_URL}/api/notifications/${notification.id}/read`,
          {
            method: "PATCH",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          setNotifications((current) =>
            current.map((item) =>
              item.id === notification.id
                ? { ...item, is_read: true }
                : item
            )
          );

          setUnreadNotifications((count) =>
            Math.max(0, count - 1)
          );
        }
      } catch (error) {
        console.error(
          "STAFF MARK NOTIFICATION READ ERROR:",
          error
        );
      }
    }

    setNotificationsOpen(false);

    if (notification.signup_request_id) {
      router.push(
        `/staff/signup-requests`
      );
      return;
    }

    if (notification.request_id) {
      router.push(
        `/staff/requests/${notification.request_id}`
      );
    }
  }

  async function fetchStaffRequests() {
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("user_role");
    if (role) setAccountRole(role);

    if (!token) {
      router.replace("/login");
      return;
    }

    if (role !== "STAFF" && role !== "ADMIN") {
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
        setError(
          data.detail ||
            "You do not have staff or administrator access."
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to load staff requests."
        );
      }

      setRequests(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("STAFF REQUESTS ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load staff requests."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStaffRequests();
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = window.setInterval(() => {
      fetchStaffRequests();
      fetchNotifications();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [autoRefresh]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement;

      if (!target.closest("[data-staff-notification-menu]")) {
        setNotificationsOpen(false);
      }
    }

    if (notificationsOpen) {
      document.addEventListener(
        "mousedown",
        handlePointerDown
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
    };
  }, [notificationsOpen]);

  const counts = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter(
        (request) => request.status === "PENDING"
      ).length,
      approval: requests.filter(
        (request) =>
          request.status === "APPROVAL_REQUIRED"
      ).length,
      processing: requests.filter(
        (request) => request.status === "PROCESSING"
      ).length,
      completed: requests.filter(
        (request) => request.status === "COMPLETED"
      ).length,
      rejected: requests.filter(
        (request) => request.status === "REJECTED"
      ).length,
    };
  }, [requests]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, priorityFilter, showOnlyActionable]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesSearch =
        !query ||
        request.student_name
          .toLowerCase()
          .includes(query) ||
        request.student_email
          .toLowerCase()
          .includes(query) ||
        request.service_name
          .toLowerCase()
          .includes(query) ||
        request.user_input
          .toLowerCase()
          .includes(query) ||
        request.id.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        request.status === statusFilter;

      const matchesPriority =
        priorityFilter === "ALL" ||
        request.priority === priorityFilter;

      const matchesActionable =
        !showOnlyActionable ||
        request.status === "APPROVAL_REQUIRED" ||
        request.status === "PENDING" ||
        request.status === "PROCESSING";

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesActionable
      );
    });
  }, [
    requests,
    search,
    statusFilter,
    priorityFilter,
    showOnlyActionable,
  ]);

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

  function getStatusStyle(status: string) {
    switch (status) {
      case "PENDING":
        return {
          badge:
            "border-white/[0.09] bg-white/[0.05] text-white/60",
          dot: "bg-white/45",
        };

      case "APPROVAL_REQUIRED":
        return {
          badge:
            "border-amber-400/20 bg-amber-400/[0.08] text-amber-200",
          dot: "bg-amber-300",
        };

      case "PROCESSING":
        return {
          badge:
            "border-cyan-400/20 bg-gradient-to-r from-cyan-400/[0.10] to-violet-400/[0.10] text-cyan-100",
          dot: "bg-cyan-300",
        };

      case "COMPLETED":
        return {
          badge:
            "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200",
          dot: "bg-emerald-300",
        };

      case "REJECTED":
        return {
          badge:
            "border-rose-400/20 bg-rose-400/[0.08] text-rose-200",
          dot: "bg-rose-300",
        };

      default:
        return {
          badge:
            "border-white/[0.08] bg-white/[0.04] text-white/50",
          dot: "bg-white/30",
        };
    }
  }

  function getPriorityStyle(priority: string) {
    switch (priority) {
      case "URGENT":
        return "text-rose-200";
      case "HIGH":
        return "text-amber-200";
      case "NORMAL":
        return "text-white/45";
      case "LOW":
        return "text-cyan-200/65";
      default:
        return "text-white/40";
    }
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.replace("/login");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#07090d] text-white">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-cyan-400/[0.045] blur-[120px]" />
        <div className="absolute -right-40 top-[18%] h-[480px] w-[480px] rounded-full bg-violet-500/[0.045] blur-[130px]" />
        <div className="absolute bottom-[-220px] left-[30%] h-[420px] w-[420px] rounded-full bg-blue-500/[0.035] blur-[120px]" />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close staff sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Staff sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col border-r border-white/[0.07] bg-[#0b0e13] px-5 py-6 shadow-2xl shadow-black/30 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="group flex items-center gap-3"
          >
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white text-black shadow-lg shadow-cyan-500/10">
              <div className="absolute -inset-4 animate-[spin_5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(34,211,238,0.9)_90deg,rgba(139,92,246,0.9)_210deg,transparent_320deg)] opacity-50" />
              <div className="relative flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#f7f8fa]">
                <Sparkles size={17} strokeWidth={2.3} />
              </div>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold tracking-tight">NEXUS</p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/25">
                Staff Workspace
              </p>
            </div>
          </button>

          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-white/45 transition hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="mt-10 space-y-1.5">
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              router.push("/staff");
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-cyan-300/[0.12] bg-cyan-300/[0.05] px-3 py-3 text-left text-xs font-medium text-cyan-100/80 transition hover:bg-cyan-300/[0.08]"
          >
            <LayoutDashboard size={17} />
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              router.push("/staff/signup-requests");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs text-white/50 transition hover:bg-white/5 hover:text-white"
          >
            <ShieldCheck size={17} />
            Signup Requests
          </button>

          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              router.push("/staff/students");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs text-white/50 transition hover:bg-white/5 hover:text-white"
          >
            <Users size={17} />
            Students
          </button>

          {accountRole === "ADMIN" && (
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                router.push("/staff/staff-management");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs text-white/50 transition hover:bg-white/5 hover:text-white"
            >
              <Settings2 size={17} />
              Staff Management
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              router.push("/staff/analytics");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs text-white/50 transition hover:bg-white/5 hover:text-white"
          >
            <BarChart3 size={17} />
            Analytics
          </button>
        </nav>

        <div className="mt-auto">
          <div className="mb-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-white/70">
                NEXUS is online
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-5 text-white/30">
              Staff tools are available from the sidebar.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-xs text-white/45 transition hover:bg-rose-400/[0.05] hover:text-rose-100"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="relative min-h-screen lg:pl-[260px]">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07090d]/85 backdrop-blur-xl">
          <div className="mx-auto flex h-[76px] max-w-[1250px] items-center justify-between px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Open sidebar"
                onClick={() => setSidebarOpen(true)}
                className="rounded-xl border border-white/[0.08] p-2.5 text-white/60 transition hover:bg-white/5 hover:text-white lg:hidden"
              >
                <Menu size={19} />
              </button>

              <div className="hidden items-center gap-3 lg:flex">
                <span className="text-sm text-white/35">Workspace</span>
                <ChevronRight size={14} className="text-white/15" />
                <span className="text-sm text-white/75">Dashboard</span>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
            <button
              onClick={fetchStaffRequests}
              disabled={loading}
              className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5 text-white/40 transition hover:border-cyan-300/20 hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
              title="Refresh requests"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan-200/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <Activity
                size={17}
                className={`relative ${
                  loading ? "animate-pulse" : ""
                }`}
              />
            </button>

            <button
              onClick={() => setAutoRefresh((value) => !value)}
              className={`flex items-center gap-2 rounded-xl border px-2.5 py-2.5 text-[10px] transition sm:px-3 ${
                autoRefresh
                  ? "border-cyan-300/15 bg-cyan-300/[0.045] text-cyan-100/70"
                  : "border-white/[0.07] bg-white/[0.025] text-white/30"
              }`}
              title="Toggle automatic refresh"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  autoRefresh
                    ? "animate-pulse bg-cyan-200"
                    : "bg-white/25"
                }`}
              />
              <span className="hidden sm:inline">Auto refresh</span>
            </button>

            <div
              className="relative"
              data-staff-notification-menu
            >
              <button
                type="button"
                onClick={() =>
                  setNotificationsOpen((open) => !open)
                }
                aria-expanded={notificationsOpen}
                aria-haspopup="menu"
                title="Notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-white/40 transition hover:border-cyan-300/15 hover:bg-white/[0.05] hover:text-white"
              >
                <Bell size={17} />

                {unreadNotifications > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#07090d] bg-rose-400 px-1 text-[9px] font-semibold text-white">
                    {unreadNotifications > 99
                      ? "99+"
                      : unreadNotifications}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div
                  role="menu"
                  className="fixed left-2 right-2 top-[84px] z-50 w-auto overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0e13]/95 shadow-2xl shadow-black/40 backdrop-blur-xl sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-[340px] sm:max-w-[calc(100vw-2rem)]"
                >
                  <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        Notifications
                      </p>
                      <p className="mt-0.5 text-[10px] text-white/25">
                        {unreadNotifications} unread
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      disabled={
                        markingNotificationsRead ||
                        unreadNotifications === 0
                      }
                      className="text-[10px] text-cyan-200/55 transition hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      {markingNotificationsRead
                        ? "Marking..."
                        : "Mark all as read"}
                    </button>
                  </div>

                  <div className="max-h-[390px] overflow-y-auto p-2">
                    {notificationsLoading ? (
                      <div className="flex items-center justify-center gap-2 px-4 py-10 text-xs text-white/25">
                        <Loader2
                          size={14}
                          className="animate-spin"
                        />
                        Loading notifications...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="px-5 py-10 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025]">
                          <Bell
                            size={16}
                            className="text-white/20"
                          />
                        </div>

                        <p className="mt-3 text-xs font-medium text-white/45">
                          No notifications
                        </p>

                        <p className="mt-1 text-[10px] leading-5 text-white/20">
                          New request activity will appear here.
                        </p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          role="menuitem"
                          onClick={() =>
                            openNotification(notification)
                          }
                          className={`flex w-full gap-3 rounded-xl p-3 text-left transition hover:bg-white/[0.045] ${
                            notification.is_read
                              ? "opacity-55"
                              : "bg-cyan-300/[0.035]"
                          }`}
                        >
                          <div
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                              notification.is_read
                                ? "border-white/[0.07] bg-white/[0.025] text-white/25"
                                : "border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-200"
                            }`}
                          >
                            {notification.notification_type ===
                            "STUDENT_SIGNUP" ? (
                              <UserCircle size={14} />
                            ) : notification.notification_type ===
                            "REQUEST_REJECTED" ? (
                              <XCircle size={14} />
                            ) : notification.notification_type ===
                              "REQUEST_COMPLETED" ? (
                              <CheckCircle2 size={14} />
                            ) : notification.notification_type ===
                              "APPROVAL_REQUIRED" ? (
                              <ShieldCheck size={14} />
                            ) : (
                              <Bell size={14} />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-medium text-white/75">
                                {notification.title}
                              </p>

                              {!notification.is_read && (
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                              )}
                            </div>

                            <p className="mt-1 text-[10px] leading-4 text-white/30">
                              {notification.message}
                            </p>

                            <p className="mt-2 text-[9px] text-white/15">
                              {formatDate(
                                notification.created_at
                              )}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-2 transition hover:border-violet-300/15 hover:bg-white/[0.05]"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[10px] font-semibold text-black">
                  {accountRole === "ADMIN" ? "A" : "S"}
                </div>
                <span className="hidden text-xs text-white/45 sm:inline">
                  {accountRole}
                </span>
                <ChevronDown
                  size={13}
                  className={`text-white/25 transition ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {profileOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+10px)] z-50 w-60 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0e13]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl"
                >
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
                        <UserCircle size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          NEXUS {accountRole === "ADMIN" ? "Admin" : "Staff"}
                        </p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan-200/40">
                          {accountRole} account
                        </p>
                      </div>
                    </div>
                  </div>

                  {accountRole === "ADMIN" && (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setProfileOpen(false);
                          router.push("/staff");
                        }}
                        className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-white/50 transition hover:bg-white/5 hover:text-white"
                      >
                        <ShieldCheck size={16} />
                        Staff workspace
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setProfileOpen(false);
                          router.push("/staff/staff-management");
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-white/50 transition hover:bg-white/5 hover:text-white"
                      >
                        <Settings2 size={16} />
                        Staff management
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-rose-200/65 transition hover:bg-rose-400/[0.06] hover:text-rose-100"
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-[1250px] px-5 py-9 sm:px-8 sm:py-11">
        {/* Heading */}
        <section className="mb-8">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-200/40">
            <ShieldCheck size={13} />
            Authorized workspace
          </div>

          <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Request Operations
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/35">
                Review, process, evaluate, and manage
                university service requests from one
                workspace.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              
              <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] text-white/35">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                Live request queue
              </div>
            </div>
          </div>
        </section>

        {/* Error */}
        {!loading && error && (
          <section className="mb-7 overflow-hidden rounded-2xl border border-rose-400/15 bg-rose-400/[0.055] p-6">
            <div className="flex items-start gap-3">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0 text-rose-200"
              />

              <div>
                <p className="text-sm font-medium text-rose-100">
                  Unable to access staff workspace
                </p>

                <p className="mt-1 text-xs leading-5 text-rose-200/55">
                  {error}
                </p>

                <button
                  onClick={fetchStaffRequests}
                  className="mt-4 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-white/90"
                >
                  Try again
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Stats */}
        {!error && (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Total"
              value={counts.total}
              icon={<FileText size={17} />}
              accent="cyan"
              loading={loading}
            />

            <StatCard
              label="Pending"
              value={counts.pending}
              icon={<Clock3 size={17} />}
              accent="neutral"
              loading={loading}
            />

            <StatCard
              label="Approval"
              value={counts.approval}
              icon={<ShieldCheck size={17} />}
              accent="amber"
              loading={loading}
            />

            <StatCard
              label="Processing"
              value={counts.processing}
              icon={<Zap size={17} />}
              accent="blue"
              loading={loading}
            />

            <StatCard
              label="Completed"
              value={counts.completed}
              icon={<CheckCircle2 size={17} />}
              accent="green"
              loading={loading}
            />

            <StatCard
              label="Rejected"
              value={counts.rejected}
              icon={<XCircle size={17} />}
              accent="rose"
              loading={loading}
            />
          </section>
        )}

        {/* Filters */}
        {!error && (
          <section className="mt-8 rounded-[24px] border border-white/[0.07] bg-white/[0.018] p-4 sm:p-5">
            <div className="flex flex-col gap-3 xl:flex-row">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/25"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search student, service, email, request..."
                  className="h-11 w-full rounded-xl border border-white/[0.07] bg-black/10 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-cyan-400/20 focus:ring-1 focus:ring-cyan-400/10"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex h-11 items-center gap-2 rounded-xl border border-white/[0.07] bg-black/10 px-3 text-white/25">
                  <Filter size={14} />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                  className="h-11 min-w-[180px] rounded-xl border border-white/[0.07] bg-[#0b0e13] px-3 text-xs text-white/55 outline-none focus:border-cyan-400/20"
                >
                  {statuses.map((status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status === "ALL"
                        ? "All statuses"
                        : formatStatus(status)}
                    </option>
                  ))}
                </select>

                <select
                  value={priorityFilter}
                  onChange={(event) =>
                    setPriorityFilter(event.target.value)
                  }
                  className="h-11 min-w-[150px] rounded-xl border border-white/[0.07] bg-[#0b0e13] px-3 text-xs text-white/55 outline-none focus:border-cyan-400/20"
                >
                  {priorities.map((priority) => (
                    <option
                      key={priority}
                      value={priority}
                    >
                      {priority === "ALL"
                        ? "All priorities"
                        : priority}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowOnlyActionable((value) => !value)}
                className={`group relative overflow-hidden rounded-full p-[1px] transition ${
                  showOnlyActionable
                    ? "shadow-[0_0_22px_rgba(34,211,238,0.08)]"
                    : ""
                }`}
              >
                <span
                  className={`absolute inset-0 bg-gradient-to-r from-cyan-400/70 via-blue-500/60 to-violet-500/70 transition-opacity ${
                    showOnlyActionable
                      ? "opacity-100"
                      : "opacity-35 group-hover:opacity-75"
                  }`}
                />
                <span className="relative flex items-center gap-2 rounded-full bg-[#0b0e13] px-3 py-1.5 text-[10px] font-medium text-cyan-100/65 transition group-hover:text-white">
                  <Settings2 size={12} />
                  Needs attention
                </span>
              </button>

              {showOnlyActionable && (
                <span className="text-[10px] text-cyan-200/35">
                  Approval, pending, and processing requests
                </span>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-4 px-1 text-[10px] text-white/25">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  {loading
                    ? "Loading requests..."
                    : `${filteredRequests.length} request${
                        filteredRequests.length === 1
                          ? ""
                          : "s"
                      } shown`}
                </span>

                {!loading && counts.approval + counts.pending + counts.processing > 0 && (
                  <span className="text-amber-200/35">
                    {counts.approval + counts.pending + counts.processing} active
                  </span>
                )}
              </div>

              <span className="hidden items-center gap-2 sm:flex">
                {lastUpdated && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-emerald-300/60" />
                    Updated{" "}
                    {lastUpdated.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </>
                )}
              </span>

              {(search ||
                statusFilter !== "ALL" ||
                priorityFilter !== "ALL" ||
                showOnlyActionable) && (
                <button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    setPriorityFilter("ALL");
                    setShowOnlyActionable(false);
                  }}
                  className="text-cyan-200/50 transition hover:text-cyan-200"
                >
                  Clear filters
                </button>
              )}
            </div>
          </section>
        )}

        {/* Queue */}
        {!error && (
          <section className="mt-5">
            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-[24px] border border-white/[0.07] bg-white/[0.018]">
                <div className="flex items-center gap-3 text-sm text-white/35">
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                  Loading request queue...
                </div>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[24px] border border-white/[0.07] bg-white/[0.018] text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025]">
                  <Search
                    size={19}
                    className="text-white/25"
                  />
                </div>

                <h2 className="text-sm font-medium">
                  No matching requests
                </h2>

                <p className="mt-2 max-w-sm text-xs leading-5 text-white/25">
                  Try changing the search term or clearing
                  one of the filters.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedRequests.map((request) => {
                  const statusStyle =
                    getStatusStyle(request.status);

                  return (
                    <button
                      key={request.id}
                      onClick={() =>
                        router.push(
                          `/staff/requests/${request.id}`
                        )
                      }
                      className="group relative w-full overflow-hidden rounded-[22px] border border-white/[0.07] bg-white/[0.02] p-5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/[0.16] hover:bg-white/[0.035]"
                    >
                      {request.status ===
                        "PROCESSING" && (
                        <>
                          <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-300/80 via-blue-400/70 to-violet-400/80 opacity-90" />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-400/[0.018] via-transparent to-violet-400/[0.018] opacity-80" />
                        </>
                      )}

                      {request.status ===
                        "APPROVAL_REQUIRED" && (
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-200/80 to-orange-400/60" />
                      )}

                      {request.status ===
                        "COMPLETED" && (
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-300/70 to-cyan-300/40" />
                      )}

                      {request.status ===
                        "REJECTED" && (
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-rose-300/70 to-violet-400/40" />
                      )}

                      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]">
                            {request.status ===
                            "PROCESSING" ? (
                              <>
                                <div className="absolute -inset-8 animate-[spin_5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(34,211,238,0.5)_100deg,rgba(139,92,246,0.5)_210deg,transparent_310deg)]" />
                                <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-[#0b0e13]">
                                  <Zap
                                    size={17}
                                    className="text-cyan-200"
                                  />
                                </div>
                              </>
                            ) : (
                              <FileText
                                size={18}
                                className="text-white/40"
                              />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="truncate text-sm font-medium text-white">
                                {formatServiceName(
                                  request.service_name
                                )}
                              </h2>

                              <span
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusStyle.badge}`}
                              >
                                <span
                                  className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${statusStyle.dot}`}
                                />
                                {formatStatus(
                                  request.status
                                )}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/30">
                              <span className="font-medium text-white/50">
                                {request.student_name}
                              </span>

                              <span className="truncate">
                                {request.student_email}
                              </span>
                            </div>

                            <p className="mt-2 max-w-3xl truncate text-xs text-white/25">
                              {request.user_input}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center justify-between gap-5 lg:justify-end">
                          <div className="hidden text-right sm:block">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-white/20">
                              Priority
                            </p>
                            <p
                              className={`mt-1 text-xs font-medium ${getPriorityStyle(
                                request.priority
                              )}`}
                            >
                              {request.priority}
                            </p>
                          </div>

                          <div className="hidden text-right md:block">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-white/20">
                              Updated
                            </p>
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/35">
                              <Clock3 size={12} />
                              {formatDate(
                                request.updated_at
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {(request.status === "APPROVAL_REQUIRED" ||
                              request.status === "PENDING" ||
                              request.status === "PROCESSING") && (
                              <span className="hidden rounded-full border border-cyan-300/10 bg-cyan-300/[0.035] px-2 py-1 text-[9px] text-cyan-100/40 lg:inline">
                                Review
                              </span>
                            )}

                            <ChevronRight
                              size={19}
                              className="text-white/20 transition group-hover:translate-x-1 group-hover:text-cyan-200/70"
                            />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}

              {filteredRequests.length > PAGE_SIZE && (
                <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-[20px] border border-white/[0.07] bg-white/[0.018] px-4 py-3 sm:flex-row">
                  <p className="text-[10px] text-white/25">
                    Showing {pageStart}-{pageEnd} of {filteredRequests.length} requests
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

                    <span className="min-w-16 text-center text-[10px] text-white/30">
                      Page {currentPage} of {totalPages}
                    </span>

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
              </div>
            )}
          </section>
        )}

        <p className="mt-8 text-center text-[10px] text-white/15">
          NEXUS • Staff operations workspace
        </p>
      </div>
          </div>
</main>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
  loading,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  accent:
    | "cyan"
    | "neutral"
    | "amber"
    | "blue"
    | "green"
    | "rose";
  loading: boolean;
}) {
  const accentStyles = {
    cyan: "text-cyan-200 border-cyan-400/[0.12] bg-cyan-400/[0.045]",
    neutral: "text-white/60 border-white/[0.07] bg-white/[0.02]",
    amber: "text-amber-200 border-amber-400/[0.12] bg-amber-400/[0.045]",
    blue: "text-blue-200 border-blue-400/[0.12] bg-blue-400/[0.045]",
    green: "text-emerald-200 border-emerald-400/[0.12] bg-emerald-400/[0.045]",
    rose: "text-rose-200 border-rose-400/[0.12] bg-rose-400/[0.045]",
  };

  return (
    <div className="group relative overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.018] p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.11] hover:bg-white/[0.025]">
      {(accent === "cyan" || accent === "blue") && (
        <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-cyan-400/[0.055] blur-2xl transition duration-500 group-hover:scale-125" />
      )}

      {accent === "blue" && (
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-24 w-24 rounded-full bg-violet-400/[0.045] blur-2xl transition duration-500 group-hover:scale-125" />
      )}

      <div
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border ${accentStyles[accent]}`}
      >
        {icon}
      </div>

      <p className="relative mt-4 text-[10px] uppercase tracking-[0.15em] text-white/25">
        {label}
      </p>

      {loading ? (
        <div className="mt-1.5 h-8 w-10 animate-pulse rounded-lg bg-white/[0.05]" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tracking-tight">
          {value}
        </p>
      )}
    </div>
  );
}