"use client";

import {
  ArrowLeft,
  CheckCircle2,
  FileImage,
  FileText,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  Upload,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  

const MAX_FILE_SIZE = 500 * 1024;

const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

const YEAR_SEMESTER_OPTIONS = [
  { value: "1/1", label: "Year 1 / Semester 1" },
  { value: "1/2", label: "Year 1 / Semester 2" },
  { value: "2/3", label: "Year 2 / Semester 3" },
  { value: "2/4", label: "Year 2 / Semester 4" },
  { value: "3/5", label: "Year 3 / Semester 5" },
  { value: "3/6", label: "Year 3 / Semester 6" },
  { value: "4/7", label: "Year 4 / Semester 7" },
  { value: "4/8", label: "Year 4 / Semester 8" },
];

const ACADEMIC_SESSION_OPTIONS = [
  "2022-2026",
  "2023-2027",
  "2024-2028",
  "2026-2030",
];

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

export default function SignupPage() {
  const router = useRouter();
  const proofInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [registrationNumber, setRegistrationNumber] =
    useState("");
  const [program, setProgram] = useState("");
  const [department, setDepartment] = useState("");
  const [yearSemester, setYearSemester] = useState("");
  const [academicSession, setAcademicSession] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [proof, setProof] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  function handleProofChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      setProof(null);
      return;
    }

    if (!ALLOWED_FILE_TYPES.has(file.type)) {
      setError(
        "Please upload a JPG, PNG, or PDF file.",
      );
      setProof(null);

      if (proofInputRef.current) {
        proofInputRef.current.value = "";
      }

      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      const actualSizeKb = Math.ceil(file.size / 1024);

      setError(
        `File too large: ${actualSizeKb} KB. The maximum allowed size is 500 KB.`,
      );
      setProof(null);

      if (proofInputRef.current) {
        proofInputRef.current.value = "";
      }

      return;
    }

    setError("");
    setProof(file);
  }

  function removeProof() {
    setProof(null);

    if (proofInputRef.current) {
      proofInputRef.current.value = "";
    }
  }

  async function submitSignup(event: FormEvent) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError(
        "Password must contain at least 8 characters.",
      );
      return;
    }

    if (!yearSemester || !academicSession) {
      setError(
        "Please select your year/semester and academic year.",
      );
      return;
    }

    const [year, semester] = yearSemester.split("/");

    const formData = new FormData();

    formData.append("name", name.trim());
    formData.append("email", email.trim().toLowerCase());
    formData.append("phone", phone.trim());
    formData.append(
      "registration_number",
      registrationNumber.trim(),
    );
    formData.append("program", program.trim());
    formData.append("department", department.trim());
    formData.append("year", year);
    formData.append("semester", semester);
    formData.append("academic_session", academicSession);
    formData.append("password", password);

    if (proof) {
      formData.append("proof", proof);
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/signup/student`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data?.detail,
            "Unable to submit your registration.",
          ),
        );
      }

      setSuccess(
        data?.message ||
          "Registration submitted successfully. Your account is waiting for verification.",
      );

      setName("");
      setEmail("");
      setPhone("");
      setRegistrationNumber("");
      setProgram("");
      setDepartment("");
      setYearSemester("");
      setAcademicSession("");
      setPassword("");
      setConfirmPassword("");
      removeProof();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit your registration.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-xl">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mb-6 inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to login
          </button>

          <div className="rounded-3xl border border-white/[0.08] bg-[#0b0e13]/95 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
            <div className="mb-8">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-black">
                <UserRound size={20} />
              </div>

              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Create your student account
              </h1>

              <p className="mt-2 max-w-lg text-sm leading-6 text-white/40">
                Submit your registration for university
                verification. Your account will only become
                available after staff or administrator approval.
              </p>
            </div>

            {success && (
              <div className="mb-5 flex gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm text-emerald-100">
                <CheckCircle2
                  size={18}
                  className="mt-0.5 shrink-0"
                />
                <div>
                  <p className="font-medium">
                    Registration submitted
                  </p>
                  <p className="mt-1 leading-5 text-emerald-100/65">
                    {success}
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/login")}
                    className="mt-3 font-medium text-emerald-200 underline underline-offset-4"
                  >
                    Return to login
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-5 flex gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-100">
                <XCircle
                  size={18}
                  className="mt-0.5 shrink-0"
                />
                <p className="leading-5">{error}</p>
              </div>
            )}

            {!success && (
              <form
                onSubmit={submitSignup}
                className="space-y-5"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-white/55">
                      Full name
                    </span>

                    <div className="relative">
                      <UserRound
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
                      />

                      <input
                        required
                        value={name}
                        onChange={(event) =>
                          setName(event.target.value)
                        }
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-10 py-3 text-sm outline-none transition placeholder:text-white/20 focus:border-cyan-300/30"
                        placeholder="Your full name"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-white/55">
                      Phone number
                    </span>

                    <div className="relative">
                      <Phone
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
                      />

                      <input
                        required
                        type="tel"
                        value={phone}
                        onChange={(event) =>
                          setPhone(event.target.value)
                        }
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-10 py-3 text-sm outline-none transition placeholder:text-white/20 focus:border-cyan-300/30"
                        placeholder="Phone number"
                      />
                    </div>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-white/55">
                    Email address
                  </span>

                  <div className="relative">
                    <Mail
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
                    />

                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-10 py-3 text-sm outline-none transition placeholder:text-white/20 focus:border-cyan-300/30"
                      placeholder="student@example.com"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-white/55">
                    Registration number
                  </span>

                  <input
                    required
                    value={registrationNumber}
                    onChange={(event) =>
                      setRegistrationNumber(
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm uppercase outline-none transition placeholder:text-white/20 focus:border-cyan-300/30"
                    placeholder="Your registration number"
                  />
                </label>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-white/55">
                      Program
                    </span>
                    <input
                      required
                      value={program}
                      onChange={(event) =>
                        setProgram(event.target.value)
                      }
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm outline-none transition placeholder:text-white/20 focus:border-cyan-300/30"
                      placeholder="e.g. B.Tech CSE"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-white/55">
                      Department
                    </span>
                    <input
                      required
                      value={department}
                      onChange={(event) =>
                        setDepartment(event.target.value)
                      }
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm outline-none transition placeholder:text-white/20 focus:border-cyan-300/30"
                      placeholder="e.g. Computer Science"
                    />
                  </label>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-white/55">
                      Year / Semester
                    </span>
                    <select
                      required
                      value={yearSemester}
                      onChange={(event) =>
                        setYearSemester(event.target.value)
                      }
                      className="w-full rounded-xl border border-white/[0.08] bg-[#0b0e13] px-4 py-3 text-sm text-white/70 outline-none transition focus:border-cyan-300/30"
                    >
                      <option value="" disabled>
                        Select year / semester
                      </option>
                      {YEAR_SEMESTER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-white/55">
                      Academic year
                    </span>
                    <select
                      required
                      value={academicSession}
                      onChange={(event) =>
                        setAcademicSession(event.target.value)
                      }
                      className="w-full rounded-xl border border-white/[0.08] bg-[#0b0e13] px-4 py-3 text-sm text-white/70 outline-none transition focus:border-cyan-300/30"
                    >
                      <option value="" disabled>
                        Select academic year
                      </option>
                      {ACADEMIC_SESSION_OPTIONS.map((session) => (
                        <option key={session} value={session}>
                          {session}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-white/55">
                      Password
                    </span>

                    <div className="relative">
                      <LockKeyhole
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
                      />

                      <input
                        required
                        type="password"
                        value={password}
                        onChange={(event) =>
                          setPassword(event.target.value)
                        }
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-10 py-3 text-sm outline-none transition placeholder:text-white/20 focus:border-cyan-300/30"
                        placeholder="Minimum 8 characters"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-white/55">
                      Confirm password
                    </span>

                    <div className="relative">
                      <LockKeyhole
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
                      />

                      <input
                        required
                        type="password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(
                            event.target.value,
                          )
                        }
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-10 py-3 text-sm outline-none transition placeholder:text-white/20 focus:border-cyan-300/30"
                        placeholder="Repeat your password"
                      />
                    </div>
                  </label>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-white/55">
                      Proof of admission
                    </span>
                    <span className="text-[11px] text-white/25">
                      Optional · JPG, PNG or PDF · max 500 KB
                    </span>
                  </div>

                  <input
                    ref={proofInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                    onChange={handleProofChange}
                    className="hidden"
                  />

                  {!proof ? (
                    <button
                      type="button"
                      onClick={() =>
                        proofInputRef.current?.click()
                      }
                      className="flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.10] bg-white/[0.02] px-4 py-7 text-sm text-white/45 transition hover:border-cyan-300/20 hover:bg-white/[0.035] hover:text-white"
                    >
                      <Upload size={18} />
                      Upload ID card, admission slip, or other proof
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.025] p-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/10 bg-emerald-400/[0.06] text-emerald-200">
                        {proof.type === "application/pdf" ? (
                          <FileText size={17} />
                        ) : (
                          <FileImage size={17} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm text-white/80">
                            {proof.name}
                          </p>
                          <span className="shrink-0 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-2 py-0.5 text-[10px] font-medium text-emerald-200/80">
                            Selected
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-white/30">
                          {(proof.size / 1024).toFixed(0)} KB
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={removeProof}
                        className="rounded-lg p-2 text-white/35 transition hover:bg-white/5 hover:text-white"
                        aria-label="Remove proof"
                      >
                        <XCircle size={17} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs leading-5 text-white/35">
                  Your registration is not a login account yet.
                  Staff or an administrator will review your
                  information and proof before activating your
                  student account.
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 text-sm font-semibold text-black shadow-lg shadow-cyan-500/10 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                      Submitting registration...
                    </>
                  ) : (
                    "Submit registration"
                  )}
                </button>
              </form>
            )}

            <div className="mt-7 text-center text-sm text-white/35">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="font-medium text-white/75 transition hover:text-white"
              >
                Sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}