# EthAum CareConnect — Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: All unmatched Firestore paths are explicitly denied.
2. **PII Isolation**: User email, country, and consent timestamps reside in `/users/{userId}/private/info` and are strictly restricted to `isOwner(userId)` or `isAdmin()`.
3. **Zero Client Role Escalation**: Users can only register `role` as `'patient'` or `'provider'` in `/users/{userId}/public/profile`. Admin privileges come exclusively from `/admins/{uid}` or bootstrapped verified admin email (`gargtanya290@gmail.com` with `email_verified == true`).
4. **Master Gate Enforcement**: Subcollections (`/medicalCases/{caseId}/messages/{messageId}`, `/medicalCases/{caseId}/journeyEvents/{eventId}`, `/documents/{documentId}/consents/{hospitalId}`) verify parent document ownership via `get()` before granting read/write access.
5. **Terminal State Lock**: Once a `MedicalCase.status == 'Closed'`, only an admin can modify it; patients cannot alter closed cases.
6. **Immutability & Strict Timestamps**: `createdAt` and `patientId` cannot be changed after document creation. Timestamps must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)
1. **Self-Admin Promotion on Create**: Write `{ role: 'admin' }` to `/users/{uid}/public/profile` -> Rejected by enum check `in ['patient', 'provider']`.
2. **Shadow Field Injection**: Create a `MedicalCase` with extra key `{ isVerified: true }` -> Rejected by `hasOnly(...)`.
3. **Cross-Patient Case Read**: Authenticated Patient A requests `/medicalCases/{caseBelongingToPatientB}` -> Rejected (`patientId != request.auth.uid`).
4. **ID Poisoning**: Write to `/medicalCases/${'a'.repeat(500)}` -> Rejected by `isValidId(caseId)` (`size() <= 128`).
5. **Timestamp Forgery**: Create `MedicalCase` with backdated `createdAt` (`!= request.time`) -> Rejected by `incoming().createdAt == request.time`.
6. **Owner Hijack on Update**: Patient updates `patientId` on their own `MedicalCase` -> Rejected (`incoming().patientId == existing().patientId`).
7. **PII Blanket Read**: Signed-in non-owner queries `/users/{otherUid}/private/info` -> Rejected (`isOwner` / `isAdmin` gate).
8. **Unverified Email Admin Spoof**: Token with `email == 'gargtanya290@gmail.com'` and `email_verified == false` tries admin action -> Rejected (`email_verified == true` mandated).
9. **Oversized Document Metadata**: Create `MedicalDocument` with `sizeKb: 50000` (> 10240 KB) or 20KB `summary` -> Rejected by volumetric bounds.
10. **Orphaned Message Injection**: Write message to `/medicalCases/nonexistent/messages/m1` -> Rejected by `exists()` parent lookup.
11. **Terminal Case Mutation**: Patient modifies `MedicalCase` whose `existing().status == 'Closed'` -> Rejected by terminal lock.
12. **Audit Log Tampering**: Non-admin tries to delete or update `/auditLogs/{logId}` -> Rejected (`allow update, delete: if false`).
