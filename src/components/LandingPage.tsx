import React from 'react';
import { Shield, Key, EyeOff, Brain, FileKey, UserCheck, ArrowRight, Activity, Cpu, LogIn, Lock, Users, Radio } from 'lucide-react';
import { motion } from 'motion/react';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export default function LandingPage({ onGetStarted, onLogin }: LandingPageProps) {
  const steps = [
    {
      num: '01',
      title: 'Patient Registers',
      desc: 'Create an account within seconds. Your device securely initializes a root profile immediately.',
      icon: Users,
      color: 'from-blue-500/10 to-transparent',
      iconColor: 'text-blue-600 bg-blue-50 border-blue-100'
    },
    {
      num: '02',
      title: 'Generate Digital Keys',
      desc: 'Creates a custom 2048-bit Public-Private Asymmetric Key Card. You hold the matching secret Private Key.',
      icon: Key,
      color: 'from-teal-500/10 to-transparent',
      iconColor: 'text-teal-600 bg-teal-50 border-teal-100'
    },
    {
      num: '03',
      title: 'Encapsulate Records',
      desc: 'All medical reports and prescriptions are encrypted in the local web-vault prior to secure transit.',
      icon: Lock,
      color: 'from-emerald-500/10 to-transparent',
      iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-100'
    },
    {
      num: '04',
      title: 'Doctor Submits Request',
      desc: 'A licensed clinician issues a targeted access request specifying duration and clinical purpose.',
      icon: FileKey,
      color: 'from-amber-500/10 to-transparent',
      iconColor: 'text-amber-600 bg-amber-50 border-amber-100'
    },
    {
      num: '05',
      title: 'Digital Signature Consent',
      desc: 'You sign off securely using your cryptographic private key. Doctors have zero access until you sign.',
      icon: UserCheck,
      color: 'from-violet-500/10 to-transparent',
      iconColor: 'text-violet-600 bg-violet-50 border-violet-100'
    },
    {
      num: '06',
      title: 'Provider Read Access',
      desc: 'The doctor decodes the payload locally. Your data remains fully encrypted everywhere else.',
      icon: EyeOff,
      color: 'from-cyan-500/10 to-transparent',
      iconColor: 'text-cyan-600 bg-cyan-50 border-cyan-100'
    },
    {
      num: '07',
      title: 'AI Chemical Conflicts Check',
      desc: 'The embedded clinician engine maps cross-drug contraindications and flags severe pharmacological warnings.',
      icon: Brain,
      color: 'from-rose-500/10 to-transparent',
      iconColor: 'text-rose-600 bg-rose-50 border-rose-100'
    },
    {
      num: '08',
      title: 'Immutable Ledger Audit',
      desc: 'All interactions are timestamped, integrity-hashed, and permanently saved on your personal history ledger.',
      icon: Radio,
      color: 'from-fuchsia-500/10 to-transparent',
      iconColor: 'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-100'
    }
  ];

  return (
    <div id="landing-page-root" className="min-h-screen bg-gradient-to-br from-blue-100/50 via-blue-50/40 to-sky-100/50 backdrop-blur-sm text-zinc-900 flex flex-col selection:bg-blue-200 selection:text-blue-900 relative">
      
      {/* Background Decorative grids with absolute minimal light footprint */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.12),transparent_60%)] pointer-events-none" />
      <div className="absolute top-24 left-12 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-24 right-12 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Navigation Header */}
      <header id="landing-nav" className="relative z-10 w-full border-b border-blue-200/50 bg-blue-50/70 backdrop-blur-md shadow-sm px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl shadow-sm overflow-hidden bg-zinc-900">
              <img src="/logo.jpeg" alt="MedSafe Logo" className="object-contain w-full h-full p-1" />
            </div>
            <div>
              <h1 className="font-display font-bold tracking-tight text-zinc-900 text-base md:text-md leading-tight uppercase">
                Med-Safe
              </h1>
              <p className="font-mono text-[9px] tracking-wide text-zinc-500 uppercase leading-none mt-0.5">
                Prescription Intelligence Network
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              id="nav-btn-login"
              onClick={onLogin}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs md:text-sm font-semibold text-zinc-650 hover:text-zinc-900 transition-all cursor-pointer whitespace-nowrap"
            >
              <LogIn className="h-4 w-4" /> Sign In
            </button>
            <button
              id="nav-btn-getstarted"
              onClick={onGetStarted}
              className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 text-xs md:text-sm font-semibold shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="hero-section" className="relative z-10 max-w-5xl mx-auto px-6 pt-20 md:pt-28 pb-16 text-center flex-1 flex flex-col justify-center items-center">

        {/* Main Display Slogan */}
        <h2 className="font-display text-4xl md:text-[54px] font-extrabold tracking-tight text-zinc-900 mb-6 leading-tight max-w-4xl">
          You own your medical data. <br />
          <span className="bg-gradient-to-r from-teal-600 via-teal-700 to-indigo-700 bg-clip-text text-transparent">
            Nobody can see it without YOUR permission.
          </span>
        </h2>

        {/* Subtitle description */}
        <p className="text-zinc-600 text-base md:text-lg max-w-2xl mb-10 leading-relaxed font-sans">
          A security-hardened locker utilizing localized asymmetric client-side keypairs. 
          Doctors must seek express digital permission to view records. Embedded AI shields you from drug-to-drug interactions.
        </p>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center w-full max-w-md">
          <button
            id="hero-btn-getstarted"
            onClick={onGetStarted}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-white px-8 py-3.5 text-sm font-bold shadow-sm transition-all cursor-pointer group"
          >
            Create Your Account
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
          <button
            id="hero-btn-how"
            onClick={() => {
              const el = document.getElementById('workflow-tracker');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-8 py-3.5 text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            How it Works
          </button>
        </div>
      </section>

      {/* Core Workflow Section */}
      <section id="workflow-tracker" className="relative z-10 max-w-7xl mx-auto px-6 py-20 border-t border-zinc-200 bg-[#fbfbfb]">
        <div className="text-center mb-14">
          <h3 className="font-display text-2xl md:text-3xl font-extrabold text-teal-700 mb-4">
            The Med-Safe Workflow
          </h3>
          <p className="text-zinc-650 max-w-2xl mx-auto text-sm md:text-base font-sans leading-relaxed">
            Every file translation, authorization, and AI clinical report operates over an asymmetric ledger loop. Review our absolute cryptographic sequence model.
          </p>
        </div>

        {/* 8-Step Grid Layout */}
        <div id="steps-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((st, index) => {
            const IconComponent = st.icon;
            const bgColors = [
              'bg-blue-100/80 border-blue-200/70 hover:bg-blue-100',
              'bg-emerald-100/80 border-emerald-200/70 hover:bg-emerald-100',
              'bg-purple-100/80 border-purple-200/70 hover:bg-purple-100',
              'bg-amber-100/80 border-amber-200/70 hover:bg-amber-100'
            ];
            const cardBg = bgColors[index % 4];
            return (
              <div
                key={st.num}
                className={`relative rounded-2xl border p-6 flex flex-col justify-between hover:shadow-md transition-all duration-300 ${cardBg}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="font-mono text-xs font-bold text-zinc-400 tracking-wider">
                      PHASE {st.num}
                    </span>
                    <div className={`p-2 rounded-lg border flex items-center justify-center ${st.iconColor}`}>
                      <IconComponent className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <h4 className="font-spartan uppercase font-bold text-zinc-900 text-sm md:text-[15px] tracking-wide mb-2.5">
                    {st.title}
                  </h4>
                  <p className="text-zinc-600 text-xs leading-relaxed font-sans">
                    {st.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer System Credits */}
      <footer id="landing-footer" className="relative z-10 border-t border-zinc-200 bg-white py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-zinc-500 text-xs font-mono">
          <div>
            &copy; 2026 Prescription Intelligence Network. Immutable Cryptographic Ledger.
          </div>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-teal-600 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
               Online
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
