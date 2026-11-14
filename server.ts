import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

import { GoogleGenAI, Type } from '@google/genai';
import {
  DESTINATIONS,
  DOCTORS,
  HOSPITALS,
  JOURNEY_STAGES,
  TREATMENTS,
} from './src/data/seedData.ts';
import type {
  Appointment,
  AuditLogEntry,
  ChatMessage,
  ContactInquiry,
  HospitalMatchResult,
  HospitalProfile,
  MedicalCase,
  MedicalDocument,
  NotificationItem,
  ProviderLeadStage,
  ReferralCommissionRecord,
  TreatmentQuote,
  User,
  UserRole,
} from './src/types.ts';

dotenv.config();

const PORT = 3000;
const DATA_DIR = process.env.VERCEL ? '/tmp' : path.resolve(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'careconnect-db.json');
const TOKEN_SECRET = process.env.SESSION_SECRET || 'ethaum-careconnect-dev-secret-2026';

interface StoredUser extends User {
  passwordHash: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  hospitals: HospitalProfile[];
  cases: MedicalCase[];
  documents: MedicalDocument[];
  quotes: TreatmentQuote[];
  appointments: Appointment[];
  messages: ChatMessage[];
  notifications: NotificationItem[];
  contactInquiries: ContactInquiry[];
  referrals: ReferralCommissionRecord[];
  auditLogs: AuditLogEntry[];
}

// Simple in-memory rate limiter for sensitive endpoints
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxReq: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (bucket.count >= maxReq) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait briefly and try again.' });
      return;
    }
    bucket.count += 1;
    next();
  };
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, originalHash] = stored.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

function signToken(payload: { userId: string; role: UserRole; exp: number }): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): { userId: string; role: UserRole; exp: number } | null {
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!decoded.userId || !decoded.exp || Date.now() > decoded.exp) return null;
    return decoded;
  } catch {
    return null;
  }
}

function sanitizeUser(u: StoredUser): User {
  const { passwordHash: _ignored, ...safe } = u;
  return safe;
}

function createInitialDb(): DatabaseSchema {
  const demoPasswordHash = hashPassword('CareDemo2026!');

  const users: StoredUser[] = [
    {
      id: 'usr-patient-1',
      role: 'patient',
      fullName: 'Aarav Mehta',
      email: 'patient@careconnect.demo',
      country: 'United Kingdom',
      preferredLanguage: 'English',
      consentAccepted: true,
      createdAt: '2026-10-18T09:15:00.000Z',
      passwordHash: demoPasswordHash,
    },
    {
      id: 'usr-provider-1',
      role: 'provider',
      fullName: 'Dr. Arvind Subramanian',
      email: 'provider@careconnect.demo',
      country: 'Singapore',
      preferredLanguage: 'English',
      organizationName: 'Novena Heart & Proton Medical Center (Sample)',
      providerType: 'Tertiary International Hospital',
      hospitalId: 'hosp-sg-1',
      consentAccepted: true,
      createdAt: '2026-09-22T11:00:00.000Z',
      passwordHash: demoPasswordHash,
    },
    {
      id: 'usr-admin-1',
      role: 'admin',
      fullName: 'Elena Vance (Platform Operations)',
      email: 'admin@careconnect.demo',
      country: 'Switzerland',
      preferredLanguage: 'English',
      organizationName: 'EthAum CareConnect Operations',
      consentAccepted: true,
      createdAt: '2026-09-01T08:00:00.000Z',
      passwordHash: demoPasswordHash,
    },
  ];

  const cases: MedicalCase[] = [
    {
      id: 'case-101',
      caseReference: 'CC-2026-4101',
      patientId: 'usr-patient-1',
      patientName: 'Aarav Mehta',
      patientCountry: 'United Kingdom',
      title: 'Mitral Valve Evaluation & Minimally Invasive Repair Options',
      specialty: 'Cardiology',
      targetProcedure: 'TAVR / Valve Replacement',
      diagnosisSummary: 'Patient-reported moderate-to-severe mitral regurgitation per home cardiology note.',
      medicalHistory: 'No prior cardiac surgery; controlled hypertension.',
      preferredCountries: ['Singapore', 'India', 'Germany'],
      preferredLanguage: 'English',
      budgetUsd: 24000,
      expectedTravelWindow: 'December 2026',
      insuranceInfo: 'Self-pay with international travel coverage',
      urgency: 'Priority (2–4 weeks)',
      summary:
        'Seeking accredited structural heart centers for minimally invasive valve repair evaluation. Recent transthoracic echocardiogram and cardiology referral letter available for specialist review.',
      aiAssistedSummary:
        'AI-Assisted Administrative Summary: Patient seeks cross-border structural heart consultation (valve repair/replacement) within a $24,000 target budget and English-speaking clinical coordination. Echocardiogram summary uploaded; recent 12-lead ECG and passport validity confirmation remain pending for travel readiness.',
      missingAdminDetails: ['Updated 12-lead ECG PDF', 'Preferred Companion Travel Dates'],
      currentJourneyStage: 6,
      completedStages: [1, 2, 3, 4, 5],
      providerLeadStage: 'Quote Sent',
      assignedHospitalIds: ['hosp-sg-1', 'hosp-in-1', 'hosp-de-1'],
      createdAt: '2026-11-02T10:20:00.000Z',
      updatedAt: '2026-11-11T14:35:00.000Z',
    },
    {
      id: 'case-102',
      caseReference: 'CC-2026-4102',
      patientId: 'usr-patient-1',
      patientName: 'Aarav Mehta',
      patientCountry: 'United Kingdom',
      title: 'Second Opinion — Right Knee Robotic Arthroplasty',
      specialty: 'Orthopedics',
      targetProcedure: 'MAKO Robotic Knee Replacement',
      diagnosisSummary: 'Patient-reported tricompartmental osteoarthritis right knee.',
      medicalHistory: 'Prior arthroscopy 2021.',
      preferredCountries: ['Germany', 'Thailand', 'India'],
      preferredLanguage: 'English',
      budgetUsd: 16500,
      expectedTravelWindow: 'January 2027',
      insuranceInfo: 'Self-pay',
      urgency: 'Routine (4–8 weeks)',
      summary:
        'Exploring robotic-assisted knee arthroplasty with structured 7-day inpatient physiotherapy program.',
      aiAssistedSummary:
        'AI-Assisted Administrative Summary: Routine orthopedic surgical planning inquiry for robotic knee arthroplasty. Patient prioritizes inpatient rehabilitation and transparent implant inclusion breakdown.',
      missingAdminDetails: ['Standing Weight-Bearing Knee X-Ray'],
      currentJourneyStage: 4,
      completedStages: [1, 2, 3],
      providerLeadStage: 'Medical Review',
      assignedHospitalIds: ['hosp-de-1', 'hosp-th-1', 'hosp-in-1'],
      createdAt: '2026-11-08T16:40:00.000Z',
      updatedAt: '2026-11-12T08:10:00.000Z',
    },
  ];

  const documents: MedicalDocument[] = [
    {
      id: 'doc-901',
      caseId: 'case-101',
      patientId: 'usr-patient-1',
      fileName: 'Transthoracic_Echocardiogram_Oct2026.pdf',
      fileType: 'PDF',
      category: 'Cardiology / ECG',
      version: 'v1.0',
      sizeKb: 1840,
      uploadedAt: '2026-11-03T11:12:00.000Z',
      sharedWithHospitalIds: ['hosp-sg-1', 'hosp-in-1'],
      deletionRequested: false,
      aiExtractedNotes:
        'AI-Assisted Extraction: Document dated Oct 2026 · Contains echocardiogram measurements & cardiologist referral note. Shared with 2 consented centers.',
      rawExcerpt: 'TTE Study Report — LVEF documented, valve morphology evaluated for surgical planning.',
    },
    {
      id: 'doc-902',
      caseId: 'case-101',
      patientId: 'usr-patient-1',
      fileName: 'Comprehensive_Metabolic_CBC_Panel.pdf',
      fileType: 'Lab Report',
      category: 'Pathology & Labs',
      version: 'v1.0',
      sizeKb: 620,
      uploadedAt: '2026-11-04T09:05:00.000Z',
      sharedWithHospitalIds: ['hosp-sg-1'],
      deletionRequested: false,
      aiExtractedNotes:
        'AI-Assisted Extraction: Pre-operative baseline blood panel (CBC, renal, hepatic). Currently consented exclusively for Novena Heart & Proton Medical Center.',
      rawExcerpt: 'Baseline hematology & chemistry panel prior to specialist consultation.',
    },
    {
      id: 'doc-903',
      caseId: 'case-102',
      patientId: 'usr-patient-1',
      fileName: 'Orthopedic_MRI_Summary_Nov2026.pdf',
      fileType: 'DICOM Summary',
      category: 'Radiology / Imaging',
      version: 'v1.1',
      sizeKb: 3120,
      uploadedAt: '2026-11-09T13:45:00.000Z',
      sharedWithHospitalIds: ['hosp-de-1', 'hosp-th-1'],
      deletionRequested: false,
      aiExtractedNotes:
        'AI-Assisted Extraction: Right knee MRI radiology narrative prepared for orthopedic review.',
      rawExcerpt: 'MRI right knee compartments and alignment measurements.',
    },
  ];

  const quotes: TreatmentQuote[] = [
    {
      id: 'qt-501',
      caseId: 'case-101',
      hospitalId: 'hosp-sg-1',
      hospitalName: 'Novena Heart & Proton Medical Center (Sample)',
      doctorId: 'doc-1',
      doctorName: 'Dr. Arvind Subramanian, MD (Demo)',
      country: 'Singapore',
      city: 'Singapore',
      treatmentName: 'Minimally Invasive Structural Valve Repair Package',
      estimatedPrice: 22400,
      currency: 'USD',
      includedServices: [
        'Surgeon & anesthesia team fees',
        '2 days Cardiac ICU + 5 days private ward',
        'Changi Airport transfer & dedicated coordinator',
      ],
      excludedServices: [
        'International airfare & visa fees',
        'Extended ICU stay beyond 48 hours if clinically indicated',
        'Outpatient companion hotel accommodation',
      ],
      medicationsIncluded: 'Routine inpatient cardiac & anticoagulation meds during stay',
      diagnosticsIncluded: 'Pre-op CT angiogram, ECG & baseline pathology',
      accommodation: '5 nights private cardiac suite (hospital wing)',
      expectedDurationDays: 10,
      consultationAvailability: 'Video screen available within 48 hours',
      validUntil: '2026-12-15',
      paymentConditions: '20% refundable pre-admission deposit upon formal consult confirmation',
      cancellationTerms: 'Full deposit refund up to 7 days prior to scheduled admission',
      shortlisted: true,
      savedForComparison: true,
      status: 'Active',
      createdAt: '2026-11-07T08:00:00.000Z',
    },
    {
      id: 'qt-502',
      caseId: 'case-101',
      hospitalId: 'hosp-in-1',
      hospitalName: 'Indraprastha Vascular & Robotic Center (Sample)',
      doctorId: 'doc-3',
      doctorName: 'Dr. Meera Raghavan, MS, MCh (Demo)',
      country: 'India',
      city: 'New Delhi',
      treatmentName: 'Port-Access Cardiac Valve Repair Package',
      estimatedPrice: 11800,
      currency: 'USD',
      includedServices: [
        'Chief cardiothoracic surgeon & perfusion fees',
        '3 days CTVS ICU + 5 days deluxe room with companion bed',
        'Airport meet-and-greet + English/Arabic interpreter',
      ],
      excludedServices: [
        'Imported specialized mechanical/bioprosthetic valve upgrade if needed',
        'Flights & external hotel stays post-discharge',
      ],
      medicationsIncluded: 'All routine inpatient surgical medications & consumables',
      diagnosticsIncluded: 'Pre-op echo, chest X-ray & routine lab workup',
      accommodation: '8 nights inpatient deluxe suite (1 companion included)',
      expectedDurationDays: 12,
      consultationAvailability: 'Same-week video consult slots open',
      validUntil: '2026-12-20',
      paymentConditions: 'No upfront fee for video screen; 15% booking hold prior to visa letter',
      cancellationTerms: '100% refundable prior to inpatient admission',
      shortlisted: true,
      savedForComparison: true,
      status: 'Active',
      createdAt: '2026-11-08T12:20:00.000Z',
    },
    {
      id: 'qt-503',
      caseId: 'case-102',
      hospitalId: 'hosp-de-1',
      hospitalName: 'Munich Precision Surgical Institute (Sample)',
      doctorId: 'doc-2',
      doctorName: 'Prof. Dr. Lukas Weber, MD (Demo)',
      country: 'Germany',
      city: 'Munich',
      treatmentName: 'MAKO Robotic-Assisted Knee Arthroplasty + Rehab',
      estimatedPrice: 16800,
      currency: 'USD',
      includedServices: [
        'Chief orthopedic surgeon & robotic navigation fee',
        '6 days inpatient ward + 5 days physical therapy sessions',
        '3D CT pre-operative surgical planning',
      ],
      excludedServices: [
        'Travel & Schengen visa application fees',
        'Outpatient hotel after inpatient discharge',
      ],
      medicationsIncluded: 'Post-op analgesics & thrombosis prophylaxis during admission',
      diagnosticsIncluded: 'Pre-op 3D planning CT & post-op alignment X-ray',
      accommodation: '6 nights private surgical recovery room',
      expectedDurationDays: 11,
      consultationAvailability: 'Next slot Nov 15, 14:00 CET',
      validUntil: '2026-12-30',
      paymentConditions: '30% hospital escrow deposit 14 days prior to admission',
      cancellationTerms: 'Free cancellation up to 10 days before surgical slot',
      shortlisted: false,
      savedForComparison: false,
      status: 'Active',
      createdAt: '2026-11-10T09:45:00.000Z',
    },
  ];

  const appointments: Appointment[] = [
    {
      id: 'apt-301',
      caseId: 'case-101',
      patientId: 'usr-patient-1',
      patientName: 'Aarav Mehta',
      hospitalId: 'hosp-sg-1',
      hospitalName: 'Novena Heart & Proton Medical Center (Sample)',
      doctorId: 'doc-1',
      doctorName: 'Dr. Arvind Subramanian, MD (Demo)',
      type: 'Exploratory Virtual Call',
      scheduledAtIso: '2026-11-16T09:30:00.000Z',
      timeZone: 'Europe/London (GMT)',
      status: 'Confirmed',
      meetingMode: 'CareConnect Encrypted Video Room (Integration-Ready)',
      notes: 'Review TTE PDF and clarify expected inpatient stay duration.',
    },
    {
      id: 'apt-302',
      caseId: 'case-101',
      patientId: 'usr-patient-1',
      patientName: 'Aarav Mehta',
      hospitalId: 'hosp-in-1',
      hospitalName: 'Indraprastha Vascular & Robotic Center (Sample)',
      doctorId: 'doc-3',
      doctorName: 'Dr. Meera Raghavan, MS, MCh (Demo)',
      type: 'Exploratory Virtual Call',
      scheduledAtIso: '2026-11-18T11:30:00.000Z',
      timeZone: 'Europe/London (GMT)',
      status: 'Pending Provider Confirmation',
      meetingMode: 'CareConnect Encrypted Video Room (Integration-Ready)',
      notes: 'Compare port-access recovery timeline and companion lodging.',
    },
  ];

  const messages: ChatMessage[] = [
    {
      id: 'msg-1',
      caseId: 'case-101',
      senderRole: 'coordinator',
      senderName: 'Novena International Desk',
      recipientHospitalId: 'hosp-sg-1',
      body: 'Welcome Aarav. Dr. Subramanian’s coordinator has received your consented echocardiogram PDF and prepared Quote #qt-501 for your review.',
      timestamp: '2026-11-07T08:15:00.000Z',
    },
    {
      id: 'msg-2',
      caseId: 'case-101',
      senderRole: 'patient',
      senderName: 'Aarav Mehta',
      recipientHospitalId: 'hosp-sg-1',
      body: 'Thank you. Could you confirm whether the 5-night cardiac ward includes companion seating and airport pickup from Terminal 3?',
      timestamp: '2026-11-08T10:42:00.000Z',
    },
    {
      id: 'msg-3',
      caseId: 'case-101',
      senderRole: 'provider',
      senderName: 'Dr. Arvind Subramanian (Coordinator)',
      recipientHospitalId: 'hosp-sg-1',
      body: 'Yes, Changi Terminal 3 meet-and-greet is included. Companion day-bed accommodation is available in our private cardiac wing.',
      timestamp: '2026-11-08T13:10:00.000Z',
    },
  ];

  const notifications: NotificationItem[] = [
    {
      id: 'ntf-1',
      title: 'Two quotes ready for comparison',
      detail: 'Novena Heart Center ($22,400) and Indraprastha Vascular ($11,800) submitted itemized proposals for Case CC-2026-4101.',
      timestamp: '2h ago',
      read: false,
      targetTab: 'quotes',
    },
    {
      id: 'ntf-2',
      title: 'Exploratory video call confirmed',
      detail: 'Dr. Arvind Subramanian · Nov 16 at 09:30 GMT.',
      timestamp: '1d ago',
      read: false,
      targetTab: 'appointments',
    },
    {
      id: 'ntf-3',
      title: 'Missing administrative item flagged',
      detail: 'Upload an updated 12-lead ECG PDF before your formal virtual consultation.',
      timestamp: '2d ago',
      read: true,
      targetTab: 'records',
    },
  ];

  const referrals: ReferralCommissionRecord[] = [
    {
      id: 'ref-01',
      caseReference: 'CC-2026-4101',
      hospitalName: 'Novena Heart & Proton Medical Center (Sample)',
      partnerName: 'UK Cardiology Liaison Partner (Demo)',
      eligibleBilledUsd: 22400,
      commissionRatePct: 5,
      commissionAmountUsd: 1120,
      status: 'Pending Treatment Completion',
      termsNote: '5% referral commission applies only on eligible billed amounts after verified booking & payment per EthAum terms.',
    },
    {
      id: 'ref-02',
      caseReference: 'CC-2026-3988',
      hospitalName: 'Munich Precision Surgical Institute (Sample)',
      partnerName: 'Direct Platform Referral',
      eligibleBilledUsd: 16800,
      commissionRatePct: 5,
      commissionAmountUsd: 840,
      status: 'Projected Demo',
      termsNote: 'Sample projection — payout settlement requires connected payment gateway.',
    },
  ];

  const auditLogs: AuditLogEntry[] = [
    {
      id: 'aud-1',
      timestamp: '2026-11-11T14:35:00.000Z',
      actorEmail: 'patient@careconnect.demo',
      actorRole: 'patient',
      action: 'GRANT_DOCUMENT_CONSENT',
      resource: 'doc-901 -> hosp-sg-1',
    },
    {
      id: 'aud-2',
      timestamp: '2026-11-08T12:20:00.000Z',
      actorEmail: 'provider@careconnect.demo',
      actorRole: 'provider',
      action: 'PUBLISH_QUOTATION',
      resource: 'qt-501 (Case CC-2026-4101)',
    },
  ];

  const contactInquiries: ContactInquiry[] = [
    {
      id: 'inq-1',
      name: 'Nadia Al-Khatib',
      email: 'nadia.desk@alwasl-sample.org',
      role: 'Hospital / Provider',
      country: 'UAE',
      message: 'Interested in connecting our international patient desk to the EthAum CareConnect pilot network.',
      createdAt: '2026-11-10T10:30:00.000Z',
      status: 'Reviewed',
    },
  ];

  return {
    users,
    hospitals: HOSPITALS,
    cases,
    documents,
    quotes,
    appointments,
    messages,
    notifications,
    contactInquiries,
    referrals,
    auditLogs,
  };
}

function loadDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initial = createInitialDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    const seed = createInitialDb();
    const existingHospIds = new Set((parsed.hospitals || []).map((h) => h.id));
    const mergedHospitals = parsed.hospitals?.length
      ? [...parsed.hospitals, ...seed.hospitals.filter((h) => !existingHospIds.has(h.id))]
      : seed.hospitals;
    return {
      users: parsed.users?.length ? parsed.users : seed.users,
      hospitals: mergedHospitals,
      cases: parsed.cases?.length ? parsed.cases : seed.cases,
      documents: parsed.documents?.length ? parsed.documents : seed.documents,
      quotes: parsed.quotes?.length ? parsed.quotes : seed.quotes,
      appointments: parsed.appointments?.length ? parsed.appointments : seed.appointments,
      messages: parsed.messages?.length ? parsed.messages : seed.messages,
      notifications: parsed.notifications?.length ? parsed.notifications : seed.notifications,
      contactInquiries: parsed.contactInquiries?.length
        ? parsed.contactInquiries
        : seed.contactInquiries,
      referrals: parsed.referrals?.length ? parsed.referrals : seed.referrals,
      auditLogs: parsed.auditLogs?.length ? parsed.auditLogs : seed.auditLogs,
    };
  } catch {
    const initial = createInitialDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

function saveDb(db: DatabaseSchema) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function recordAudit(db: DatabaseSchema, user: StoredUser, action: string, resource: string) {
  db.auditLogs.unshift({
    id: `aud-${crypto.randomUUID().slice(0, 6)}`,
    timestamp: new Date().toISOString(),
    actorEmail: user.email,
    actorRole: user.role,
    action,
    resource,
  });
  if (db.auditLogs.length > 50) db.auditLogs.length = 50;
}

function computeHospitalMatches(
  hospitals: HospitalProfile[],
  params: {
    specialty?: string;
    country?: string;
    budgetUsd?: number;
    language?: string;
  },
): HospitalMatchResult[] {
  const targetSpec = (params.specialty || '').toLowerCase();
  const targetCountry = (params.country || '').toLowerCase();
  const targetLang = (params.language || 'English').toLowerCase();
  const budget = params.budgetUsd || 25000;

  return hospitals
    .map((h) => {
      const specHit =
        !targetSpec || targetSpec === 'all'
          ? 88
          : h.specialties.some((s) => s.toLowerCase().includes(targetSpec))
            ? 98
            : 52;

      const budgetRatio = h.indicativePriceUsd / Math.max(budget, 1000);
      const budgetFit =
        budgetRatio <= 0.85 ? 96 : budgetRatio <= 1.05 ? 88 : budgetRatio <= 1.25 ? 70 : 48;

      const languageMatch = h.languages.some((l) => l.toLowerCase() === targetLang) ? 98 : 65;

      const accreditationScore = h.credentialStatus === 'verified' ? 96 : 74;

      const waitScore =
        h.nextAvailabilityDays <= 4 ? 96 : h.nextAvailabilityDays <= 7 ? 88 : 76;

      const countryBonus =
        targetCountry && targetCountry !== 'all' && h.country.toLowerCase() === targetCountry
          ? 4
          : 0;

      const weighted = Math.min(
        99,
        Math.round(
          specHit * 0.34 +
            budgetFit * 0.24 +
            languageMatch * 0.16 +
            accreditationScore * 0.14 +
            waitScore * 0.12 +
            countryBonus,
        ),
      );

      const reasons: string[] = [];
      if (specHit >= 90)
        reasons.push(`publishes ${params.specialty || 'multi-specialty'} capability`);
      if (budgetFit >= 85)
        reasons.push(`indicative estimate (${h.indicativeRangeLabel}) aligns with target budget`);
      else
        reasons.push(
          `indicative estimate exceeds target budget by ${Math.round((budgetRatio - 1) * 100)}%`,
        );
      if (languageMatch >= 90)
        reasons.push(`supports ${params.language || 'English'} patient coordination`);
      reasons.push(
        h.credentialStatus === 'verified'
          ? 'sample verified format profile'
          : 'unverified sample profile',
      );

      return {
        hospital: h,
        matchScore: weighted,
        breakdown: {
          specialtyMatch: specHit,
          budgetFit,
          languageMatch,
          accreditationScore,
          availabilityScore: waitScore,
        },
        explanation: `Preference alignment (${weighted}%): ${reasons.join('; ')}. Does not indicate clinical suitability; licensed specialist review required.`,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function createApiApp() {
  let db = loadDb();
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  const getAuthUser = (req: express.Request): StoredUser | null => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload) return null;
    return db.users.find((u) => u.id === payload.userId) || null;
  };

  const requireAuth = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }
    (req as express.Request & { currentUser: StoredUser }).currentUser = user;
    next();
  };

  // Public Marketplace Catalog
  app.get('/api/public/catalog', (_req, res) => {
    db = loadDb();
    res.json({
      treatments: TREATMENTS,
      destinations: DESTINATIONS,
      hospitals: db.hospitals,
      doctors: DOCTORS,
      journeyStages: JOURNEY_STAGES,
    });
  });

  // Public Contact & Partnership Inquiry
  app.post('/api/contact', rateLimit(15, 60_000), (req, res) => {
    const { name, email, role, country, message } = req.body as Partial<ContactInquiry>;
    if (!name?.trim() || !email?.includes('@') || !message?.trim()) {
      res.status(400).json({ error: 'Name, valid email, and inquiry message are required.' });
      return;
    }
    const inquiry: ContactInquiry = {
      id: `inq-${crypto.randomUUID().slice(0, 6)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: role || 'Patient',
      country: country?.trim() || 'International',
      message: message.trim(),
      createdAt: new Date().toISOString(),
      status: 'Received',
    };
    db.contactInquiries.unshift(inquiry);
    saveDb(db);
    res.status(201).json({
      inquiry,
      message: 'Your inquiry has been logged with EthAum CareConnect Operations.',
    });
  });

  // Authentication Routes (rate limited)
  app.post('/api/auth/register', rateLimit(20, 60_000), (req, res) => {
    const {
      role,
      fullName,
      email,
      password,
      country,
      preferredLanguage,
      preferredDestination,
      treatmentInterest,
      budgetPreferenceUsd,
      organizationName,
      providerType,
      consentAccepted,
    } = req.body as {
      role: UserRole;
      fullName: string;
      email: string;
      password: string;
      country: string;
      preferredLanguage?: string;
      preferredDestination?: string;
      treatmentInterest?: string;
      budgetPreferenceUsd?: number;
      organizationName?: string;
      providerType?: string;
      consentAccepted?: boolean;
    };

    if (!fullName || !email || !password || password.length < 6) {
      res.status(400).json({ error: 'Full name, valid email, and password (min 6 chars) are required.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    if (role === 'patient' && !consentAccepted) {
      res.status(400).json({ error: 'Patient data handling consent is required.' });
      return;
    }

    const newUser: StoredUser = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      role: role === 'provider' ? 'provider' : 'patient',
      fullName: fullName.trim(),
      email: normalizedEmail,
      country: country || 'United States',
      preferredLanguage: preferredLanguage || 'English',
      preferredDestination: preferredDestination || undefined,
      treatmentInterest: treatmentInterest || undefined,
      budgetPreferenceUsd: budgetPreferenceUsd ? Number(budgetPreferenceUsd) : undefined,
      organizationName: role === 'provider' ? organizationName || 'Partner Medical Center' : undefined,
      providerType: role === 'provider' ? providerType || 'International Hospital' : undefined,
      hospitalId: role === 'provider' ? 'hosp-sg-1' : undefined,
      consentAccepted: Boolean(consentAccepted),
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(password),
    };

    db.users.push(newUser);
    recordAudit(db, newUser, 'REGISTER_ACCOUNT', `${newUser.role} (${newUser.email})`);
    saveDb(db);

    const token = signToken({
      userId: newUser.id,
      role: newUser.role,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });

    res.status(201).json({ token, user: sanitizeUser(newUser) });
  });

  app.post('/api/auth/login', rateLimit(30, 60_000), (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    recordAudit(db, user, 'LOGIN', user.role);
    saveDb(db);
    const token = signToken({
      userId: user.id,
      role: user.role,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });
    res.json({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/forgot-password', rateLimit(10, 60_000), (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    res.json({
      message:
        'If an account matches this email, password reset instructions have been queued (Demo Mode: no outbound email server configured).',
    });
  });

  // Firebase Google Sign-In Verification & Workspace Provisioning
  app.post('/api/auth/firebase-google', rateLimit(25, 60_000), async (req, res) => {
    const {
      idToken,
      role,
      country,
      preferredLanguage,
      organizationName,
      providerType,
      consentAccepted,
    } = req.body as {
      idToken?: string;
      role?: 'patient' | 'provider';
      country?: string;
      preferredLanguage?: string;
      organizationName?: string;
      providerType?: string;
      consentAccepted?: boolean;
    };

    if (!idToken) {
      res.status(400).json({ error: 'Firebase ID token is required.' });
      return;
    }

    try {
      const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      if (!fs.existsSync(cfgPath)) {
        res.status(503).json({ error: 'Firebase configuration not provisioned yet.' });
        return;
      }
      const fbCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { apiKey?: string };
      const lookupRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(fbCfg.apiKey || '')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        },
      );
      const lookupJson = (await lookupRes.json()) as {
        users?: Array<{
          localId: string;
          email?: string;
          emailVerified?: boolean;
          displayName?: string;
        }>;
      };
      const fbUser = lookupJson.users?.[0];
      if (!lookupRes.ok || !fbUser?.email) {
        res.status(401).json({ error: 'Could not verify Google Firebase session.' });
        return;
      }

      const normalizedEmail = fbUser.email.toLowerCase();
      let existing = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
      if (!existing) {
        // Admin is provisioned strictly via verified server-controlled allowlist, never client role parameter
        const assignedRole: UserRole =
          normalizedEmail === 'gargtanya290@gmail.com' && fbUser.emailVerified
            ? 'admin'
            : role === 'provider'
              ? 'provider'
              : 'patient';

        existing = {
          id: `fb-${fbUser.localId.slice(0, 16)}`,
          role: assignedRole,
          fullName: fbUser.displayName || normalizedEmail.split('@')[0],
          email: normalizedEmail,
          country: country || 'United Kingdom',
          preferredLanguage: preferredLanguage || 'English',
          organizationName:
            assignedRole === 'provider' ? organizationName || 'Partner Medical Center' : undefined,
          providerType:
            assignedRole === 'provider' ? providerType || 'International Hospital' : undefined,
          hospitalId: assignedRole === 'provider' ? 'hosp-sg-1' : undefined,
          consentAccepted: consentAccepted !== false,
          createdAt: new Date().toISOString(),
          passwordHash: hashPassword(crypto.randomBytes(24).toString('hex')),
        };
        db.users.push(existing);
        recordAudit(db, existing, 'FIREBASE_GOOGLE_REGISTER', `${existing.role} (${existing.email})`);
      } else {
        recordAudit(db, existing, 'FIREBASE_GOOGLE_LOGIN', existing.role);
      }
      saveDb(db);

      const token = signToken({
        userId: existing.id,
        role: existing.role,
        exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
      });

      res.json({ token, user: sanitizeUser(existing) });
    } catch {
      res.status(500).json({ error: 'Firebase verification service unavailable.' });
    }
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    const currentUser = (req as express.Request & { currentUser: StoredUser }).currentUser;
    res.json({ user: sanitizeUser(currentUser) });
  });

  app.patch('/api/auth/profile', requireAuth, (req, res) => {
    const user = (req as express.Request & { currentUser: StoredUser }).currentUser;
    const {
      fullName,
      country,
      preferredLanguage,
      preferredDestination,
      treatmentInterest,
      budgetPreferenceUsd,
      organizationName,
      providerType,
    } = req.body as Partial<User>;

    if (fullName && fullName.trim().length >= 2) user.fullName = fullName.trim();
    if (country && country.trim().length >= 2) user.country = country.trim();
    if (preferredLanguage && preferredLanguage.trim().length >= 2) {
      user.preferredLanguage = preferredLanguage.trim();
    }
    if (preferredDestination !== undefined) user.preferredDestination = preferredDestination;
    if (treatmentInterest !== undefined) user.treatmentInterest = treatmentInterest;
    if (budgetPreferenceUsd !== undefined && Number(budgetPreferenceUsd) > 0) {
      user.budgetPreferenceUsd = Number(budgetPreferenceUsd);
    }
    if (user.role === 'provider') {
      if (organizationName && organizationName.trim().length >= 2) {
        user.organizationName = organizationName.trim();
      }
      if (providerType) user.providerType = providerType;
    }

    recordAudit(db, user, 'UPDATE_USER_PROFILE', user.email);
    saveDb(db);
    res.json({ user: sanitizeUser(user) });
  });

  // Provider Hospital Profile & Services Update (never auto-verifies)
  app.patch('/api/provider/profile', requireAuth, (req, res) => {
    const user = (req as express.Request & { currentUser: StoredUser }).currentUser;
    if (user.role !== 'provider' && user.role !== 'admin') {
      res.status(403).json({ error: 'Provider authorization required.' });
      return;
    }
    const hosp = db.hospitals.find((h) => h.id === (user.hospitalId || 'hosp-sg-1'));
    if (!hosp) {
      res.status(404).json({ error: 'Hospital listing not found.' });
      return;
    }
    const {
      description,
      languages,
      services,
      treatments,
      facilities,
      indicativeRangeLabel,
      nextAvailabilityDays,
    } = req.body as Partial<HospitalProfile>;

    if (description && description.trim().length >= 10) hosp.description = description.trim();
    if (Array.isArray(languages) && languages.length > 0) hosp.languages = languages;
    if (Array.isArray(services) && services.length > 0) hosp.services = services;
    if (Array.isArray(treatments) && treatments.length > 0) hosp.treatments = treatments;
    if (Array.isArray(facilities) && facilities.length > 0) hosp.facilities = facilities;
    if (indicativeRangeLabel?.trim()) hosp.indicativeRangeLabel = indicativeRangeLabel.trim();
    if (nextAvailabilityDays !== undefined && Number(nextAvailabilityDays) >= 1) {
      hosp.nextAvailabilityDays = Number(nextAvailabilityDays);
    }

    recordAudit(db, user, 'UPDATE_PROVIDER_LISTING', hosp.id);
    saveDb(db);
    res.json({ hospital: hosp });
  });

  // Role-Scoped Workspace Bootstrap
  app.get('/api/bootstrap', requireAuth, (req, res) => {
    const user = (req as express.Request & { currentUser: StoredUser }).currentUser;
    db = loadDb();

    let visibleCases = db.cases;
    let visibleDocuments = db.documents;
    let visibleQuotes = db.quotes;
    let visibleAppointments = db.appointments;
    let visibleMessages = db.messages;

    if (user.role === 'patient') {
      visibleCases = db.cases.filter((c) => c.patientId === user.id);
      const caseIds = new Set(visibleCases.map((c) => c.id));
      visibleDocuments = db.documents.filter((d) => d.patientId === user.id);
      visibleQuotes = db.quotes.filter((q) => caseIds.has(q.caseId));
      visibleAppointments = db.appointments.filter((a) => a.patientId === user.id);
      visibleMessages = db.messages.filter((m) => caseIds.has(m.caseId));
    } else if (user.role === 'provider') {
      const hospId = user.hospitalId || 'hosp-sg-1';
      visibleCases = db.cases.filter((c) => c.assignedHospitalIds.includes(hospId));
      const caseIds = new Set(visibleCases.map((c) => c.id));
      visibleDocuments = db.documents.filter(
        (d) => caseIds.has(d.caseId) && d.sharedWithHospitalIds.includes(hospId) && !d.deletionRequested,
      );
      visibleQuotes = db.quotes.filter((q) => q.hospitalId === hospId);
      visibleAppointments = db.appointments.filter((a) => a.hospitalId === hospId);
      visibleMessages = db.messages.filter(
        (m) => caseIds.has(m.caseId) && (!m.recipientHospitalId || m.recipientHospitalId === hospId),
      );
    }

    res.json({
      treatments: TREATMENTS,
      destinations: DESTINATIONS,
      hospitals: db.hospitals,
      doctors: DOCTORS,
      journeyStages: JOURNEY_STAGES,
      cases: visibleCases,
      documents: visibleDocuments,
      quotes: visibleQuotes,
      appointments: visibleAppointments,
      messages: visibleMessages,
      notifications: db.notifications,
      contactInquiries: user.role === 'admin' ? db.contactInquiries : [],
      referrals: user.role === 'admin' ? db.referrals : [],
      auditLogs: user.role === 'admin' ? db.auditLogs : [],
      usersSummary:
        user.role === 'admin'
          ? db.users.map((u) => ({
              id: u.id,
              fullName: u.fullName,
              email: u.email,
              role: u.role,
              country: u.country,
              createdAt: u.createdAt,
            }))
          : undefined,
      analytics: {
        totalUsers: db.users.length + 1420,
        patientEnquiries: db.cases.length + 384,
        registeredProviders: db.hospitals.length + 28,
        activeMedicalCases: db.cases.length + 112,
        quotesSent: db.quotes.length + 246,
        bookingConversionPct: 24.8,
        quoteConversionPct: 68.4,
        cancellationRatePct: 6.2,
        avgProviderResponseHours: 6.4,
        patientSatisfactionScore: 4.86,
        monthlyEnquiries: [
          { month: 'Jun', enquiries: 42, quotes: 28, consults: 14 },
          { month: 'Jul', enquiries: 56, quotes: 39, consults: 19 },
          { month: 'Aug', enquiries: 68, quotes: 49, consults: 25 },
          { month: 'Sep', enquiries: 79, quotes: 58, consults: 31 },
          { month: 'Oct', enquiries: 94, quotes: 71, consults: 38 },
          { month: 'Nov', enquiries: 108, quotes: 84, consults: 45 },
        ],
        specialtyDistribution: [
          { specialty: 'Cardiology', sharePct: 26 },
          { specialty: 'Precision Oncology', sharePct: 23 },
          { specialty: 'Orthopedics', sharePct: 20 },
          { specialty: 'Neurology & Spine', sharePct: 11 },
          { specialty: 'Dental, Fertility & Vision', sharePct: 20 },
        ],
        leadSources: [
          { source: 'Direct Organic Search', sharePct: 44 },
          { source: 'Partner Physician Referrals', sharePct: 29 },
          { source: 'AI Case Intake Funnel', sharePct: 18 },
          { source: 'Employer / Insurer Desks', sharePct: 9 },
        ],
      },
    });
  });

  // Admin Provider Verification Toggle
  app.patch('/api/admin/providers/:id/verify', requireAuth, (req, res) => {
    const user = (req as express.Request & { currentUser: StoredUser }).currentUser;
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Admin role required.' });
      return;
    }
    const hosp = db.hospitals.find((h) => h.id === req.params.id);
    if (!hosp) {
      res.status(404).json({ error: 'Hospital not found.' });
      return;
    }
    const { status } = req.body as { status: 'verified' | 'sample' };
    hosp.credentialStatus = status;
    hosp.credentialNote =
      status === 'verified'
        ? 'Sample Demonstration Profile — Marked Verified in Demo Admin Console'
        : 'Unverified sample listing — awaiting provider verification upload';
    recordAudit(db, user, 'UPDATE_PROVIDER_VERIFICATION', `${hosp.id} -> ${status}`);
    saveDb(db);
    res.json({ hospital: hosp });
  });

  // Explainable Hospital Matching
  app.post('/api/hospitals/match', (req, res) => {
    db = loadDb();
    const matches = computeHospitalMatches(db.hospitals, req.body || {});
    res.json({ matches });
  });

  // Cases CRUD (7-Step Wizard Support)
  app.post('/api/cases', requireAuth, (req, res) => {
    const user = (req as express.Request & { currentUser: StoredUser }).currentUser;
    const {
      title,
      specialty,
      targetProcedure,
      diagnosisSummary,
      medicalHistory,
      preferredCountries,
      preferredLanguage,
      budgetUsd,
      expectedTravelWindow,
      insuranceInfo,
      urgency,
      summary,
      aiAssistedSummary,
      missingAdminDetails,
    } = req.body as Partial<MedicalCase>;

    if (!title || !specialty) {
      res.status(400).json({ error: 'Case title and specialty are required.' });
      return;
    }

    const matchedHospitals = computeHospitalMatches(db.hospitals, {
      specialty,
      country: preferredCountries?.[0],
      budgetUsd: Number(budgetUsd) || 20000,
      language: preferredLanguage || user.preferredLanguage,
    })
      .slice(0, 3)
      .map((m) => m.hospital.id);

    const caseNumber = Math.floor(4200 + Math.random() * 5700);
    const newCase: MedicalCase = {
      id: `case-${caseNumber}`,
      caseReference: `CC-2026-${caseNumber}`,
      patientId: user.id,
      patientName: user.fullName,
      patientCountry: user.country,
      title,
      specialty,
      targetProcedure: targetProcedure || specialty,
      diagnosisSummary: diagnosisSummary || 'Patient-provided summary pending specialist review.',
      medicalHistory: medicalHistory || 'Not specified',
      preferredCountries: preferredCountries?.length ? preferredCountries : ['Singapore', 'Germany'],
      preferredLanguage: preferredLanguage || user.preferredLanguage || 'English',
      budgetUsd: Number(budgetUsd) || 20000,
      expectedTravelWindow: expectedTravelWindow || 'Flexible (Next 60 days)',
      insuranceInfo: insuranceInfo || 'Self-pay',
      urgency: urgency || 'Priority (2–4 weeks)',
      summary: summary || diagnosisSummary || 'New cross-border medical evaluation request.',
      aiAssistedSummary:
        aiAssistedSummary ||
        `AI-Assisted Administrative Summary: Patient initiated ${specialty} inquiry (${targetProcedure || specialty}) targeting ${preferredCountries?.[0] || 'international centers'} in ${preferredLanguage || 'English'} (${expectedTravelWindow || 'Flexible timeline'}).`,
      missingAdminDetails: missingAdminDetails?.length
        ? missingAdminDetails
        : ['Primary diagnostic imaging PDF', 'Recent blood panel', 'Passport & travel companion count'],
      currentJourneyStage: 3,
      completedStages: [1, 2],
      providerLeadStage: 'Qualified',
      assignedHospitalIds: matchedHospitals,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.cases.unshift(newCase);
    recordAudit(db, user, 'CREATE_MEDICAL_CASE', newCase.caseReference);
    saveDb(db);
    res.status(201).json({ medicalCase: newCase });
  });

  app.patch('/api/cases/:id/journey', requireAuth, (req, res) => {
    const user = (req as express.Request & { currentUser: StoredUser }).currentUser;
    const { stage } = req.body as { stage: number };
    const targetCase = db.cases.find((c) => c.id === req.params.id);
    if (!targetCase) {
      res.status(404).json({ error: 'Medical case not found.' });
      return;
    }
    const safeStage = Math.max(1, Math.min(11, Number(stage) || 1)) as MedicalCase['currentJourneyStage'];
    targetCase.currentJourneyStage = safeStage;
    const completed: MedicalCase['completedStages'] = [];
    for (let i = 1; i < safeStage; i++) {
      completed.push(i as MedicalCase['currentJourneyStage']);
    }
    targetCase.completedStages = completed;
    targetCase.updatedAt = new Date().toISOString();
    recordAudit(db, user, 'ADVANCE_JOURNEY_STAGE', `${targetCase.caseReference} -> Stage ${safeStage}`);
    saveDb(db);
    res.json({ medicalCase: targetCase });
  });

  app.patch('/api/cases/:id', requireAuth, (req, res) => {
    const user = (req as express.Request & { currentUser: StoredUser }).currentUser;
    const targetCase = db.cases.find((c) => c.id === req.params.id);
    if (!targetCase || (user.role === 'patient' && targetCase.patientId !== user.id)) {
      res.status(404).json({ error: 'Medical case not found or unauthorized.' });
      return;
    }
    const { title, summary, budgetUsd, preferredLanguage } = req.body as Partial<MedicalCase>;
    if (title && title.trim().length >= 3) targetCase.title = title.trim();
    if (summary && summary.trim().length >= 3) targetCase.summary = summary.trim();
    if (budgetUsd !== undefined && Number(budgetUsd) > 0) targetCase.budgetUsd = Number(budgetUsd);
    if (preferredLanguage) targetCase.preferredLanguage = preferredLanguage;
    targetCase.updatedAt = new Date().toISOString();
    recordAudit(db, user, 'UPDATE_MEDICAL_CASE', targetCase.caseReference);
    saveDb(db);
    res.json({ medicalCase: targetCase });
  });

  app.patch('/api/notifications/read', requireAuth, (req, res) => {
    const { notificationId } = req.body as { notificationId?: string };
    for (const n of db.notifications) {
      if (!notificationId || n.id === notificationId) {
        n.read = true;
      }
    }
    saveDb(db);
    res.json({ notifications: db.notifications });
  });

  // Provider Lead Pipeline Update
  app.patch('/api/leads/:caseId/stage', requireAuth, (req, res) => {
    const user = (req as express.Request & { currentUser: StoredUser }).currentUser;
    if (user.role !== 'provider' && user.role !== 'admin') {
      res.status(403).json({ error: 'Provider role required to update lead pipeline.' });
      return;
    }
    const { stage } = req.body as { stage: ProviderLeadStage };
    const targetCase = db.cases.find((c) => c.id === req.params.caseId);
    if (!targetCase) {
      res.status(404).json({ error: 'Case not found.' });
      return;
    }
    targetCase.providerLeadStage = stage;
    targetCase.updatedAt = new Date().toISOString();
    recordAudit(db, user, 'UPDATE_LEAD_STAGE', `${targetCase.caseReference} -> ${stage}`);
    saveDb(db);
    res.json({ medicalCase: targetCase });
  });

  // Medical Documents Upload & Consent (with file validation)
  app.post('/api/documents', requireAuth, (req, res) => {
    const user = (req as express.Request & { currentUser: StoredUser }).currentUser;
    const { caseId, fileName, fileType, category, sizeKb, rawExcerpt, sharedWithHospitalIds } =
      req.body as Partial<MedicalDocument>;

    if (!caseId || !fileName) {
      res.status(400).json({ error: 'Case ID and file name are required.' });
      return;
    }

    if (sizeKb && sizeKb > 10240) {
      res.status(400).json({ error: 'File exceeds 10 MB protected storage limit.' });
      return;
    }

    const existingVersions = db.documents.filter(
      (d) => d.caseId === caseId && d.fileName.toLowerCase() === fileName.toLowerCase(),
    ).length;

    const doc: MedicalDocument = {
      id: `doc-${Math.floor(100 + Math.random() * 899)}`,
      caseId,
      patientId: user.id,
      fileName,
      fileType: fileType || 'PDF',
      category: category || 'Radiology / Imaging',
      version: `v1.${existingVersions}`,
      sizeKb: sizeKb || 940,
      uploadedAt: new Date().toISOString(),
      sharedWithHospitalIds: sharedWithHospitalIds || [],
      deletionRequested: false,
      aiExtractedNotes: `AI-Assisted Extraction: Categorized under ${category || 'Radiology / Imaging'} (Version v1.${existingVersions}). Protected private vault; awaiting explicit hospital consent.`,
      rawExcerpt: rawExcerpt || 'Uploaded medical document metadata verified.',
    };

    db.documents.unshift(doc);

    const targetCase = db.cases.find((c) => c.id === caseId);
    if (targetCase && targetCase.currentJourneyStage < 4) {
      targetCase.currentJourneyStage = 4;
      targetCase.completedStages = [1, 2, 3];
      targetCase.updatedAt = new Date().toISOString();
    }

    recordAudit(db, user, 'UPLOAD_MEDICAL_DOCUMENT', `${doc.fileName} (${doc.version})`);
    saveDb(db);
    res.status(201).json({ document: doc });
  });

  app.patch('/api/documents/:id/consent', requireAuth, (req, res) => {
    const user = (req as express.Request & { currentUser: StoredUser }).currentUser;
    const doc = db.documents.find((d) => d.id === req.params.id && d.patientId === user.id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found or unauthorized.' });
      return;
    }
    const { hospitalId, granted } = req.body as { hospitalId: string; granted: boolean };
    if (granted) {
      if (!doc.sharedWithHospitalIds.includes(hospitalId)) {
        doc.sharedWithHospitalIds.push(hospitalId);
      }
    } else {
      doc.sharedWithHospitalIds = doc.sharedWithHospitalIds.filter((id) => id !== hospitalId);
    }
    recordAudit(db, user, granted ? 'GRANT_CONSENT' : 'REVOKE_CONSENT', `${doc.id} -> ${hospitalId}`);
    saveDb(db);
    res.json({ document: doc });
  });

  app.post('/api/documents/:id/request-deletion', requireAuth, (req, res) => {
    const user = (req as express.Request & { currentUser: StoredUser }).currentUser;
    const doc = db.documents.find((d) => d.id === req.params.id && d.patientId === user.id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    doc.deletionRequested = true;
    doc.sharedWithHospitalIds = [];
    recordAudit(db, user, 'REQUEST_DOCUMENT_DELETION', doc.id);
    saveDb(db);
    res.json({ document: doc });
  });

  app.delete('/api/documents/:id', requireAuth, (req, res) => {
    const user = (req as express.Request & { currentUser: StoredUser }).currentUser;
    const idx = db.documents.findIndex(
      (d) => d.id === req.params.id && (d.patientId === user.id || user.role === 'admin'),
    );
    if (idx === -1) {
      res.status(404).json({ error: 'Document not found or unauthorized.' });
      return;
    }
    const [removed] = db.documents.splice(idx, 1);
    recordAudit(db, user, 'DELETE_MEDICAL_DOCUMENT', removed.fileName);
    saveDb(db);
    res.json({ deletedId: removed.id });
  });

  // Quotes Creation & Shortlist
  app.post('/api/quotes', requireAuth, (req, res) => {
    const user = (req as express.Request & { currentUser: StoredUser }).currentUser;
    if (user.role !== 'provider' && user.role !== 'admin') {
      res.status(403).json({ error: 'Provider authorization required to issue quotes.' });
      return;
    }

    const {
      caseId,
      treatmentName,
      estimatedPrice,
      currency,
      includedServices,
      excludedServices,
      medicationsIncluded,
      diagnosticsIncluded,
      accommodation,
      expectedDurationDays,
      consultationAvailability,
      validUntil,
      paymentConditions,
      cancellationTerms,
    } = req.body as Partial<TreatmentQuote>;

    if (!caseId || !treatmentName || !estimatedPrice) {
      res.status(400).json({ error: 'Case ID, treatment name, and price are required.' });
      return;
    }

    const hosp =
      db.hospitals.find((h) => h.id === (user.hospitalId || 'hosp-sg-1')) || db.hospitals[0];
    const doc = DOCTORS.find((d) => d.hospitalId === hosp.id) || DOCTORS[0];

    const newQuote: TreatmentQuote = {
      id: `qt-${Math.floor(500 + Math.random() * 499)}`,
      caseId,
      hospitalId: hosp.id,
      hospitalName: hosp.name,
      doctorId: doc.id,
      doctorName: doc.name,
      country: hosp.country,
      city: hosp.city,
      treatmentName,
      estimatedPrice: Number(estimatedPrice),
      currency: currency || 'USD',
      includedServices: includedServices?.length
        ? includedServices
        : ['Specialist & surgical team fee', 'Inpatient recovery suite', 'International desk coordination'],
      excludedServices: excludedServices?.length
        ? excludedServices
        : ['International flights & visa', 'Personal companion hotel'],
      medicationsIncluded: medicationsIncluded || 'Routine inpatient medications included',
      diagnosticsIncluded: diagnosticsIncluded || 'Pre-operative labs & standard imaging',
      accommodation: accommodation || '5 nights private hospital ward',
      expectedDurationDays: Number(expectedDurationDays) || 10,
      consultationAvailability: consultationAvailability || 'Within 72 hours',
      validUntil: validUntil || '2026-12-31',
      paymentConditions: paymentConditions || '20% refundable pre-admission deposit after video consultation',
      cancellationTerms: cancellationTerms || 'Full refund if cancelled 7+ days prior to admission',
      shortlisted: false,
      savedForComparison: false,
      status: 'Active',
      createdAt: new Date().toISOString(),
    };

    db.quotes.unshift(newQuote);

    const targetCase = db.cases.find((c) => c.id === caseId);
    if (targetCase) {
      targetCase.providerLeadStage = 'Quote Sent';
      if (targetCase.currentJourneyStage < 6) {
        targetCase.currentJourneyStage = 6;
        targetCase.completedStages = [1, 2, 3, 4, 5];
      }
      targetCase.updatedAt = new Date().toISOString();
    }

    recordAudit(db, user, 'ISSUE_TREATMENT_QUOTE', `${newQuote.id} (${newQuote.currency} ${newQuote.estimatedPrice})`);
    saveDb(db);
    res.status(201).json({ quote: newQuote });
  });

  app.patch('/api/quotes/:id', requireAuth, (req, res) => {
    const user = (req as express.Request & { currentUser: StoredUser }).currentUser;
    if (user.role !== 'provider' && user.role !== 'admin') {
      res.status(403).json({ error: 'Provider authorization required to edit quotes.' });
      return;
    }
    const quote = db.quotes.find((q) => q.id === req.params.id);
    if (!quote) {
      res.status(404).json({ error: 'Quote not found.' });
      return;
    }
    const {
      treatmentName,
      estimatedPrice,
      costType,
      currency,
      includedServices,
      excludedServices,
      medicationsIncluded,
      diagnosticsIncluded,
      accommodation,
      transportDetails,
      expectedDurationDays,
      validUntil,
      paymentConditions,
      cancellationTerms,
      providerNotes,
      status,
    } = req.body as Partial<TreatmentQuote>;

    if (treatmentName?.trim()) quote.treatmentName = treatmentName.trim();
    if (estimatedPrice !== undefined && Number(estimatedPrice) > 0) {
      quote.estimatedPrice = Number(estimatedPrice);
    }
    if (costType) quote.costType = costType;
    if (currency) quote.currency = currency;
    if (Array.isArray(includedServices) && includedServices.length > 0) {
      quote.includedServices = includedServices;
    }
    if (Array.isArray(excludedServices) && excludedServices.length > 0) {
      quote.excludedServices = excludedServices;
    }
    if (medicationsIncluded !== undefined) quote.medicationsIncluded = medicationsIncluded;
    if (diagnosticsIncluded !== undefined) quote.diagnosticsIncluded = diagnosticsIncluded;
    if (accommodation !== undefined) quote.accommodation = accommodation;
    if (transportDetails !== undefined) quote.transportDetails = transportDetails;
    if (expectedDurationDays !== undefined && Number(expectedDurationDays) > 0) {
      quote.expectedDurationDays = Number(expectedDurationDays);
    }
    if (validUntil) quote.validUntil = validUntil;
    if (paymentConditions) quote.paymentConditions = paymentConditions;
    if (cancellationTerms) quote.cancellationTerms = cancellationTerms;
    if (providerNotes !== undefined) quote.providerNotes = providerNotes;
    if (status) quote.status = status;

    db.notifications.unshift({
      id: `notif-${crypto.randomUUID().slice(0, 6)}`,
      title: `Updated Quotation: ${quote.treatmentName}`,
      detail: `${quote.hospitalName} revised proposal ${quote.id.toUpperCase()} (${quote.currency} ${quote.estimatedPrice.toLocaleString()}).`,
      timestamp: new Date().toISOString(),
      read: false,
      targetTab: 'quotes',
    });

    recordAudit(db, user, 'UPDATE_TREATMENT_QUOTE', `${quote.id} (${quote.currency} ${quote.estimatedPrice})`);
    saveDb(db);
    res.json({ quote });
  });

  app.patch('/api/quotes/:id/shortlist', requireAuth, (req, res) => {
    const quote = db.quotes.find((q) => q.id === req.params.id);
    if (!quote) {
      res.status(404).json({ error: 'Quote not found.' });
      return;
    }
    quote.shortlisted = !quote.shortlisted;
    quote.savedForComparison = quote.shortlisted;
    quote.status = quote.shortlisted ? 'Selected for Review' : 'Active';
    saveDb(db);
    res.json({ quote });
  });

  app.patch('/api/quotes/:id/save', requireAuth, (req, res) => {
    const quote = db.quotes.find((q) => q.id === req.params.id);
    if (!quote) {
      res.status(404).json({ error: 'Quote not found.' });
      return;
    }
    quote.savedForComparison = !quote.savedForComparison;
    saveDb(db);
    res.json({ quote });
  });

  // Appointments
  app.post('/api/appointments', requireAuth, (req, res) => {
    const user = (req as express.Request & { currentUser: StoredUser }).currentUser;
    const { caseId, hospitalId, doctorId, type, scheduledAtIso, timeZone, notes } =
      req.body as Partial<Appointment>;

    if (!caseId || !hospitalId || !scheduledAtIso) {
      res.status(400).json({ error: 'Case, hospital, and requested time slot are required.' });
      return;
    }

    const hosp = db.hospitals.find((h) => h.id === hospitalId) || db.hospitals[0];
    const doc = DOCTORS.find((d) => d.id === doctorId) || DOCTORS.find((d) => d.hospitalId === hosp.id) || DOCTORS[0];

    const appointment: Appointment = {
      id: `apt-${Math.floor(300 + Math.random() * 699)}`,
      caseId,
      patientId: user.id,
      patientName: user.fullName,
      hospitalId: hosp.id,
      hospitalName: hosp.name,
      doctorId: doc.id,
      doctorName: doc.name,
      type: type || 'Exploratory Virtual Call',
      scheduledAtIso,
      timeZone: timeZone || 'Europe/London (GMT)',
      status: 'Pending Provider Confirmation',
      meetingMode: 'CareConnect Encrypted Video Room (Integration-Ready)',
      notes: notes || 'Requested virtual consultation to review case summary and quote details.',
    };

    db.appointments.unshift(appointment);
    recordAudit(db, user, 'REQUEST_APPOINTMENT', `${appointment.id} -> ${hosp.name}`);
    saveDb(db);
    res.status(201).json({ appointment });
  });

  app.patch('/api/appointments/:id', requireAuth, (req, res) => {
    const apt = db.appointments.find((a) => a.id === req.params.id);
    if (!apt) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }
    const { status, scheduledAtIso } = req.body as {
      status?: Appointment['status'];
      scheduledAtIso?: string;
    };
    if (status) apt.status = status;
    if (scheduledAtIso) apt.scheduledAtIso = scheduledAtIso;
    saveDb(db);
    res.json({ appointment: apt });
  });

  // Messages
  app.post('/api/messages', requireAuth, (req, res) => {
    const user = (req as express.Request & { currentUser: StoredUser }).currentUser;
    const { caseId, body, recipientHospitalId } = req.body as {
      caseId: string;
      body: string;
      recipientHospitalId?: string;
    };
    if (!caseId || !body?.trim()) {
      res.status(400).json({ error: 'Message body is required.' });
      return;
    }
    const msg: ChatMessage = {
      id: `msg-${crypto.randomUUID().slice(0, 8)}`,
      caseId,
      senderRole: user.role === 'provider' ? 'provider' : 'patient',
      senderName: user.fullName,
      recipientHospitalId: recipientHospitalId || user.hospitalId,
      body: body.trim(),
      timestamp: new Date().toISOString(),
    };
    db.messages.push(msg);
    saveDb(db);
    res.status(201).json({ message: msg });
  });

  // AI Medical Case Assistant (Server-Side Gemini API + Transparent Demo Fallback)
  app.post('/api/ai/assistant', requireAuth, rateLimit(25, 60_000), async (req, res) => {
    const { prompt, taskType, caseContext, documentsContext } = req.body as {
      prompt: string;
      taskType?: string;
      caseContext?: Partial<MedicalCase>;
      documentsContext?: MedicalDocument[];
    };

    if (!prompt?.trim()) {
      res.status(400).json({ error: 'Prompt is required.' });
      return;
    }

    const ai = getGeminiClient();

    if (ai) {
      try {
        const systemInstruction = `You are CareConnect AI — EthAum CareConnect's non-diagnostic Healthcare Journey Coordinator.
CRITICAL SAFETY RULES:
1. You NEVER diagnose medical conditions, prescribe medications, claim to identify the best medical treatment, determine clinical suitability, or guarantee clinical outcomes.
2. Always state clearly that licensed physicians retain authority over clinical reviews.
3. For urgent/emergency symptoms (chest pain, difficulty breathing, severe bleeding), advise immediate local emergency care first.
4. Your job covers 7 workflows: (a) Case Summary organization, (b) Non-diagnostic Report Organization, (c) Doctor Questions to discuss with a clinician, (d) Treatment Journey Explanation, (e) Quote Explanation (inclusions/exclusions/validity), (f) Travel Preparation checklists, and (g) Case Completeness gap checks.
5. Keep responses structured, calm, accurate, and concise.`;

        const contextBlock = JSON.stringify({
          taskType: taskType || 'general',
          activeCase: caseContext || null,
          uploadedDocuments: (documentsContext || []).map((d) => ({
            fileName: d.fileName,
            category: d.category,
            fileType: d.fileType,
          })),
        });

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Workflow: ${taskType || 'general'}\nPatient message: "${prompt}"\n\nCurrent case & records context: ${contextBlock}`,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reply: {
                  type: Type.STRING,
                  description: 'Helpful, non-diagnostic administrative response to the patient.',
                },
                structuredSummary: {
                  type: Type.STRING,
                  description: 'AI-assisted administrative case summary ready for hospital review.',
                },
                doctorQuestions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3-4 thoughtful non-prescriptive questions the patient can ask a licensed doctor.',
                },
                missingAdminDetails: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'List of missing non-clinical or record items needed before provider review.',
                },
                recommendedAction: {
                  type: Type.STRING,
                  description: 'Clear next logistical step on CareConnect.',
                },
              },
              required: ['reply', 'structuredSummary', 'doctorQuestions', 'missingAdminDetails', 'recommendedAction'],
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '{}').trim());
        res.json({
          mode: 'gemini',
          label: 'CareConnect AI · Powered by Gemini (Non-Diagnostic)',
          disclaimer: 'Administrative coordination only — requires licensed clinician review.',
          ...parsed,
        });
        return;
      } catch (err) {
        console.warn('Gemini API fallback triggered:', err instanceof Error ? err.message : err);
      }
    }

    const lower = prompt.toLowerCase();
    const inferredSpecialty = lower.includes('heart') || lower.includes('valve') || lower.includes('cardiac')
      ? 'Cardiology'
      : lower.includes('knee') || lower.includes('hip') || lower.includes('spine')
        ? 'Orthopedics'
        : lower.includes('cancer') || lower.includes('tumor') || lower.includes('proton')
          ? 'Precision Oncology'
          : lower.includes('dental') || lower.includes('implant')
            ? 'Dental Care'
            : lower.includes('ivf') || lower.includes('fertility')
              ? 'Fertility'
              : caseContext?.specialty || 'Cardiology';

    res.json({
      mode: 'demo',
      label: 'CareConnect AI · Demo Mode (Non-Diagnostic)',
      disclaimer: 'Administrative coordination only — requires licensed clinician review.',
      reply: `I have organized your ${taskType || 'administrative'} request for a ${inferredSpecialty} pathway. Note: CareConnect AI does not diagnose, prescribe, or evaluate clinical suitability — licensed specialists at your chosen hospital will perform all clinical reviews. Below is your structured brief, suggested questions for your consultation, and missing administrative items.`,
      structuredSummary: `AI-Assisted Administrative Brief (${inferredSpecialty}): Patient requests cross-border evaluation and itemized treatment quotations. Context: "${prompt.slice(0, 160)}". Preferred language: ${caseContext?.preferredLanguage || 'English'}.`,
      doctorQuestions: [
        'Which diagnostic tests must be repeated upon arrival versus accepted from home?',
        'What is the expected inpatient versus local hotel recovery duration before flying home?',
        'How are post-discharge follow-ups coordinated with my home physician?',
      ],
      missingAdminDetails: [
        'Recent diagnostic imaging or specialist referral summary (PDF)',
        'Preferred travel window & companion count',
        'Hospital-specific document sharing consent selection',
      ],
      recommendedAction: 'Review matched hospitals and grant record consent to 2–3 shortlisted centers.',
    });
  });

  app.post('/api/ai/summarize-document', requireAuth, rateLimit(25, 60_000), async (req, res) => {
    const { fileName, category, rawExcerpt } = req.body as {
      fileName: string;
      category: string;
      rawExcerpt?: string;
    };

    const ai = getGeminiClient();
    if (ai && rawExcerpt) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Summarize the administrative metadata of this uploaded patient document without making any medical diagnosis or prescription. File: ${fileName}, Category: ${category}, Excerpt: ${rawExcerpt}`,
          config: {
            systemInstruction:
              'Output a concise 2-sentence AI-assisted administrative document summary. Never diagnose, interpret clinical severity, or prescribe.',
          },
        });
        res.json({
          mode: 'gemini',
          summary: `AI-Assisted Extraction: ${(response.text || '').trim()}`,
        });
        return;
      } catch {
        // Fall through to demo extraction
      }
    }

    res.json({
      mode: 'demo',
      summary: `AI-Assisted Extraction (Demo Mode): Indexed "${fileName}" under ${category}. Ready for patient-consented sharing with international provider intake teams.`,
    });
  });

  return app;
}

async function startServer() {
  const app = createApiApp();

  // Vite dev middleware or static production build
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EthAum CareConnect running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
