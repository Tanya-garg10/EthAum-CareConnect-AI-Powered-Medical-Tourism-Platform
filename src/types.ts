export type UserRole = 'patient' | 'provider' | 'admin';

export interface User {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
  country: string;
  preferredLanguage: string;
  preferredDestination?: string;
  treatmentInterest?: string;
  budgetPreferenceUsd?: number;
  organizationName?: string;
  providerType?: string;
  hospitalId?: string;
  consentAccepted: boolean;
  createdAt: string;
}

export interface TreatmentCategory {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  procedures: string[];
  typicalStayDays: string;
  indicativeRangeUsd: string;
  imageUrl?: string;
  accentColor: string;
}

export interface DestinationHub {
  id: string;
  country: string;
  city: string;
  lat: number;
  lon: number;
  hubName: string;
  specialties: string[];
  languages: string[];
  avgCostAdvantage: string;
  accreditationCount: number;
  summary: string;
  travelInfo?: string;
  imageUrl?: string;
}

export interface HospitalProfile {
  id: string;
  name: string;
  country: string;
  city: string;
  specialties: string[];
  treatments: string[];
  accreditations: string[];
  credentialStatus: 'verified' | 'sample';
  credentialNote: string;
  languages: string[];
  indicativePriceUsd: number;
  indicativeRangeLabel: string;
  nextAvailabilityDays: number;
  services: string[];
  facilities: string[];
  bedCapacity: number;
  internationalDesk: boolean;
  availableSlots?: string[];
  imageUrl?: string;
  description: string;
}

export interface DoctorProfile {
  id: string;
  name: string;
  title: string;
  hospitalId: string;
  hospitalName: string;
  country: string;
  city: string;
  specialty: string;
  subspecialties: string[];
  yearsExperience: number;
  credentials: string;
  registrationNote: string;
  publicationsCount: number;
  credentialStatus: 'verified' | 'sample';
  languages: string[];
  nextConsultSlot: string;
  indicativeConsultFeeUsd: number;
}

export type JourneyStageId =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface JourneyStageDef {
  stage: JourneyStageId;
  title: string;
  category: 'Discovery & Intake' | 'Matching & Evaluation' | 'Coordination & Care' | 'Recovery';
  description: string;
  owner: 'Patient' | 'CareConnect AI' | 'Medical Provider';
}

export type ProviderLeadStage =
  | 'New'
  | 'Qualified'
  | 'Medical Review'
  | 'Quote Requested'
  | 'Quote Sent'
  | 'Consultation'
  | 'Booked'
  | 'Treatment'
  | 'Aftercare'
  | 'Closed';

export interface MedicalCase {
  id: string;
  caseReference: string;
  patientId: string;
  patientName: string;
  patientCountry: string;
  title: string;
  specialty: string;
  targetProcedure: string;
  diagnosisSummary?: string;
  medicalHistory?: string;
  preferredCountries: string[];
  preferredLanguage: string;
  budgetUsd: number;
  expectedTravelWindow?: string;
  insuranceInfo?: string;
  urgency: 'Routine (4–8 weeks)' | 'Priority (2–4 weeks)' | 'Expedited (< 2 weeks)';
  summary: string;
  aiAssistedSummary?: string;
  missingAdminDetails: string[];
  currentJourneyStage: JourneyStageId;
  completedStages: JourneyStageId[];
  providerLeadStage: ProviderLeadStage;
  assignedHospitalIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MedicalDocument {
  id: string;
  caseId: string;
  patientId: string;
  fileName: string;
  fileType: 'PDF' | 'DICOM Summary' | 'Lab Report' | 'Imaging (JPG/PNG)' | 'Clinical Note';
  category: 'Cardiology / ECG' | 'Radiology / Imaging' | 'Pathology & Labs' | 'Surgical History' | 'Identity & Travel';
  version: string;
  sizeKb: number;
  uploadedAt: string;
  sharedWithHospitalIds: string[];
  deletionRequested: boolean;
  aiExtractedNotes?: string;
  rawExcerpt?: string;
}

export interface TreatmentQuote {
  id: string;
  caseId: string;
  hospitalId: string;
  hospitalName: string;
  doctorId: string;
  doctorName: string;
  country: string;
  city: string;
  treatmentName: string;
  estimatedPrice: number;
  costType?: 'Estimated' | 'Confirmed';
  currency: 'USD' | 'EUR' | 'SGD';
  includedServices: string[];
  excludedServices: string[];
  medicationsIncluded: string;
  diagnosticsIncluded: string;
  accommodation: string;
  transportDetails?: string;
  expectedDurationDays: number;
  consultationAvailability: string;
  validUntil: string;
  paymentConditions: string;
  cancellationTerms: string;
  providerNotes?: string;
  shortlisted: boolean;
  savedForComparison?: boolean;
  status: 'Active' | 'Pending Revision' | 'Selected for Review';
  createdAt: string;
}

export interface Appointment {
  id: string;
  caseId: string;
  patientId: string;
  patientName: string;
  hospitalId: string;
  hospitalName: string;
  doctorId: string;
  doctorName: string;
  type: 'Exploratory Virtual Call' | 'Formal Virtual Consultation' | 'Pre-Arrival Briefing';
  scheduledAtIso: string;
  timeZone: string;
  status: 'Confirmed' | 'Pending Provider Confirmation' | 'Reschedule Requested' | 'Cancelled';
  meetingMode: string;
  notes: string;
}

export interface ChatMessage {
  id: string;
  caseId: string;
  senderRole: 'patient' | 'provider' | 'coordinator';
  senderName: string;
  recipientHospitalId?: string;
  body: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  read: boolean;
  targetTab?: string;
}

export interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  role: 'Patient' | 'Hospital / Provider' | 'Partner / Investor';
  country: string;
  message: string;
  createdAt: string;
  status: 'Received' | 'Reviewed';
}

export interface ReferralCommissionRecord {
  id: string;
  caseReference: string;
  hospitalName: string;
  partnerName: string;
  eligibleBilledUsd: number;
  commissionRatePct: number;
  commissionAmountUsd: number;
  status: 'Pending Treatment Completion' | 'Integration-Ready Payout' | 'Projected Demo';
  termsNote: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorEmail: string;
  actorRole: UserRole;
  action: string;
  resource: string;
}

export interface HospitalMatchResult {
  hospital: HospitalProfile;
  matchScore: number;
  breakdown: {
    specialtyMatch: number;
    budgetFit: number;
    languageMatch: number;
    accreditationScore: number;
    availabilityScore: number;
  };
  explanation: string;
}

export interface PlatformBootstrapData {
  treatments: TreatmentCategory[];
  destinations: DestinationHub[];
  hospitals: HospitalProfile[];
  doctors: DoctorProfile[];
  journeyStages: JourneyStageDef[];
  cases: MedicalCase[];
  documents: MedicalDocument[];
  quotes: TreatmentQuote[];
  appointments: Appointment[];
  messages: ChatMessage[];
  notifications: NotificationItem[];
  contactInquiries?: ContactInquiry[];
  referrals: ReferralCommissionRecord[];
  auditLogs: AuditLogEntry[];
  usersSummary?: Array<Pick<User, 'id' | 'fullName' | 'email' | 'role' | 'country' | 'createdAt'>>;
  analytics: {
    totalUsers: number;
    patientEnquiries: number;
    registeredProviders: number;
    activeMedicalCases: number;
    quotesSent: number;
    bookingConversionPct: number;
    quoteConversionPct: number;
    cancellationRatePct: number;
    avgProviderResponseHours: number;
    patientSatisfactionScore: number;
    monthlyEnquiries: { month: string; enquiries: number; quotes: number; consults: number }[];
    specialtyDistribution: { specialty: string; sharePct: number }[];
    leadSources: { source: string; sharePct: number }[];
  };
}
