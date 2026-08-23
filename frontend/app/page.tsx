"use client";

import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Clock3,
  Info,
  RefreshCw,
  Search,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  FileText,
  UserCircle,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect,useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://localhost:8000";

const services = [
  {
    title: "Bonafide Certificate",
    description: "Get your enrollment certificate",
    icon: GraduationCap,
    message: "I need a bonafide certificate",
  },
  {
    title: "Academic Transcript",
    description: "Request your official transcript",
    icon: FileText,
    message: "I need my academic transcript",
  },
  {
    title: "Fee Receipt",
    description: "Access your payment receipt",
    icon: Receipt,
    message: "I need my fee receipt",
  },
  {
    title: "ID Card",
    description: "Replace or report your ID card",
    icon: IdCard,
    message: "I need an ID card",
  },
];

type ChatResponse = {
  message: string;
  intent: string;
  confidence: number;
  request_id?: string | null;
  status?: string | null;
};

type ServiceRequest = {
  id: string;
  service_name: string;
  status: string;
  priority: string;
  created_at: string;
};

type Notification = {
  id: string;
  request_id?: string | null;
  title: string;
  message: string;
  notification_type?: string;
  is_read: boolean;
  created_at: string;
};

function getRequestUpdateText(status: string) {
  switch (status) {
    case "PROCESSING":
      return {
        title: "Request is being processed",
        message: "Your request is currently being handled by university staff.",
      };
    case "COMPLETED":
      return {
        title: "Request completed",
        message: "Your request has been completed successfully.",
      };
    case "REJECTED":
      return {
        title: "Request rejected",
        message: "Your request was rejected. Open the request for more details.",
      };
    case "APPROVAL_REQUIRED":
      return {
        title: "Approval required",
        message: "Your request is waiting for the required approval.",
      };
    case "PENDING":
      return {
        title: "Request received",
        message: "Your request has been received and is waiting to be processed.",
      };
    default:
      return {
        title: "Request updated",
        message: "There is an update available for your request.",
      };
  }
}

function getRequestStatusClass(status: string) {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200";
    case "REJECTED":
      return "border-rose-300/15 bg-rose-300/[0.06] text-rose-200";
    case "PROCESSING":
      return "border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-100";
    case "APPROVAL_REQUIRED":
      return "border-amber-300/15 bg-amber-300/[0.06] text-amber-200";
    default:
      return "border-white/[0.07] bg-white/[0.025] text-white/45";
  }
}

export default function Home() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsRefreshing, setRequestsRefreshing] = useState(false);
  const [studentName, setStudentName] = useState("Student");
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [markingNotificationsRead, setMarkingNotificationsRead] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const askNexusRef = useRef<HTMLTextAreaElement | null>(null);
  const updatesRef = useRef<HTMLElement | null>(null);

  /*
   * Check login status when dashboard loads.
   */
  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      const payload = JSON.parse(
        atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
      );

      if (payload.role === "STAFF" || payload.role === "ADMIN") {
        router.replace("/staff");
        return;
      }

      if (payload.name) {
        setStudentName(payload.name);
      }
    } catch {
      // The backend remains the source of truth for authorization.
    }
  }, [router]);

  async function fetchRecentRequests(isRefresh = false) {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      if (isRefresh) {
        setRequestsRefreshing(true);
      } else {
        setRequestsLoading(true);
      }

      const res = await fetch(`${API_URL}/api/requests`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (res.status === 401) {
        localStorage.removeItem("access_token");
        router.replace("/login");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.detail || "Unable to load recent requests."
        );
      }

      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("DASHBOARD REQUESTS ERROR:", error);
    } finally {
      setRequestsLoading(false);
      setRequestsRefreshing(false);
    }
  }

  async function fetchNotifications() {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/notifications`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (res.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.replace("/login");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.detail || "Unable to load notifications."
        );
      }

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
              (notification: Notification) => !notification.is_read
            ).length
      );
    } catch (error) {
      console.error("NOTIFICATIONS ERROR:", error);
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function markAllNotificationsRead() {
    const token = localStorage.getItem("access_token");

    if (!token || markingNotificationsRead || unreadNotifications === 0) {
      return;
    }

    try {
      setMarkingNotificationsRead(true);

      const res = await fetch(
        `${API_URL}/api/notifications/read-all`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.replace("/login");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.detail || "Unable to mark notifications as read."
        );
      }

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      );
      setUnreadNotifications(0);
    } catch (error) {
      console.error("MARK NOTIFICATIONS READ ERROR:", error);
    } finally {
      setMarkingNotificationsRead(false);
    }
  }

  async function openNotification(notification: Notification) {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    if (!notification.is_read) {
      try {
        const res = await fetch(
          `${API_URL}/api/notifications/${notification.id}/read`,
          {
            method: "PATCH",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (res.ok) {
          setNotifications((current) =>
            current.map((item) =>
              item.id === notification.id
                ? { ...item, is_read: true }
                : item
            )
          );
          setUnreadNotifications((count) => Math.max(0, count - 1));
        }
      } catch (error) {
        console.error("MARK NOTIFICATION READ ERROR:", error);
      }
    }

    if (notification.request_id) {
      router.push(`/requests/${notification.request_id}`);
    } else {
      updatesRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }

  useEffect(() => {
    fetchRecentRequests();
    fetchNotifications();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchRecentRequests(true);
      fetchNotifications();
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-notification-menu]")) {
        setNotificationsOpen(false);
      }
    }

    if (notificationsOpen) {
      document.addEventListener("mousedown", handlePointerDown);
    }

    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [notificationsOpen]);

  /*
   * Send message to NEXUS backend.
   */
  function sendMessage(customMessage?: string) {
    const text = (customMessage ?? message).trim();

    if (!text || loading) {
      return;
    }

    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    router.push(`/ask-nexus?message=${encodeURIComponent(text)}`);
  }

  /*
   * Logout.
   */
  function goToAskNexus() {
    router.push("/ask-nexus");
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      {/* ==================== MOBILE OVERLAY ==================== */}

      {sidebarOpen && (
        <button
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ==================== SIDEBAR ==================== */}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col border-r border-white/[0.07] bg-[#0b0e13] px-5 py-6 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white text-black shadow-lg shadow-cyan-500/5">
              <div className="absolute -inset-8 animate-[spin_5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(34,211,238,0.85)_80deg,rgba(59,130,246,0.75)_160deg,rgba(139,92,246,0.85)_240deg,transparent_320deg)] opacity-55" />
              <div className="relative flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#f7f8fa]">
                <Sparkles size={20} />
              </div>
            </div>

            <div>
              <div className="text-lg font-semibold tracking-tight">
                NEXUS
              </div>

              <div className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                University OS
              </div>
            </div>
          </div>

          {/* Mobile close button */}

          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-white/50 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}

        <nav className="mt-12 space-y-2">
          <NavItem
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            active
          />

          <NavItem
            icon={<Sparkles size={18} />}
            label="Ask NEXUS"
            onClick={goToAskNexus}
          />

          <NavItem
            icon={<FileText size={18} />}
            label="My Requests"
            onClick={() => router.push("/requests")}
          />

          <NavItem
            icon={<Info size={18} />}
            label="About NEXUS"
            onClick={() => router.push("/about")}
          />
        </nav>

        {/* Sidebar bottom */}

        <div className="mt-auto">
          <div className="mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />

              <span className="text-xs font-medium text-white/70">
                NEXUS is online
              </span>
            </div>

            <p className="text-xs leading-5 text-white/35">
              Your university services are available around the clock.
            </p>
          </div>

          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/45 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ==================== MAIN ==================== */}

      <section className="lg:pl-[260px]">
        {/* ==================== HEADER ==================== */}

        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-white/[0.06] bg-[#07090d]/85 px-5 backdrop-blur-xl sm:px-8">
          {/* Mobile menu */}

          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-xl border border-white/[0.08] p-2.5 text-white/60 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}

          <div className="hidden items-center gap-3 lg:flex">
            <span className="text-sm text-white/35">
              Workspace
            </span>

            <ChevronRight
              size={15}
              className="text-white/20"
            />

            <span className="text-sm text-white/75">
              Dashboard
            </span>
          </div>

          {/* Right side */}

          <div className="ml-auto flex items-center gap-3">
            <div className="relative" data-notification-menu>
              <button
                type="button"
                onClick={() => setNotificationsOpen((open) => !open)}
                aria-label="Open notifications"
                aria-expanded={notificationsOpen}
                aria-haspopup="menu"
                className={`relative rounded-xl border p-2.5 transition ${
                  notificationsOpen
                    ? "border-cyan-300/20 bg-cyan-300/[0.06] text-white"
                    : "border-white/[0.07] text-white/55 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Bell size={18} />
                <span className={`absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-semibold ${unreadNotifications > 0 ? "bg-rose-400 text-black" : "border border-white/[0.08] bg-white/[0.08] text-white/45"}`}>
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              </button>

              {notificationsOpen && (
                <div role="menu" className="fixed left-2 right-2 top-[84px] z-50 w-auto overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0e13]/95 shadow-2xl shadow-black/50 backdrop-blur-xl sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-[380px] sm:max-w-[calc(100vw-2rem)]">
                  <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Notifications</p>
                      <p className="mt-0.5 text-[10px] text-white/30">{unreadNotifications > 0 ? `${unreadNotifications} unread` : "You're all caught up"}</p>
                    </div>
                    <button type="button" onClick={markAllNotificationsRead} disabled={markingNotificationsRead || unreadNotifications === 0} className="text-[10px] font-medium text-cyan-100/60 transition hover:text-cyan-100 disabled:cursor-not-allowed disabled:text-white/20">
                      {markingNotificationsRead ? "Marking..." : "Mark all as read"}
                    </button>
                  </div>

                  <div className="max-h-[390px] overflow-y-auto p-2">
                    {notificationsLoading ? (
                      <div className="flex min-h-[120px] items-center justify-center gap-2 text-xs text-white/30"><RefreshCw size={14} className="animate-spin" />Loading notifications...</div>
                    ) : notifications.length === 0 ? (
                      <div className="flex min-h-[150px] flex-col items-center justify-center px-5 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025]"><Bell size={17} className="text-white/20" /></div>
                        <p className="mt-3 text-xs font-medium text-white/45">No notifications yet</p>
                        <p className="mt-1 max-w-[240px] text-[10px] leading-5 text-white/20">Updates from your university requests will appear here.</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {notifications.slice(0, 8).map((notification) => (
                          <button key={notification.id} type="button" role="menuitem" onClick={() => { setNotificationsOpen(false); openNotification(notification); }} className={`group flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${notification.is_read ? "hover:bg-white/[0.035]" : "bg-cyan-300/[0.045] hover:bg-cyan-300/[0.07]"}`}>
                            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${notification.notification_type === "REQUEST_COMPLETED" ? "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200/75" : notification.notification_type === "REQUEST_REJECTED" ? "border-rose-300/15 bg-rose-300/[0.06] text-rose-200/75" : "border-cyan-300/10 bg-cyan-300/[0.05] text-cyan-100/70"}`}>
                              {notification.notification_type === "REQUEST_COMPLETED" ? <CheckCircle2 size={14} /> : notification.notification_type === "REQUEST_REJECTED" ? <Info size={14} /> : <Clock3 size={14} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2"><p className={`line-clamp-1 text-xs ${notification.is_read ? "font-medium text-white/65" : "font-semibold text-white/90"}`}>{notification.title}</p>{!notification.is_read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />}</div>
                              <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-white/35">{notification.message}</p>
                              <p className="mt-1 text-[9px] text-white/20">{new Date(notification.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                            </div>
                            <ChevronRight size={14} className="mt-1 shrink-0 text-white/15 transition group-hover:translate-x-0.5 group-hover:text-cyan-100/60" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {notifications.length > 8 && (
                    <div className="border-t border-white/[0.07] p-2"><button type="button" onClick={() => { setNotificationsOpen(false); updatesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="flex w-full items-center justify-center gap-1 rounded-xl px-3 py-2 text-[10px] font-medium text-cyan-100/50 transition hover:bg-white/[0.035] hover:text-cyan-100">View all notifications<ChevronRight size={12} /></button></div>
                  )}
                </div>
              )}
            </div>

            <div className="hidden h-8 w-px bg-white/[0.08] sm:block" />

            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-white/5"
              >
                <div className="hidden text-right sm:block">
                  <div className="text-sm font-medium">
                    {studentName}
                  </div>

                  <div className="text-[11px] text-white/35">
                    Student
                  </div>
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-white to-white/60 text-sm font-semibold text-black">
                  {studentName
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase() || "S"}
                </div>

                <ChevronDown
                  size={14}
                  className={`hidden text-white/30 transition sm:block ${
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
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-semibold text-black">
                        {studentName
                          .split(" ")
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")
                          .toUpperCase() || "S"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {studentName}
                        </p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan-200/40">
                          Student account
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      router.push("/student");
                    }}
                    className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-white/50 transition hover:bg-white/5 hover:text-white"
                  >
                    <UserCircle size={16} />
                    My account
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={logout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-rose-200/65 transition hover:bg-rose-400/[0.06] hover:text-rose-100"
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ==================== CONTENT ==================== */}

        <div className="mx-auto max-w-[1250px] px-5 py-10 sm:px-8 lg:px-10">
          {/* ==================== GREETING ==================== */}

          <div>
            <p className="mb-2 text-sm font-medium text-white/35">
              University workspace
            </p>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Good morning, {studentName.split(" ")[0]}.
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-white/40">
              Your university, simplified. Ask NEXUS for anything
              you need and let it handle the workflow for you.
            </p>
          </div>

          {/* ==================== ASK NEXUS ==================== */}

          <div className="group relative mt-10 overflow-hidden rounded-[28px] border border-white/[0.09] bg-gradient-to-br from-white/[0.075] to-white/[0.025] p-5 shadow-2xl shadow-black/20 sm:p-7">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/[0.04] blur-3xl transition duration-700 group-hover:bg-white/[0.07]" />

            <div className="relative">
              {/* Card heading */}

              <div className="mb-5 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black">
                  <Sparkles size={15} />
                </div>

                <span className="text-sm font-medium">
                  Ask NEXUS
                </span>

                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  ONLINE
                </span>
              </div>

              {/* Text input */}

              <textarea
                ref={askNexusRef}
                value={message}
                onChange={(event) =>
                  setMessage(event.target.value)
                }
                onKeyDown={(event) => {
                  /*
                   * Enter = send
                   * Shift + Enter = new line
                   */

                  if (
                    event.key === "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="What can I help you with today?"
                className="min-h-[110px] w-full resize-none bg-transparent text-lg font-medium outline-none placeholder:text-white/20"
              />

              {/* Bottom controls */}

              <div className="mt-5 flex flex-col gap-4 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-white/25">
                  Press Enter to send • Shift + Enter for a new line
                </span>

                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !message.trim()}
                  className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-cyan-500/10 transition duration-300 hover:-translate-y-0.5 hover:shadow-cyan-500/20 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Processing..." : "Send request"}

                  {!loading && <ArrowUpRight size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* ==================== NEXUS RESPONSE ==================== */}

          {response && (
            <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <div className="flex items-start gap-3">
                {/* Icon */}

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-black">
                  <Sparkles size={16} />
                </div>

                <div className="min-w-0 flex-1">
                  {/* Header */}

                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">
                      NEXUS
                    </span>

                    {response.status && (
                      <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-[10px] font-medium text-amber-300">
                        {response.status}
                      </span>
                    )}
                  </div>

                  {/* Message */}

                  <p className="text-sm leading-6 text-white/65">
                    {response.message}
                  </p>

                  {/* Metadata */}

                  {response.intent !== "ERROR" && (
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/30">
                      <span className="rounded-lg border border-white/[0.07] px-2.5 py-1.5">
                        Intent: {response.intent}
                      </span>

                      <span className="rounded-lg border border-white/[0.07] px-2.5 py-1.5">
                        Confidence:{" "}
                        {(response.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}

                  {/* ==================== CREATED REQUEST CARD ==================== */}

                  {response.request_id && response.status !== "ERROR" && (
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/requests/${response.request_id}`)
                      }
                      className="group mt-5 w-full overflow-hidden rounded-2xl border border-cyan-300/[0.14] bg-gradient-to-br from-cyan-300/[0.055] via-blue-400/[0.035] to-violet-400/[0.055] p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/[0.28] hover:bg-cyan-300/[0.07] hover:shadow-lg hover:shadow-cyan-500/[0.06]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-200">
                          <CheckCircle2 size={18} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white/90">
                              Request created successfully
                            </p>

                            {response.status && (
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide ${getRequestStatusClass(
                                  response.status
                                )}`}
                              >
                                {response.status.replaceAll("_", " ")}
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-white/40">
                            Your request has been added to your NEXUS requests.
                          </p>

                          <p className="mt-2 truncate font-mono text-[10px] text-white/25">
                            {response.request_id}
                          </p>
                        </div>

                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-white/25 transition group-hover:border-cyan-300/15 group-hover:bg-cyan-300/[0.06] group-hover:text-cyan-100/70">
                          <ChevronRight size={15} />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] font-medium text-cyan-100/45 transition group-hover:text-cyan-100/75">
                        View request
                        <ArrowUpRight size={12} />
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== REQUEST SUMMARY ==================== */}

          {!requestsLoading && requests.length > 0 && (
            <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DashboardStat
                label="Total"
                value={requests.length}
              />
              <DashboardStat
                label="Processing"
                value={requests.filter((r) => r.status === "PROCESSING").length}
                active
              />
              <DashboardStat
                label="Completed"
                value={requests.filter((r) => r.status === "COMPLETED").length}
              />
              <DashboardStat
                label="Needs attention"
                value={
                  requests.filter(
                    (r) =>
                      r.status === "APPROVAL_REQUIRED" ||
                      r.status === "PENDING"
                  ).length
                }
              />
            </section>
          )}

          {/* ==================== RECENT UPDATES ==================== */}

          <section
            ref={updatesRef}
            className="mt-10 scroll-mt-28"
          >
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Recent updates
                </h2>

                <p className="mt-1 text-xs text-white/30">
                  Important updates from your university requests.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {unreadNotifications > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    disabled={markingNotificationsRead}
                    className="text-xs text-cyan-100/55 transition hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {markingNotificationsRead
                      ? "Marking..."
                      : "Mark all as read"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => router.push("/requests")}
                  className="flex items-center gap-1 text-xs text-cyan-100/45 transition hover:text-cyan-100"
                >
                  View all
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4 sm:p-5">
              {notificationsLoading ? (
                <div className="flex min-h-[110px] items-center justify-center gap-3 text-xs text-white/30">
                  <RefreshCw size={15} className="animate-spin" />
                  Loading updates...
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex min-h-[110px] flex-col items-center justify-center text-center">
                  <Bell size={19} className="text-white/20" />
                  <p className="mt-3 text-sm text-white/45">
                    No notifications yet
                  </p>
                  <p className="mt-1 text-xs text-white/20">
                    Updates from your requests will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.slice(0, 6).map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => openNotification(notification)}
                      className={`group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                        notification.is_read
                          ? "border-white/[0.055] bg-white/[0.018] hover:border-white/[0.11] hover:bg-white/[0.03]"
                          : "border-cyan-300/[0.12] bg-cyan-300/[0.035] hover:border-cyan-300/[0.2] hover:bg-cyan-300/[0.05]"
                      }`}
                    >
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/10 bg-cyan-300/[0.05] text-cyan-100/70">
                        {notification.notification_type ===
                        "REQUEST_COMPLETED" ? (
                          <CheckCircle2 size={15} />
                        ) : notification.notification_type ===
                          "REQUEST_REJECTED" ? (
                          <Info size={15} />
                        ) : (
                          <Clock3 size={15} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <p
                            className={`text-xs ${
                              notification.is_read
                                ? "font-medium text-white/70"
                                : "font-semibold text-white/90"
                            }`}
                          >
                            {notification.title}
                          </p>

                          {!notification.is_read && (
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                          )}
                        </div>

                        <p className="mt-1 text-[11px] leading-5 text-white/40">
                          {notification.message}
                        </p>

                        <p className="mt-1 text-[10px] text-white/20">
                          {new Date(
                            notification.created_at
                          ).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <ChevronRight
                        size={15}
                        className="mt-2 shrink-0 text-white/15 transition group-hover:translate-x-0.5 group-hover:text-cyan-100/60"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ==================== QUICK SERVICES ==================== */}

          <section className="mt-12">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">
                Quick services
              </h2>

              <p className="mt-1 text-xs text-white/30">
                Common things students ask NEXUS to handle.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {services.map((service) => {
                const Icon = service.icon;

                return (
                  <button
                    key={service.title}
                    onClick={() => {
                      setMessage(service.message);

                      /*
                       * Scroll back to the chat box.
                       */
                      window.scrollTo({
                        top: 0,
                        behavior: "smooth",
                      });
                    }}
                    className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-cyan-300/15 hover:bg-white/[0.04]"
                  >
                    <div className="mb-7 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-white/65 transition group-hover:bg-white group-hover:text-black">
                      <Icon size={18} />
                    </div>

                    <h3 className="text-sm font-medium">
                      {service.title}
                    </h3>

                    <p className="mt-1.5 text-xs leading-5 text-white/30">
                      {service.description}
                    </p>

                    <div className="mt-5 flex items-center gap-1 text-[11px] text-white/25 transition group-hover:text-white/60">
                      Use service
                      <ArrowUpRight size={13} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ==================== REQUESTS ==================== */}

          <section className="mt-12">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Recent requests
                </h2>

                <p className="mt-1 text-xs text-white/30">
                  Keep track of everything NEXUS is handling.
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push("/requests")}
                className="flex items-center gap-1 text-xs text-white/40 transition hover:text-white"
              >
                View history
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4 sm:p-5">
              {requestsLoading ? (
                <div className="flex min-h-[120px] items-center justify-center gap-3 text-xs text-white/30">
                  <RefreshCw size={15} className="animate-spin" />
                  Loading recent requests...
                </div>
              ) : requests.length === 0 ? (
                <div className="flex min-h-[120px] flex-col items-center justify-center text-center">
                  <FileText size={20} className="text-white/20" />
                  <p className="mt-3 text-sm text-white/45">
                    No requests yet
                  </p>
                  <p className="mt-1 text-xs text-white/20">
                    Your NEXUS service activity will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {requests.slice(0, 5).map((request) => (
                    <button
                      key={request.id}
                      onClick={() =>
                        router.push(`/requests/${request.id}`)
                      }
                      className="group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-white/[0.055] bg-white/[0.018] p-3 text-left transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.035]"
                    >
                      <div
                        className={`h-9 w-1 shrink-0 rounded-full ${
                          request.status === "PROCESSING"
                            ? "bg-gradient-to-b from-cyan-300 via-blue-400 to-violet-400"
                            : request.status === "COMPLETED"
                            ? "bg-emerald-300/70"
                            : request.status === "REJECTED"
                            ? "bg-rose-300/70"
                            : request.status === "APPROVAL_REQUIRED"
                            ? "bg-amber-300/70"
                            : "bg-white/15"
                        }`}
                      />

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025]">
                        {request.status === "COMPLETED" ? (
                          <CheckCircle2 size={15} className="text-emerald-200/70" />
                        ) : request.status === "PROCESSING" ? (
                          <Clock3 size={15} className="animate-pulse text-cyan-200/70" />
                        ) : (
                          <FileText size={15} className="text-white/35" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-white/80">
                          {request.service_name
                            .replaceAll("_", " ")
                            .toLowerCase()
                            .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                        </p>
                        <p className="mt-1 text-[10px] text-white/25">
                          {new Date(request.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-medium ${
                          request.status === "PROCESSING"
                            ? "border-cyan-300/15 bg-gradient-to-r from-cyan-300/[0.08] to-violet-400/[0.08] text-cyan-100"
                            : request.status === "COMPLETED"
                            ? "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200"
                            : request.status === "REJECTED"
                            ? "border-rose-300/15 bg-rose-300/[0.06] text-rose-200"
                            : request.status === "APPROVAL_REQUIRED"
                            ? "border-amber-300/15 bg-amber-300/[0.06] text-amber-200"
                            : "border-white/[0.07] bg-white/[0.025] text-white/40"
                        }`}
                      >
                        {request.status.replaceAll("_", " ")}
                      </span>

                      <ChevronRight
                        size={15}
                        className="shrink-0 text-white/15 transition group-hover:translate-x-0.5 group-hover:text-cyan-100/60"
                      />
                    </button>
                  ))}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => fetchRecentRequests(true)}
                      disabled={requestsRefreshing}
                      className="flex items-center gap-1.5 text-[10px] text-white/25 transition hover:text-white/60 disabled:opacity-40"
                    >
                      <RefreshCw
                        size={12}
                        className={requestsRefreshing ? "animate-spin" : ""}
                      />
                      Refresh
                    </button>

                    <button
                      onClick={() => router.push("/requests")}
                      className="flex items-center gap-1 text-xs text-cyan-100/45 transition hover:text-cyan-100"
                    >
                      View all
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}


function DashboardStat({
  label,
  value,
  active = false,
}: {
  label: string;
  value: number;
  active?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4">
      {active && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-300/[0.035] via-blue-400/[0.02] to-violet-400/[0.035]" />
      )}
      <div className="relative">
        <p className="text-[9px] uppercase tracking-[0.15em] text-white/25">
          {label}
        </p>
        <p className="mt-2 text-xl font-semibold tracking-tight text-white/85">
          {value}
        </p>
      </div>
    </div>
  );
}

/* ==================== NAV ITEM ==================== */

function NavItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
        active
          ? "bg-white text-black"
          : "text-white/40 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}