import { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Edit3,
  FileCheck2,
  Inbox,
  LayoutDashboard,
  Layers,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Send,
  Settings,
  X,
} from 'lucide-react';
import { PROVIDER_LEAD_STAGES } from '../data/seedData';
import type { PlatformBootstrapData, ProviderLeadStage, TreatmentQuote, User } from '../types';

export type ProviderTabId =
  | 'overview'
  | 'inbox'
  | 'cases'
  | 'quotations'
  | 'appointments'
  | 'messages'
  | 'profile'
  | 'services'
  | 'analytics'
  | 'settings';

interface ProviderDashboardProps {
  user: User;
  token: string;
  data: PlatformBootstrapData;
  onRefresh: () => Promise<void>;
  onSignOut: () => void;
  onBackToLanding: () => void;
}

const PROVIDER_NAV: Array<{ id: ProviderTabId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'inbox', label: 'Leads', icon: Inbox },
  { id: 'cases', label: 'Patient Cases', icon: Activity },
  { id: 'quotations', label: 'Quotations', icon: FileCheck2 },
  { id: 'appointments', label: 'Appointments', icon: Calendar },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'profile', label: 'Organization Profile', icon: Building2 },
  { id: 'services', label: 'Services', icon: Layers },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function ProviderDashboard({
  user,
  token,
  data,
  onRefresh,
  onSignOut,
  onBackToLanding,
}: ProviderDashboardProps) {
  const [activeTab, setActiveTab] = useState<ProviderTabId>(
    user.role === 'admin' ? 'analytics' : 'overview',
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // Quotation Builder + Editor state
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [qtCaseId, setQtCaseId] = useState(data.cases[0]?.id || 'case-101');
  const [qtTreatment, setQtTreatment] = useState('Minimally Invasive Structural Heart Package');
  const [qtPrice, setQtPrice] = useState(21500);
  const [qtCostType, setQtCostType] = useState<'Estimated' | 'Confirmed'>('Estimated');
  const [qtCurrency, setQtCurrency] = useState<'USD' | 'EUR' | 'SGD'>('USD');
  const [qtDuration, setQtDuration] = useState(10);
  const [qtAccommodation, setQtAccommodation] = useState('5 nights private inpatient suite');
  const [qtInclusions, setQtInclusions] = useState(
    'Lead surgeon & anesthesia team\n2 days ICU + 5 days private ward\nPre-op diagnostics & airport transfer',
  );
  const [qtExclusions, setQtExclusions] = useState(
    'International flights & visa\nExtended ICU stay if clinically required',
  );
  const [qtMedications, setQtMedications] = useState(
    'Routine inpatient surgical & cardiac medications included',
  );
  const [qtDiagnostics, setQtDiagnostics] = useState(
    'Pre-operative imaging, ECG & baseline blood panel',
  );
  const [qtPayment, setQtPayment] = useState('20% refundable deposit after formal virtual consultation');
  const [qtCancellation, setQtCancellation] = useState(
    'Full refund of deposit up to 7 days prior to admission',
  );
  const [busy, setBusy] = useState(false);

  // Messaging state
  const [msgCaseId, setMsgCaseId] = useState(data.cases[0]?.id || 'case-101');
  const [msgBody, setMsgBody] = useState('');

  const hospital = useMemo(
    () => data.hospitals.find((h) => h.id === (user.hospitalId || 'hosp-sg-1')) || data.hospitals[0],
    [data.hospitals, user.hospitalId],
  );

  // Editable Organization & Services state
  const [orgDescription, setOrgDescription] = useState(hospital.description);
  const [orgLanguages, setOrgLanguages] = useState(hospital.languages.join(', '));
  const [orgPriceRange, setOrgPriceRange] = useState(hospital.indicativeRangeLabel);
  const [orgWaitDays, setOrgWaitDays] = useState(hospital.nextAvailabilityDays);
  const [orgServices, setOrgServices] = useState(hospital.services.join('\n'));
  const [orgTreatments, setOrgTreatments] = useState(hospital.treatments.join('\n'));
  const [orgFacilities, setOrgFacilities] = useState(hospital.facilities.join('\n'));

  // Settings edit state
  const [setFullName, setSetFullName] = useState(user.fullName);
  const [setOrgName, setSetOrgName] = useState(user.organizationName || hospital.name);
  const [setLanguage, setSetLanguage] = useState(user.preferredLanguage);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const handleLeadStageChange = async (caseId: string, stage: ProviderLeadStage) => {
    const res = await fetch(`/api/leads/${caseId}/stage`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ stage }),
    });
    if (res.ok) {
      setBanner(`Updated case ${caseId.toUpperCase()} pipeline stage to "${stage}".`);
      await onRefresh();
    }
  };

  const startEditQuote = (q: TreatmentQuote) => {
    setEditingQuoteId(q.id);
    setQtCaseId(q.caseId);
    setQtTreatment(q.treatmentName);
    setQtPrice(q.estimatedPrice);
    setQtCostType(q.costType || 'Estimated');
    setQtCurrency(q.currency);
    setQtDuration(q.expectedDurationDays);
    setQtAccommodation(q.accommodation);
    setQtInclusions(q.includedServices.join('\n'));
    setQtExclusions(q.excludedServices.join('\n'));
    setQtMedications(q.medicationsIncluded);
    setQtDiagnostics(q.diagnosticsIncluded);
    setQtPayment(q.paymentConditions);
    setQtCancellation(q.cancellationTerms);
  };

  const handleCreateOrUpdateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        caseId: qtCaseId,
        treatmentName: qtTreatment,
        estimatedPrice: Number(qtPrice),
        costType: qtCostType,
        currency: qtCurrency,
        expectedDurationDays: Number(qtDuration),
        accommodation: qtAccommodation,
        includedServices: qtInclusions
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        excludedServices: qtExclusions
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        medicationsIncluded: qtMedications,
        diagnosticsIncluded: qtDiagnostics,
        paymentConditions: qtPayment,
        cancellationTerms: qtCancellation,
      };
      const res = await fetch(editingQuoteId ? `/api/quotes/${editingQuoteId}` : '/api/quotes', {
        method: editingQuoteId ? 'PATCH' : 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setBanner(
          editingQuoteId
            ? `Updated quotation ${editingQuoteId.toUpperCase()} and notified patient.`
            : `Published itemized quotation for ${qtCaseId.toUpperCase()}.`,
        );
        setEditingQuoteId(null);
        await onRefresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveHospitalListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/provider/profile', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          description: orgDescription,
          languages: orgLanguages.split(',').map((s) => s.trim()).filter(Boolean),
          indicativeRangeLabel: orgPriceRange,
          nextAvailabilityDays: Number(orgWaitDays),
          services: orgServices.split('\n').map((s) => s.trim()).filter(Boolean),
          treatments: orgTreatments.split('\n').map((s) => s.trim()).filter(Boolean),
          facilities: orgFacilities.split('\n').map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        setBanner('Saved organization listing & service programs (credential verification remains governance-controlled).');
        await onRefresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProviderSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          fullName: setFullName,
          organizationName: setOrgName,
          preferredLanguage: setLanguage,
        }),
      });
      if (res.ok) {
        setBanner('Saved provider desk settings.');
        await onRefresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAppointment = async (
    id: string,
    status: 'Confirmed' | 'Reschedule Requested' | 'Cancelled',
  ) => {
    await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status }),
    });
    setBanner(`Updated appointment ${id.toUpperCase()} status to "${status}".`);
    await onRefresh();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgBody.trim()) return;
    const text = msgBody.trim();
    setMsgBody('');
    await fetch('/api/messages', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        caseId: msgCaseId,
        body: text,
        recipientHospitalId: hospital.id,
      }),
    });
    await onRefresh();
  };

  const maxEnquiry = Math.max(...data.analytics.monthlyEnquiries.map((m) => m.enquiries), 1);

  return (
    <div className="min-h-screen bg-[#070B18] text-slate-100 flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-white/10 bg-[#090F20] p-4">
        <div>
          <button
            type="button"
            onClick={onBackToLanding}
            className="px-3 py-2 text-left font-display text-lg font-semibold tracking-tight text-white hover:text-[#35D5F5]"
          >
            EthAum CareConnect
          </button>
          <div className="px-3 text-xs text-[#9B8CFF]">
            {user.role === 'admin' ? 'Platform Operations' : 'Provider Portal'}
          </div>

          <nav className="mt-6 space-y-1">
            {PROVIDER_NAV.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#9B8CFF]/15 text-[#9B8CFF]'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/10 pt-4">
          <div className="px-3">
            <div className="text-sm font-medium text-white truncate">{user.fullName}</div>
            <div className="text-xs text-slate-400 truncate">
              {user.organizationName || hospital.name}
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-72 bg-[#090F20] border-r border-white/10 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between px-2 py-2">
                <span className="font-display text-lg font-semibold text-white">
                  Provider Portal
                </span>
                <button type="button" onClick={() => setMobileOpen(false)}>
                  <X className="h-5 w-5 text-slate-300" />
                </button>
              </div>
              <nav className="mt-4 space-y-1">
                {PROVIDER_NAV.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                        activeTab === item.id ? 'bg-[#9B8CFF]/15 text-[#9B8CFF]' : 'text-slate-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070B18]/95 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <div className="text-xs text-slate-400">
                  {user.role === 'admin' ? 'Admin Console' : hospital.name} /{' '}
                  {PROVIDER_NAV.find((i) => i.id === activeTab)?.label}
                </div>
                <div className="text-sm font-medium text-white truncate">
                  International Patient Desk & Case Pipeline
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('quotations')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#9B8CFF] px-3.5 py-2 text-xs font-semibold text-[#070B18] whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Build Quote</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
          {banner && (
            <div className="flex items-center justify-between rounded-xl border border-[#9B8CFF]/40 bg-[#141536] px-4 py-3 text-xs text-white">
              <span>{banner}</span>
              <button type="button" onClick={() => setBanner(null)} className="text-slate-300">
                Dismiss
              </button>
            </div>
          )}

          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-semibold text-white">
                  Provider Operations Overview
                </h1>
                <p className="text-sm text-slate-400">
                  Review consented patient enquiries, track quotation response times, and manage virtual consults.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-white/10 bg-[#0B1224] p-5">
                  <div className="text-xs text-slate-400">New Enquiries</div>
                  <div className="mt-2 font-mono-tabular text-2xl font-semibold text-white">
                    {data.cases.length}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0B1224] p-5">
                  <div className="text-xs text-slate-400">Consented Records</div>
                  <div className="mt-2 font-mono-tabular text-2xl font-semibold text-[#35D5F5]">
                    {data.documents.length}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0B1224] p-5">
                  <div className="text-xs text-slate-400">Quotations Issued</div>
                  <div className="mt-2 font-mono-tabular text-2xl font-semibold text-white">
                    {data.quotes.length}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0B1224] p-5">
                  <div className="text-xs text-slate-400">Upcoming Consults</div>
                  <div className="mt-2 font-mono-tabular text-2xl font-semibold text-white">
                    {data.appointments.length}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0B1224] p-5">
                  <div className="text-xs text-slate-400">Conversion Rate</div>
                  <div className="mt-2 font-mono-tabular text-2xl font-semibold text-emerald-400">
                    {data.analytics.bookingConversionPct}%
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0B1224] p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold text-white">
                    Recent Assigned Enquiries
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('inbox')}
                    className="text-xs text-[#9B8CFF] hover:underline"
                  >
                    Open Lead Inbox
                  </button>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400">
                        <th className="py-2.5 pr-4">Case</th>
                        <th className="py-2.5 pr-4">Patient Origin</th>
                        <th className="py-2.5 pr-4">Specialty</th>
                        <th className="py-2.5 pr-4">Budget Target</th>
                        <th className="py-2.5">Pipeline Stage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {data.cases.map((c) => (
                        <tr key={c.id}>
                          <td className="py-3 pr-4 font-medium text-white">{c.title}</td>
                          <td className="py-3 pr-4 text-slate-300">{c.patientCountry}</td>
                          <td className="py-3 pr-4 text-slate-300">{c.specialty}</td>
                          <td className="py-3 pr-4 font-mono-tabular text-white">
                            ${c.budgetUsd.toLocaleString()}
                          </td>
                          <td className="py-3 text-[#35D5F5]">{c.providerLeadStage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* LEAD INBOX (10-STAGE PIPELINE) */}
          {activeTab === 'inbox' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-semibold text-white">
                  10-Stage Provider Lead Inbox
                </h1>
                <p className="text-sm text-slate-400">
                  Progress enquiries cleanly from New → Qualified → Medical Review → Quote Sent → Consultation → Aftercare.
                </p>
              </div>

              <div className="space-y-4">
                {data.cases.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-white/10 bg-[#0B1224] p-6 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="font-mono-tabular text-xs text-[#9B8CFF]">
                          {c.caseReference || c.id.toUpperCase()} · {c.patientCountry} · {c.urgency}
                        </div>
                        <h3 className="mt-1 font-display text-lg font-semibold text-white">
                          {c.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-300">{c.aiAssistedSummary || c.summary}</p>
                      </div>
                      <div className="text-right space-y-2">
                        <div>
                          <div className="text-xs text-slate-400">Target Budget</div>
                          <div className="font-mono-tabular text-lg font-semibold text-white">
                            ${c.budgetUsd.toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => handleLeadStageChange(c.id, 'Qualified')}
                            className="rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-medium text-emerald-300"
                          >
                            Accept Lead
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLeadStageChange(c.id, 'Closed')}
                            className="rounded-md border border-rose-500/30 px-2.5 py-1 text-[11px] text-rose-300"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <div className="text-xs font-medium text-slate-400 mb-2">
                        Pipeline Stage:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {PROVIDER_LEAD_STAGES.map((st) => {
                          const active = c.providerLeadStage === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleLeadStageChange(c.id, st)}
                              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                active
                                  ? 'bg-[#9B8CFF] text-[#070B18]'
                                  : 'border border-white/10 bg-[#070B18] text-slate-300 hover:border-white/30'
                              }`}
                            >
                              {st}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PATIENT CASES & CONSENTED RECORDS */}
          {activeTab === 'cases' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-semibold text-white">
                  Authorized Patient Cases & Records
                </h1>
                <p className="text-sm text-slate-400">
                  Only documents explicitly consented by the patient for {hospital.name} appear below.
                </p>
              </div>

              {data.cases.map((c) => {
                const consentedDocs = data.documents.filter((d) => d.caseId === c.id);
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-white/10 bg-[#0B1224] p-6 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-display text-lg font-semibold text-white">{c.title}</h3>
                        <div className="text-xs text-slate-400">
                          Patient: {c.patientName} ({c.patientCountry}) · Language: {c.preferredLanguage}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setQtCaseId(c.id);
                          setActiveTab('quotations');
                        }}
                        className="rounded-lg bg-[#9B8CFF] px-3 py-1.5 text-xs font-semibold text-[#070B18]"
                      >
                        Prepare Quote
                      </button>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#070B18] p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-[#35D5F5]">
                        <Lock className="h-3.5 w-3.5" />
                        <span>Consented Medical Records ({consentedDocs.length})</span>
                      </div>
                      {consentedDocs.length === 0 ? (
                        <div className="text-xs text-slate-400">
                          Patient has not yet shared documents with your hospital for this case.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {consentedDocs.map((d) => (
                            <div
                              key={d.id}
                              className="flex items-center justify-between border-t border-white/10 pt-2 text-xs"
                            >
                              <div>
                                <div className="font-medium text-white">{d.fileName}</div>
                                <div className="text-slate-400">{d.aiExtractedNotes}</div>
                              </div>
                              <span className="font-mono-tabular text-slate-400">{d.sizeKb} KB</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* QUOTATION BUILDER & REVISION */}
          {activeTab === 'quotations' && (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <form
                  onSubmit={handleCreateOrUpdateQuote}
                  className="rounded-2xl border border-white/10 bg-[#0B1224] p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-semibold text-white">
                      {editingQuoteId
                        ? `Editing Quote ${editingQuoteId.toUpperCase()}`
                        : 'Itemized Quotation Builder'}
                    </h2>
                    {editingQuoteId && (
                      <button
                        type="button"
                        onClick={() => setEditingQuoteId(null)}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Target Medical Case</label>
                    <select
                      value={qtCaseId}
                      disabled={Boolean(editingQuoteId)}
                      onChange={(e) => setQtCaseId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white disabled:opacity-60"
                    >
                      {data.cases.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.caseReference || c.id.toUpperCase()} · {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Treatment Package Title</label>
                    <input
                      type="text"
                      required
                      value={qtTreatment}
                      onChange={(e) => setQtTreatment(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400">Package Price</label>
                      <input
                        type="number"
                        required
                        value={qtPrice}
                        onChange={(e) => setQtPrice(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400">Certainty</label>
                      <select
                        value={qtCostType}
                        onChange={(e) => setQtCostType(e.target.value as typeof qtCostType)}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                      >
                        <option value="Estimated">Estimated</option>
                        <option value="Confirmed">Confirmed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400">Currency</label>
                      <select
                        value={qtCurrency}
                        onChange={(e) => setQtCurrency(e.target.value as typeof qtCurrency)}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                      >
                        <option>USD</option>
                        <option>EUR</option>
                        <option>SGD</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400">Days</label>
                      <input
                        type="number"
                        value={qtDuration}
                        onChange={(e) => setQtDuration(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white font-mono-tabular"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Accommodation Details</label>
                    <input
                      type="text"
                      value={qtAccommodation}
                      onChange={(e) => setQtAccommodation(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">
                      Included Services (one per line)
                    </label>
                    <textarea
                      rows={3}
                      value={qtInclusions}
                      onChange={(e) => setQtInclusions(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">
                      Excluded Services (one per line)
                    </label>
                    <textarea
                      rows={2}
                      value={qtExclusions}
                      onChange={(e) => setQtExclusions(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs text-slate-400">Medications Included</label>
                      <input
                        type="text"
                        value={qtMedications}
                        onChange={(e) => setQtMedications(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400">Diagnostics &amp; Tests</label>
                      <input
                        type="text"
                        value={qtDiagnostics}
                        onChange={(e) => setQtDiagnostics(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Payment Conditions</label>
                    <input
                      type="text"
                      value={qtPayment}
                      onChange={(e) => setQtPayment(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Cancellation Terms</label>
                    <input
                      type="text"
                      value={qtCancellation}
                      onChange={(e) => setQtCancellation(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-lg bg-[#9272FF] px-4 py-2.5 text-xs font-semibold text-[#070B18]"
                  >
                    {busy
                      ? 'Saving...'
                      : editingQuoteId
                        ? 'Save Revised Quotation'
                        : 'Send Transparent Quote to Patient'}
                  </button>
                </form>
              </div>

              <div className="lg:col-span-6 space-y-4">
                <h2 className="font-display text-lg font-semibold text-white">
                  Issued Quotations ({data.quotes.length})
                </h2>
                {data.quotes.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-2xl border border-white/10 bg-[#0B1224] p-5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono-tabular text-xs text-[#9272FF]">
                          {q.id.toUpperCase()} · {q.caseId.toUpperCase()} · {q.costType || 'Estimated'}
                        </div>
                        <div className="font-display text-base font-semibold text-white">
                          {q.treatmentName}
                        </div>
                      </div>
                      <div className="font-mono-tabular text-lg font-semibold text-[#39DDF5]">
                        {q.currency} {q.estimatedPrice.toLocaleString()}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span>
                        Duration: {q.expectedDurationDays} days · Valid until {q.validUntil} ·{' '}
                        {q.shortlisted ? 'Shortlisted' : q.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEditQuote(q)}
                        className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1 text-xs text-slate-200 hover:border-[#9272FF]"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>Edit Quote</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* APPOINTMENTS */}
          {activeTab === 'appointments' && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-semibold text-white">
                Consultation Requests &amp; Schedule
              </h1>
              {data.appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0B1224] p-5"
                >
                  <div>
                    <div className="text-xs text-[#9272FF]">{apt.type}</div>
                    <div className="font-display text-base font-semibold text-white">
                      {apt.patientName} · {apt.doctorName}
                    </div>
                    <div className="font-mono-tabular text-xs text-slate-300">
                      {new Date(apt.scheduledAtIso).toLocaleString()} · {apt.timeZone}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">Status: {apt.status}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirmAppointment(apt.id, 'Confirmed')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-300"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Confirm Slot</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmAppointment(apt.id, 'Reschedule Requested')}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300"
                    >
                      Propose New Time
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmAppointment(apt.id, 'Cancelled')}
                      className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MESSAGES */}
          {activeTab === 'messages' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="font-display text-2xl font-semibold text-white">
                  Patient Messages
                </h1>
                <select
                  value={msgCaseId}
                  onChange={(e) => setMsgCaseId(e.target.value)}
                  className="rounded-lg border border-white/15 bg-[#0B1224] px-3 py-1.5 text-xs text-white"
                >
                  {data.cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id.toUpperCase()} · {c.patientName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0B1224] flex flex-col h-[460px]">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {data.messages
                    .filter((m) => m.caseId === msgCaseId)
                    .map((m) => (
                      <div
                        key={m.id}
                        className={`flex flex-col ${
                          m.senderRole === 'provider' ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div className="max-w-xl rounded-2xl border border-white/10 bg-[#070B18] p-4 text-sm text-slate-200">
                          <div className="mb-1 text-[11px] text-[#9B8CFF]">
                            {m.senderName} · {new Date(m.timestamp).toLocaleString()}
                          </div>
                          <p>{m.body}</p>
                        </div>
                      </div>
                    ))}
                </div>
                <form
                  onSubmit={handleSendMessage}
                  className="border-t border-white/10 p-4 flex gap-3"
                >
                  <input
                    type="text"
                    value={msgBody}
                    onChange={(e) => setMsgBody(e.target.value)}
                    placeholder="Reply to patient enquiry..."
                    className="flex-1 rounded-lg border border-white/15 bg-[#070B18] px-4 py-2 text-sm text-white"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#9B8CFF] px-4 py-2 text-xs font-semibold text-[#070B18]"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* EDITABLE ORGANIZATION PROFILE */}
          {activeTab === 'profile' && (
            <form
              onSubmit={handleSaveHospitalListing}
              className="max-w-3xl rounded-2xl border border-white/10 bg-[#0B1224] p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-[#39DDF5]">
                    {hospital.city}, {hospital.country} · {hospital.credentialNote}
                  </div>
                  <h1 className="mt-1 font-display text-2xl font-semibold text-white">
                    {hospital.name}
                  </h1>
                </div>
                <span className="text-xs text-amber-300">
                  {hospital.credentialStatus === 'verified' ? 'Verified Format' : 'Sample Listing'}
                </span>
              </div>

              <div>
                <label className="block text-xs text-slate-400">Organization Summary</label>
                <textarea
                  rows={3}
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3 text-xs">
                <div>
                  <label className="block text-slate-400">Languages (comma separated)</label>
                  <input
                    type="text"
                    value={orgLanguages}
                    onChange={(e) => setOrgLanguages(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400">Indicative Price Range</label>
                  <input
                    type="text"
                    value={orgPriceRange}
                    onChange={(e) => setOrgPriceRange(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 font-mono-tabular text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400">Next Consult Wait (Days)</label>
                  <input
                    type="number"
                    min={1}
                    value={orgWaitDays}
                    onChange={(e) => setOrgWaitDays(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 font-mono-tabular text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end border-t border-white/10 pt-4">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#9272FF] px-5 py-2 text-xs font-semibold text-[#070B18]"
                >
                  {busy ? 'Saving...' : 'Save Organization Profile'}
                </button>
              </div>
            </form>
          )}

          {/* SERVICES & FACILITIES MANAGEMENT */}
          {activeTab === 'services' && (
            <form
              onSubmit={handleSaveHospitalListing}
              className="max-w-3xl rounded-2xl border border-white/10 bg-[#0B1224] p-6 space-y-4"
            >
              <div>
                <h1 className="font-display text-2xl font-semibold text-white">
                  Treatment Programs &amp; International Services
                </h1>
                <p className="text-xs text-slate-400">
                  Manage treatments, patient desk services, and clinical facilities shown to international patients.
                </p>
              </div>

              <div>
                <label className="block text-xs text-slate-400">
                  Published Treatment Programs (one per line)
                </label>
                <textarea
                  rows={4}
                  value={orgTreatments}
                  onChange={(e) => setOrgTreatments(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400">
                    International Patient Services (one per line)
                  </label>
                  <textarea
                    rows={4}
                    value={orgServices}
                    onChange={(e) => setOrgServices(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400">
                    Clinical Facilities (one per line)
                  </label>
                  <textarea
                    rows={4}
                    value={orgFacilities}
                    onChange={(e) => setOrgFacilities(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end border-t border-white/10 pt-4">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#9272FF] px-5 py-2 text-xs font-semibold text-[#070B18]"
                >
                  {busy ? 'Saving...' : 'Save Services & Facilities'}
                </button>
              </div>
            </form>
          )}

          {/* ANALYTICS & ADMIN METRICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-semibold text-white">
                  Marketplace & Provider Analytics
                </h1>
                <p className="text-sm text-slate-400">
                  Cross-border enquiry volume, quotation velocity, booking conversion, and patient satisfaction.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Total Platform Users', val: data.analytics.totalUsers.toLocaleString() },
                  { label: 'Patient Enquiries', val: data.analytics.patientEnquiries.toLocaleString() },
                  { label: 'Registered Providers', val: String(data.analytics.registeredProviders) },
                  { label: 'Active Medical Cases', val: String(data.analytics.activeMedicalCases) },
                  { label: 'Quotes Sent', val: String(data.analytics.quotesSent) },
                  { label: 'Booking Conversion', val: `${data.analytics.bookingConversionPct}%` },
                  { label: 'Avg Provider Response', val: `${data.analytics.avgProviderResponseHours} hrs` },
                  { label: 'Patient Satisfaction', val: `${data.analytics.patientSatisfactionScore} / 5.0` },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-xl border border-white/10 bg-[#0B1224] p-5"
                  >
                    <div className="text-xs text-slate-400">{kpi.label}</div>
                    <div className="mt-2 font-mono-tabular text-2xl font-semibold text-white">
                      {kpi.val}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                {/* Monthly Enquiries / Quotes / Consults Chart */}
                <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#0B1224] p-6">
                  <h2 className="font-display text-base font-semibold text-white">
                    Monthly Marketplace Funnel (Sample Analytics)
                  </h2>
                  <div className="mt-6 grid grid-cols-6 gap-4 items-end h-52">
                    {data.analytics.monthlyEnquiries.map((m) => (
                      <div key={m.month} className="flex flex-col items-center gap-2 h-full justify-end">
                        <div className="flex w-full items-end justify-center gap-1 h-40">
                          <div
                            title={`Enquiries: ${m.enquiries}`}
                            style={{ height: `${Math.round((m.enquiries / maxEnquiry) * 100)}%` }}
                            className="w-3 rounded-t bg-[#35D5F5]"
                          />
                          <div
                            title={`Quotes: ${m.quotes}`}
                            style={{ height: `${Math.round((m.quotes / maxEnquiry) * 100)}%` }}
                            className="w-3 rounded-t bg-[#9B8CFF]"
                          />
                          <div
                            title={`Consults: ${m.consults}`}
                            style={{ height: `${Math.round((m.consults / maxEnquiry) * 100)}%` }}
                            className="w-3 rounded-t bg-emerald-400"
                          />
                        </div>
                        <div className="font-mono-tabular text-xs text-slate-400">{m.month}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-5 text-xs text-slate-400 border-t border-white/10 pt-3">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#35D5F5]" /> Enquiries
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#9B8CFF]" /> Quotes Sent
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Virtual Consults
                    </span>
                  </div>
                </div>

                {/* Specialty Share */}
                <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#0B1224] p-6 space-y-4">
                  <h2 className="font-display text-base font-semibold text-white">
                    Enquiries by Specialty
                  </h2>
                  <div className="space-y-3">
                    {data.analytics.specialtyDistribution.map((s) => (
                      <div key={s.specialty}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-300">{s.specialty}</span>
                          <span className="font-mono-tabular text-white">{s.sharePct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            style={{ width: `${s.sharePct}%` }}
                            className="h-full rounded-full bg-[#35D5F5]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EDITABLE PROVIDER SETTINGS */}
          {activeTab === 'settings' && (
            <form
              onSubmit={handleSaveProviderSettings}
              className="max-w-2xl rounded-2xl border border-white/10 bg-[#0B1224] p-6 space-y-4 text-xs"
            >
              <h1 className="font-display text-xl font-semibold text-white">Provider Desk Settings</h1>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-slate-400">Coordinator Name</label>
                  <input
                    type="text"
                    required
                    value={setFullName}
                    onChange={(e) => setSetFullName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400">Organization Name</label>
                  <input
                    type="text"
                    required
                    value={setOrgName}
                    onChange={(e) => setSetOrgName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-slate-400">Primary Language</label>
                  <select
                    value={setLanguage}
                    onChange={(e) => setSetLanguage(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
                  >
                    <option>English</option>
                    <option>Arabic</option>
                    <option>German</option>
                    <option>Mandarin</option>
                    <option>Hindi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400">Account Role</label>
                  <div className="mt-2 font-mono-tabular uppercase text-[#9272FF] font-semibold">
                    {user.role}
                  </div>
                </div>
              </div>
              <div className="flex justify-end border-t border-white/10 pt-4">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#9272FF] px-5 py-2 text-xs font-semibold text-[#070B18]"
                >
                  {busy ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
