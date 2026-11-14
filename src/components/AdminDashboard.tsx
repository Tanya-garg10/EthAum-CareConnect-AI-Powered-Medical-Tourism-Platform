import { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  CheckCircle2,
  DollarSign,
  Download,
  Eye,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  HospitalProfile,
  MedicalCase,
  PlatformBootstrapData,
  User,
  UserRole,
} from '../types';

type AdminTab =
  | 'overview'
  | 'patients'
  | 'providers'
  | 'cases'
  | 'inquiries'
  | 'referrals'
  | 'analytics'
  | 'audit';

interface AdminDashboardProps {
  user: User;
  token: string;
  data: PlatformBootstrapData;
  onRefresh: () => Promise<void>;
  onSignOut: () => void;
  onBackToLanding: () => void;
}

const ADMIN_NAV: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Platform Overview', icon: LayoutDashboard },
  { id: 'patients', label: 'Registered Users', icon: Users },
  { id: 'providers', label: 'Provider Verification', icon: Building2 },
  { id: 'cases', label: 'Cases & Enquiries', icon: Activity },
  { id: 'inquiries', label: 'Contact Inquiries', icon: Mail },
  { id: 'referrals', label: '5% Referral Ledger', icon: DollarSign },
  { id: 'analytics', label: 'Marketplace Analytics', icon: BarChart3 },
  { id: 'audit', label: 'Security & Audit Log', icon: ShieldCheck },
];

type SummaryUser = NonNullable<PlatformBootstrapData['usersSummary']>[number];

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsvFile(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const csvContent = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AdminDashboard({
  user,
  token,
  data,
  onRefresh,
  onSignOut,
  onBackToLanding,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Filters & Search states
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'All' | UserRole>('All');

  const [providerSearch, setProviderSearch] = useState('');
  const [providerStatusFilter, setProviderStatusFilter] = useState<'All' | 'verified' | 'sample'>('All');

  const [caseSearch, setCaseSearch] = useState('');
  const [caseStageFilter, setCaseStageFilter] = useState('All');

  const [inquirySearch, setInquirySearch] = useState('');
  const [inquiryRoleFilter, setInquiryRoleFilter] = useState('All');

  const [auditSearch, setAuditSearch] = useState('');
  const [auditRoleFilter, setAuditRoleFilter] = useState<'All' | UserRole>('All');

  // Detail modal state
  const [inspectedUser, setInspectedUser] = useState<SummaryUser | null>(null);
  const [inspectedHospital, setInspectedHospital] = useState<HospitalProfile | null>(null);
  const [inspectedCase, setInspectedCase] = useState<MedicalCase | null>(null);

  const handleToggleVerify = async (hospitalId: string, current: 'verified' | 'sample') => {
    const nextStatus = current === 'verified' ? 'sample' : 'verified';
    setVerifyingId(hospitalId);
    try {
      const res = await fetch(`/api/admin/providers/${hospitalId}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setBanner(`Updated provider verification status to "${nextStatus}".`);
        await onRefresh();
        if (inspectedHospital?.id === hospitalId) {
          setInspectedHospital((prev) => (prev ? { ...prev, credentialStatus: nextStatus } : null));
        }
      }
    } finally {
      setVerifyingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return (data.usersSummary || []).filter((u) => {
      if (userRoleFilter !== 'All' && u.role !== userRoleFilter) return false;
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.country.toLowerCase().includes(q)
      );
    });
  }, [data.usersSummary, userSearch, userRoleFilter]);

  const filteredProviders = useMemo(() => {
    const q = providerSearch.trim().toLowerCase();
    return data.hospitals.filter((h) => {
      if (providerStatusFilter !== 'All' && h.credentialStatus !== providerStatusFilter) return false;
      if (!q) return true;
      return (
        h.name.toLowerCase().includes(q) ||
        h.country.toLowerCase().includes(q) ||
        h.city.toLowerCase().includes(q) ||
        h.specialties.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [data.hospitals, providerSearch, providerStatusFilter]);

  const filteredCases = useMemo(() => {
    const q = caseSearch.trim().toLowerCase();
    return data.cases.filter((c) => {
      if (caseStageFilter !== 'All' && c.providerLeadStage !== caseStageFilter) return false;
      if (!q) return true;
      return (
        c.caseReference.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.patientName.toLowerCase().includes(q) ||
        c.specialty.toLowerCase().includes(q) ||
        c.patientCountry.toLowerCase().includes(q)
      );
    });
  }, [data.cases, caseSearch, caseStageFilter]);

  const filteredInquiries = useMemo(() => {
    const q = inquirySearch.trim().toLowerCase();
    return (data.contactInquiries || []).filter((inq) => {
      if (inquiryRoleFilter !== 'All' && inq.role !== inquiryRoleFilter) return false;
      if (!q) return true;
      return (
        inq.name.toLowerCase().includes(q) ||
        inq.email.toLowerCase().includes(q) ||
        inq.country.toLowerCase().includes(q) ||
        inq.message.toLowerCase().includes(q)
      );
    });
  }, [data.contactInquiries, inquirySearch, inquiryRoleFilter]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return data.auditLogs.filter((log) => {
      if (auditRoleFilter !== 'All' && log.actorRole !== auditRoleFilter) return false;
      if (!q) return true;
      return (
        log.actorEmail.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.resource.toLowerCase().includes(q)
      );
    });
  }, [data.auditLogs, auditSearch, auditRoleFilter]);

  const handleExportReferralsCsv = () => {
    downloadCsvFile(
      'careconnect-referral-ledger.csv',
      ['Case Reference', 'Hospital', 'Referral Partner', 'Eligible Billed (USD)', 'Rate (%)', 'Commission (USD)', 'Status', 'Terms Note'],
      data.referrals.map((r) => [
        r.caseReference,
        r.hospitalName,
        r.partnerName,
        r.eligibleBilledUsd,
        r.commissionRatePct,
        r.commissionAmountUsd,
        r.status,
        r.termsNote,
      ]),
    );
    setBanner('Downloaded 5% Referral Ledger CSV report.');
  };

  const handleExportAnalyticsCsv = () => {
    downloadCsvFile(
      'careconnect-marketplace-analytics.csv',
      ['Month', 'Enquiries', 'Quotes Sent', 'Consultations Booked'],
      data.analytics.monthlyEnquiries.map((m) => [m.month, m.enquiries, m.quotes, m.consults]),
    );
    setBanner('Downloaded Marketplace Analytics CSV report.');
  };

  const maxEnquiry = Math.max(...data.analytics.monthlyEnquiries.map((m) => m.enquiries), 1);
  const contactCount = data.contactInquiries?.length ?? 0;

  return (
    <div className="min-h-screen bg-[#070B18] text-[#F5F8FF] flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-white/10 bg-[#0B1224] p-4">
        <div>
          <button
            type="button"
            onClick={onBackToLanding}
            className="px-3 py-2 text-left font-display text-lg font-semibold tracking-tight text-white hover:text-[#39DDF5]"
          >
            EthAum CareConnect
          </button>
          <div className="px-3 text-xs text-[#39DDF5]">Platform Operations Console</div>

          <nav className="mt-6 space-y-1">
            {ADMIN_NAV.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#39DDF5]/15 text-[#39DDF5]'
                      : 'text-[#9BAAC2] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.id === 'inquiries' && contactCount > 0 && (
                    <span className="tabular-nums text-[11px] font-mono text-[#39DDF5]">
                      {contactCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/10 pt-4">
          <div className="px-3">
            <div className="text-sm font-medium text-white truncate">{user.fullName}</div>
            <div className="text-xs text-[#9BAAC2] truncate">Admin Governance</div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#9BAAC2] hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-72 bg-[#0B1224] border-r border-white/10 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between px-2 py-2">
                <span className="font-display text-lg font-semibold text-white">Admin Console</span>
                <button type="button" onClick={() => setMobileOpen(false)}>
                  <X className="h-5 w-5 text-slate-300" />
                </button>
              </div>
              <nav className="mt-4 space-y-1">
                {ADMIN_NAV.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                        activeTab === item.id ? 'bg-[#39DDF5]/15 text-[#39DDF5]' : 'text-[#9BAAC2]'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </span>
                      {item.id === 'inquiries' && contactCount > 0 && (
                        <span className="tabular-nums text-xs text-[#39DDF5]">{contactCount}</span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
            <button type="button" onClick={onSignOut} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300">
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070B18]/95 backdrop-blur-md px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div>
                <div className="text-xs text-[#9BAAC2]">
                  Admin Console / {ADMIN_NAV.find((n) => n.id === activeTab)?.label}
                </div>
                <div className="text-sm font-medium text-white">
                  EthAum CareConnect Governance & Commercial Operations
                </div>
              </div>
            </div>
            <div className="text-xs font-mono text-[#39DDF5]">Governance Mode · Live Demo Store</div>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
          {banner && (
            <div className="flex items-center justify-between rounded-xl border border-[#39DDF5]/40 bg-[#101A30] px-4 py-3 text-xs text-white">
              <span>{banner}</span>
              <button type="button" onClick={() => setBanner(null)} className="text-[#9BAAC2] hover:text-white">
                Dismiss
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-white">
                    Platform Operations Overview
                  </h1>
                  <p className="text-sm text-[#9BAAC2]">
                    Monitor registered users, provider verification status, patient cases, public inquiries, and 5% referral commissions.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('providers')}
                    className="rounded-lg border border-white/10 bg-[#101A30] px-3.5 py-2 text-xs font-medium text-white hover:border-[#39DDF5]/50"
                  >
                    Review Verification Queue
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('inquiries')}
                    className="rounded-lg bg-[#39DDF5] px-3.5 py-2 text-xs font-semibold text-[#070B18] hover:bg-[#6ee7f8]"
                  >
                    View Inquiries ({contactCount})
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Total Users (Sample)', val: data.analytics.totalUsers.toLocaleString() },
                  { label: 'Active Medical Cases', val: String(data.analytics.activeMedicalCases) },
                  { label: 'Registered Providers', val: String(data.analytics.registeredProviders) },
                  { label: 'Contact Inquiries', val: String(contactCount) },
                  { label: 'Booking Conversion', val: `${data.analytics.bookingConversionPct}%` },
                  { label: 'Quote Conversion', val: `${data.analytics.quoteConversionPct}%` },
                  { label: 'Avg Provider Response', val: `${data.analytics.avgProviderResponseHours} hrs` },
                  { label: 'Patient Satisfaction', val: `${data.analytics.patientSatisfactionScore} / 5.0` },
                ].map((k) => (
                  <div key={k.label} className="rounded-xl border border-white/10 bg-[#101A30] p-5">
                    <div className="text-xs text-[#9BAAC2]">{k.label}</div>
                    <div className="mt-2 tabular-nums text-2xl font-semibold text-white">
                      {k.val}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-[#101A30] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-semibold text-white">Recent Audit Activity</h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('audit')}
                      className="text-xs text-[#39DDF5] hover:underline"
                    >
                      View Full Log
                    </button>
                  </div>
                  <div className="divide-y divide-white/10">
                    {data.auditLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate">{log.action}</div>
                          <div className="text-[#9BAAC2] truncate">
                            {log.actorEmail} · {log.resource}
                          </div>
                        </div>
                        <div className="tabular-nums text-[11px] text-[#9BAAC2] shrink-0">
                          {new Date(log.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#101A30] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-semibold text-white">Provider Credential Status</h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('providers')}
                      className="text-xs text-[#39DDF5] hover:underline"
                    >
                      Manage Providers
                    </button>
                  </div>
                  <div className="divide-y divide-white/10">
                    {data.hospitals.slice(0, 5).map((h) => (
                      <div key={h.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate">{h.name}</div>
                          <div className="text-[#9BAAC2]">
                            {h.city}, {h.country}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 font-mono text-[11px] ${
                            h.credentialStatus === 'verified' ? 'text-emerald-300' : 'text-amber-300'
                          }`}
                        >
                          {h.credentialStatus === 'verified' ? 'Verified' : 'Sample Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'patients' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-white">Registered Users</h1>
                  <p className="text-sm text-[#9BAAC2]">
                    Inspect patient, provider, and governance accounts across the workspace.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-[#9BAAC2] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search name, email, country..."
                      className="rounded-lg border border-white/10 bg-[#101A30] pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#39DDF5] focus:outline-none"
                    />
                  </div>
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value as 'All' | UserRole)}
                    className="rounded-lg border border-white/10 bg-[#101A30] px-3 py-2 text-xs text-white focus:border-[#39DDF5] focus:outline-none"
                  >
                    <option value="All">All Roles</option>
                    <option value="patient">Patients</option>
                    <option value="provider">Providers</option>
                    <option value="admin">Admins</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#101A30]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-[#0B1224] text-[#9BAAC2]">
                      <th className="p-4">Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Country</th>
                      <th className="p-4">Created</th>
                      <th className="p-4 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.02]">
                        <td className="p-4 font-medium text-white">{u.fullName}</td>
                        <td className="p-4 tabular-nums font-mono text-slate-300">{u.email}</td>
                        <td className="p-4 uppercase text-[#39DDF5] font-mono">{u.role}</td>
                        <td className="p-4 text-slate-300">{u.country}</td>
                        <td className="p-4 tabular-nums text-[#9BAAC2]">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() => setInspectedUser(u)}
                            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#14213B] px-2.5 py-1 text-[11px] text-white hover:border-[#39DDF5]/50"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-[#9BAAC2]">
                          No users match the selected search criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'providers' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-white">
                    Provider Verification Queue
                  </h1>
                  <p className="text-sm text-[#9BAAC2]">
                    Manage credential verification flags for partner hospitals across all destination hubs.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-[#9BAAC2] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={providerSearch}
                      onChange={(e) => setProviderSearch(e.target.value)}
                      placeholder="Filter hospital, country, specialty..."
                      className="rounded-lg border border-white/10 bg-[#101A30] pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#39DDF5] focus:outline-none"
                    />
                  </div>
                  <select
                    value={providerStatusFilter}
                    onChange={(e) => setProviderStatusFilter(e.target.value as 'All' | 'verified' | 'sample')}
                    className="rounded-lg border border-white/10 bg-[#101A30] px-3 py-2 text-xs text-white focus:border-[#39DDF5] focus:outline-none"
                  >
                    <option value="All">All Statuses</option>
                    <option value="verified">Verified Format</option>
                    <option value="sample">Sample Pending</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {filteredProviders.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-[#101A30] p-5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs text-[#9BAAC2]">
                        {h.city}, {h.country} · {h.bedCapacity} beds
                      </div>
                      <div className="mt-1 font-display text-base font-semibold text-white">
                        {h.name}
                      </div>
                      <div className="mt-1 text-xs text-[#9BAAC2]">{h.credentialNote}</div>
                      <button
                        type="button"
                        onClick={() => setInspectedHospital(h)}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#39DDF5] hover:underline"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect Facility Profile</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={verifyingId === h.id}
                      onClick={() => handleToggleVerify(h.id, h.credentialStatus)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium shrink-0 transition-colors ${
                        h.credentialStatus === 'verified'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                          : 'border-amber-400/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>
                        {verifyingId === h.id
                          ? 'Updating...'
                          : h.credentialStatus === 'verified'
                            ? 'Verified Format'
                            : 'Sample Pending'}
                      </span>
                    </button>
                  </div>
                ))}
                {filteredProviders.length === 0 && (
                  <div className="md:col-span-2 rounded-2xl border border-white/10 bg-[#101A30] p-6 text-center text-xs text-[#9BAAC2]">
                    No partner hospitals match your filter.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'cases' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-white">
                    Platform Medical Cases & Enquiries
                  </h1>
                  <p className="text-sm text-[#9BAAC2]">
                    Cross-border patient journeys currently active in CareConnect.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-[#9BAAC2] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={caseSearch}
                      onChange={(e) => setCaseSearch(e.target.value)}
                      placeholder="Search case ref, patient, specialty..."
                      className="rounded-lg border border-white/10 bg-[#101A30] pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#39DDF5] focus:outline-none"
                    />
                  </div>
                  <select
                    value={caseStageFilter}
                    onChange={(e) => setCaseStageFilter(e.target.value)}
                    className="rounded-lg border border-white/10 bg-[#101A30] px-3 py-2 text-xs text-white focus:border-[#39DDF5] focus:outline-none"
                  >
                    <option value="All">All Pipeline Stages</option>
                    <option value="New">New</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Medical Review">Medical Review</option>
                    <option value="Quote Requested">Quote Requested</option>
                    <option value="Quote Sent">Quote Sent</option>
                    <option value="Consultation">Consultation</option>
                    <option value="Booked">Booked</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {filteredCases.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#101A30] p-5"
                  >
                    <div className="min-w-0">
                      <div className="tabular-nums font-mono text-xs text-[#39DDF5]">
                        {c.caseReference} · {c.specialty}
                      </div>
                      <div className="mt-1 font-display text-base font-semibold text-white">
                        {c.title}
                      </div>
                      <div className="text-xs text-[#9BAAC2]">
                        Patient: {c.patientName} ({c.patientCountry}) · Stage {c.currentJourneyStage}/14
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="tabular-nums text-sm font-semibold text-white">
                          ${c.budgetUsd.toLocaleString()}
                        </div>
                        <div className="text-xs text-[#9272FF]">{c.providerLeadStage}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInspectedCase(c)}
                        className="rounded-lg border border-white/10 bg-[#14213B] px-3 py-1.5 text-xs text-white hover:border-[#39DDF5]/50"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                ))}
                {filteredCases.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-[#101A30] p-6 text-center text-xs text-[#9BAAC2]">
                    No medical cases match your search criteria.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'inquiries' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-white">
                    Public Contact & Partnership Inquiries
                  </h1>
                  <p className="text-sm text-[#9BAAC2]">
                    Inbound messages submitted through the public About & Contact page.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-[#9BAAC2] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={inquirySearch}
                      onChange={(e) => setInquirySearch(e.target.value)}
                      placeholder="Search sender, email, country..."
                      className="rounded-lg border border-white/10 bg-[#101A30] pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#39DDF5] focus:outline-none"
                    />
                  </div>
                  <select
                    value={inquiryRoleFilter}
                    onChange={(e) => setInquiryRoleFilter(e.target.value)}
                    className="rounded-lg border border-white/10 bg-[#101A30] px-3 py-2 text-xs text-white focus:border-[#39DDF5] focus:outline-none"
                  >
                    <option value="All">All Sender Types</option>
                    <option value="Patient">Patient</option>
                    <option value="Hospital / Provider">Hospital / Provider</option>
                    <option value="Partner / Investor">Partner / Investor</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {filteredInquiries.map((inq) => (
                  <div
                    key={inq.id}
                    className="rounded-2xl border border-white/10 bg-[#101A30] p-5 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-display text-base font-semibold text-white">
                          {inq.name}{' '}
                          <span className="text-xs font-normal text-[#39DDF5]">· {inq.role}</span>
                        </div>
                        <div className="text-xs text-[#9BAAC2]">
                          {inq.email} · {inq.country}
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-emerald-300 font-mono">{inq.status}</div>
                        <div className="tabular-nums text-[#9BAAC2]">
                          {new Date(inq.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed border-t border-white/10 pt-2">
                      {inq.message}
                    </p>
                  </div>
                ))}
                {filteredInquiries.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-[#101A30] p-8 text-center text-xs text-[#9BAAC2]">
                    No contact inquiries recorded yet. Submissions from the public Contact form appear here immediately.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'referrals' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-white">
                    5% Referral Commission Tracking (Integration-Ready)
                  </h1>
                  <p className="text-sm text-[#9BAAC2]">
                    Tracks eligible billed amounts and 5% referral partner commissions after verified booking and payment, subject to platform terms.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportReferralsCsv}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#101A30] px-4 py-2 text-xs font-medium text-white hover:border-[#39DDF5]/50"
                >
                  <Download className="h-3.5 w-3.5 text-[#39DDF5]" />
                  <span>Export CSV Report</span>
                </button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#101A30]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-[#0B1224] text-[#9BAAC2]">
                      <th className="p-4">Case Ref</th>
                      <th className="p-4">Hospital</th>
                      <th className="p-4">Referral Partner</th>
                      <th className="p-4">Eligible Billed</th>
                      <th className="p-4">Rate</th>
                      <th className="p-4">Commission</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {data.referrals.map((r) => (
                      <tr key={r.id} className="hover:bg-white/[0.02]">
                        <td className="p-4 tabular-nums font-mono text-[#39DDF5]">{r.caseReference}</td>
                        <td className="p-4 text-white">{r.hospitalName}</td>
                        <td className="p-4 text-slate-300">{r.partnerName}</td>
                        <td className="p-4 tabular-nums text-white">
                          ${r.eligibleBilledUsd.toLocaleString()}
                        </td>
                        <td className="p-4 tabular-nums text-slate-300">{r.commissionRatePct}%</td>
                        <td className="p-4 tabular-nums font-semibold text-emerald-400">
                          ${r.commissionAmountUsd.toLocaleString()}
                        </td>
                        <td className="p-4 text-amber-300">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-white">
                    Marketplace Funnel & Specialty Analytics
                  </h1>
                  <p className="text-sm text-[#9BAAC2]">
                    Monthly enquiries, quotations, consultations, specialty demand, and acquisition channels.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportAnalyticsCsv}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#101A30] px-4 py-2 text-xs font-medium text-white hover:border-[#39DDF5]/50"
                >
                  <Download className="h-3.5 w-3.5 text-[#39DDF5]" />
                  <span>Export CSV Report</span>
                </button>
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#101A30] p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-semibold text-white">
                      Monthly Funnel Volume (Sample Analytics)
                    </h2>
                    <div className="flex items-center gap-3 text-[11px] text-[#9BAAC2]">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm bg-[#39DDF5]" /> Enquiries
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm bg-[#9272FF]" /> Quotes
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm bg-emerald-400" /> Consults
                      </span>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-6 gap-4 items-end h-52">
                    {data.analytics.monthlyEnquiries.map((m) => (
                      <div key={m.month} className="flex flex-col items-center gap-2 h-full justify-end">
                        <div className="flex w-full items-end justify-center gap-1 h-40">
                          <div
                            title={`Enquiries: ${m.enquiries}`}
                            style={{ height: `${Math.round((m.enquiries / maxEnquiry) * 100)}%` }}
                            className="w-3 rounded-t bg-[#39DDF5]"
                          />
                          <div
                            title={`Quotes: ${m.quotes}`}
                            style={{ height: `${Math.round((m.quotes / maxEnquiry) * 100)}%` }}
                            className="w-3 rounded-t bg-[#9272FF]"
                          />
                          <div
                            title={`Consults: ${m.consults}`}
                            style={{ height: `${Math.round((m.consults / maxEnquiry) * 100)}%` }}
                            className="w-3 rounded-t bg-emerald-400"
                          />
                        </div>
                        <div className="tabular-nums text-xs text-[#9BAAC2]">{m.month}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#101A30] p-6 space-y-6">
                  <div>
                    <h2 className="font-display text-base font-semibold text-white">Lead Sources</h2>
                    <div className="mt-3 space-y-2.5">
                      {data.analytics.leadSources.map((src) => (
                        <div key={src.source}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-300">{src.source}</span>
                            <span className="tabular-nums text-white">{src.sharePct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div style={{ width: `${src.sharePct}%` }} className="h-full rounded-full bg-[#9272FF]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h2 className="font-display text-base font-semibold text-white">Specialty Demand</h2>
                    <div className="mt-3 space-y-2.5">
                      {data.analytics.specialtyDistribution.map((sp) => (
                        <div key={sp.specialty}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-300">{sp.specialty}</span>
                            <span className="tabular-nums text-white">{sp.sharePct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div style={{ width: `${sp.sharePct}%` }} className="h-full rounded-full bg-[#39DDF5]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-white">
                    Security & Consent Audit Log
                  </h1>
                  <p className="text-sm text-[#9BAAC2]">
                    Immutable audit trail of logins, consent grants, document sharing, quotes, and governance changes.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-[#9BAAC2] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      placeholder="Filter actor, action, resource..."
                      className="rounded-lg border border-white/10 bg-[#101A30] pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#39DDF5] focus:outline-none"
                    />
                  </div>
                  <select
                    value={auditRoleFilter}
                    onChange={(e) => setAuditRoleFilter(e.target.value as 'All' | UserRole)}
                    className="rounded-lg border border-white/10 bg-[#101A30] px-3 py-2 text-xs text-white focus:border-[#39DDF5] focus:outline-none"
                  >
                    <option value="All">All Roles</option>
                    <option value="patient">Patient</option>
                    <option value="provider">Provider</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#101A30]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-[#0B1224] text-[#9BAAC2]">
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Actor</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Action</th>
                      <th className="p-4">Resource</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.02]">
                        <td className="p-4 tabular-nums text-[#9BAAC2]">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-4 text-white">{log.actorEmail}</td>
                        <td className="p-4 uppercase font-mono text-[#39DDF5]">{log.actorRole}</td>
                        <td className="p-4 font-mono text-slate-200">{log.action}</td>
                        <td className="p-4 text-slate-300">{log.resource}</td>
                      </tr>
                    ))}
                    {filteredAuditLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-[#9BAAC2]">
                          No audit log entries match your filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Inspect User Modal */}
      {inspectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#101A30] p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-mono uppercase text-[#39DDF5]">{inspectedUser.role} Account</div>
                <h3 className="mt-1 font-display text-xl font-semibold text-white">
                  {inspectedUser.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedUser(null)}
                className="rounded-lg border border-white/10 p-1.5 text-[#9BAAC2] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs border-y border-white/10 py-4">
              <div>
                <div className="text-[#9BAAC2]">Email</div>
                <div className="mt-0.5 font-mono text-white break-all">{inspectedUser.email}</div>
              </div>
              <div>
                <div className="text-[#9BAAC2]">Country</div>
                <div className="mt-0.5 text-white">{inspectedUser.country}</div>
              </div>
              <div>
                <div className="text-[#9BAAC2]">Account ID</div>
                <div className="mt-0.5 font-mono text-slate-300">{inspectedUser.id}</div>
              </div>
              <div>
                <div className="text-[#9BAAC2]">Registered</div>
                <div className="mt-0.5 tabular-nums text-white">
                  {new Date(inspectedUser.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="text-xs text-[#9BAAC2]">
              Active cases associated with this account:{' '}
              <span className="tabular-nums font-semibold text-white">
                {data.cases.filter((c) => c.patientId === inspectedUser.id).length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Hospital Modal */}
      {inspectedHospital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#101A30] p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-mono text-[#39DDF5]">
                  {inspectedHospital.city}, {inspectedHospital.country}
                </div>
                <h3 className="mt-1 font-display text-xl font-semibold text-white">
                  {inspectedHospital.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedHospital(null)}
                className="rounded-lg border border-white/10 p-1.5 text-[#9BAAC2] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{inspectedHospital.description}</p>
            <div className="grid grid-cols-2 gap-3 text-xs border-y border-white/10 py-4">
              <div>
                <div className="text-[#9BAAC2]">Specialties</div>
                <div className="mt-0.5 text-white">{inspectedHospital.specialties.join(', ')}</div>
              </div>
              <div>
                <div className="text-[#9BAAC2]">Accreditations</div>
                <div className="mt-0.5 text-white">{inspectedHospital.accreditations.join(', ')}</div>
              </div>
              <div>
                <div className="text-[#9BAAC2]">Indicative Package Range</div>
                <div className="mt-0.5 tabular-nums text-white">{inspectedHospital.indicativeRangeLabel}</div>
              </div>
              <div>
                <div className="text-[#9BAAC2]">Bed Capacity & Desk</div>
                <div className="mt-0.5 tabular-nums text-white">
                  {inspectedHospital.bedCapacity} beds · {inspectedHospital.internationalDesk ? 'International Desk' : 'Standard'}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-[#9BAAC2]">{inspectedHospital.credentialNote}</span>
              <button
                type="button"
                onClick={() => handleToggleVerify(inspectedHospital.id, inspectedHospital.credentialStatus)}
                className="rounded-lg bg-[#39DDF5] px-4 py-2 text-xs font-semibold text-[#070B18] shrink-0"
              >
                Toggle to {inspectedHospital.credentialStatus === 'verified' ? 'Sample Pending' : 'Verified Format'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Case Modal */}
      {inspectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#101A30] p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-mono text-[#39DDF5]">
                  {inspectedCase.caseReference} · {inspectedCase.specialty}
                </div>
                <h3 className="mt-1 font-display text-xl font-semibold text-white">
                  {inspectedCase.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedCase(null)}
                className="rounded-lg border border-white/10 p-1.5 text-[#9BAAC2] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{inspectedCase.summary}</p>
            <div className="grid grid-cols-2 gap-3 text-xs border-y border-white/10 py-4">
              <div>
                <div className="text-[#9BAAC2]">Patient</div>
                <div className="mt-0.5 text-white">
                  {inspectedCase.patientName} ({inspectedCase.patientCountry})
                </div>
              </div>
              <div>
                <div className="text-[#9BAAC2]">Budget & Urgency</div>
                <div className="mt-0.5 tabular-nums text-white">
                  ${inspectedCase.budgetUsd.toLocaleString()} · {inspectedCase.urgency}
                </div>
              </div>
              <div>
                <div className="text-[#9BAAC2]">Journey Stage</div>
                <div className="mt-0.5 tabular-nums text-white">Stage {inspectedCase.currentJourneyStage} of 14</div>
              </div>
              <div>
                <div className="text-[#9BAAC2]">Provider Lead Stage</div>
                <div className="mt-0.5 text-[#9272FF]">{inspectedCase.providerLeadStage}</div>
              </div>
            </div>
            <div className="text-xs text-[#9BAAC2]">
              Active quotes on this case:{' '}
              <span className="tabular-nums font-semibold text-white">
                {data.quotes.filter((q) => q.caseId === inspectedCase.id).length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
