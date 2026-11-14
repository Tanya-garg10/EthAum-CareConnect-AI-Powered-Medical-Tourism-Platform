import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  Compass,
  Edit3,
  Eye,
  FileText,
  GitCompare,
  Globe2,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Printer,
  RotateCcw,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import CaseCreationWizard from './CaseCreationWizard';
import {
  syncAppointmentToFirestore,
  syncDocumentConsentToFirestore,
  syncDocumentMetaToFirestore,
  syncMedicalCaseToFirestore,
  syncMessageToFirestore,
  updateMedicalCaseInFirestore,
} from '../lib/firebase';
import type {
  HospitalMatchResult,
  HospitalProfile,
  MedicalCase,
  MedicalDocument,
  PlatformBootstrapData,
  User,
} from '../types';

export type PatientTabId =
  | 'overview'
  | 'cases'
  | 'assistant'
  | 'hospitals'
  | 'doctors'
  | 'quotes'
  | 'records'
  | 'appointments'
  | 'messages'
  | 'journey'
  | 'notifications'
  | 'settings';

interface PatientDashboardProps {
  user: User;
  token: string;
  data: PlatformBootstrapData;
  initialTab?: PatientTabId;
  prefillSpecialty?: string;
  onRefresh: () => Promise<void>;
  onSignOut: () => void;
  onBackToLanding: () => void;
}

const SIDEBAR_ITEMS: Array<{ id: PatientTabId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'cases', label: 'My Cases', icon: Activity },
  { id: 'hospitals', label: 'Find Hospitals', icon: Building2 },
  { id: 'doctors', label: 'Find Doctors', icon: Stethoscope },
  { id: 'assistant', label: 'AI Assistant', icon: Sparkles },
  { id: 'quotes', label: 'Compare Quotes', icon: GitCompare },
  { id: 'records', label: 'Medical Records', icon: FileText },
  { id: 'appointments', label: 'Appointments', icon: Calendar },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'journey', label: 'My Journey', icon: Compass },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const AI_WORKFLOWS = [
  {
    id: 'Case Summary',
    label: 'Case Summary',
    prompt: 'Organize my active case intake brief cleanly for hospital international desks.',
  },
  {
    id: 'Report Organization',
    label: 'Report Organization',
    prompt: 'Summarize how my uploaded medical reports are organized and categorized.',
  },
  {
    id: 'Doctor Questions',
    label: 'Doctor Questions',
    prompt: 'Prepare thoughtful administrative and procedural questions I can ask my doctor during the virtual call.',
  },
  {
    id: 'Treatment Journey Explanation',
    label: 'Journey Explanation',
    prompt: 'Explain my next milestones in the 14-stage CareConnect coordination workflow.',
  },
  {
    id: 'Quote Explanation',
    label: 'Quote Explanation',
    prompt: 'Explain key inclusions, exclusions, and cancellation terms to check across quotes.',
  },
  {
    id: 'Travel Preparation',
    label: 'Travel Preparation',
    prompt: 'Generate an international medical travel and visa readiness checklist for my preferred destination.',
  },
  {
    id: 'Case Completeness',
    label: 'Case Completeness',
    prompt: 'Check which administrative items or uploaded files are still missing before formal review.',
  },
];

export default function PatientDashboard({
  user,
  token,
  data,
  initialTab = 'overview',
  prefillSpecialty,
  onRefresh,
  onSignOut,
  onBackToLanding,
}: PatientDashboardProps) {
  const [activeTab, setActiveTab] = useState<PatientTabId>(initialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(data.cases[0]?.id || '');
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Selected hospital profile & document preview modals
  const [viewingHospital, setViewingHospital] = useState<HospitalProfile | null>(null);
  const [previewDoc, setPreviewDoc] = useState<MedicalDocument | null>(null);
  const [comparisonSaved, setComparisonSaved] = useState(false);

  // Create Case 7-step wizard & inline edit state
  const [showNewCaseForm, setShowNewCaseForm] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [editCaseTitle, setEditCaseTitle] = useState('');
  const [editCaseSummary, setEditCaseSummary] = useState('');
  const [editCaseBudget, setEditCaseBudget] = useState(20000);
  const [busyAction, setBusyAction] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // AI Case Assistant state
  const [aiTaskType, setAiTaskType] = useState<string>('Case Summary');
  const [aiMessages, setAiMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      text: string;
      modeLabel?: string;
      structuredSummary?: string;
      doctorQuestions?: string[];
      missingAdminDetails?: string[];
      recommendedAction?: string;
      disclaimer?: string;
    }>
  >([
    {
      role: 'assistant',
      modeLabel: 'CareConnect AI · Non-Diagnostic Intake Organizer',
      text: `Hello ${user.fullName.split(' ')[0]}. Select any coordination workflow on the left or ask a question below. Note: I organize logistics and records only — licensed physicians lead all clinical decisions.`,
      disclaimer: 'Administrative coordination only — requires licensed clinician review.',
    },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Settings edit state
  const [settingName, setSettingName] = useState(user.fullName);
  const [settingCountry, setSettingCountry] = useState(user.country);
  const [settingLanguage, setSettingLanguage] = useState(user.preferredLanguage);
  const [settingDestination, setSettingDestination] = useState(user.preferredDestination || 'Singapore');
  const [settingInterest, setSettingInterest] = useState(user.treatmentInterest || 'Cardiology');
  const [settingBudget, setSettingBudget] = useState(user.budgetPreferenceUsd || 22000);

  // Hospital Matching Filter state
  const [filterCountry, setFilterCountry] = useState('All');
  const [filterSpecialty, setFilterSpecialty] = useState(prefillSpecialty ? 'All' : 'All');
  const [filterLanguage, setFilterLanguage] = useState(user.preferredLanguage || 'English');
  const [filterBudget, setFilterBudget] = useState(30000);
  const [filterAccreditation, setFilterAccreditation] = useState('All');
  const [hospitalMatches, setHospitalMatches] = useState<HospitalMatchResult[]>([]);

  // Doctor search filter
  const [doctorQuery, setDoctorQuery] = useState('');

  // Upload Document form state
  const [docCategory, setDocCategory] = useState<'Cardiology / ECG' | 'Radiology / Imaging' | 'Pathology & Labs' | 'Surgical History' | 'Identity & Travel'>('Radiology / Imaging');
  const [docFileType, setDocFileType] = useState<'PDF' | 'DICOM Summary' | 'Lab Report' | 'Imaging (JPG/PNG)'>('PDF');
  const [docName, setDocName] = useState('');
  const [docSizeKb, setDocSizeKb] = useState<number>(940);
  const [docNotes, setDocNotes] = useState('');

  // Appointment request state
  const [aptHospitalId, setAptHospitalId] = useState(data.hospitals[0]?.id || 'hosp-sg-1');
  const [aptType, setAptType] = useState<'Exploratory Virtual Call' | 'Formal Virtual Consultation'>('Exploratory Virtual Call');
  const [aptDate, setAptDate] = useState('2026-11-20T10:00');
  const [aptTimeZone, setAptTimeZone] = useState('Europe/London (GMT)');
  const [aptNotes, setAptNotes] = useState('');

  // Chat message state
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    if (!selectedCaseId && data.cases[0]?.id) {
      setSelectedCaseId(data.cases[0].id);
    }
  }, [data.cases, selectedCaseId]);

  const activeCase: MedicalCase | undefined = useMemo(
    () => data.cases.find((c) => c.id === selectedCaseId) || data.cases[0],
    [data.cases, selectedCaseId],
  );

  useEffect(() => {
    const runMatch = async () => {
      try {
        const res = await fetch('/api/hospitals/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            specialty: filterSpecialty === 'All' ? activeCase?.specialty : filterSpecialty,
            country: filterCountry === 'All' ? undefined : filterCountry,
            budgetUsd: filterBudget,
            language: filterLanguage,
          }),
        });
        const json = await res.json();
        if (json.matches) {
          let filtered: HospitalMatchResult[] = json.matches;
          if (filterCountry !== 'All') {
            filtered = filtered.filter((m) => m.hospital.country === filterCountry);
          }
          if (filterSpecialty !== 'All') {
            filtered = filtered.filter((m) =>
              m.hospital.specialties.some((s) =>
                s.toLowerCase().includes(filterSpecialty.toLowerCase()),
              ),
            );
          }
          if (filterAccreditation === 'Verified Only') {
            filtered = filtered.filter((m) => m.hospital.credentialStatus === 'verified');
          }
          setHospitalMatches(filtered);
        }
      } catch {
        // Fallback silently
      }
    };
    runMatch();
  }, [filterCountry, filterSpecialty, filterLanguage, filterBudget, filterAccreditation, activeCase?.specialty]);

  const caseQuotes = useMemo(
    () => (activeCase ? data.quotes.filter((q) => q.caseId === activeCase.id) : data.quotes),
    [data.quotes, activeCase],
  );

  const caseDocuments = useMemo(
    () =>
      (activeCase ? data.documents.filter((d) => d.caseId === activeCase.id) : data.documents).filter(
        (d) => !d.deletionRequested,
      ),
    [data.documents, activeCase],
  );

  const caseMessages = useMemo(
    () => (activeCase ? data.messages.filter((m) => m.caseId === activeCase.id) : data.messages),
    [data.messages, activeCase],
  );

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const handleCreateCaseWizard = async (payload: {
    title: string;
    specialty: string;
    targetProcedure: string;
    diagnosisSummary: string;
    medicalHistory: string;
    preferredCountries: string[];
    preferredLanguage: string;
    budgetUsd: number;
    expectedTravelWindow: string;
    insuranceInfo: string;
    urgency: 'Routine (4–8 weeks)' | 'Priority (2–4 weeks)' | 'Expedited (< 2 weeks)';
    summary: string;
  }) => {
    setBusyAction(true);
    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.medicalCase) {
        await syncMedicalCaseToFirestore(json.medicalCase).catch(() => {});
        setSelectedCaseId(json.medicalCase.id);
        setShowNewCaseForm(false);
        setFeedbackBanner(
          `Created medical case ${json.medicalCase.caseReference || json.medicalCase.id.toUpperCase()} — "${json.medicalCase.title}".`,
        );
        await onRefresh();
      } else {
        setFeedbackBanner(json.error || 'Could not create medical case.');
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handleSaveCaseEdit = async (e: React.FormEvent, caseId: string) => {
    e.preventDefault();
    setBusyAction(true);
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          title: editCaseTitle,
          summary: editCaseSummary,
          budgetUsd: Number(editCaseBudget),
        }),
      });
      if (res.ok) {
        await updateMedicalCaseInFirestore(caseId, {
          title: editCaseTitle,
          summary: editCaseSummary,
          budgetUsd: Number(editCaseBudget),
        }).catch(() => {});
        setEditingCaseId(null);
        setFeedbackBanner('Updated medical case details.');
        await onRefresh();
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handleMarkNotificationRead = async (notificationId?: string) => {
    await fetch('/api/notifications/read', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ notificationId }),
    });
    await onRefresh();
  };

  const runAiPrompt = async (promptText: string, task = aiTaskType) => {
    if (!promptText.trim() || aiLoading) return;
    setAiMessages((prev) => [...prev, { role: 'user', text: promptText }]);
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          prompt: promptText,
          taskType: task,
          caseContext: activeCase,
          documentsContext: caseDocuments,
        }),
      });
      const json = await res.json();
      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          modeLabel: json.label || 'CareConnect AI · Non-Diagnostic',
          text: json.reply || 'Structured administrative response generated.',
          structuredSummary: json.structuredSummary,
          doctorQuestions: json.doctorQuestions,
          missingAdminDetails: json.missingAdminDetails,
          recommendedAction: json.recommendedAction,
          disclaimer: json.disclaimer,
        },
      ]);
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          modeLabel: 'Assistant Notice',
          text: 'Could not reach the AI endpoint. Please retry.',
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSendAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || aiLoading) return;
    const prompt = aiInput.trim();
    setAiInput('');
    await runAiPrompt(prompt, aiTaskType);
  };

  const handleToggleShortlist = async (quoteId: string) => {
    await fetch(`/api/quotes/${quoteId}/shortlist`, {
      method: 'PATCH',
      headers: authHeaders,
    });
    await onRefresh();
  };

  const handleToggleSaveQuote = async (quoteId: string) => {
    await fetch(`/api/quotes/${quoteId}/save`, {
      method: 'PATCH',
      headers: authHeaders,
    });
    setFeedbackBanner('Updated saved comparison status for quotation.');
    await onRefresh();
  };

  const handleDeleteDocumentPermanent = async (docId: string) => {
    const res = await fetch(`/api/documents/${docId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (res.ok) {
      setFeedbackBanner('Document permanently deleted from patient vault.');
      await onRefresh();
    }
  };

  const handleSaveProfileSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          fullName: settingName,
          country: settingCountry,
          preferredLanguage: settingLanguage,
          preferredDestination: settingDestination,
          treatmentInterest: settingInterest,
          budgetPreferenceUsd: Number(settingBudget),
        }),
      });
      if (res.ok) {
        setFeedbackBanner('Saved profile & care preference updates.');
        await onRefresh();
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase) return;
    if (docSizeKb > 10240) {
      setFeedbackBanner('File size exceeds the 10 MB protected storage limit.');
      return;
    }
    const finalName = docName.trim() || `Medical_Record_${Date.now()}.pdf`;
    setBusyAction(true);
    try {
      const extractRes = await fetch('/api/ai/summarize-document', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          fileName: finalName,
          category: docCategory,
          rawExcerpt: docNotes || 'Patient uploaded diagnostic report',
        }),
      });
      const extractJson = await extractRes.json();

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          caseId: activeCase.id,
          fileName: finalName,
          fileType: docFileType,
          category: docCategory,
          sizeKb: docSizeKb || 940,
          rawExcerpt: extractJson.summary || docNotes,
          sharedWithHospitalIds: [],
        }),
      });
      const json = await res.json();
      if (res.ok) {
        if (json.document) {
          await syncDocumentMetaToFirestore(json.document).catch(() => {});
        }
        setDocName('');
        setDocSizeKb(940);
        setDocNotes('');
        setFeedbackBanner(
          `Uploaded "${finalName}" (${json.document?.version || 'v1.0'}). Grant hospital consent below before sharing.`,
        );
        await onRefresh();
      } else {
        setFeedbackBanner(json.error || 'Document upload failed.');
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handleToggleConsent = async (docId: string, hospitalId: string, granted: boolean) => {
    await fetch(`/api/documents/${docId}/consent`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ hospitalId, granted }),
    });
    await syncDocumentConsentToFirestore(docId, hospitalId, granted).catch(() => {});
    await onRefresh();
  };

  const handleRequestDeletion = async (docId: string) => {
    await fetch(`/api/documents/${docId}/request-deletion`, {
      method: 'POST',
      headers: authHeaders,
    });
    setFeedbackBanner('Document access revoked and deletion request logged.');
    await onRefresh();
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase) return;
    setBusyAction(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          caseId: activeCase.id,
          hospitalId: aptHospitalId,
          type: aptType,
          scheduledAtIso: new Date(aptDate).toISOString(),
          timeZone: aptTimeZone,
          notes: aptNotes,
        }),
      });
      const aptJson = await res.json();
      if (res.ok) {
        if (aptJson.appointment) {
          await syncAppointmentToFirestore(aptJson.appointment).catch(() => {});
        }
        setAptNotes('');
        setFeedbackBanner('Appointment request sent to hospital international desk.');
        await onRefresh();
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handleAppointmentStatus = async (
    id: string,
    status: 'Reschedule Requested' | 'Cancelled',
  ) => {
    await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status }),
    });
    await onRefresh();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !chatInput.trim()) return;
    const body = chatInput.trim();
    setChatInput('');
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ caseId: activeCase.id, body }),
    });
    const json = await res.json();
    if (res.ok && json.message) {
      await syncMessageToFirestore(json.message).catch(() => {});
    }
    await onRefresh();
  };

  const handleAdvanceJourney = async (stage: number) => {
    if (!activeCase) return;
    await fetch(`/api/cases/${activeCase.id}/journey`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ stage }),
    });
    await onRefresh();
  };

  const unreadCount = data.notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[#070B18] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-white/10 bg-[#090F20] p-4">
        <div>
          <button
            type="button"
            onClick={onBackToLanding}
            className="px-3 py-2 text-left font-display text-lg font-semibold tracking-tight text-white hover:text-[#35D5F5] transition-colors"
          >
            EthAum CareConnect
          </button>
          <div className="px-3 text-xs text-slate-400">Patient Care Workspace</div>

          <nav className="mt-6 space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#35D5F5]/15 text-[#35D5F5]'
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
            <div className="text-xs text-slate-400 truncate">{user.country}</div>
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
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-72 bg-[#090F20] border-r border-white/10 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between px-2 py-2">
                <span className="font-display text-lg font-semibold text-white">
                  EthAum CareConnect
                </span>
                <button type="button" onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-5 w-5 text-slate-300" />
                </button>
              </div>
              <nav className="mt-4 space-y-1">
                {SIDEBAR_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                        active ? 'bg-[#35D5F5]/15 text-[#35D5F5]' : 'text-slate-300'
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
          <div className="flex-1 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070B18]/95 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <div className="text-xs text-slate-400">
                  Patient Portal / {SIDEBAR_ITEMS.find((i) => i.id === activeTab)?.label}
                </div>
                {activeCase && (
                  <div className="text-sm font-medium text-white truncate">
                    Active Case: {activeCase.title}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {data.cases.length > 1 && (
                <select
                  value={activeCase?.id || ''}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="hidden sm:block rounded-lg border border-white/15 bg-[#0B1224] px-3 py-1.5 text-xs text-white focus:border-[#35D5F5] focus:outline-none"
                >
                  {data.cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.caseReference || c.id.toUpperCase()} · {c.specialty}
                    </option>
                  ))}
                </select>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative rounded-lg border border-white/10 bg-[#0B1224] p-2 text-slate-300 hover:text-white"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#35D5F5] text-[10px] font-bold text-[#070B18]">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl border border-white/15 bg-[#0B1224] p-4 shadow-2xl z-40">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 text-xs font-semibold text-white">
                      <span>Notification Centre</span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleMarkNotificationRead()}
                          className="text-[11px] font-medium text-[#35D5F5] hover:underline"
                        >
                          Mark all read
                        </button>
                        <button
                          type="button"
                          onClick={() => setNotificationsOpen(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-3">
                      {data.notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            void handleMarkNotificationRead(n.id);
                            if (n.targetTab) setActiveTab(n.targetTab as PatientTabId);
                            setNotificationsOpen(false);
                          }}
                          className="block w-full rounded-lg border border-white/10 bg-[#070B18] p-3 text-left hover:border-[#35D5F5]/40"
                        >
                          <div className="flex items-center justify-between text-xs font-medium text-white">
                            <span>{n.title}</span>
                            <span className="text-slate-500">{n.timestamp}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">{n.detail}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('cases');
                  setShowNewCaseForm(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#35D5F5] px-3.5 py-2 text-xs font-semibold text-[#070B18] hover:bg-[#5ce0fa] whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Case</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
          {feedbackBanner && (
            <div className="flex items-center justify-between rounded-xl border border-[#35D5F5]/40 bg-[#0F1B36] px-4 py-3 text-xs text-slate-100">
              <span>{feedbackBanner}</span>
              <button
                type="button"
                onClick={() => setFeedbackBanner(null)}
                className="text-slate-400 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
                  Welcome back, {user.fullName.split(' ')[0]}
                </h1>
                <p className="mt-1 text-sm text-[#9BAAC2]">
                  Your healthcare journey, organized in one place. Manage medical dossiers, consent, transparent quotes, and appointments.
                </p>
              </div>

              {/* 4 KPI Strip */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-[#0B1224] p-5">
                  <div className="text-xs text-slate-400">Active Medical Cases</div>
                  <div className="mt-2 font-mono-tabular text-2xl font-semibold text-white">
                    {data.cases.length}
                  </div>
                  <div className="mt-1 text-xs text-[#35D5F5]">
                    {activeCase ? `Stage ${activeCase.currentJourneyStage}/14` : 'Ready to start'}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0B1224] p-5">
                  <div className="text-xs text-slate-400">Matched Providers</div>
                  <div className="mt-2 font-mono-tabular text-2xl font-semibold text-white">
                    {activeCase ? activeCase.assignedHospitalIds.length : data.hospitals.length}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">Explainable score active</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0B1224] p-5">
                  <div className="text-xs text-slate-400">Itemized Quotations</div>
                  <div className="mt-2 font-mono-tabular text-2xl font-semibold text-white">
                    {data.quotes.length}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {data.quotes.filter((q) => q.shortlisted).length} shortlisted
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0B1224] p-5">
                  <div className="text-xs text-slate-400">Upcoming Consultations</div>
                  <div className="mt-2 font-mono-tabular text-2xl font-semibold text-white">
                    {data.appointments.filter((a) => a.status !== 'Cancelled').length}
                  </div>
                  <div className="mt-1 text-xs text-emerald-400">
                    {data.appointments[0]?.status || 'None scheduled'}
                  </div>
                </div>
              </div>

              {data.cases.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#0B1224] p-10 text-center">
                  <Activity className="mx-auto h-8 w-8 text-[#35D5F5]" />
                  <h2 className="mt-3 font-display text-xl font-semibold text-white">
                    No active medical cases yet
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
                    Start by creating a medical case or chatting with the AI Case Assistant to organize your goals, budget, and preferred destinations.
                  </p>
                  <div className="mt-6 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('cases');
                        setShowNewCaseForm(true);
                      }}
                      className="rounded-lg bg-[#35D5F5] px-4 py-2.5 text-xs font-semibold text-[#070B18]"
                    >
                      Create First Medical Case
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('assistant')}
                      className="rounded-lg border border-white/15 px-4 py-2.5 text-xs font-medium text-white"
                    >
                      Open AI Case Assistant
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-12">
                  {/* Visual Journey Tracker Preview */}
                  <div className="lg:col-span-8 rounded-2xl border border-white/10 bg-[#0B1224] p-6 space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-display text-lg font-semibold text-white">
                          Journey Progress · {activeCase?.title}
                        </h2>
                        <p className="text-xs text-slate-400">
                          Stage {activeCase?.currentJourneyStage} of 14 ·{' '}
                          {
                            data.journeyStages.find(
                              (s) => s.stage === activeCase?.currentJourneyStage,
                            )?.title
                          }
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('journey')}
                        className="text-xs font-medium text-[#35D5F5] hover:underline"
                      >
                        Full 14-Stage Tracker
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {data.journeyStages.slice(0, 7).map((st) => {
                        const done = activeCase?.completedStages.includes(st.stage);
                        const current = activeCase?.currentJourneyStage === st.stage;
                        return (
                          <div
                            key={st.stage}
                            className={`rounded-lg border p-2.5 text-center ${
                              current
                                ? 'border-[#35D5F5] bg-[#0F1B36]'
                                : done
                                  ? 'border-emerald-500/30 bg-emerald-500/5'
                                  : 'border-white/10 bg-[#070B18]'
                            }`}
                          >
                            <div className="font-mono-tabular text-xs font-semibold text-slate-300">
                              {String(st.stage).padStart(2, '0')}
                            </div>
                            <div className="mt-1 truncate text-[11px] text-slate-300">
                              {st.title}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <div className="text-xs font-semibold text-white">Pending Actions</div>
                      <div className="mt-2 space-y-2">
                        {(activeCase?.missingAdminDetails || []).map((item) => (
                          <div
                            key={item}
                            className="flex items-center justify-between rounded-lg border border-white/10 bg-[#070B18] px-3.5 py-2.5 text-xs"
                          >
                            <span className="text-slate-300">{item}</span>
                            <button
                              type="button"
                              onClick={() => setActiveTab('records')}
                              className="font-medium text-[#35D5F5] hover:underline"
                            >
                              Upload
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Recommended Providers & Recent Activity */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className="rounded-2xl border border-white/10 bg-[#0B1224] p-6">
                      <div className="flex items-center justify-between">
                        <h2 className="font-display text-base font-semibold text-white">
                          Top Matched Hospitals
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('hospitals')}
                          className="text-xs text-[#35D5F5] hover:underline"
                        >
                          See all
                        </button>
                      </div>
                      <div className="mt-4 space-y-3">
                        {hospitalMatches.slice(0, 3).map((m) => (
                          <div
                            key={m.hospital.id}
                            className="rounded-xl border border-white/10 bg-[#070B18] p-3.5"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-white truncate">
                                {m.hospital.name}
                              </span>
                              <span className="font-mono-tabular font-semibold text-[#35D5F5]">
                                {m.matchScore}%
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {m.hospital.city}, {m.hospital.country} · {m.hospital.indicativeRangeLabel}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#0B1224] p-6">
                      <h2 className="font-display text-base font-semibold text-white">
                        Recent Activity
                      </h2>
                      <div className="mt-3 space-y-3 text-xs text-slate-300">
                        {data.notifications.map((n) => (
                          <div key={n.id} className="border-b border-white/10 pb-2.5 last:border-0">
                            <div className="font-medium text-white">{n.title}</div>
                            <div className="mt-0.5 text-slate-400">{n.timestamp}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY MEDICAL CASES */}
          {activeTab === 'cases' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-white">
                    My Medical Cases
                  </h1>
                  <p className="text-sm text-slate-400">
                    Organize your treatment inquiries and track missing administrative documentation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewCaseForm(!showNewCaseForm)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#35D5F5] px-4 py-2 text-xs font-semibold text-[#070B18]"
                >
                  <Plus className="h-4 w-4" />
                  <span>{showNewCaseForm ? 'Cancel' : 'Create Medical Case'}</span>
                </button>
              </div>

              {showNewCaseForm && (
                <CaseCreationWizard
                  defaultSpecialty={prefillSpecialty}
                  defaultLanguage={user.preferredLanguage}
                  destinations={data.destinations}
                  busy={busyAction}
                  onCancel={() => setShowNewCaseForm(false)}
                  onSubmit={handleCreateCaseWizard}
                />
              )}

              <div className="grid gap-4">
                {data.cases.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-2xl border p-6 transition-colors ${
                      c.id === activeCase?.id
                        ? 'border-[#35D5F5]/50 bg-[#0F1B36]'
                        : 'border-white/10 bg-[#0B1224]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="font-mono-tabular text-[#35D5F5]">
                            {c.caseReference || c.id.toUpperCase()}
                          </span>
                          <span>·</span>
                          <span>{c.specialty}</span>
                          <span>·</span>
                          <span>{c.urgency}</span>
                        </div>
                        <h3 className="mt-1 font-display text-xl font-semibold text-white">
                          {c.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCaseId(editingCaseId === c.id ? null : c.id);
                            setEditCaseTitle(c.title);
                            setEditCaseSummary(c.summary);
                            setEditCaseBudget(c.budgetUsd);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-[#35D5F5] hover:text-white"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>{editingCaseId === c.id ? 'Cancel Edit' : 'Edit'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCaseId(c.id)}
                          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white hover:border-[#35D5F5]"
                        >
                          {c.id === activeCase?.id ? 'Selected Active Case' : 'Set Active'}
                        </button>
                      </div>
                    </div>

                    {editingCaseId === c.id ? (
                      <form
                        onSubmit={(e) => handleSaveCaseEdit(e, c.id)}
                        className="mt-4 space-y-3 rounded-xl border border-[#35D5F5]/30 bg-[#070B18] p-4"
                      >
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="sm:col-span-2">
                            <label className="block text-xs text-slate-400">Case Title</label>
                            <input
                              type="text"
                              required
                              value={editCaseTitle}
                              onChange={(e) => setEditCaseTitle(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0B1224] px-3 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400">Budget (USD)</label>
                            <input
                              type="number"
                              required
                              value={editCaseBudget}
                              onChange={(e) => setEditCaseBudget(Number(e.target.value))}
                              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0B1224] px-3 py-1.5 text-xs text-white font-mono-tabular"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400">Case Summary</label>
                          <textarea
                            rows={2}
                            required
                            value={editCaseSummary}
                            onChange={(e) => setEditCaseSummary(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-white/15 bg-[#0B1224] px-3 py-1.5 text-xs text-white"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={busyAction}
                          className="rounded-lg bg-[#35D5F5] px-4 py-1.5 text-xs font-semibold text-[#070B18]"
                        >
                          {busyAction ? 'Saving...' : 'Save Changes'}
                        </button>
                      </form>
                    ) : (
                      <p className="mt-3 text-sm text-slate-300">{c.summary}</p>
                    )}
                    {(c.expectedTravelWindow || c.insuranceInfo) && (
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
                        {c.expectedTravelWindow && (
                          <span>Travel Window: <span className="text-slate-200">{c.expectedTravelWindow}</span></span>
                        )}
                        {c.insuranceInfo && (
                          <span>Funding / Insurance: <span className="text-slate-200">{c.insuranceInfo}</span></span>
                        )}
                      </div>
                    )}
                    {c.aiAssistedSummary && (
                      <div className="mt-4 rounded-xl border border-white/10 bg-[#070B18] p-4 text-xs leading-relaxed text-slate-300">
                        <span className="font-semibold text-[#9B8CFF]">AI-Assisted Summary: </span>
                        {c.aiAssistedSummary}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4 text-xs text-slate-400">
                      <div>
                        Preferred: {c.preferredCountries.join(', ')} · Target Budget:{' '}
                        <span className="font-mono-tabular text-white">
                          ${c.budgetUsd.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        Journey Stage {c.currentJourneyStage}/14 · Provider Status: {c.providerLeadStage}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CARECONNECT AI COORDINATOR (7 WORKFLOWS) */}
          {activeTab === 'assistant' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-white">
                    CareConnect AI Coordinator
                  </h1>
                  <p className="text-sm text-[#9BAAC2]">
                    Organize records, build doctor consultation questions, explain quotes, and prepare cross-border travel checklists.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setAiMessages([
                      {
                        role: 'assistant',
                        modeLabel: 'CareConnect AI · Non-Diagnostic Intake Organizer',
                        text: `Conversation cleared. Ready to assist with ${activeCase?.title || 'your medical journey'}.`,
                        disclaimer: 'Administrative coordination only — requires licensed clinician review.',
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#0B1224] px-3 py-1.5 text-xs text-slate-300 hover:border-[#39DDF5] hover:text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Clear Conversation</span>
                </button>
              </div>

              {/* Mandatory Clinical Safety Banner */}
              <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-xs text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div>
                  <span className="font-semibold">Clinical Safety Guardrail: </span>
                  CareConnect AI organizes administrative information only. It never diagnoses medical conditions, prescribes treatments, or replaces licensed physicians. For urgent symptoms, seek local emergency care immediately.
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-12">
                {/* 7 Workflows Sidebar */}
                <div className="lg:col-span-4 space-y-2 rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#0B1224] p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#39DDF5] mb-2">
                    7 AI Coordinator Workflows
                  </div>
                  {AI_WORKFLOWS.map((wf) => {
                    const active = aiTaskType === wf.id;
                    return (
                      <button
                        key={wf.id}
                        type="button"
                        onClick={() => {
                          setAiTaskType(wf.id);
                          void runAiPrompt(wf.prompt, wf.id);
                        }}
                        className={`w-full rounded-xl border p-3 text-left transition-colors ${
                          active
                            ? 'border-[#39DDF5] bg-[#101A30] text-white'
                            : 'border-white/10 bg-[#070B18] text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <div className="text-xs font-semibold">{wf.label}</div>
                        <div className="mt-0.5 text-[11px] text-[#9BAAC2] line-clamp-2">
                          {wf.prompt}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Chat Thread */}
                <div className="lg:col-span-8 rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#0B1224] flex flex-col h-[560px]">
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {aiMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col ${
                          msg.role === 'user' ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`max-w-2xl rounded-2xl border p-4 text-sm ${
                            msg.role === 'user'
                              ? 'border-[#39DDF5]/40 bg-[#101A30] text-white'
                              : 'border-white/10 bg-[#070B18] text-slate-200'
                          }`}
                        >
                          {msg.modeLabel && (
                            <div className="mb-1.5 text-[11px] font-medium text-[#39DDF5]">
                              {msg.modeLabel}
                            </div>
                          )}
                          <p className="leading-relaxed">{msg.text}</p>

                          {msg.structuredSummary && (
                            <div className="mt-3 rounded-lg border border-white/10 bg-[#0B1224] p-3 text-xs text-slate-300">
                              <div className="font-semibold text-white">
                                Structured Case Brief (AI-Assisted)
                              </div>
                              <p className="mt-1">{msg.structuredSummary}</p>
                            </div>
                          )}

                          {msg.doctorQuestions && msg.doctorQuestions.length > 0 && (
                            <div className="mt-3 rounded-lg border border-[#9272FF]/30 bg-[#0B1224] p-3 text-xs">
                              <div className="font-semibold text-[#9272FF]">
                                Suggested Questions for Your Doctor
                              </div>
                              <ul className="mt-1.5 space-y-1 text-slate-300">
                                {msg.doctorQuestions.map((q) => (
                                  <li key={q}>· {q}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {msg.missingAdminDetails && msg.missingAdminDetails.length > 0 && (
                            <div className="mt-2.5 text-xs text-[#9BAAC2]">
                              <span className="font-medium text-slate-200">Missing Admin Items: </span>
                              {msg.missingAdminDetails.join(' · ')}
                            </div>
                          )}

                          {msg.recommendedAction && (
                            <div className="mt-2 text-xs text-[#39DDF5]">
                              Next Logistical Step: {msg.recommendedAction}
                            </div>
                          )}

                          {msg.disclaimer && (
                            <div className="mt-2 border-t border-white/10 pt-2 text-[11px] text-amber-300/80">
                              {msg.disclaimer}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {aiLoading && (
                      <div className="text-xs text-[#9BAAC2]">Organizing response...</div>
                    )}
                  </div>

                  <form
                    onSubmit={handleSendAi}
                    className="border-t border-white/10 p-4 flex items-center gap-3"
                  >
                    <input
                      type="text"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder={`Ask under "${aiTaskType}" workflow...`}
                      className="flex-1 rounded-lg border border-white/15 bg-[#070B18] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#39DDF5] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={aiLoading}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#39DDF5] px-4 py-2.5 text-xs font-semibold text-[#070B18] disabled:opacity-60"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FIND HOSPITALS (SMART MATCHING) */}
          {activeTab === 'hospitals' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-semibold text-white">
                  Smart Hospital Discovery & Matching
                </h1>
                <p className="text-sm text-slate-400">
                  Explainable matching compares hospital capabilities, budget alignment, language support, and published accreditations. Scores never represent clinical suitability.
                </p>
              </div>

              {/* Filters */}
              <div className="grid gap-3 rounded-2xl border border-white/10 bg-[#0B1224] p-5 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <label className="block text-xs text-slate-400">Country</label>
                  <select
                    value={filterCountry}
                    onChange={(e) => setFilterCountry(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                  >
                    <option value="All">All Countries</option>
                    {data.destinations.map((d) => (
                      <option key={d.id} value={d.country}>
                        {d.country}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400">Specialty</label>
                  <select
                    value={filterSpecialty}
                    onChange={(e) => setFilterSpecialty(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                  >
                    <option value="All">All Specialties</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Precision Oncology">Precision Oncology</option>
                    <option value="Orthopedics">Orthopedics</option>
                    <option value="Neurology">Neurology</option>
                    <option value="Cosmetic">Cosmetic Surgery</option>
                    <option value="Dental">Dental Care</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400">Language</label>
                  <select
                    value={filterLanguage}
                    onChange={(e) => setFilterLanguage(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                  >
                    <option>English</option>
                    <option>Arabic</option>
                    <option>German</option>
                    <option>Mandarin</option>
                    <option>Hindi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400">
                    Target Budget: <span className="font-mono-tabular text-white">${filterBudget.toLocaleString()}</span>
                  </label>
                  <input
                    type="range"
                    min={5000}
                    max={50000}
                    step={1000}
                    value={filterBudget}
                    onChange={(e) => setFilterBudget(Number(e.target.value))}
                    className="mt-3 w-full accent-[#35D5F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400">Credentials</label>
                  <select
                    value={filterAccreditation}
                    onChange={(e) => setFilterAccreditation(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                  >
                    <option value="All">All Listings</option>
                    <option value="Verified Only">Verified Registry Only</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {hospitalMatches.map((m) => (
                  <div
                    key={m.hospital.id}
                    className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0B1224] p-6"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400">
                              {m.hospital.city}, {m.hospital.country}
                            </span>
                            <span>·</span>
                            <span
                              className={
                                m.hospital.credentialStatus === 'verified'
                                  ? 'text-emerald-400'
                                  : 'text-amber-300'
                              }
                            >
                              {m.hospital.credentialStatus === 'verified'
                                ? 'Verified Credential Record'
                                : 'Sample Listing'}
                            </span>
                          </div>
                          <h3 className="mt-1.5 font-display text-xl font-semibold text-white">
                            {m.hospital.name}
                          </h3>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono-tabular text-2xl font-semibold text-[#35D5F5]">
                            {m.matchScore}%
                          </div>
                          <div className="text-[11px] text-slate-400">Logistical Fit</div>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-slate-300">
                        {m.hospital.accreditations.join(' · ')} · Next slot in{' '}
                        <span className="font-mono-tabular text-white">
                          {m.hospital.nextAvailabilityDays} days
                        </span>
                      </div>

                      <p className="mt-3 text-xs leading-relaxed text-slate-400">
                        {m.explanation}
                      </p>

                      {/* Explainable Score Bars */}
                      <div className="mt-4 grid grid-cols-5 gap-2 border-t border-white/10 pt-4 text-center">
                        {[
                          { label: 'Specialty', val: m.breakdown.specialtyMatch },
                          { label: 'Budget', val: m.breakdown.budgetFit },
                          { label: 'Language', val: m.breakdown.languageMatch },
                          { label: 'Accred.', val: m.breakdown.accreditationScore },
                          { label: 'Wait', val: m.breakdown.availabilityScore },
                        ].map((b) => (
                          <div key={b.label} className="rounded-lg bg-[#070B18] p-2">
                            <div className="font-mono-tabular text-xs font-semibold text-white">
                              {b.val}
                            </div>
                            <div className="text-[10px] text-slate-400">{b.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                      <div className="font-mono-tabular text-sm font-semibold text-white">
                        {m.hospital.indicativeRangeLabel}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewingHospital(m.hospital)}
                          className="rounded-lg border border-white/15 px-3.5 py-2 text-xs font-medium text-white hover:border-[#35D5F5]"
                        >
                          View Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAptHospitalId(m.hospital.id);
                            setActiveTab('appointments');
                          }}
                          className="rounded-lg bg-[#35D5F5] px-3.5 py-2 text-xs font-semibold text-[#070B18]"
                        >
                          Request Call
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: DOCTOR DIRECTORY */}
          {activeTab === 'doctors' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-white">
                    Specialist Doctor Directory
                  </h1>
                  <p className="text-sm text-slate-400">
                    Inspect published board credentials, subspecialties, languages, and consultation availability.
                  </p>
                </div>
                <input
                  type="search"
                  value={doctorQuery}
                  onChange={(e) => setDoctorQuery(e.target.value)}
                  placeholder="Search doctor, specialty, or country..."
                  className="w-full sm:w-72 rounded-lg border border-white/15 bg-[#0B1224] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#35D5F5] focus:outline-none"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {data.doctors
                  .filter((d) => {
                    if (!doctorQuery.trim()) return true;
                    const q = doctorQuery.toLowerCase();
                    return (
                      d.name.toLowerCase().includes(q) ||
                      d.specialty.toLowerCase().includes(q) ||
                      d.country.toLowerCase().includes(q)
                    );
                  })
                  .map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0B1224] p-6"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#35D5F5]">{doc.specialty}</span>
                          <span
                            className={
                              doc.credentialStatus === 'verified'
                                ? 'text-emerald-400'
                                : 'text-amber-300'
                            }
                          >
                            {doc.credentialStatus === 'verified' ? 'Verified' : 'Sample Profile'}
                          </span>
                        </div>
                        <h3 className="mt-2 font-display text-lg font-semibold text-white">
                          {doc.name}
                        </h3>
                        <div className="text-xs text-slate-400">{doc.title}</div>
                        <div className="mt-2 text-xs text-slate-300">
                          {doc.hospitalName} · {doc.city}, {doc.country}
                        </div>
                        <div className="mt-3 border-t border-white/10 pt-3 text-xs text-slate-400">
                          {doc.credentials}
                        </div>
                        <div className="mt-2 text-xs text-slate-300">
                          Languages: {doc.languages.join(', ')}
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                        <div className="text-xs">
                          <div className="text-slate-400">Next Slot: {doc.nextConsultSlot}</div>
                          <div className="font-mono-tabular font-semibold text-white">
                            Consult ~${doc.indicativeConsultFeeUsd}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAptHospitalId(doc.hospitalId);
                            setActiveTab('appointments');
                          }}
                          className="rounded-lg bg-[#35D5F5] px-3 py-2 text-xs font-semibold text-[#070B18]"
                        >
                          Book Consult
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 6: COMPARE QUOTES */}
          {activeTab === 'quotes' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-white">
                    Side-by-Side Quotation Comparison
                  </h1>
                  <p className="text-sm text-slate-400">
                    Compare itemized hospital proposals neutrally across inclusions, exclusions, stay length, medications, diagnostics, and cancellation terms. Lowest price does not imply clinical superiority.
                  </p>
                </div>
                {caseQuotes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 no-print">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#0B1224] px-3.5 py-2 text-xs font-medium text-white hover:border-[#39DDF5]"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Print / Export</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setComparisonSaved(true);
                        setFeedbackBanner(
                          `Saved side-by-side comparison snapshot for ${activeCase?.caseReference || activeCase?.id.toUpperCase() || 'active case'}.`,
                        );
                      }}
                      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                        comparisonSaved
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                          : 'border-[#39DDF5]/40 bg-[#101A30] text-[#39DDF5] hover:bg-[#39DDF5] hover:text-[#070B18]'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{comparisonSaved ? 'Comparison Snapshot Saved' : 'Save Snapshot'}</span>
                    </button>
                  </div>
                )}
              </div>

              {caseQuotes.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#0B1224] p-8 text-center text-sm text-slate-400">
                  No quotations submitted for this medical case yet. Request quotes from matched hospitals in Find Hospitals.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0B1224] print-friendly">
                  <table className="w-full min-w-[780px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-[#090F20]">
                        <th className="w-48 p-4 font-semibold text-slate-300">Comparison Field</th>
                        {caseQuotes.map((q) => (
                          <th key={q.id} className="p-4 align-top">
                            <div className="font-display text-base font-semibold text-white">
                              {q.hospitalName}
                            </div>
                            <div className="text-xs font-normal text-slate-400">
                              {q.city}, {q.country}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 no-print">
                              <button
                                type="button"
                                onClick={() => handleToggleShortlist(q.id)}
                                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                                  q.shortlisted
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-white/10 text-white hover:bg-[#39DDF5] hover:text-[#070B18]'
                                }`}
                              >
                                {q.shortlisted ? 'Shortlisted' : 'Shortlist'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleSaveQuote(q.id)}
                                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                                  q.savedForComparison
                                    ? 'border-[#39DDF5]/50 text-[#39DDF5]'
                                    : 'border-white/15 text-slate-300 hover:text-white'
                                }`}
                              >
                                {q.savedForComparison ? 'Saved' : 'Save'}
                              </button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      <tr>
                        <td className="p-4 font-medium text-slate-300">Lead Specialist</td>
                        {caseQuotes.map((q) => (
                          <td key={q.id} className="p-4 text-slate-200">{q.doctorName}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-slate-300">Treatment Proposal</td>
                        {caseQuotes.map((q) => (
                          <td key={q.id} className="p-4 text-white font-medium">{q.treatmentName}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-slate-300">Price &amp; Certainty</td>
                        {caseQuotes.map((q) => (
                          <td key={q.id} className="p-4">
                            <div className="font-mono-tabular text-lg font-semibold text-[#39DDF5]">
                              {q.currency} {q.estimatedPrice.toLocaleString()}
                            </div>
                            <div className="mt-0.5 text-[11px] text-amber-300">
                              {q.costType || 'Estimated'} Package Price
                            </div>
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-slate-300">Included Services</td>
                        {caseQuotes.map((q) => (
                          <td key={q.id} className="p-4 align-top">
                            <ul className="space-y-1 text-slate-300">
                              {q.includedServices.map((s) => (
                                <li key={s}>· {s}</li>
                              ))}
                            </ul>
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-slate-300">Excluded Services</td>
                        {caseQuotes.map((q) => (
                          <td key={q.id} className="p-4 align-top">
                            <ul className="space-y-1 text-amber-200/90">
                              {q.excludedServices.map((s) => (
                                <li key={s}>· {s}</li>
                              ))}
                            </ul>
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-slate-300">Medications Included</td>
                        {caseQuotes.map((q) => (
                          <td key={q.id} className="p-4 text-slate-300">
                            {q.medicationsIncluded || 'Routine inpatient medications included'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-slate-300">Diagnostics & Tests Included</td>
                        {caseQuotes.map((q) => (
                          <td key={q.id} className="p-4 text-slate-300">
                            {q.diagnosticsIncluded || 'Standard pre-operative diagnostics'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-slate-300">Accommodation</td>
                        {caseQuotes.map((q) => (
                          <td key={q.id} className="p-4 text-slate-300">{q.accommodation}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-slate-300">Expected Duration</td>
                        {caseQuotes.map((q) => (
                          <td key={q.id} className="p-4 font-mono-tabular text-white">
                            {q.expectedDurationDays} days
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-slate-300">Consult Availability</td>
                        {caseQuotes.map((q) => (
                          <td key={q.id} className="p-4 text-slate-300">{q.consultationAvailability}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-slate-300">Quote Validity</td>
                        {caseQuotes.map((q) => (
                          <td key={q.id} className="p-4 font-mono-tabular text-slate-300">{q.validUntil}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-slate-300">Payment Conditions</td>
                        {caseQuotes.map((q) => (
                          <td key={q.id} className="p-4 text-slate-300">{q.paymentConditions}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-slate-300">Cancellation Terms</td>
                        {caseQuotes.map((q) => (
                          <td key={q.id} className="p-4 text-slate-300">
                            {q.cancellationTerms || 'Refundable prior to scheduled admission'}
                          </td>
                        ))}
                      </tr>
                      <tr className="bg-[#090F20]">
                        <td className="p-4 font-medium text-slate-300">Coordinator Action</td>
                        {caseQuotes.map((q) => (
                          <td key={q.id} className="p-4">
                            <button
                              type="button"
                              onClick={() => {
                                setChatInput(
                                  `Clarification request for Quote ${q.id.toUpperCase()} (${q.hospitalName}): Could you confirm inpatient medication limits and post-discharge follow-up schedule?`,
                                );
                                setActiveTab('messages');
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-[#35D5F5]/50 hover:text-[#35D5F5] transition-colors"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>Request Clarification</span>
                            </button>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: MEDICAL RECORDS */}
          {activeTab === 'records' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-semibold text-white">
                  Medical Records & Consent Control
                </h1>
                <p className="text-sm text-slate-400">
                  Records remain private by default. Grant or revoke sharing permission per hospital at any time.
                </p>
              </div>

              <form
                onSubmit={handleUploadDocument}
                className="rounded-2xl border border-white/10 bg-[#0B1224] p-6 space-y-4"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Upload className="h-4 w-4 text-[#35D5F5]" />
                  <span>Upload Medical Document (PDF / Imaging / Lab Report)</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs text-slate-400">Choose Local File or Enter Name</label>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.dcm"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const kb = Math.max(1, Math.round(file.size / 1024));
                          if (kb > 10240) {
                            setFeedbackBanner('Selected file exceeds the 10 MB protected storage limit.');
                            return;
                          }
                          setDocName(file.name);
                          setDocSizeKb(kb);
                        }
                      }}
                      className="mt-1 block w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-[#0F1B36] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#35D5F5]"
                    />
                    <div className="mt-1 text-[11px] text-slate-500">
                      Supported: PDF, JPG, PNG, DICOM summary (max 10 MB)
                    </div>
                    <input
                      type="text"
                      value={docName}
                      onChange={(e) => setDocName(e.target.value)}
                      placeholder="Or enter document title (e.g., ECG_Nov2026.pdf)"
                      className="mt-2 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Document Category</label>
                    <select
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value as typeof docCategory)}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                    >
                      <option>Cardiology / ECG</option>
                      <option>Radiology / Imaging</option>
                      <option>Pathology & Labs</option>
                      <option>Surgical History</option>
                      <option>Identity & Travel</option>
                    </select>
                    <label className="mt-2 block text-xs text-slate-400">Format</label>
                    <select
                      value={docFileType}
                      onChange={(e) => setDocFileType(e.target.value as typeof docFileType)}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                    >
                      <option>PDF</option>
                      <option>DICOM Summary</option>
                      <option>Lab Report</option>
                      <option>Imaging (JPG/PNG)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Administrative Note / Excerpt</label>
                    <textarea
                      rows={3}
                      value={docNotes}
                      onChange={(e) => setDocNotes(e.target.value)}
                      placeholder="Optional context for AI indexing..."
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busyAction || !activeCase}
                  className="rounded-lg bg-[#35D5F5] px-4 py-2 text-xs font-semibold text-[#070B18] disabled:opacity-60"
                >
                  {busyAction ? 'Indexing...' : 'Upload & Index Document'}
                </button>
              </form>

              <div className="space-y-4">
                {caseDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-2xl border border-white/10 bg-[#0B1224] p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="text-[#35D5F5]">{doc.category}</span>
                          <span>·</span>
                          <span>{doc.fileType}</span>
                          <span>·</span>
                          <span className="font-mono-tabular text-white">{doc.version || 'v1.0'}</span>
                          <span>·</span>
                          <span className="font-mono-tabular">{doc.sizeKb} KB</span>
                        </div>
                        <div className="mt-1 font-display text-base font-semibold text-white">
                          {doc.fileName}
                        </div>
                        {doc.aiExtractedNotes && (
                          <p className="mt-1.5 text-xs text-slate-300">{doc.aiExtractedNotes}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:border-[#39DDF5]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestDeletion(doc.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/10"
                        >
                          <span>Revoke &amp; Log</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDocumentPermanent(doc.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                        <Lock className="h-3.5 w-3.5 text-[#35D5F5]" />
                        <span>Granular Hospital Sharing Consent:</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {data.hospitals.slice(0, 4).map((h) => {
                          const shared = doc.sharedWithHospitalIds.includes(h.id);
                          return (
                            <button
                              key={h.id}
                              type="button"
                              onClick={() => handleToggleConsent(doc.id, h.id, !shared)}
                              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                                shared
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                  : 'border-white/10 bg-[#070B18] text-slate-400 hover:text-white'
                              }`}
                            >
                              {shared ? `Shared: ${h.name}` : `Share with ${h.name}`}
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

          {/* TAB 8: APPOINTMENTS */}
          {activeTab === 'appointments' && (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <form
                  onSubmit={handleBookAppointment}
                  className="rounded-2xl border border-white/10 bg-[#0B1224] p-6 space-y-4"
                >
                  <h2 className="font-display text-lg font-semibold text-white">
                    Request Virtual Consultation
                  </h2>
                  <div>
                    <label className="block text-xs text-slate-400">Hospital / Desk</label>
                    <select
                      value={aptHospitalId}
                      onChange={(e) => setAptHospitalId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                    >
                      {data.hospitals.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.city})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Consultation Type</label>
                    <select
                      value={aptType}
                      onChange={(e) => setAptType(e.target.value as typeof aptType)}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                    >
                      <option>Exploratory Virtual Call</option>
                      <option>Formal Virtual Consultation</option>
                    </select>
                  </div>
                  {(() => {
                    const chosenHosp = data.hospitals.find((h) => h.id === aptHospitalId);
                    if (!chosenHosp?.availableSlots?.length) return null;
                    return (
                      <div>
                        <label className="block text-xs text-slate-400">
                          Hospital Suggested Slots
                        </label>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {chosenHosp.availableSlots.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setAptDate(slot)}
                              className={`rounded-md border px-2.5 py-1 font-mono-tabular text-[11px] ${
                                aptDate === slot
                                  ? 'border-[#39DDF5] bg-[#101A30] text-[#39DDF5]'
                                  : 'border-white/10 bg-[#070B18] text-slate-300'
                              }`}
                            >
                              {slot.replace('T', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400">Preferred Date &amp; Time</label>
                      <input
                        type="datetime-local"
                        value={aptDate}
                        onChange={(e) => setAptDate(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400">Time Zone</label>
                      <select
                        value={aptTimeZone}
                        onChange={(e) => setAptTimeZone(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                      >
                        <option>Europe/London (GMT)</option>
                        <option>Asia/Singapore (SGT)</option>
                        <option>Asia/Kolkata (IST)</option>
                        <option>Europe/Berlin (CET)</option>
                        <option>America/New_York (EST)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Agenda / Questions</label>
                    <textarea
                      rows={3}
                      value={aptNotes}
                      onChange={(e) => setAptNotes(e.target.value)}
                      placeholder="Topics for the specialist or international coordinator..."
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busyAction || !activeCase}
                    className="w-full rounded-lg bg-[#35D5F5] px-4 py-2.5 text-xs font-semibold text-[#070B18]"
                  >
                    Submit Appointment Request
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 space-y-4">
                <h2 className="font-display text-lg font-semibold text-white">
                  Scheduled & Requested Consultations
                </h2>
                {data.appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="rounded-2xl border border-white/10 bg-[#0B1224] p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-[#35D5F5]">{apt.type}</div>
                        <div className="font-display text-base font-semibold text-white">
                          {apt.hospitalName}
                        </div>
                        <div className="text-xs text-slate-400">{apt.doctorName}</div>
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          apt.status === 'Confirmed'
                            ? 'text-emerald-400'
                            : apt.status === 'Cancelled'
                              ? 'text-rose-400'
                              : 'text-amber-300'
                        }`}
                      >
                        {apt.status}
                      </span>
                    </div>

                    <div className="font-mono-tabular text-xs text-slate-300">
                      {new Date(apt.scheduledAtIso).toLocaleString()} · {apt.timeZone}
                    </div>
                    <div className="text-xs text-slate-400">{apt.meetingMode}</div>
                    <p className="text-xs text-slate-300">{apt.notes}</p>

                    {apt.status !== 'Cancelled' && (
                      <div className="flex gap-2 border-t border-white/10 pt-3">
                        <button
                          type="button"
                          onClick={() => handleAppointmentStatus(apt.id, 'Reschedule Requested')}
                          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:border-[#35D5F5]"
                        >
                          Request Reschedule
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAppointmentStatus(apt.id, 'Cancelled')}
                          className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 9: MESSAGES */}
          {activeTab === 'messages' && (
            <div className="space-y-4">
              <div>
                <h1 className="font-display text-2xl font-semibold text-white">
                  Provider Coordination Messages
                </h1>
                <p className="text-sm text-slate-400">
                  Direct case thread with hospital international coordinators.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0B1224] flex flex-col h-[480px]">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {caseMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${
                        m.senderRole === 'patient' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-xl rounded-2xl border p-4 text-sm ${
                          m.senderRole === 'patient'
                            ? 'border-[#35D5F5]/40 bg-[#0F1B36] text-white'
                            : 'border-white/10 bg-[#070B18] text-slate-200'
                        }`}
                      >
                        <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="font-semibold text-[#35D5F5]">{m.senderName}</span>
                          <span>·</span>
                          <span>{new Date(m.timestamp).toLocaleString()}</span>
                        </div>
                        <p>{m.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={handleSendMessage}
                  className="border-t border-white/10 p-4 flex items-center gap-3"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Message international hospital desk..."
                    className="flex-1 rounded-lg border border-white/15 bg-[#070B18] px-4 py-2.5 text-sm text-white"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[#35D5F5] px-4 py-2.5 text-xs font-semibold text-[#070B18]"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 10: 14-STAGE MY JOURNEY */}
          {activeTab === 'journey' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-white">
                    14-Stage Patient Journey Tracker
                  </h1>
                  <p className="text-sm text-slate-400">
                    Track every milestone from discovery to post-treatment follow-up. Bookings and clinical procedures (Stages 10–14) remain gated until verified.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {data.journeyStages.map((st) => {
                  const isCompleted = activeCase?.completedStages.includes(st.stage);
                  const isCurrent = activeCase?.currentJourneyStage === st.stage;
                  const canPreviewAdvance = st.stage <= 11 && activeCase;
                  return (
                    <div
                      key={st.stage}
                      className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${
                        isCurrent
                          ? 'border-[#35D5F5] bg-[#0F1B36]'
                          : isCompleted
                            ? 'border-emerald-500/30 bg-[#0B1224]'
                            : 'border-white/10 bg-[#0B1224]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono-tabular text-xs font-semibold ${
                            isCurrent
                              ? 'bg-[#35D5F5] text-[#070B18]'
                              : isCompleted
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-white/5 text-slate-400'
                          }`}
                        >
                          {String(st.stage).padStart(2, '0')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span>{st.category}</span>
                            <span>·</span>
                            <span>Owner: {st.owner}</span>
                          </div>
                          <div className="mt-0.5 font-display text-base font-semibold text-white">
                            {st.title}
                          </div>
                          <p className="mt-1 text-xs text-slate-400">{st.description}</p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Done</span>
                          </span>
                        ) : isCurrent ? (
                          <span className="text-xs font-semibold text-[#35D5F5]">Current</span>
                        ) : canPreviewAdvance ? (
                          <button
                            type="button"
                            onClick={() => handleAdvanceJourney(st.stage)}
                            className="rounded-md border border-white/15 px-2.5 py-1 text-[11px] text-slate-300 hover:border-[#35D5F5]"
                          >
                            Set Current
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500">Provider Gated</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 11: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="max-w-3xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-white">
                    Notifications Center
                  </h1>
                  <p className="text-sm text-[#9BAAC2]">
                    Updates on quotations, virtual consultations, and administrative case readiness.
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleMarkNotificationRead()}
                    className="rounded-lg border border-[#39DDF5]/40 bg-[#101A30] px-3.5 py-2 text-xs font-medium text-[#39DDF5]"
                  >
                    Mark All Read ({unreadCount})
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {data.notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 ${
                      n.read
                        ? 'border-white/10 bg-[#0B1224]'
                        : 'border-[#39DDF5]/40 bg-[#101A30]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-white">{n.title}</span>
                        {!n.read && <span className="text-[11px] text-[#39DDF5]">Unread</span>}
                        <span className="text-slate-500">· {n.timestamp}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#9BAAC2]">{n.detail}</p>
                    </div>
                    <div className="flex gap-2">
                      {n.targetTab && (
                        <button
                          type="button"
                          onClick={() => {
                            void handleMarkNotificationRead(n.id);
                            setActiveTab(n.targetTab as PatientTabId);
                          }}
                          className="rounded-lg bg-[#39DDF5] px-3 py-1.5 text-xs font-semibold text-[#070B18]"
                        >
                          Open Section
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 12: EDITABLE SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h1 className="font-display text-2xl font-semibold text-white">Account Settings</h1>
                <p className="text-sm text-[#9BAAC2]">
                  Update your patient profile, preferred language, and destination preferences.
                </p>
              </div>
              <form
                onSubmit={handleSaveProfileSettings}
                className="rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#0B1224] p-6 space-y-4 text-xs"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[#9BAAC2]">Full Name</label>
                    <input
                      type="text"
                      required
                      value={settingName}
                      onChange={(e) => setSettingName(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[#9BAAC2]">Email (Account Identifier)</label>
                    <input
                      type="text"
                      disabled
                      value={user.email}
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#070B18] px-3 py-2 font-mono-tabular text-sm text-slate-400"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[#9BAAC2]">Country</label>
                    <input
                      type="text"
                      required
                      value={settingCountry}
                      onChange={(e) => setSettingCountry(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[#9BAAC2]">Preferred Language</label>
                    <select
                      value={settingLanguage}
                      onChange={(e) => setSettingLanguage(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
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

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-[#9BAAC2]">Preferred Destination</label>
                    <select
                      value={settingDestination}
                      onChange={(e) => setSettingDestination(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
                    >
                      {data.destinations.map((d) => (
                        <option key={d.id} value={d.country}>{d.country}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#9BAAC2]">Treatment Interest</label>
                    <input
                      type="text"
                      value={settingInterest}
                      onChange={(e) => setSettingInterest(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[#9BAAC2]">Target Budget (USD)</label>
                    <input
                      type="number"
                      value={settingBudget}
                      onChange={(e) => setSettingBudget(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 font-mono-tabular text-sm text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-emerald-400">
                    Consent Status: Active (Patient-Controlled)
                  </span>
                  <button
                    type="submit"
                    disabled={busyAction}
                    className="rounded-lg bg-[#39DDF5] px-5 py-2 text-xs font-semibold text-[#070B18] disabled:opacity-60"
                  >
                    {busyAction ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* Enriched Hospital Detail Modal */}
      {viewingHospital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-h-[90vh] overflow-y-auto max-w-2xl w-full rounded-2xl border border-white/15 bg-[#0B1224] p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-[#35D5F5]">
                  {viewingHospital.city}, {viewingHospital.country} ·{' '}
                  {viewingHospital.bedCapacity ? `${viewingHospital.bedCapacity} beds` : 'International Wing'}
                </div>
                <h3 className="mt-1 font-display text-xl font-semibold text-white">
                  {viewingHospital.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingHospital(null)}
                className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-slate-300">{viewingHospital.description}</p>
            <div className="rounded-xl border border-white/10 bg-[#070B18] p-4 text-xs space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Credential Verification</span>
                <span className="text-white text-right">{viewingHospital.credentialNote}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Accreditations</span>
                <span className="text-white text-right">{viewingHospital.accreditations.join(', ')}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Languages</span>
                <span className="text-white text-right">{viewingHospital.languages.join(', ')}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Indicative Estimate</span>
                <span className="font-mono-tabular text-[#35D5F5]">
                  {viewingHospital.indicativeRangeLabel}
                </span>
              </div>
            </div>

            {viewingHospital.treatments && viewingHospital.treatments.length > 0 && (
              <div>
                <div className="text-xs font-medium text-slate-400">Published Treatment Programs</div>
                <div className="mt-1 text-xs text-slate-200">
                  {viewingHospital.treatments.join(' · ')}
                </div>
              </div>
            )}

            {viewingHospital.facilities && viewingHospital.facilities.length > 0 && (
              <div>
                <div className="text-xs font-medium text-slate-400">Clinical Facilities</div>
                <div className="mt-1 text-xs text-slate-200">
                  {viewingHospital.facilities.join(' · ')}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-medium text-slate-400">International Patient Services</div>
              <div className="mt-1 text-xs text-slate-200">
                {viewingHospital.services.join(' · ')}
              </div>
            </div>

            {data.doctors.filter((d) => d.hospitalId === viewingHospital.id).length > 0 && (
              <div className="border-t border-white/10 pt-4 space-y-2">
                <div className="text-xs font-semibold text-white">Affiliated Specialists (Sample)</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.doctors
                    .filter((d) => d.hospitalId === viewingHospital.id)
                    .map((doc) => (
                      <div
                        key={doc.id}
                        className="rounded-xl border border-white/10 bg-[#070B18] p-3 text-xs"
                      >
                        <div className="font-medium text-white">{doc.name}</div>
                        <div className="text-[#35D5F5]">{doc.specialty}</div>
                        <div className="mt-1 text-slate-400">
                          {doc.yearsExperience} yrs exp · Consult ~${doc.indicativeConsultFeeUsd}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setViewingHospital(null)}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs text-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewingHospital(null);
                  setActiveTab('quotes');
                }}
                className="rounded-lg border border-[#35D5F5]/40 px-4 py-2 text-xs text-[#35D5F5]"
              >
                Compare Quotes
              </button>
              <button
                type="button"
                onClick={() => {
                  setAptHospitalId(viewingHospital.id);
                  setViewingHospital(null);
                  setActiveTab('appointments');
                }}
                className="rounded-lg bg-[#35D5F5] px-4 py-2 text-xs font-semibold text-[#070B18]"
              >
                Schedule Exploratory Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Medical Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-w-xl w-full rounded-2xl border border-white/15 bg-[#0B1224] p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-[#35D5F5]">
                  Protected Patient Vault · {previewDoc.version || 'v1.0'}
                </div>
                <h3 className="mt-1 font-display text-lg font-semibold text-white">
                  {previewDoc.fileName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#070B18] p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Category</span>
                <span className="text-white">{previewDoc.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Format & Size</span>
                <span className="font-mono-tabular text-white">
                  {previewDoc.fileType} · {previewDoc.sizeKb} KB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Uploaded At</span>
                <span className="font-mono-tabular text-white">
                  {new Date(previewDoc.uploadedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Hospital Access Count</span>
                <span className="font-mono-tabular text-[#35D5F5]">
                  {previewDoc.sharedWithHospitalIds.length} consented provider(s)
                </span>
              </div>
            </div>
            {previewDoc.aiExtractedNotes && (
              <div className="rounded-xl border border-[#9B8CFF]/30 bg-[#070B18] p-4 text-xs text-slate-300">
                <div className="font-semibold text-[#9B8CFF] mb-1">
                  AI-Assisted Administrative Note (Non-Diagnostic)
                </div>
                <p>{previewDoc.aiExtractedNotes}</p>
              </div>
            )}
            <div className="rounded-xl border border-white/10 bg-[#070B18] p-4 text-xs text-slate-300">
              <div className="font-semibold text-white mb-1">Extracted Administrative Excerpt</div>
              <p>{previewDoc.rawExcerpt || 'Protected binary document payload stored privately in vault.'}</p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="rounded-lg bg-[#35D5F5] px-4 py-2 text-xs font-semibold text-[#070B18]"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
