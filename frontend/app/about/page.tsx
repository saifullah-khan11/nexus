"use client";

import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Cpu,
  Database,
  FileCheck2,
  GraduationCap,
  Layers,
  Lock,
  Mail,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const architecturePillars = [
  {
    icon: Terminal,
    step: "01",
    title: "Student Request Gateway",
    badge: "Intake Layer",
    description:
      "Conversational natural language interface and structured forms designed to ingest student requirements without ambiguity.",
    features: [
      "Real-time intent extraction",
      "Dynamic field dependency checks",
      "Immediate request tracking IDs",
    ],
  },
  {
    icon: ShieldCheck,
    step: "02",
    title: "Human Governance Engine",
    badge: "Policy Layer",
    description:
      "Automates routine administrative routing while enforcing human-in-the-loop review for compliance, approvals, and overrides.",
    features: [
      "Role-based staff dispatch",
      "Immutable audit log records",
      "Dual-stage approval gates",
    ],
  },
  {
    icon: FileCheck2,
    step: "03",
    title: "Document Synthesis",
    badge: "Output Layer",
    description:
      "Compiles validated request data directly into official DOCX certificate templates and tamper-resistant digital records.",
    features: [
      "Automated placeholder binding",
      "DOCX certificate rendering",
      "Instant student download delivery",
    ],
  },
];

const metrics = [
  {
    value: "< 30s",
    label: "Average Intake Time",
    detail: "From natural language intent to validated service request",
  },
  {
    value: "100%",
    label: "Policy Compliant",
    detail: "Strict human oversight on institutional certifications",
  },
  {
    value: "24 / 7",
    label: "Continuous Availability",
    detail: "Zero physical queue bottleneck for campus requests",
  },
  {
    value: "Zero",
    label: "Paper Bureaucracy",
    detail: "Fully digitized lifecycle from intake to certificate issuance",
  },
];

const capabilities = [
  {
    title: "Bonafide Certificates",
    category: "Academic Records",
    description: "Rapid generation of certified enrollment and study proofs.",
    icon: GraduationCap,
  },
  {
    title: "Academic Transcripts",
    category: "Registrar Services",
    description: "Automated verification and structured transcript requests.",
    icon: FileCheck2,
  },
  {
    title: "Fee Clearance & Receipts",
    category: "Finance Office",
    description: "Instant access to financial clearances and verified receipts.",
    icon: Receipt,
  },
  {
    title: "DOCX Design Catalog",
    category: "Administration",
    description: "Staff-customizable certificate templates with zero code changes.",
    icon: Layers,
  },
  {
    title: "Staff Review Command",
    category: "Governance",
    description: "Granular controls to approve, reject, or request revisions.",
    icon: ShieldCheck,
  },
  {
    title: "Cryptographic Audit Logs",
    category: "Security",
    description: "Chronological traceability across all status transitions.",
    icon: Lock,
  },
];

export default function AboutPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-white/[0.07] bg-white/80 dark:bg-[#07090e]/80 backdrop-blur-xl transition-colors duration-200">
        <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-600 dark:text-white/60 shadow-sm transition hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-white"
            >
              <ArrowLeft size={15} />
              Dashboard
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.03] px-3 py-1.5 shadow-sm">
              <div className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500 text-white shadow-sm shadow-cyan-500/30">
                <Cpu size={14} />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold tracking-tight text-slate-900 dark:text-white">
                  NEXUS
                </p>
                <p className="text-[9px] font-medium tracking-wider uppercase text-cyan-600 dark:text-cyan-300/80">
                  Campus OS
                </p>
              </div>
            </div>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ================= HERO SECTION ================= */}
      <section className="relative overflow-hidden border-b border-slate-200/70 dark:border-white/[0.06] bg-gradient-to-b from-white via-slate-50 to-slate-100/60 dark:from-[#090c14] dark:via-[#07090e] dark:to-[#07090e]">
        {/* Subtle grid background */}
        <div className="pointer-events-none absolute inset-0 bg-grid-mesh opacity-60 dark:opacity-40" />

        {/* Ambient radial glows */}
        <div className="pointer-events-none absolute left-1/2 -top-40 h-[450px] w-[800px] -translate-x-1/2 rounded-full bg-cyan-500/10 dark:bg-cyan-500/[0.07] blur-[120px]" />
        <div className="pointer-events-none absolute right-10 top-1/2 h-[350px] w-[500px] -translate-y-1/2 rounded-full bg-violet-500/10 dark:bg-violet-500/[0.05] blur-[140px]" />

        <div className="relative mx-auto max-w-[1200px] px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8">
          <div className="max-w-3xl">
            {/* Live Status Badge */}
            <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-cyan-500/20 dark:border-cyan-400/20 bg-cyan-50 dark:bg-cyan-950/30 px-3.5 py-1.5 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
              </span>
              <span className="text-xs font-semibold tracking-wide text-cyan-700 dark:text-cyan-300">
                Autonomous Campus Operating System • v2.4
              </span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-6xl sm:leading-[1.12]">
              Architecture for the{" "}
              <span className="bg-gradient-to-r from-cyan-600 via-blue-600 to-violet-600 dark:from-cyan-300 dark:via-blue-400 dark:to-violet-400 bg-clip-text text-transparent">
                autonomous modern campus.
              </span>
            </h1>

            <p className="mt-6 text-base leading-relaxed text-slate-600 dark:text-slate-300/80 sm:text-lg">
              NEXUS replaces fragmented queues and disconnected portals with a
              unified, verifiable digital engine. Students request certificates
              through conversational AI; staff govern workflows with single-click
              cryptographic confidence.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={() => router.push("/")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-5 text-sm font-semibold shadow-md shadow-slate-900/10 dark:shadow-white/10 transition hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
              >
                Access Services
                <ArrowRight size={16} />
              </button>

              <button
                onClick={() => router.push("/ask-nexus")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300/80 dark:border-white/[0.1] bg-white dark:bg-white/[0.03] px-5 text-sm font-semibold text-slate-700 dark:text-white/80 shadow-sm transition hover:border-slate-400 dark:hover:border-white/20 hover:text-slate-950 dark:hover:text-white"
              >
                <Sparkles size={16} className="text-cyan-600 dark:text-cyan-300" />
                Ask NEXUS AI
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= STATS COUNTER STRIP ================= */}
      <section className="border-b border-slate-200/80 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.015]">
        <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-8">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="relative rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5 shadow-sm"
              >
                <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                  {m.value}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                  {m.label}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-white/40">
                  {m.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= ARCHITECTURAL PILLARS ================= */}
      <section className="border-b border-slate-200/80 dark:border-white/[0.06] py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
              System Blueprint
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              How NEXUS orchestrates university operations
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              A 3-stage pipeline that balances autonomous machine speed with strict
              human governance and document integrity.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {architecturePillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40 dark:hover:border-cyan-400/30 hover:shadow-xl hover:shadow-cyan-500/5"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-500/20 shadow-sm">
                        <Icon size={22} />
                      </div>
                      <span className="font-mono text-xs font-semibold text-slate-400 dark:text-white/20">
                        {pillar.step}
                      </span>
                    </div>

                    <div className="mt-6">
                      <span className="inline-block rounded-full bg-slate-100 dark:bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-white/60">
                        {pillar.badge}
                      </span>
                      <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
                        {pillar.title}
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {pillar.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 border-t border-slate-100 dark:border-white/[0.06] pt-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30 mb-3">
                      Key Highlights
                    </p>
                    <ul className="space-y-2">
                      {pillar.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300"
                        >
                          <CheckCircle2
                            size={14}
                            className="shrink-0 text-cyan-500"
                          />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= THE BRAIN BEHIND NEXUS ================= */}
      <section className="relative border-b border-slate-200/80 dark:border-white/[0.06] bg-slate-100/50 dark:bg-white/[0.01] py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border border-violet-200 dark:border-violet-500/20 shadow-sm">
              <Award size={20} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
              Leadership & Architecture
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              The brain behind NEXUS
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Built through deep technical commitment, critical problem solving,
              and relentless iterative engineering.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-2xl">
            <div className="relative overflow-hidden rounded-[28px] border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-gradient-to-br dark:from-[#0e131c] dark:via-[#090c13] dark:to-[#07090e] p-8 sm:p-10 shadow-xl shadow-slate-900/5 dark:shadow-cyan-500/5">
              {/* Subtle background glow */}
              <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl dark:bg-cyan-500/[0.08]" />

              <div className="relative flex flex-col items-center sm:flex-row sm:items-start gap-6">
                {/* Monogram Badge */}
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-violet-600 p-0.5 shadow-lg shadow-cyan-500/20">
                  <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950 text-white font-mono text-2xl font-bold tracking-tight">
                    SK
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-slate-900 shadow-sm">
                    <ShieldCheck size={13} />
                  </span>
                </div>

                {/* Profile Header */}
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                      Mohammad Saifullah Khan
                    </h3>
                    <span className="rounded-full border border-cyan-500/30 bg-cyan-50 dark:bg-cyan-950/40 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300">
                      Lead Architect
                    </span>
                  </div>

                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Computer Science & Engineering Undergraduate
                  </p>

                  <p className="mt-4 text-xs leading-6 text-slate-600 dark:text-slate-300/80">
                    Saif conceived, designed, and developed NEXUS to eliminate the
                    bureaucratic lag in university systems. He orchestrated the
                    entire platform from the natural language intake layer and
                    DOCX certificate generation engine to the staff governance
                    dashboard and database architecture.
                  </p>

                  <div className="mt-5 flex flex-wrap justify-center sm:justify-start gap-2">
                    {[
                      "Full-Stack Architecture",
                      "Autonomous AI Workflows",
                      "Document Synthesis Engine",
                      "Security & RBAC",
                    ].map((badge) => (
                      <span
                        key={badge}
                        className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-slate-700 dark:text-white/70"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CAPABILITIES GRID ================= */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
              Institutional Capabilities
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Comprehensive university services in one place
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Modular services that adapt to the governance and record-keeping
              needs of any university department.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.title}
                  className="rounded-2xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-6 shadow-sm transition hover:border-slate-300 dark:hover:border-white/20 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-cyan-300">
                      <Icon size={18} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                        {cap.category}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {cap.title}
                      </h4>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {cap.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-[#07090e] py-10 transition-colors duration-200">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500 text-white font-bold text-[10px]">
              N
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              NEXUS • Unified University Service Platform
            </p>
          </div>

          <p className="text-xs text-slate-400 dark:text-white/30">
            Engineered with verifiable human governance.
          </p>
        </div>
      </footer>
    </main>
  );
}