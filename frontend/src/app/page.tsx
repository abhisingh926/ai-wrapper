"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import axios from "axios";

/* ───── Feature data ───── */
const features = [
  {
    icon: "🤖",
    title: "Custom AI Agents",
    description:
      "Create intelligent agents powered by GPT-4o, Claude, Gemini, or any LLM. Customize personality, system prompts, and temperature.",
    gradient: "from-indigo-500/20 to-violet-500/20",
  },
  {
    icon: "💬",
    title: "Multi-Channel Deployment",
    description:
      "Deploy your agent across WhatsApp, Discord, Slack, or embed it as a chat widget on any website — all from one dashboard.",
    gradient: "from-emerald-500/20 to-cyan-500/20",
  },
  {
    icon: "🧠",
    title: "Knowledge Base (RAG)",
    description:
      "Upload PDFs, docs, and text files. Your agent uses RAG to answer questions grounded in your own data — no hallucinations.",
    gradient: "from-amber-500/20 to-orange-500/20",
  },
  {
    icon: "📊",
    title: "Lead Capture & CRM",
    description:
      "Automatically extract contact info from conversations. Every lead is saved and visible in your dashboard — zero manual work.",
    gradient: "from-pink-500/20 to-rose-500/20",
  },
  {
    icon: "🎨",
    title: "White-Label Branding",
    description:
      "Customize your chat widget with your brand colors, logo, welcome message, and position. Make it truly yours.",
    gradient: "from-purple-500/20 to-fuchsia-500/20",
  },
  {
    icon: "⚡",
    title: "Tools & Actions",
    description:
      "Give your agents superpowers — web search, calculator, code interpreter, lead catcher, and more. Enable per agent.",
    gradient: "from-sky-500/20 to-blue-500/20",
  },
];

const channels = [
  { name: "WhatsApp", emoji: "💬", color: "#25D366", desc: "Scan QR & go live" },
  { name: "Discord", emoji: "🎮", color: "#5865F2", desc: "Bot token pairing" },
  { name: "Slack", emoji: "💼", color: "#4A154B", desc: "App + Bot tokens" },
  { name: "Web Widget", emoji: "🌐", color: "#6366f1", desc: "Embed anywhere" },
  { name: "API", emoji: "🔗", color: "#06b6d4", desc: "REST endpoints" },
];

const steps = [
  {
    num: "01",
    title: "Create Your Agent",
    description:
      "Choose an AI model, set the personality, and configure the system prompt. Your agent is ready in seconds.",
    icon: "🧩",
  },
  {
    num: "02",
    title: "Train It",
    description:
      "Upload your knowledge base — PDFs, documents, FAQs. The agent learns your domain instantly via RAG.",
    icon: "📚",
  },
  {
    num: "03",
    title: "Deploy Everywhere",
    description:
      "Connect WhatsApp, Discord, Slack, or embed the chat widget on your website. One agent, all channels.",
    icon: "🚀",
  },
];

const testimonials = [
  {
    quote: "We replaced our entire support team's first-response with an AIWrapper agent. Response time went from 4 hours to 4 seconds.",
    name: "Sarah Chen",
    role: "Head of Support, TechScale",
    avatar: "SC",
  },
  {
    quote: "The WhatsApp integration is a game-changer. Our sales agents now capture leads 24/7 without lifting a finger.",
    name: "Marcus Rodriguez",
    role: "Founder, LeadFlow",
    avatar: "MR",
  },
  {
    quote: "We uploaded our 200-page product manual and the AI answers customer questions better than most of our staff.",
    name: "Priya Sharma",
    role: "CTO, CloudNine SaaS",
    avatar: "PS",
  },
];

/* ───── Autonomous Skills data ───── */
const autonomousSkills = [
  {
    icon: "📈",
    title: "Market Analyst",
    description: "Monitors asset prices & market trends. Alerts you when critical thresholds are met.",
    tags: ["Web Search", "Proactive Alerts"],
    schedule: "Hourly",
    gradient: "from-emerald-500/20 to-teal-500/10",
    iconBg: "from-emerald-500 to-teal-400",
  },
  {
    icon: "📰",
    title: "News Sentinel",
    description: "Scans global news for keywords or entities and alerts you of important developments.",
    tags: ["Web Search", "Proactive Alerts"],
    schedule: "Daily at 8 AM",
    gradient: "from-blue-500/20 to-indigo-500/10",
    iconBg: "from-blue-500 to-indigo-400",
  },
  {
    icon: "🔍",
    title: "Competitor Watcher",
    description: "Checks competitor websites for major updates, product launches, or pricing changes.",
    tags: ["Web Search", "Proactive Alerts"],
    schedule: "Weekly",
    gradient: "from-violet-500/20 to-purple-500/10",
    iconBg: "from-violet-500 to-purple-400",
  },
  {
    icon: "🐙",
    title: "GitHub Issue Triage",
    description: "Scans your repos for unassigned or critical issues and summarizes them for you.",
    tags: ["GitHub Data", "Proactive Alerts"],
    schedule: "Hourly (9-5)",
    gradient: "from-orange-500/20 to-amber-500/10",
    iconBg: "from-orange-500 to-amber-400",
  },
  {
    icon: "☀️",
    title: "Daily Briefing",
    description: "Gathers your schedule, weather, and breaking news into one concise morning alert.",
    tags: ["Calendar", "Weather", "News"],
    schedule: "Daily at 7 AM",
    gradient: "from-cyan-500/20 to-sky-500/10",
    iconBg: "from-cyan-500 to-sky-400",
  },
  {
    icon: "🧬",
    title: "Deep Researcher",
    description: "Performs multi-step web research on a topic and synthesizes a comprehensive report.",
    tags: ["Multi-Step Search", "Reports"],
    schedule: "Custom",
    gradient: "from-rose-500/20 to-pink-500/10",
    iconBg: "from-rose-500 to-pink-400",
  },
];

const skillExecutionSteps = [
  { step: "01", icon: "⏰", title: "Wake Up", desc: 'Cron triggers at schedule' },
  { step: "02", icon: "🔎", title: "Search", desc: 'search_web("BTC price")' },
  { step: "03", icon: "🧠", title: "Analyze", desc: 'Is price > $100k?' },
  { step: "04", icon: "🔔", title: "Alert", desc: 'proactive_alert(user)' },
];

const defaultPricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["1 AI Agent", "100 Messages / mo", "1 Channel", "Basic Knowledge Base", "Community Support"],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    features: ["5 AI Agents", "5,000 Messages / mo", "All Channels", "Unlimited Knowledge Base", "Lead Capture", "Custom Branding", "Priority Support"],
    cta: "Get Pro",
    popular: true,
  },
  {
    name: "Business",
    price: "$49",
    period: "/month",
    features: ["Unlimited Agents", "50,000 Messages / mo", "All Channels", "Unlimited Knowledge Base", "Advanced Analytics", "API Access", "Team Members", "White-Label Widget"],
    cta: "Go Business",
    popular: false,
  },
];

/* ───── Animated counter component ───── */
function AnimatedCounter({ target, suffix = "" }: { target: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const numericTarget = parseInt(target.replace(/[^0-9]/g, "")) || 0;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const duration = 1500;
          const step = numericTarget / (duration / 16);
          const timer = setInterval(() => {
            start += step;
            if (start >= numericTarget) {
              setCount(numericTarget);
              clearInterval(timer);
            } else {
              setCount(Math.floor(start));
            }
          }, 16);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [numericTarget]);

  return <div ref={ref}>{count.toLocaleString()}{suffix}</div>;
}

/* ═══════════════════════════ LANDING PAGE ═══════════════════════════ */
export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pricingPlans, setPricingPlans] = useState(defaultPricingPlans);
  const [showAutonomousSkills, setShowAutonomousSkills] = useState(true);

  useEffect(() => {
    axios
      .get("/api/billing/plans")
      .then((res) => {
        const ctas = ["Start Free", "Get Pro", "Go Business"];
        setPricingPlans(
          res.data.map((p: any, i: number) => ({
            name: p.name,
            price: `$${p.price_monthly}`,
            period: p.price_monthly === 0 ? "forever" : "/month",
            features: p.features,
            cta: ctas[i] || "Get Started",
            popular: i === 1,
          }))
        );
      })
      .catch(() => { });

    // Fetch landing page visibility settings
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/landing-settings`)
      .then((res) => {
        setShowAutonomousSkills(res.data.show_autonomous_skills_section !== false);
      })
      .catch(() => { /* default: show */ });
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] overflow-x-hidden">
      {/* ─── NAVBAR ─── */}
      <nav className="glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/20">
              A
            </div>
            <span className="text-xl font-bold text-white">
              AI<span className="text-indigo-400">Wrapper</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-slate-300 hover:text-white transition-colors text-sm">Features</a>
            <a href="#channels" className="text-slate-300 hover:text-white transition-colors text-sm">Channels</a>
            <a href="#how-it-works" className="text-slate-300 hover:text-white transition-colors text-sm">How It Works</a>
            <a href="#pricing" className="text-slate-300 hover:text-white transition-colors text-sm">Pricing</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-slate-300 hover:text-white transition-colors text-sm font-medium px-4 py-2">
              Log In
            </Link>
            <Link href="/login" className="btn-primary text-sm !py-2.5 !px-5">
              Get Started Free
            </Link>
          </div>

          <button className="md:hidden text-slate-300" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileMenuOpen ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden px-6 pb-4 flex flex-col gap-3 border-t border-slate-800/50">
            <a href="#features" className="text-slate-300 hover:text-white py-2 text-sm">Features</a>
            <a href="#channels" className="text-slate-300 hover:text-white py-2 text-sm">Channels</a>
            <a href="#how-it-works" className="text-slate-300 hover:text-white py-2 text-sm">How It Works</a>
            <a href="#pricing" className="text-slate-300 hover:text-white py-2 text-sm">Pricing</a>
            <Link href="/login" className="btn-primary text-center text-sm mt-2">Get Started</Link>
          </div>
        )}
      </nav>

      {/* ─── HERO ─── */}
      <section className="gradient-hero relative min-h-screen flex items-center pt-20">
        {/* Decorative orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-[180px]" />

        <div className="max-w-7xl mx-auto px-6 py-20 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 mb-8">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-indigo-300">Now with WhatsApp QR Pairing</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
            Build AI Agents That
            <br />
            <span className="text-gradient">Talk to Your Customers</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Create custom AI agents powered by any LLM. Deploy them on WhatsApp,
            Discord, Slack, or your website. Capture leads, answer questions from
            your knowledge base, and automate conversations — all without writing code.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/login" className="btn-primary text-lg !py-4 !px-8 glow-primary">
              🚀 Create Your First Agent
            </Link>
            <a href="#how-it-works" className="btn-secondary text-lg !py-4 !px-8">
              See How It Works
            </a>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 md:gap-16">
            {[
              { value: "5", suffix: "+", label: "Channels" },
              { value: "8", suffix: "+", label: "AI Tools" },
              { value: "60", suffix: "s", label: "Setup Time" },
              { value: "0", suffix: "", label: "Code Required", display: "Zero" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-gradient">
                  {stat.display || <AnimatedCounter target={stat.value} suffix={stat.suffix} />}
                </div>
                <div className="text-sm text-slate-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Everything You Need to Build
              <br />
              <span className="text-gradient">Intelligent Agents</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              From creation to deployment to analytics — AIWrapper gives you the full stack for AI-powered customer conversations.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className={`rounded-2xl p-8 bg-gradient-to-br ${feature.gradient} border border-white/5 
                  hover:border-indigo-500/30 transition-all duration-300 group hover:scale-[1.02]`}
              >
                <div className="text-4xl mb-5 float-animation">{feature.icon}</div>
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-slate-400 leading-relaxed text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CHANNELS ─── */}
      <section id="channels" className="py-24 bg-[#0c1222] relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              One Agent, <span className="text-gradient">Every Channel</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Deploy your AI agent wherever your customers are. Connect in minutes, not months.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-4xl mx-auto">
            {channels.map((ch) => (
              <div
                key={ch.name}
                className="gradient-card rounded-xl p-6 text-center transition-all duration-300 hover:scale-105 cursor-pointer group"
              >
                <div className="text-4xl mb-3">{ch.emoji}</div>
                <div className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  {ch.name}
                </div>
                <div className="text-xs text-slate-500 mt-1">{ch.desc}</div>
              </div>
            ))}
          </div>

          {/* Visual: Agent → Channels diagram */}
          <div className="mt-16 max-w-3xl mx-auto">
            <div className="gradient-card rounded-2xl p-8 text-center">
              <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/30">
                    🤖
                  </div>
                  <span className="text-sm text-white font-medium">Your AI Agent</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <svg width="60" height="24" viewBox="0 0 60 24" className="text-indigo-500 hidden md:block">
                    <path d="M0 12h50M45 6l10 6-10 6" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                  <svg width="24" height="40" viewBox="0 0 24 40" className="text-indigo-500 md:hidden">
                    <path d="M12 0v30M6 25l6 10 6-10" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                  {channels.map((ch) => (
                    <div
                      key={ch.name}
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: `${ch.color}20`, border: `1px solid ${ch.color}40` }}
                      title={ch.name}
                    >
                      {ch.emoji}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-slate-400 text-sm mt-6">
                Build once → Deploy everywhere. Your agent handles WhatsApp, Discord, Slack, web chat, and API calls simultaneously.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Live in <span className="text-gradient">Three Steps</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              From zero to a fully functional AI agent in under 60 seconds.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div
                key={step.num}
                className="gradient-card rounded-2xl p-8 transition-all duration-300 hover:scale-[1.02] group relative"
              >
                <div className="absolute -top-4 -left-2 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                  {step.num}
                </div>
                <div className="text-5xl mb-6 float-animation">{step.icon}</div>
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors">
                  {step.title}
                </h3>
                <p className="text-slate-400 leading-relaxed text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AGENTS THAT WORK WHILE YOU SLEEP ─── */}
      {showAutonomousSkills && (
        <section id="autonomous-skills" className="py-28 bg-[#0c1222] relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[150px]" />

          <div className="max-w-7xl mx-auto px-6 relative z-10">
            {/* Badge + Heading */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 mb-6">
                <span className="text-violet-400 text-sm">⚡</span>
                <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Autonomous Background Skills</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Agents That Work <span className="text-gradient">While You Sleep</span>
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Your agent doesn&apos;t just respond &mdash; it acts. Schedule autonomous skills that monitor markets,
                scan news, triage issues, and alert you proactively.
              </p>
            </div>

            {/* Skill Cards Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
              {autonomousSkills.map((skill) => (
                <div
                  key={skill.title}
                  className={`rounded-2xl p-6 bg-gradient-to-br ${skill.gradient} border border-white/5
                  hover:border-violet-500/30 transition-all duration-300 group hover:scale-[1.02] flex flex-col`}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${skill.iconBg} flex items-center justify-center text-lg shrink-0 shadow-lg`}>
                      {skill.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-violet-300 transition-colors">
                        {skill.title}
                      </h3>
                      <p className="text-slate-400 text-sm leading-relaxed mt-1">{skill.description}</p>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center gap-2 flex-wrap pt-4 border-t border-white/5">
                    {skill.tags.map((tag) => (
                      <span key={tag} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/5 text-slate-400 border border-white/5">
                        {tag}
                      </span>
                    ))}
                    <span className="ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center gap-1">
                      <span>⏱</span> {skill.schedule}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* How a Skill Executes - Flow Diagram */}
            <div className="max-w-3xl mx-auto">
              <div className="gradient-card rounded-2xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-white">How a Skill Executes</h3>
                    <p className="text-xs text-slate-500 mt-1">Example: Market Analyst checking Bitcoin price</p>
                  </div>
                  <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                    Autonomous
                  </span>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
                  {skillExecutionSteps.map((s, i) => (
                    <div key={s.step} className="flex items-center gap-2 md:gap-0 w-full md:w-auto">
                      <div className="flex flex-col items-center text-center min-w-[100px]">
                        <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-2">
                          Step {s.step}
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center text-2xl mb-2 skill-step-pulse">
                          {s.icon}
                        </div>
                        <div className="text-sm font-semibold text-white">{s.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-mono">{s.desc}</div>
                      </div>

                      {i < skillExecutionSteps.length - 1 && (
                        <>
                          <svg width="40" height="16" viewBox="0 0 40 16" className="text-violet-500/50 hidden md:block shrink-0 mx-1">
                            <path d="M0 8h30M26 3l8 5-8 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                          </svg>
                          <svg width="16" height="30" viewBox="0 0 16 30" className="text-violet-500/50 md:hidden shrink-0">
                            <path d="M8 0v22M3 18l5 8 5-8" stroke="currentColor" strokeWidth="1.5" fill="none" />
                          </svg>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-24 bg-[#0c1222]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Loved by <span className="text-gradient">Teams Everywhere</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="gradient-card rounded-2xl p-8 transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-amber-400 text-sm">★</span>
                  ))}
                </div>
                <p className="text-slate-300 leading-relaxed text-sm mb-6 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Simple, <span className="text-gradient">Transparent</span> Pricing
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Start free, upgrade as your agents grow. No hidden fees, cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 transition-all duration-300 hover:scale-[1.03] relative ${plan.popular
                  ? "bg-gradient-to-b from-indigo-500/20 to-indigo-900/20 border-2 border-indigo-500/50 glow-primary"
                  : "gradient-card"
                  }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-indigo-500 text-white text-xs font-bold rounded-full">
                    MOST POPULAR
                  </div>
                )}
                <div className="text-sm text-indigo-400 font-medium mb-2">{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                  <span className="text-slate-400 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-slate-300">
                      <span className="text-green-400">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`block text-center py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${plan.popular ? "btn-primary w-full" : "btn-secondary w-full"
                    }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA BANNER ─── */}
      <section className="py-24 bg-[#0c1222] relative">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-transparent to-cyan-500/10" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Your AI Agent is <span className="text-gradient">Waiting</span>
          </h2>
          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
            Create your first AI agent in 60 seconds. No credit card, no code, no limits on imagination.
          </p>
          <Link
            href="/login"
            className="btn-primary text-lg !py-4 !px-10 glow-primary inline-block"
          >
            🚀 Start Building for Free
          </Link>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm">
                  A
                </div>
                <span className="text-lg font-bold text-white">
                  AI<span className="text-indigo-400">Wrapper</span>
                </span>
              </Link>
              <p className="text-sm text-slate-400 leading-relaxed">
                Build, deploy, and manage AI agents that talk to your customers on every channel.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</a></li>
                <li><a href="#channels" className="text-sm text-slate-400 hover:text-white transition-colors">Channels</a></li>
                <li><a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">API Docs</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Careers</a></li>
                <li><a href="mailto:support@aiwrapper.com" className="text-sm text-slate-400 hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">© 2026 AIWrapper. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="text-slate-400 hover:text-white transition-colors text-sm">Twitter</a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors text-sm">GitHub</a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors text-sm">Discord</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
