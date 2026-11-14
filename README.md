<div align="center">

# 🌐 EthAum CareConnect — Healthcare Without Borders
### AI-Powered Next-Gen Cross-Border Medical Tourism & Care Coordination Platform

[![Live Demo](https://img.shields.io/badge/Demo-Live%20on%20Vercel-38DDF5?style=for-the-badge&logo=vercel)](https://eth-aum-care-connect-ai-powered-med.vercel.app)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL_3D-black?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-AI_Powered-8E75C4?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini/)

**Hackathon Submission**: EthAum Venture Partners — Building Medical Tourism Platform  
**Developer**: Tanya Garg · **Team**: Krackcode (Individual Participation)

[Explore Live Demo](https://eth-aum-care-connect-ai-powered-med.vercel.app) · [Report Bug](https://github.com/Tanya-garg10/EthAum-CareConnect-AI-Powered-Medical-Tourism-Platform/issues) · [Request Feature](https://github.com/Tanya-garg10/EthAum-CareConnect-AI-Powered-Medical-Tourism-Platform/issues)

</div>

---

## 📌 Table of Contents
- [Problem Statement](#-problem-statement)
- [Solution Overview](#-solution-overview)
- [Key Architectural Highlights & Features](#-key-architectural-highlights--features)
  - [1. Interactive 3D Medical Globe](#1-interactive-3d-medical-globe-globehero3d)
  - [2. Multi-Role Workspaces](#2-multi-role-workspaces)
  - [3. AI Intelligence Suite](#3-ai-intelligence-suite)
  - [4. Explainable Hospital Matchmaking](#4-explainable-hospital-matchmaking)
  - [5. Transparent Quotation Comparison](#5-transparent-quotation-comparison)
  - [6. Granular Patient Data Sovereignty](#6-granular-patient-data-sovereignty)
- [Demo Credentials](#-demo-credentials-seeded-for-evaluation)
- [Tech Stack & Architecture](#-tech-stack--architecture)
- [Project Directory Structure](#-project-directory-structure)
- [Local Setup & Development](#-local-setup--development)
- [Deployment Guide](#-deployment-guide)
- [Business & Monetization Model](#-business--monetization-model)
- [Security & Compliance](#-security--compliance)

---

## 🚨 Problem Statement

Patients pursuing specialized cross-border healthcare face critical friction points:
- **Opaque Pricing & Hidden Costs**: Hospital packages vary widely with unpredictable add-on fees.
- **Fragmented Directories**: Difficult to verify medical accreditations (JCI, NABH, ISO) and surgeon credentials across borders.
- **Unstructured Records**: Medical histories, DICOM imaging, and pathology reports scattered across PDFs, emails, and messaging apps.
- **Coordination Breakdown**: Language barriers, time-zone disconnects, and unorganized intake packages slow down international patient desks.

---

## 💡 Solution Overview

**EthAum CareConnect** bridges global patients and accredited international medical centers via a unified, AI-orchestrated ecosystem:
- **Explainable Discovery**: Match based on budget, clinical specialty, accreditation, and wait times.
- **AI-Assisted Intake**: Non-diagnostic intake synthesis, document indexing, and missing paperwork detection powered by Google Gemini.
- **Patient Sovereignty**: Explicit, revocable per-hospital document sharing consent.
- **Transparent Comparison**: Granular side-by-side package analysis (inclusions, exclusions, stay lengths, cancellations).
- **End-to-End Tracking**: A structured 14-stage journey from inquiry to post-op international aftercare.

---

## 🌟 Key Architectural Highlights & Features

### 1. Interactive 3D Medical Globe (`GlobeHero3D`)
- Pure **Three.js** & **@react-three/fiber** WebGL Earth with custom procedural shaders.
- Atmospheric Fresnel glow shell, rotating orbital hologram telemetry rings, and particle starfields.
- **6 Active International Medical Corridors**: Singapore, New Delhi, Munich, Bangkok, Istanbul, Dubai.
- Dynamic camera glide animation upon hub selection, interactive click proxies, and responsive 2D SVG fallback.

### 2. Multi-Role Workspaces

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EthAum CareConnect                              │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
 👤 Patient Portal           🏥 Provider Desk            🛡️ Admin Console
 • 7-Step Case Intake        • 10-Stage Lead Pipeline    • Platform KPIs & Metrics
 • Multi-Factor Matching     • Consent-Gated Records     • Provider Verification
 • Side-by-Side Quotes       • Itemized Quote Builder    • 5% Commission Ledger
 • Granular Document Vault   • Direct Messaging          • Security Audit Logs
 • 14-Stage Journey Tracker  • Video Consult Desk        • Dispute & Inquiry Center
```

### 3. AI Intelligence Suite
- **Intake Assistant**: Structures patient narrative into non-diagnostic clinical summaries with missing item alerts.
- **Document Metadata Extraction**: Automated indexing of radiology, pathology, and cardiology records.
- **Consultation Prep**: Generates high-yield questions for patients to ask their overseas surgeons.
- **Zero-Crash Resilience**: Automatic fallback to structured offline synthesis if external API quotas are unavailable.

### 4. Explainable Hospital Matchmaking
Transparent multi-weighted mathematical ranking formula:
$$\text{Match Score} = (0.34 \times \text{Specialty}) + (0.24 \times \text{Budget Fit}) + (0.16 \times \text{Language}) + (0.14 \times \text{Accreditation}) + (0.12 \times \text{Availability})$$
Every score displays a human-readable justification breaking down exactly why a hospital is recommended.

### 5. Transparent Quotation Comparison
- Compare up to 4 hospital quotations side-by-side.
- Granular breakdown: Surgery, Inpatient Room Tier, ICU Days, Diagnostics, Airport Transfers, Anticoagulant/Meds inclusions, and Cancellation/Escrow Terms.

### 6. Granular Patient Data Sovereignty
- Patients maintain complete ownership of their health data.
- Records are hidden by default; sharing requires explicit per-hospital consent toggles.
- Instant consent revocation and audit-logged deletion requests.

---

## 🔑 Demo Credentials (Seeded for Evaluation)

Explore any role instantly without creating a new account:

| Portal | Role | Email | Password | Access Highlights |
| :--- | :--- | :--- | :--- | :--- |
| **Patient Portal** | Patient | `patient@careconnect.demo` | `CareDemo2026!` | Active Case `CC-2026-4101`, Quote Comparison, Document Vault |
| **Provider Desk** | Hospital Desk | `provider@careconnect.demo` | `CareDemo2026!` | Novena Heart Center, Lead Kanban, Quote Publishing |
| **Admin Console** | Platform Ops | `admin@careconnect.demo` | `CareDemo2026!` | Referral Ledger, Verification Queue, Audit Trail |

---

## 🛠️ Tech Stack & Architecture

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Motion, Lucide Icons |
| **3D Graphics** | Three.js, @react-three/fiber, @react-three/drei, GLSL Shaders |
| **Backend API** | Express.js, Node.js, Vercel Serverless Functions |
| **Security & Auth** | PBKDF2/scrypt Salted Hashes, Timing-Safe HMAC-SHA256 Tokens, Rate Limiting |
| **AI Engine** | Google Gemini (`@google/genai`) with offline administrative fallback |
| **Persistence** | File-backed JSON schema store with audit trails + Cloud Firestore schema blueprint |
| **Deployment** | Vercel (CI/CD Automated Deployments) |

---

## 📂 Project Directory Structure

```text
careconnect/
├── api/
│   └── index.ts                     # Vercel Serverless entry point
├── public/
│   └── images/                      # Optimized medical center & procedure assets
├── src/
│   ├── components/
│   │   ├── AdminDashboard.tsx       # Platform governance, audit log, referral ledger
│   │   ├── AiIntelligenceVisual.tsx # 5-Node AI orchestration architectural graphic
│   │   ├── AuthPortal.tsx           # Split-screen role authentication & onboarding
│   │   ├── CaseCreationWizard.tsx   # 7-Step cross-border medical intake wizard
│   │   ├── GlobeHero3D.tsx          # Pure Three.js WebGL globe & orbital corridors
│   │   ├── LandingPage.tsx          # Public marketing page, treatment catalog & FAQ
│   │   ├── PatientDashboard.tsx     # 11-module patient journey & quotes workspace
│   │   └── ProviderDashboard.tsx    # 10-stage hospital lead pipeline & quote builder
│   ├── data/
│   │   └── seedData.ts              # Accredited hospitals, procedures & sample records
│   ├── lib/
│   │   └── firebase.ts              # Firebase client SDK & Firestore sync bridge
│   ├── types.ts                     # Strict TypeScript interfaces across all domain entities
│   ├── App.tsx                      # Root role-based routing orchestrator
│   └── main.tsx                     # React 19 application mount
├── server.ts                        # Express REST API, auth middleware & AI proxies
├── vercel.json                      # Vercel serverless routing & build rewrites
├── package.json                     # Project manifest & dependency configuration
└── vite.config.ts                   # Vite bundler & Tailwind v4 setup
```

---

## 💻 Local Setup & Development

### Prerequisites
- Node.js ≥ 20.x or [Bun](https://bun.sh/)
- Git

### 1. Clone the repository
```bash
git clone https://github.com/Tanya-garg10/EthAum-CareConnect-AI-Powered-Medical-Tourism-Platform.git
cd EthAum-CareConnect-AI-Powered-Medical-Tourism-Platform
```

### 2. Install dependencies
```bash
npm install
# or
bun install
```

### 3. Configure environment variables (Optional)
Create a `.env` file in the root directory:
```env
PORT=3000
SESSION_SECRET=your-custom-hmac-secret-key
GEMINI_API_KEY=your-gemini-api-key # Optional: activates live Gemini responses
```

### 4. Start development server
```bash
npm run dev
# or
bun run dev
```
Visit `http://localhost:3000` in your browser.

---

## 🚀 Deployment Guide

### Deploying to Vercel (One-Click)

This project is pre-configured with [vercel.json](file:///c:/Users/arpan/Downloads/careconnect/vercel.json) to deploy both the static React frontend and Express serverless API routes seamlessly.

1. Push your code to GitHub.
2. Import the repository into **[Vercel](https://vercel.com/)**.
3. Set Framework Preset to **Vite**.
4. Set Build Command to: `npm run build`
5. Set Output Directory to: `dist`
6. Click **Deploy**.

---

## 💰 Business & Monetization Model

EthAum CareConnect operates on a strictly neutral, outcome-aligned marketplace framework:

- **5% Referral Commission Ledger**: Transparent success fee applied solely to verified, completed international procedures.
- **Zero Pay-to-Rank Bias**: Hospital match scores are calculated purely on objective patient criteria (specialty, budget, language, accreditation)—never influenced by sponsorship or ad spend.
- **Direct Hospital SaaS Tiers**: Optional premium coordinator workflow tools and tele-health consultation suite subscriptions for international hospital desks.

---

## 🛡️ Security & Compliance

- **Rate Limiting**: Built-in IP rate limiters on sensitive endpoints (`/api/auth/*`, `/api/contact`, `/api/ai/*`).
- **Timing-Safe Auth**: Constant-time HMAC comparison prevents timing attacks.
- **Cryptographic Hashing**: Scrypt key derivation with per-user unique random salts.
- **Non-Diagnostic AI Guardrails**: Strict administrative prompt framing preventing automated medical advice or diagnosis.

---

<div align="center">

Made with ❤️ for the **EthAum Venture Partners Hackathon**  
*Empowering patients worldwide with transparent, accessible, and dignified healthcare.*

</div>
