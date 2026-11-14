# EthAum CareConnect — Healthcare Without Borders

**AI-Powered International Medical Tourism Marketplace**  
**Hackathon Submission**: EthAum Venture Partners — Building Medical Tourism Platform  
**Developer**: Tanya Garg · **Team**: Krackcode (Individual Participation)

---

## 1. Problem Statement

Patients seeking cross-border specialized procedures face fragmented hospital directories, opaque package pricing, unverified clinic claims, unstructured medical records scattered across formats, and disconnected communication with international hospital coordinators. Meanwhile, partner hospitals receive incomplete patient enquiries lacking structured history or pre-screening readiness.

## 2. Solution Overview

**EthAum CareConnect** unifies global healthcare discovery, AI-assisted non-diagnostic intake organization, explainable hospital matching, patient-controlled document consent, transparent side-by-side quotation comparison, virtual consultation scheduling, and a 14-stage patient journey tracker into one cohesive full-stack web platform.

## 3. Core Features

- **Interactive 3D Global Healthcare Network (`GlobeHero3D`)**: Pure Three.js WebGL medical globe with procedural Earth cartography, atmospheric Fresnel shell, orbital hologram rings, clickable destination markers across 6 medical corridors (Singapore, India, Germany, Turkey, UAE, Thailand), animated Bezier network packets, software-WebGL frame pacing, and 2D SVG fallback.
- **Role-Based Authentication (`AuthPortal`)**: Split-screen authentication supporting **Patient**, **Healthcare Provider**, and **Admin** roles with `scrypt` salted password hashing and HMAC-SHA256 bearer tokens.
- **11-Module Patient Workspace (`PatientDashboard`)**:
  - **7-Step Medical Case Creation Wizard**: Structured intake generating unique `CC-2026-XXXX` case references.
  - **AI Case Assistant**: Server-side `@google/genai` (`gemini-4-hydrogen`) integration for non-diagnostic administrative intake, document indexing, and missing paperwork detection (with automatic Demo Mode fallback).
  - **Smart Hospital Discovery**: Explainable multi-factor logistical matching across specialty, budget fit, language, accreditation, and wait time.
  - **Doctor Directory**: Searchable specialist profiles clearly distinguishing verified registry records from sample listings.
  - **Side-by-Side Quotation Comparison**: Neutral comparison across estimated price, included/excluded services, medications, diagnostics, accommodation, duration, validity, payment conditions, cancellation terms, and saved comparisons.
  - **Medical Records & Granular Consent**: File validation (max 10 MB), document versioning (`v1.0`, `v1.1`), preview modal, per-hospital sharing toggles, and deletion requests.
  - **Appointments, Coordinator Messages & 14-Stage Journey Tracker**.
- **Provider Portal (`ProviderDashboard`)**:
  - **10-Stage Lead Pipeline** (`New` → `Qualified` → `Medical Review` → `Quote Requested` → `Quote Sent` → `Consultation` → `Booked` → `Treatment` → `Aftercare` → `Closed`).
  - **Consent-Gated Patient Records**: Providers only see records explicitly shared with their hospital.
  - **Itemized Quotation Builder**: Publishes transparent quotes directly into patient comparison tables.
- **Admin Operations Console (`AdminDashboard`)**:
  - Platform overview metrics, patient directory, provider verification queue, cases & enquiries, **5% Referral Commission Ledger**, marketplace analytics funnel, and security audit log.

## 4. Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Three.js, Motion, Lucide React
- **Authentication & Database**: Firebase Authentication (Google Sign-In via `signInWithPopup`), Cloud Firestore (`firebase-blueprint.json` + ESLint-audited `firestore.rules`), plus Express `scrypt` + HMAC session tokens & local `.data/careconnect-db.json` demo persistence
- **Backend**: Node.js, Express, `tsx`, rate limiting, Identity Toolkit token verification
- **AI Integration**: `@google/genai` (`gemini-4-hydrogen`) via server-side `/api/ai/*` routes

## 5. Project Structure

```text
├── firebase-applet-config.json     # Provisioned Firebase Web & Firestore config
├── firebase-blueprint.json         # Strict Firestore entity & path Intermediate Representation
├── firestore.rules                 # Hardened ABAC / RBAC Firestore security rules
├── eslint.config.mjs               # @firebase/eslint-plugin-security-rules audit config
├── server.ts                       # Express API, auth, rate limiting, Gemini proxy & persistence
├── src/
│   ├── App.tsx                     # Role-based router (Landing, Auth, Patient, Provider, Admin)
│   ├── lib/firebase.ts             # Firebase App, Auth, Firestore connection probe & sync helpers
│   ├── types.ts                    # Shared TypeScript interfaces
│   ├── data/seedData.ts            # 10 treatments, 6 destinations, 8 sample hospitals, 6 doctors
│   └── components/
│       ├── LandingPage.tsx         # 3D Hero, Treatment Explorer, Destinations, 8-Step Flow, FAQ
│       ├── GlobeHero3D.tsx         # Pure Three.js WebGL interactive globe + SVG fallback
│       ├── AiIntelligenceVisual.tsx# 5-node AI architectural flow diagram
│       ├── AuthPortal.tsx          # Split-screen Google Firebase Auth, Sign In & Register
│       ├── CaseCreationWizard.tsx  # 7-step cross-border medical case wizard
│       ├── PatientDashboard.tsx    # 11-module patient workspace
│       ├── ProviderDashboard.tsx   # 9-module hospital provider desk
│       └── AdminDashboard.tsx      # 7-tab admin analytics, verification & referral ledger
```

## 6. Firebase & Local Setup

```bash
npm install
npm run dev
```

For production build & start:

```bash
npm run build
npm start
```

Audit Firestore security rules with:

```bash
npx eslint firestore.rules
```

Optional environment secrets (`.env`):
- `GEMINI_API_KEY`: Enables live Gemini responses on `/api/ai/*` (falls back to Demo Mode automatically when absent).
- `SESSION_SECRET`: Signing key for HMAC session tokens.

## 7. Demo Credentials (Seeded Environment)

- **Patient Portal**: `patient@careconnect.demo` / `CareDemo2026!`
- **Provider Portal**: `provider@careconnect.demo` / `CareDemo2026!`
- **Admin Console**: `admin@careconnect.demo` / `CareDemo2026!`

## 8. Business Model & Referral Commission

EthAum CareConnect operates on a transparent marketplace model featuring an integration-ready **5% Referral Commission Ledger** applied solely to eligible billed amounts upon verified treatment booking and completion—never altering patient quote rankings or clinical comparisons.

## 9. Security, Privacy & Clinical Safety Boundaries

- **Non-Diagnostic AI**: CareConnect AI organizes administrative records and missing paperwork only; it never diagnoses, prescribes, or replaces licensed doctors.
- **Granular Patient Consent**: Medical documents remain private by default and are exposed only to hospitals explicitly consented by the patient.
- **Transparent Sample Labelling**: Demonstration hospitals, doctors, quotes, and analytics figures are clearly marked as sample/fictional data.

## 10. Future Roadmap

- Live FHIR / HL7 hospital EHR connectors and DICOM viewer integration
- Escrow-backed multi-currency milestone payments and travel visa API integrations
- Verified clinical credential registry webhooks (JCI / NABH / TEMOS live sync)
