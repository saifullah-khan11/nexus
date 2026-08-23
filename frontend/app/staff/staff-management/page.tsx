"use client";

import {
  ArrowLeft,
  Check,
  Loader2,
  Mail,
  MoreVertical,
  Pencil,
  Plus,
  KeyRound,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://localhost:8000";

type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default function StaffManagementPage() {
  const router = useRouter();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState("");

  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [showActionsId, setShowActionsId] =
    useState("");

  const [showEditForm, setShowEditForm] =
    useState(false);

  const [showPasswordForm, setShowPasswordForm] =
    useState(false);

  const [selectedStaff, setSelectedStaff] =
    useState<StaffMember | null>(null);

  const [editName, setEditName] =
    useState("");

  const [editEmail, setEditEmail] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [savingProfile, setSavingProfile] =
    useState(false);

  const [resettingPassword, setResettingPassword] =
    useState(false);

  /*
   * Convert any FastAPI error response into
   * a readable string.
   *
   * This prevents errors such as:
   *
   * [object Object]
   */
  function getErrorMessage(
    detail: unknown,
    fallback: string
  ): string {
    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item: unknown) => {
          if (typeof item === "string") {
            return item;
          }

          if (
            typeof item === "object" &&
            item !== null &&
            "msg" in item
          ) {
            return String(
              (item as { msg: unknown }).msg
            );
          }

          return JSON.stringify(item);
        })
        .join(", ");
    }

    if (
      typeof detail === "object" &&
      detail !== null
    ) {
      try {
        return JSON.stringify(detail);
      } catch {
        return fallback;
      }
    }

    return fallback;
  }

  /*
   * Protect the page on the frontend.
   *
   * Backend ADMIN authorization remains
   * the real security boundary.
   */
  useEffect(() => {
    const token =
      localStorage.getItem("access_token");

    const role =
      localStorage.getItem("user_role");

    if (!token) {
      router.replace("/login");
      return;
    }

    if (role !== "ADMIN") {
      router.replace("/staff");
      return;
    }

    fetchStaff();
  }, [router]);

  /*
   * Load all staff accounts.
   */
  async function fetchStaff() {
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
        `${API_URL}/api/admin/staff`,
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

        localStorage.removeItem(
          "user_role"
        );

        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        router.replace("/staff");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data.detail,
            "Unable to load staff accounts."
          )
        );
      }

      setStaff(data);
    } catch (error) {
      console.error(
        "STAFF MANAGEMENT ERROR:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to load staff accounts."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Create a new staff account.
   */
  async function handleCreateStaff(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setFormError("");
    setSuccessMessage("");

    if (
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      setFormError(
        "Please fill in all fields."
      );
      return;
    }

    if (password.length < 8) {
      setFormError(
        "Password must be at least 8 characters."
      );
      return;
    }

    const token =
      localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      setCreating(true);

      const response = await fetch(
        `${API_URL}/api/admin/staff`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
          }),
        }
      );

      const data = await response.json();

      console.log(
        "CREATE STAFF RESPONSE:",
        data
      );

      if (response.status === 401) {
        localStorage.removeItem(
          "access_token"
        );

        localStorage.removeItem(
          "user_role"
        );

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
            data.detail,
            "Unable to create staff account."
          )
        );
      }

      /*
       * Clear form after successful creation.
       */
      setName("");
      setEmail("");
      setPassword("");

      setShowAddForm(false);

      setSuccessMessage(
        "Staff account created successfully."
      );

      /*
       * Reload staff list.
       */
      await fetchStaff();
    } catch (error) {
      console.error(
        "CREATE STAFF ERROR:",
        error
      );

      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to create staff account."
      );
    } finally {
      setCreating(false);
    }
  }

  /*
   * Activate or deactivate a staff account.
   */
  async function toggleStaffStatus(
    member: StaffMember
  ) {
    const token =
      localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      setUpdatingId(member.id);
      setError("");
      setSuccessMessage("");

      const response = await fetch(
        `${API_URL}/api/admin/staff/${member.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            is_active: !member.is_active,
          }),
        }
      );

      const data = await response.json();

      console.log(
        "UPDATE STAFF RESPONSE:",
        data
      );

      if (response.status === 401) {
        localStorage.removeItem(
          "access_token"
        );

        localStorage.removeItem(
          "user_role"
        );

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
            data.detail,
            "Unable to update staff account."
          )
        );
      }

      setSuccessMessage(
        data.message ||
          "Staff account updated successfully."
      );

      await fetchStaff();
    } catch (error) {
      console.error(
        "UPDATE STAFF ERROR:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to update staff account."
      );
    } finally {
      setUpdatingId("");
    }
  }

  /*
   * Open the Edit Staff modal.
   */
  function openEditForm(member: StaffMember) {
    setSelectedStaff(member);
    setEditName(member.name);
    setEditEmail(member.email);
    setFormError("");
    setSuccessMessage("");
    setShowActionsId("");
    setShowEditForm(true);
  }

  /*
   * Open the Reset Password modal.
   */
  function openPasswordForm(member: StaffMember) {
    setSelectedStaff(member);
    setNewPassword("");
    setFormError("");
    setSuccessMessage("");
    setShowActionsId("");
    setShowPasswordForm(true);
  }

  /*
   * Update staff name and email.
   */
  async function handleUpdateProfile(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setFormError("");
    setSuccessMessage("");

    if (!selectedStaff) {
      return;
    }

    if (!editName.trim() || !editEmail.trim()) {
      setFormError("Please fill in all fields.");
      return;
    }

    const token =
      localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      setSavingProfile(true);

      const response = await fetch(
        `${API_URL}/api/admin/staff/${selectedStaff.id}/profile`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: editName.trim(),
            email: editEmail.trim(),
          }),
        }
      );

      const data = await response.json();

      console.log(
        "UPDATE STAFF PROFILE RESPONSE:",
        data
      );

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
            data.detail,
            "Unable to update staff profile."
          )
        );
      }

      setShowEditForm(false);
      setSelectedStaff(null);

      setSuccessMessage(
        data.message ||
          "Staff profile updated successfully."
      );

      await fetchStaff();
    } catch (error) {
      console.error(
        "UPDATE STAFF PROFILE ERROR:",
        error
      );

      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to update staff profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  /*
   * Reset a staff member's password.
   */
  async function handleResetPassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setFormError("");
    setSuccessMessage("");

    if (!selectedStaff) {
      return;
    }

    if (!newPassword) {
      setFormError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 8) {
      setFormError(
        "Password must be at least 8 characters."
      );
      return;
    }

    const token =
      localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      setResettingPassword(true);

      const response = await fetch(
        `${API_URL}/api/admin/staff/${selectedStaff.id}/password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            password: newPassword,
          }),
        }
      );

      const data = await response.json();

      console.log(
        "RESET STAFF PASSWORD RESPONSE:",
        data
      );

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
            data.detail,
            "Unable to reset staff password."
          )
        );
      }

      setNewPassword("");
      setShowPasswordForm(false);
      setSelectedStaff(null);

      setSuccessMessage(
        data.message ||
          "Staff password reset successfully."
      );
    } catch (error) {
      console.error(
        "RESET STAFF PASSWORD ERROR:",
        error
      );

      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to reset staff password."
      );
    } finally {
      setResettingPassword(false);
    }
  }

  /*
   * Format dates for India.
   */
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

  return (
    <main className="min-h-screen bg-[#07090d] text-white">

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07090d]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1100px] items-center justify-between px-5 sm:px-8">

          <button
            onClick={() =>
              router.push("/staff")
            }
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft size={17} />
            Staff Dashboard
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
              <ShieldCheck size={17} />
            </div>

            <span className="text-sm font-semibold tracking-tight">
              NEXUS
            </span>
          </div>

        </div>
      </header>

      {/* Main */}
      <div className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8">

        {/* Heading */}
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <p className="mb-2 text-sm text-white/30">
              Administration
            </p>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Staff Management
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-white/40">
              Create and manage NEXUS staff accounts
              and control their access to the staff
              workspace.
            </p>
          </div>

          <button
            onClick={() => {
              setShowAddForm(true);
              setFormError("");
              setSuccessMessage("");
            }}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 px-5 text-sm font-semibold text-black shadow-lg shadow-cyan-500/10 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <Plus size={17} />
            Add Staff
          </button>

        </div>

        {/* Success */}
        {successMessage && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-300">
            <Check size={17} />

            {successMessage}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-5 rounded-2xl border border-red-400/15 bg-red-400/10 px-5 py-4 text-sm text-red-300">
            {error}

            <button
              onClick={fetchStaff}
              className="ml-4 underline underline-offset-4 hover:text-white"
            >
              Try again
            </button>
          </div>
        )}

        {/* Stats */}
        {!loading && (
          <div className="mb-7 grid gap-3 sm:grid-cols-3">

            {/* Total */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <div className="flex items-center justify-between">

                <p className="text-xs text-white/35">
                  Total Staff
                </p>

                <Users
                  size={17}
                  className="text-cyan-300/50"
                />

              </div>

              <p className="mt-3 text-2xl font-semibold">
                {staff.length}
              </p>
            </div>

            {/* Active */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <div className="flex items-center justify-between">

                <p className="text-xs text-white/35">
                  Active
                </p>

                <Check
                  size={17}
                  className="text-emerald-300/50"
                />

              </div>

              <p className="mt-3 text-2xl font-semibold">
                {
                  staff.filter(
                    (member) =>
                      member.is_active
                  ).length
                }
              </p>
            </div>

            {/* Inactive */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <div className="flex items-center justify-between">

                <p className="text-xs text-white/35">
                  Inactive
                </p>

                <X
                  size={17}
                  className="text-red-300/50"
                />

              </div>

              <p className="mt-3 text-2xl font-semibold">
                {
                  staff.filter(
                    (member) =>
                      !member.is_active
                  ).length
                }
              </p>
            </div>

          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.02]">

            <div className="flex items-center gap-3 text-sm text-white/40">

              <Loader2
                size={18}
                className="animate-spin"
              />

              Loading staff accounts...

            </div>

          </div>
        )}

        {/* Empty */}
        {!loading &&
          !error &&
          staff.length === 0 && (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.02] text-center">

              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025]">
                <Users
                  size={20}
                  className="text-white/35"
                />
              </div>

              <h2 className="text-sm font-medium">
                No staff accounts
              </h2>

              <p className="mt-2 max-w-sm text-xs leading-5 text-white/30">
                Create your first staff account to
                begin managing the university service
                workspace.
              </p>

              <button
                onClick={() =>
                  setShowAddForm(true)
                }
                className="mt-5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Add Staff
              </button>

            </div>
          )}

        {/* Staff List */}
        {!loading &&
          !error &&
          staff.length > 0 && (
            <div className="space-y-3">

              {staff.map((member) => (
                <div
                  key={member.id}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition hover:border-white/[0.12] hover:bg-white/[0.035]"
                >

                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                    {/* Identity */}
                    <div className="flex items-start gap-4">

                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]">
                        <ShieldCheck
                          size={18}
                          className="text-cyan-300/60"
                        />
                      </div>

                      <div>

                        <div className="flex flex-wrap items-center gap-2">

                          <h2 className="text-sm font-medium">
                            {member.name}
                          </h2>

                          <span className="rounded-full border border-violet-400/15 bg-violet-400/10 px-2.5 py-1 text-[10px] font-medium text-violet-300">
                            {member.role}
                          </span>

                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/30">

                          <span className="flex items-center gap-1.5">
                            <Mail size={13} />
                            {member.email}
                          </span>

                          <span>
                            Created:{" "}
                            {formatDate(
                              member.created_at
                            )}
                          </span>

                        </div>

                      </div>

                    </div>

                    {/* Status + Actions */}
                    <div className="relative flex items-center justify-between gap-3 lg:justify-end">

                      <span
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${
                          member.is_active
                            ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                            : "border-red-400/20 bg-red-400/10 text-red-300"
                        }`}
                      >
                        {member.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setShowActionsId(
                            showActionsId === member.id
                              ? ""
                              : member.id
                          )
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white/40 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
                        aria-label={`Actions for ${member.name}`}
                      >
                        <MoreVertical size={17} />
                      </button>

                      {showActionsId === member.id && (
                        <div className="absolute right-0 top-12 z-20 w-48 rounded-2xl border border-white/[0.09] bg-[#0d1118] p-1.5 shadow-2xl shadow-black/50">

                          <button
                            type="button"
                            onClick={() =>
                              openEditForm(member)
                            }
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-white/60 transition hover:bg-white/5 hover:text-white"
                          >
                            <Pencil size={15} />
                            Edit profile
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openPasswordForm(member)
                            }
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-white/60 transition hover:bg-white/5 hover:text-white"
                          >
                            <KeyRound size={15} />
                            Reset password
                          </button>

                          <div className="my-1 border-t border-white/[0.06]" />

                          <button
                            type="button"
                            onClick={() => {
                              setShowActionsId("");
                              toggleStaffStatus(member);
                            }}
                            disabled={
                              updatingId === member.id
                            }
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              member.is_active
                                ? "text-red-300 hover:bg-red-400/10"
                                : "text-emerald-300 hover:bg-emerald-400/10"
                            }`}
                          >
                            {updatingId === member.id ? (
                              <Loader2
                                size={15}
                                className="animate-spin"
                              />
                            ) : member.is_active ? (
                              <X size={15} />
                            ) : (
                              <Check size={15} />
                            )}

                            {updatingId === member.id
                              ? "Updating..."
                              : member.is_active
                                ? "Deactivate"
                                : "Activate"}
                          </button>

                        </div>
                      )}

                    </div>

                  </div>

                </div>
              ))}

            </div>
          )}

      </div>

      {/* Edit Staff Modal */}
      {showEditForm && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[28px] border border-white/[0.09] bg-[#0b0e14] p-6 shadow-2xl shadow-black/50 sm:p-8">

            <div className="mb-7 flex items-start justify-between">
              <div>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05]">
                  <Pencil
                    size={19}
                    className="text-cyan-300/70"
                  />
                </div>

                <h2 className="text-xl font-semibold">
                  Edit Staff
                </h2>

                <p className="mt-1.5 text-xs leading-5 text-white/35">
                  Update this staff member's name and email.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowEditForm(false);
                  setSelectedStaff(null);
                  setFormError("");
                }}
                className="rounded-xl p-2 text-white/30 transition hover:bg-white/5 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleUpdateProfile}
              className="space-y-5"
            >
              <div>
                <label className="mb-2 block text-xs font-medium text-white/50">
                  Full name
                </label>

                <input
                  type="text"
                  value={editName}
                  onChange={(event) =>
                    setEditName(event.target.value)
                  }
                  autoComplete="name"
                  className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-sm outline-none transition placeholder:text-white/20 focus:border-cyan-300/20 focus:bg-white/[0.04] focus:ring-1 focus:ring-cyan-300/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-white/50">
                  Email
                </label>

                <input
                  type="email"
                  value={editEmail}
                  onChange={(event) =>
                    setEditEmail(event.target.value)
                  }
                  autoComplete="email"
                  className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-sm outline-none transition placeholder:text-white/20 focus:border-cyan-300/20 focus:bg-white/[0.04] focus:ring-1 focus:ring-cyan-300/10"
                />
              </div>

              {formError && (
                <div className="rounded-xl border border-red-400/15 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false);
                    setSelectedStaff(null);
                    setFormError("");
                  }}
                  disabled={savingProfile}
                  className="h-12 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.025] text-sm font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 text-sm font-semibold text-black shadow-lg shadow-cyan-500/10 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingProfile ? (
                    <>
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordForm && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[28px] border border-white/[0.09] bg-[#0b0e14] p-6 shadow-2xl shadow-black/50 sm:p-8">

            <div className="mb-7 flex items-start justify-between">
              <div>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-300/[0.05]">
                  <KeyRound
                    size={19}
                    className="text-violet-300/70"
                  />
                </div>

                <h2 className="text-xl font-semibold">
                  Reset Password
                </h2>

                <p className="mt-1.5 text-xs leading-5 text-white/35">
                  Set a new password for{" "}
                  <span className="text-white/55">
                    {selectedStaff.name}
                  </span>
                  .
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false);
                  setSelectedStaff(null);
                  setNewPassword("");
                  setFormError("");
                }}
                className="rounded-xl p-2 text-white/30 transition hover:bg-white/5 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleResetPassword}
              className="space-y-5"
            >
              <div>
                <label className="mb-2 block text-xs font-medium text-white/50">
                  New password
                </label>

                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(event.target.value)
                  }
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-sm outline-none transition placeholder:text-white/20 focus:border-violet-300/20 focus:bg-white/[0.04] focus:ring-1 focus:ring-violet-300/10"
                />
              </div>

              {formError && (
                <div className="rounded-xl border border-red-400/15 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setSelectedStaff(null);
                    setNewPassword("");
                    setFormError("");
                  }}
                  disabled={resettingPassword}
                  className="h-12 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.025] text-sm font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={resettingPassword}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 text-sm font-semibold text-black shadow-lg shadow-cyan-500/10 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resettingPassword ? (
                    <>
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <KeyRound size={16} />
                      Reset Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-md">

          <div className="w-full max-w-md rounded-[28px] border border-white/[0.09] bg-[#0b0e14] p-6 shadow-2xl shadow-black/50 sm:p-8">

            {/* Modal Header */}
            <div className="mb-7 flex items-start justify-between">

              <div>

                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05]">
                  <UserPlus
                    size={19}
                    className="text-cyan-300/70"
                  />
                </div>

                <h2 className="text-xl font-semibold">
                  Add Staff
                </h2>

                <p className="mt-1.5 text-xs leading-5 text-white/35">
                  Create a new staff account for the
                  NEXUS workspace.
                </p>

              </div>

              <button
                onClick={() => {
                  setShowAddForm(false);
                  setFormError("");
                }}
                className="rounded-xl p-2 text-white/30 transition hover:bg-white/5 hover:text-white"
              >
                <X size={18} />
              </button>

            </div>

            {/* Form */}
            <form
              onSubmit={handleCreateStaff}
              className="space-y-5"
            >

              {/* Name */}
              <div>

                <label className="mb-2 block text-xs font-medium text-white/50">
                  Full name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Enter staff name"
                  autoComplete="name"
                  className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-sm outline-none transition placeholder:text-white/20 focus:border-cyan-300/20 focus:bg-white/[0.04] focus:ring-1 focus:ring-cyan-300/10"
                />

              </div>

              {/* Email */}
              <div>

                <label className="mb-2 block text-xs font-medium text-white/50">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  placeholder="staff@university.edu"
                  autoComplete="email"
                  className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-sm outline-none transition placeholder:text-white/20 focus:border-cyan-300/20 focus:bg-white/[0.04] focus:ring-1 focus:ring-cyan-300/10"
                />

              </div>

              {/* Password */}
              <div>

                <label className="mb-2 block text-xs font-medium text-white/50">
                  Temporary password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-sm outline-none transition placeholder:text-white/20 focus:border-cyan-300/20 focus:bg-white/[0.04] focus:ring-1 focus:ring-cyan-300/10"
                />

              </div>

              {/* Form Error */}
              {formError && (
                <div className="rounded-xl border border-red-400/15 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                  {formError}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-1">

                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setFormError("");
                  }}
                  disabled={creating}
                  className="h-12 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.025] text-sm font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 text-sm font-semibold text-black shadow-lg shadow-cyan-500/10 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />

                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create Staff
                    </>
                  )}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

    </main>
  );
}