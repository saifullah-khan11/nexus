"use client";

import { FormEvent, useState } from "react";
import {
  ArrowRight,
  Lock,
  Mail,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError(
        "Please enter your email and password."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new URLSearchParams();

      formData.append(
        "username",
        email.trim()
      );

      formData.append(
        "password",
        password
      );

      const response = await fetch(
        `${API_URL}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: formData.toString(),
        }
      );

      const data = await response.json();

      console.log("LOGIN RESPONSE:", data);

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Invalid email or password."
        );
      }

      if (!data.access_token) {
        throw new Error(
          "Login succeeded, but no access token was returned."
        );
      }

      /*
       * Store authentication token.
       */
      localStorage.setItem(
        "access_token",
        data.access_token
      );

      /*
       * Read the JWT payload.
       *
       * The backend currently puts the role
       * inside the JWT:
       *
       * {
       *   "sub": "...",
       *   "role": "STUDENT"
       * }
       *
       * or
       *
       * {
       *   "sub": "...",
       *   "role": "STAFF"
       * }
       */
      let tokenPayload: {
        sub?: string;
        role?: string;
        exp?: number;
      };

      try {
        const base64Payload =
          data.access_token
            .split(".")[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        const paddedPayload =
          base64Payload.padEnd(
            base64Payload.length +
              ((4 -
                (base64Payload.length % 4)) %
                4),
            "="
          );

        tokenPayload = JSON.parse(
          atob(paddedPayload)
        );
      } catch (tokenError) {
        console.error(
          "JWT DECODE ERROR:",
          tokenError
        );

        throw new Error(
          "Login succeeded, but the authentication token could not be read."
        );
      }

      /*
       * Get role from JWT.
       */
      const role = (
        tokenPayload.role || "STUDENT"
      ).toUpperCase();

      console.log(
        "LOGIN USER ID:",
        tokenPayload.sub
      );

      console.log(
        "LOGIN ROLE:",
        role
      );

      /*
       * Store role locally for frontend UI logic.
       *
       * Backend authorization still remains
       * the actual security boundary.
       */
      localStorage.setItem(
        "user_role",
        role
      );

      /*
       * Redirect according to role.
       *
       * STUDENT
       *   -> Student Dashboard
       *
       * STAFF
       *   -> Staff Dashboard
       *
       * ADMIN
       *   -> Staff Dashboard for now
       */
      if (
        role === "STAFF" ||
        role === "ADMIN"
      ) {
        router.replace("/staff");
      } else {
        router.replace("/");
      }
    } catch (error) {
      console.error(
        "LOGIN ERROR:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to sign in."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07090d] px-5 text-white">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-10 text-center">

          <div className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white text-black shadow-xl shadow-cyan-500/10">

            <div className="absolute -inset-8 animate-[spin_5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(34,211,238,0.8)_90deg,rgba(139,92,246,0.8)_210deg,transparent_320deg)] opacity-50" />

            <div className="relative flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#f7f8fa]">

              <Sparkles
                size={25}
                strokeWidth={2.2}
              />

            </div>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">
            NEXUS
          </h1>

          <p className="mt-2 text-sm text-white/35">
            Autonomous University Service Agent
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-6 shadow-2xl shadow-black/30 sm:p-8">

          <div className="mb-7">

            <h2 className="text-xl font-semibold">
              Welcome back
            </h2>

            <p className="mt-1.5 text-sm text-white/35">
              Sign in to continue to your university workspace.
            </p>

          </div>

          <form
            onSubmit={handleLogin}
            className="space-y-5"
          >

            {/* Email */}
            <div>

              <label className="mb-2 block text-xs font-medium text-white/50">
                Email
              </label>

              <div className="relative">

                <Mail
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25"
                />

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@university.edu"
                  autoComplete="email"
                  className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] pl-11 pr-4 text-sm outline-none transition placeholder:text-white/20 focus:border-cyan-300/20 focus:bg-white/[0.04] focus:ring-1 focus:ring-cyan-300/10"
                />

              </div>

            </div>

            {/* Password */}
            <div>

              <label className="mb-2 block text-xs font-medium text-white/50">
                Password
              </label>

              <div className="relative">

                <Lock
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25"
                />

                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] pl-11 pr-4 text-sm outline-none transition placeholder:text-white/20 focus:border-cyan-300/20 focus:bg-white/[0.04] focus:ring-1 focus:ring-cyan-300/10"
                />

              </div>

            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-400/15 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 text-sm font-semibold text-black shadow-lg shadow-cyan-500/10 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >

              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

              <span className="relative">
                {loading
                  ? "Signing in..."
                  : "Sign in"}
              </span>

              {!loading && (
                <ArrowRight
                  size={16}
                  className="relative transition-transform duration-300 group-hover:translate-x-1"
                />
              )}

            </button>

          </form>
          <div className="mt-6 border-t border-white/[0.06] pt-5 text-center">
              <p className="text-xs text-white/30">
                 Don&apos;t have an account?{" "}
                <button
                    type="button"
                    onClick={() => router.push("/signup")}
                    className="font-medium text-cyan-200/75 transition hover:text-cyan-100"
                  >
                  Sign up
                 </button>
              </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/20">
          NEXUS • University Digital Services
        </p>

      </div>
    </main>
  );
}