import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Lock,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { signInWithGoogleFirebase, syncUserProfileToFirestore } from '../lib/firebase';
import type { User, UserRole } from '../types';

interface AuthPortalProps {
  initialMode: 'login' | 'register';
  initialRole?: 'patient' | 'provider';
  prefillSpecialty?: string;
  onBackToLanding: () => void;
  onAuthenticated: (token: string, user: User, prefillSpecialty?: string) => void;
}

export default function AuthPortal({
  initialMode,
  initialRole = 'patient',
  prefillSpecialty,
  onBackToLanding,
  onAuthenticated,
}: AuthPortalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [role, setRole] = useState<'patient' | 'provider'>(initialRole);
  const [onboardStep, setOnboardStep] = useState<1 | 2 | 3>(1);

  // Shared credentials
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('United Kingdom');
  const [preferredLanguage, setPreferredLanguage] = useState('English');

  // Patient onboarding preferences
  const [preferredDestination, setPreferredDestination] = useState('Singapore');
  const [treatmentInterest, setTreatmentInterest] = useState(
    prefillSpecialty || 'Cardiology & Structural Heart',
  );
  const [budgetPreferenceUsd, setBudgetPreferenceUsd] = useState(22000);

  // Provider onboarding details
  const [organizationName, setOrganizationName] = useState('');
  const [providerType, setProviderType] = useState('Tertiary International Hospital');
  const [consentAccepted, setConsentAccepted] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleLogin = async (loginEmail: string, loginPassword: string) => {
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Sign in failed.');
        setLoading(false);
        return;
      }
      onAuthenticated(data.token, data.user, prefillSpecialty);
    } catch {
      setError('Network error while connecting to authentication service.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onboardStep < 3) {
      setOnboardStep((s) => (s + 1) as 1 | 2 | 3);
      return;
    }
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: role as UserRole,
          fullName,
          email,
          password,
          country,
          preferredLanguage,
          preferredDestination: role === 'patient' ? preferredDestination : undefined,
          treatmentInterest: role === 'patient' ? treatmentInterest : undefined,
          budgetPreferenceUsd: role === 'patient' ? Number(budgetPreferenceUsd) : undefined,
          organizationName: role === 'provider' ? organizationName : undefined,
          providerType: role === 'provider' ? providerType : undefined,
          consentAccepted,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed.');
        setLoading(false);
        return;
      }
      onAuthenticated(data.token, data.user, prefillSpecialty || treatmentInterest);
    } catch {
      setError('Unable to complete registration right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Could not process request.');
      else setInfoMessage(data.message);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      const { idToken } = await signInWithGoogleFirebase();
      const res = await fetch('/api/auth/firebase-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          role,
          country,
          preferredLanguage,
          organizationName: role === 'provider' ? organizationName : undefined,
          providerType: role === 'provider' ? providerType : undefined,
          consentAccepted,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Google Firebase sign-in failed.');
        return;
      }
      await syncUserProfileToFirestore(data.user).catch(() => {});
      onAuthenticated(data.token, data.user, prefillSpecialty);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In popup was cancelled or blocked.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const stepLabels =
    role === 'patient'
      ? ['01 · Identity', '02 · Care Preferences', '03 · Consent & Security']
      : ['01 · Organization', '02 · Corridor & Contact', '03 · Review & Submit'];

  return (
    <div className="min-h-screen bg-[#070B18] text-[#F5F8FF] flex flex-col">
      <header className="border-b border-[rgba(135,180,230,0.15)] bg-[#070B18]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button
            type="button"
            onClick={onBackToLanding}
            className="inline-flex items-center gap-2 text-sm text-[#9BAAC2] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to EthAum CareConnect</span>
          </button>
          <div className="text-xs text-[#9BAAC2]">Encrypted Session · Role-Based Access</div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-6 py-12 lg:grid-cols-12 lg:items-center">
        {/* Left Split-Screen Architecture & Instant Demo Access */}
        <div className="lg:col-span-5 space-y-6">
          <div>
            <div className="text-xs font-medium text-[#39DDF5]">EthAum CareConnect Portal</div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {mode === 'login'
                ? 'Sign in to your care workspace'
                : mode === 'register'
                  ? 'Role-based platform onboarding'
                  : 'Reset account access'}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#9BAAC2]">
              Patients organize dossiers, control hospital consent, and compare quotes. Providers manage consented enquiries and issue itemized proposals.
            </p>
          </div>

          <div className="rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#0B1224] p-5">
            <div className="flex items-center justify-between text-xs text-[#9BAAC2] mb-3">
              <span className="font-medium text-white">Cross-Border Consent Architecture</span>
              <span className="font-mono-tabular text-[#39DDF5]">7 Care Corridors</span>
            </div>
            <svg viewBox="0 0 360 112" className="w-full h-28" aria-label="Cross-border consent flow diagram">
              <defs>
                <linearGradient id="authLinkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#39DDF5" stopOpacity="0.85" />
                  <stop offset="50%" stopColor="#477BFF" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#9272FF" stopOpacity="0.85" />
                </linearGradient>
              </defs>
              <path
                d="M 48 56 Q 115 16 180 56 T 312 56"
                fill="none"
                stroke="url(#authLinkGrad)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <path
                d="M 48 56 Q 115 96 180 56 T 312 56"
                fill="none"
                stroke="rgba(57,221,245,0.28)"
                strokeWidth="1.5"
              />
              <circle cx="48" cy="56" r="18" fill="#101A30" stroke="#39DDF5" strokeWidth="1.5" />
              <text x="48" y="60" textAnchor="middle" fill="#F5F8FF" fontSize="10" fontWeight="600">
                Patient
              </text>
              <circle cx="180" cy="56" r="22" fill="#14213B" stroke="#477BFF" strokeWidth="1.5" />
              <text x="180" y="53" textAnchor="middle" fill="#39DDF5" fontSize="9" fontWeight="600">
                Vault &amp;
              </text>
              <text x="180" y="65" textAnchor="middle" fill="#39DDF5" fontSize="9" fontWeight="600">
                Consent
              </text>
              <circle cx="312" cy="56" r="18" fill="#161738" stroke="#9272FF" strokeWidth="1.5" />
              <text x="312" y="60" textAnchor="middle" fill="#F5F8FF" fontSize="10" fontWeight="600">
                Hospital
              </text>
              <text x="48" y="96" textAnchor="middle" fill="#9BAAC2" fontSize="9">
                Case Intake
              </text>
              <text x="180" y="96" textAnchor="middle" fill="#9BAAC2" fontSize="9">
                Granular ACL
              </text>
              <text x="312" y="96" textAnchor="middle" fill="#9BAAC2" fontSize="9">
                Itemized Quote
              </text>
            </svg>
          </div>

          <div className="rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#0B1224] p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-medium text-white">
              <ShieldCheck className="h-4 w-4 text-[#39DDF5]" />
              <span>Instant Demo Workspaces (Sample Data)</span>
            </div>
            <div className="grid gap-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleLogin('patient@careconnect.demo', 'CareDemo2026!')}
                className="flex items-center justify-between rounded-xl border border-[#39DDF5]/30 bg-[#101A30] px-4 py-3 text-left transition-colors hover:border-[#39DDF5]/70"
              >
                <div>
                  <div className="text-sm font-semibold text-white">Patient Portal Demo</div>
                  <div className="font-mono-tabular text-xs text-[#9BAAC2]">
                    patient@careconnect.demo · Aarav Mehta
                  </div>
                </div>
                <span className="text-xs font-medium text-[#39DDF5]">Enter</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleLogin('provider@careconnect.demo', 'CareDemo2026!')}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-[#090F20] px-4 py-3 text-left transition-colors hover:border-[#9272FF]/60"
              >
                <div>
                  <div className="text-sm font-semibold text-white">Provider Portal Demo</div>
                  <div className="font-mono-tabular text-xs text-[#9BAAC2]">
                    provider@careconnect.demo · Novena Heart Center
                  </div>
                </div>
                <span className="text-xs font-medium text-[#9272FF]">Enter</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleLogin('admin@careconnect.demo', 'CareDemo2026!')}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-[#090F20] px-4 py-3 text-left transition-colors hover:border-white/30"
              >
                <div>
                  <div className="text-sm font-semibold text-white">Governance &amp; Admin Console</div>
                  <div className="font-mono-tabular text-xs text-[#9BAAC2]">
                    admin@careconnect.demo · Platform Operations
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-300">Enter</span>
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3 text-xs text-[#9BAAC2]">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span>
              Credentials are salted and hashed with scrypt server-side. Patient records stay isolated by consent.
            </span>
          </div>
        </div>

        {/* Right Form Card */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#0B1224] p-6 sm:p-8">
            <div className="flex items-center gap-2 border-b border-white/10 pb-5">
              {(
                [
                  ['login', 'Sign In'],
                  ['register', 'Create Account'],
                  ['forgot', 'Forgot Password'],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                    setInfoMessage(null);
                  }}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                    mode === m
                      ? 'bg-[#39DDF5] text-[#070B18]'
                      : 'bg-white/5 text-slate-300 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {error && (
              <div className="mt-5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200">
                {error}
              </div>
            )}

            {infoMessage && (
              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{infoMessage}</span>
              </div>
            )}



            {mode === 'login' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleLogin(email, password);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-300">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#39DDF5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#39DDF5] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#39DDF5] px-4 py-3 text-sm font-semibold text-[#070B18] transition-colors hover:bg-[#6ae5f8] disabled:opacity-60"
                >
                  {loading ? 'Signing in...' : 'Sign In to Workspace'}
                </button>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegister} className="mt-4 space-y-5">
                {/* Role Switcher */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRole('patient');
                      setOnboardStep(1);
                    }}
                    className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-left transition-colors ${
                      role === 'patient'
                        ? 'border-[#39DDF5] bg-[#101A30]'
                        : 'border-white/10 bg-[#070B18]'
                    }`}
                  >
                    <UserIcon className={`h-4 w-4 ${role === 'patient' ? 'text-[#39DDF5]' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-sm font-semibold text-white">Patient</div>
                      <div className="text-xs text-[#9BAAC2]">Seek care &amp; compare quotes</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole('provider');
                      setOnboardStep(1);
                    }}
                    className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-left transition-colors ${
                      role === 'provider'
                        ? 'border-[#9272FF] bg-[#161738]'
                        : 'border-white/10 bg-[#070B18]'
                    }`}
                  >
                    <Building2 className={`h-4 w-4 ${role === 'provider' ? 'text-[#9272FF]' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-sm font-semibold text-white">Healthcare Provider</div>
                      <div className="text-xs text-[#9BAAC2]">Hospital / International desk</div>
                    </div>
                  </button>
                </div>

                {/* Onboarding Step Indicator */}
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  {stepLabels.map((lbl, idx) => {
                    const stepNum = (idx + 1) as 1 | 2 | 3;
                    const active = onboardStep === stepNum;
                    const done = onboardStep > stepNum;
                    return (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => setOnboardStep(stepNum)}
                        className={`rounded-lg border px-2.5 py-2 text-left font-medium transition-colors ${
                          active
                            ? 'border-[#39DDF5] bg-[#101A30] text-[#39DDF5]'
                            : done
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                              : 'border-white/10 bg-[#070B18] text-[#9BAAC2]'
                        }`}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>

                {/* Step 1: Identity / Organization */}
                {onboardStep === 1 && (
                  <div className="space-y-4">
                    {role === 'provider' && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium text-slate-300">
                            Hospital / Organization Name
                          </label>
                          <input
                            type="text"
                            required
                            value={organizationName}
                            onChange={(e) => setOrganizationName(e.target.value)}
                            placeholder="e.g., Pacific Heart Institute"
                            className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2.5 text-sm text-white focus:border-[#39DDF5] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300">Provider Type</label>
                          <select
                            value={providerType}
                            onChange={(e) => setProviderType(e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2.5 text-sm text-white focus:border-[#39DDF5] focus:outline-none"
                          >
                            <option>Tertiary International Hospital</option>
                            <option>Specialty Surgical Center</option>
                            <option>Oncology &amp; Proton Institute</option>
                            <option>Dental &amp; Maxillofacial Clinic</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-300">
                          {role === 'provider' ? 'Coordinator Contact Name' : 'Full Legal Name'}
                        </label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Full name"
                          className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2.5 text-sm text-white focus:border-[#39DDF5] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300">
                          {role === 'provider' ? 'Business Email' : 'Email Address'}
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@domain.com"
                          className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2.5 text-sm text-white focus:border-[#39DDF5] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-300">
                          {role === 'provider' ? 'Hospital Country' : 'Home Country'}
                        </label>
                        <input
                          type="text"
                          required
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2.5 text-sm text-white focus:border-[#39DDF5] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300">
                          Preferred Language
                        </label>
                        <select
                          value={preferredLanguage}
                          onChange={(e) => setPreferredLanguage(e.target.value)}
                          className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2.5 text-sm text-white focus:border-[#39DDF5] focus:outline-none"
                        >
                          <option>English</option>
                          <option>Arabic</option>
                          <option>German</option>
                          <option>Mandarin</option>
                          <option>Hindi</option>
                          <option>Spanish</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Preferences */}
                {onboardStep === 2 && (
                  <div className="space-y-4">
                    {role === 'patient' ? (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-300">
                              Preferred Destination Hub
                            </label>
                            <select
                              value={preferredDestination}
                              onChange={(e) => setPreferredDestination(e.target.value)}
                              className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2.5 text-sm text-white"
                            >
                              <option>Singapore</option>
                              <option>Germany</option>
                              <option>India</option>
                              <option>Turkey</option>
                              <option>Thailand</option>
                              <option>South Korea</option>
                              <option>UAE</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-300">
                              Treatment Interest
                            </label>
                            <input
                              type="text"
                              value={treatmentInterest}
                              onChange={(e) => setTreatmentInterest(e.target.value)}
                              placeholder="e.g., Cardiology, Knee Replacement"
                              className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2.5 text-sm text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300">
                            Target Budget Estimate (USD):{' '}
                            <span className="font-mono-tabular text-[#39DDF5]">
                              ${budgetPreferenceUsd.toLocaleString()}
                            </span>
                          </label>
                          <input
                            type="range"
                            min={4000}
                            max={60000}
                            step={1000}
                            value={budgetPreferenceUsd}
                            onChange={(e) => setBudgetPreferenceUsd(Number(e.target.value))}
                            className="mt-2 w-full accent-[#39DDF5]"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="rounded-xl border border-[#9272FF]/30 bg-[#141536] p-4 text-xs text-slate-200 space-y-2">
                        <div className="font-semibold text-[#9272FF]">
                          Provider Verification Policy
                        </div>
                        <p>
                          New provider organizations register in <strong className="text-white">Unverified Sample</strong> status until CareConnect Governance reviews accreditation documents inside the Admin Verification Queue.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Password + Consent */}
                {onboardStep === 3 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        Password (minimum 6 characters)
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a strong password"
                        className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2.5 text-sm text-white focus:border-[#39DDF5] focus:outline-none"
                      />
                    </div>

                    <label className="flex items-start gap-2.5 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={consentAccepted}
                        onChange={(e) => setConsentAccepted(e.target.checked)}
                        className="mt-0.5 rounded border-white/25 bg-[#070B18]"
                      />
                      <span>
                        I acknowledge that EthAum CareConnect coordinates administrative case intake and does not provide medical diagnoses or replace licensed clinical care.
                      </span>
                    </label>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-2">
                  {onboardStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => setOnboardStep((s) => (s - 1) as 1 | 2 | 3)}
                      className="rounded-lg border border-white/15 px-4 py-2.5 text-xs font-medium text-slate-300 hover:text-white"
                    >
                      Previous Step
                    </button>
                  ) : (
                    <span />
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#39DDF5] px-5 py-2.5 text-xs font-semibold text-[#070B18] transition-colors hover:bg-[#6ae5f8] disabled:opacity-60"
                  >
                    <span>
                      {loading
                        ? 'Creating account...'
                        : onboardStep < 3
                          ? 'Continue'
                          : role === 'patient'
                            ? 'Create Patient Account'
                            : 'Complete Provider Onboarding'}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            )}

            {mode === 'forgot' && (
              <form onSubmit={handleForgot} className="mt-6 space-y-4">
                <p className="text-xs leading-relaxed text-[#9BAAC2]">
                  Enter the email associated with your CareConnect profile to receive password recovery instructions.
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-300">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2.5 text-sm text-white focus:border-[#39DDF5] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#39DDF5] px-4 py-3 text-sm font-semibold text-[#070B18] transition-colors hover:bg-[#6ae5f8] disabled:opacity-60"
                >
                  {loading ? 'Sending...' : 'Request Password Reset'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
