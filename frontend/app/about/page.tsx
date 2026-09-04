"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";

const teamMembers = [
  {
    name: "Mohammad Saifullah Khan",
    role: "CSE Undergraduate",
    initials: "SK",
    cardClass:
      "border-cyan-300/20 bg-gradient-to-br from-cyan-300/[0.10] via-blue-400/[0.06] to-violet-400/[0.06]",
    avatarClass:
      "bg-gradient-to-br from-cyan-300 to-violet-400 text-black",
    roleClass:
      "border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200/80",
    description:
      "Saif helps coordinate the team and oversees the overall development of NEXUS. He contributes to planning and keeps the project moving toward its goals. He works closely with the entire team throughout development.",
  },
];

const capabilities = [
  "University service requests",
  "Request tracking and status updates",
  "Staff request management",
  "Administrative account management",
  "AI-assisted university services",
  "Centralized digital workspace",
];

export default function AboutPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#07090d] text-white">

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07090d]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1100px] items-center justify-between px-5 sm:px-8">

          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft size={17} />
            Back
          </button>

          <div className="flex items-center gap-3">

            <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white text-black">

              <div className="absolute -inset-5 animate-[spin_5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(34,211,238,0.8)_90deg,rgba(139,92,246,0.8)_210deg,transparent_320deg)] opacity-50" />

              <div className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#f7f8fa]">
                <Sparkles size={16} />
              </div>

            </div>

            <span className="text-sm font-semibold tracking-tight">
              NEXUS
            </span>

          </div>

        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">

        <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[420px] w-[700px] -translate-x-1/2 rounded-full bg-cyan-400/[0.06] blur-[120px]" />

        <div className="relative mx-auto max-w-[1100px] px-5 pb-20 pt-20 sm:px-8 sm:pt-28">

          <div className="max-w-3xl">

            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.05] px-3.5 py-2 text-xs font-medium text-cyan-200/70">
              <Sparkles size={13} />
              About NEXUS
            </div>

            <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
              A smarter way to connect with

              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                {" "}university services.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/40 sm:text-base">
              NEXUS is an autonomous university service agent
              designed to make everyday university services
              simpler, faster, and easier to access from one
              centralized digital workspace.
            </p>

          </div>

        </div>
      </section>

      {/* About / Mission */}
      <section className="border-y border-white/[0.06] bg-white/[0.015]">

        <div className="mx-auto grid max-w-[1100px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-20">

          <div>

            <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-cyan-300/50">
              What is NEXUS?
            </p>

            <h2 className="text-3xl font-semibold tracking-tight">
              One workspace for university services.
            </h2>

          </div>

          <div className="space-y-5 text-sm leading-7 text-white/40">

            <p>
              NEXUS brings university service interactions
              into one unified digital experience. Instead of
              navigating multiple disconnected processes,
              users can interact with a single platform.
            </p>

            <p>
              The platform is designed to help students
              submit and track service requests while giving
              university staff the tools they need to review,
              process, and manage those requests.
            </p>

            <p>
              Our goal is to make university services more
              accessible while creating a more organized and
              efficient digital experience for everyone.
            </p>

          </div>

        </div>

      </section>

      {/* Mission */}
      <section>

        <div className="mx-auto max-w-[1100px] px-5 py-20 sm:px-8">

          <div className="mb-10 max-w-2xl">

            <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-violet-300/50">
              Our Mission
            </p>

            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Make university services feel effortless.
            </h2>

            <p className="mt-4 text-sm leading-7 text-white/40">
              NEXUS aims to reduce unnecessary complexity in
              university service workflows by bringing
              requests, communication, tracking, and
              administration together in one place.
            </p>

          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

            {capabilities.map((capability) => (
              <div
                key={capability}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition hover:border-white/[0.13] hover:bg-white/[0.04]"
              >

                <CheckCircle2
                  size={18}
                  className="shrink-0 text-cyan-300/60"
                />

                <span className="text-sm text-white/55">
                  {capability}
                </span>

              </div>
            ))}

          </div>

        </div>

      </section>

      {/* Team */}
      <section className="border-t border-white/[0.06] bg-white/[0.015]">

        <div className="mx-auto max-w-[1100px] px-5 py-20 sm:px-8">

          <div className="mb-12 text-center">

            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-300/[0.05]">
              <Users
                size={19}
                className="text-violet-300/70"
              />
            </div>

            <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-violet-300/50">
              Meet the Man
            </p>

            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              The brain behind NEXUS.
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/35">
              NEXUS is built through hardworking , 
              critical thinking and efforts.
            </p>

          </div>

          {/* Team Grid */}
          <div className="grid gap-4 md:grid-cols-2">

            {teamMembers.map((member, index) => (
              <div
                key={member.name}
                className={`rounded-[24px] border p-6 ${member.cardClass}`}
              >

                <div className="flex items-start gap-4">

                  {/* Avatar */}
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${member.avatarClass}`}
                  >
                    {member.initials}
                  </div>

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <h3 className="text-sm font-semibold">
                        {member.name}
                      </h3>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${member.roleClass}`}
                      >
                        {member.role}
                      </span>

                    </div>

                  </div>

                </div>

                <p className="mt-5 text-xs leading-6 text-white/35">
                  {member.description}
                </p>

              </div>
            ))}

          </div>

        </div>

      </section>

      {/* Closing */}
      <section>

        <div className="mx-auto max-w-[1100px] px-5 py-20 text-center sm:px-8">

          <div className="mx-auto max-w-2xl">

            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black shadow-xl">
              <Sparkles size={20} />
            </div>

            <h2 className="text-3xl font-semibold tracking-tight">
              Welcome to NEXUS.
            </h2>

            <p className="mt-4 text-sm leading-7 text-white/35">
              A connected digital experience designed to make
              university services simpler, clearer, and more
              accessible.
            </p>

            <button
              onClick={() => router.push("/")}
              className="group mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 px-5 py-3 text-sm font-semibold text-black shadow-lg shadow-cyan-500/10 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Go to NEXUS

              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>

          </div>

        </div>

      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06]">

        <div className="mx-auto flex max-w-[1100px] items-center justify-center px-5 py-7 sm:px-8">

          <p className="text-xs text-white/20">
            NEXUS • University Digital Services
          </p>

        </div>

      </footer>

    </main>
  );
}