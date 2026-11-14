import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { Appointment, ChatMessage, MedicalCase, MedicalDocument, User } from '../types';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined') {
  void testConnection();
}

export function subscribeFirebaseAuth(cb: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogleFirebase(): Promise<{
  idToken: string;
  firebaseUser: FirebaseUser;
}> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  const idToken = await cred.user.getIdToken();
  return { idToken, firebaseUser: cred.user };
}

export async function signOutFirebase() {
  if (auth.currentUser) {
    await signOut(auth);
  }
}

function safeId(value: string, fallback: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || fallback;
}

export async function syncUserProfileToFirestore(user: User) {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const uid = safeId(fbUser.uid, 'user');
  const publicPath = `users/${uid}/public/profile`;
  const privatePath = `users/${uid}/private/info`;

  try {
    await setDoc(
      doc(db, 'users', uid, 'public', 'profile'),
      {
        uid,
        displayName: user.fullName.slice(0, 120) || 'CareConnect Member',
        role: user.role === 'provider' ? 'provider' : 'patient',
        preferredLanguage: (user.preferredLanguage || 'English').slice(0, 40),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, publicPath);
  }

  try {
    await setDoc(
      doc(db, 'users', uid, 'private', 'info'),
      {
        uid,
        email: (fbUser.email || user.email).slice(0, 180),
        country: (user.country || 'United Kingdom').slice(0, 80),
        ...(user.organizationName
          ? { organizationName: user.organizationName.slice(0, 160) }
          : {}),
        ...(user.hospitalId ? { hospitalId: safeId(user.hospitalId, 'hosp-sg-1') } : {}),
        consentAccepted: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

export async function syncMedicalCaseToFirestore(mc: MedicalCase) {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const uid = safeId(fbUser.uid, 'user');
  const caseId = safeId(mc.id, 'case_item');
  const path = `medicalCases/${caseId}`;

  try {
    await setDoc(doc(db, 'medicalCases', caseId), {
      id: caseId,
      caseReference: mc.caseReference.slice(0, 32),
      patientId: uid,
      title: mc.title.slice(0, 180),
      specialty: mc.specialty.slice(0, 80),
      targetProcedure: (mc.targetProcedure || mc.specialty).slice(0, 140),
      preferredLanguage: (mc.preferredLanguage || 'English').slice(0, 40),
      budgetUsd: Math.min(1000000, Math.max(0, Number(mc.budgetUsd) || 0)),
      status: 'Submitted',
      currentJourneyStage: Math.min(14, Math.max(1, Number(mc.currentJourneyStage) || 1)),
      summary: (mc.summary || 'Cross-border medical case intake.').slice(0, 2000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateMedicalCaseInFirestore(
  caseIdRaw: string,
  patch: { title?: string; summary?: string; budgetUsd?: number; preferredLanguage?: string },
) {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;
  const caseId = safeId(caseIdRaw, 'case_item');
  const path = `medicalCases/${caseId}`;
  try {
    await updateDoc(doc(db, 'medicalCases', caseId), {
      ...(patch.title ? { title: patch.title.slice(0, 180) } : {}),
      ...(patch.summary ? { summary: patch.summary.slice(0, 2000) } : {}),
      ...(patch.budgetUsd !== undefined
        ? { budgetUsd: Math.min(1000000, Math.max(0, Number(patch.budgetUsd))) }
        : {}),
      ...(patch.preferredLanguage
        ? { preferredLanguage: patch.preferredLanguage.slice(0, 40) }
        : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncDocumentMetaToFirestore(docMeta: MedicalDocument) {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const uid = safeId(fbUser.uid, 'user');
  const docId = safeId(docMeta.id, 'doc_item');
  const caseId = safeId(docMeta.caseId, 'case_item');
  const path = `documents/${docId}`;

  try {
    await setDoc(doc(db, 'documents', docId), {
      id: docId,
      caseId,
      patientId: uid,
      fileName: docMeta.fileName.slice(0, 180),
      fileType: docMeta.fileType.slice(0, 40),
      category: docMeta.category.slice(0, 60),
      version: (docMeta.version || 'v1.0').slice(0, 20),
      sizeKb: Math.min(10240, Math.max(1, Number(docMeta.sizeKb) || 100)),
      deletionRequested: Boolean(docMeta.deletionRequested),
      uploadedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncDocumentConsentToFirestore(
  docIdRaw: string,
  hospitalIdRaw: string,
  granted: boolean,
) {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const docId = safeId(docIdRaw, 'doc_item');
  const hospitalId = safeId(hospitalIdRaw, 'hosp_item');
  const path = `documents/${docId}/consents/${hospitalId}`;

  try {
    await setDoc(doc(db, 'documents', docId, 'consents', hospitalId), {
      hospitalId,
      granted,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncAppointmentToFirestore(apt: Appointment) {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const uid = safeId(fbUser.uid, 'user');
  const aptId = safeId(apt.id, 'apt_item');
  const caseId = safeId(apt.caseId, 'case_item');
  const hospitalId = safeId(apt.hospitalId, 'hosp_sg_1');
  const path = `appointments/${aptId}`;

  try {
    await setDoc(doc(db, 'appointments', aptId), {
      id: aptId,
      caseId,
      patientId: uid,
      hospitalId,
      type: apt.type.slice(0, 80),
      scheduledAtIso: apt.scheduledAtIso.slice(0, 64),
      timeZone: apt.timeZone.slice(0, 64),
      status: apt.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncMessageToFirestore(msg: ChatMessage) {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const uid = safeId(fbUser.uid, 'user');
  const caseId = safeId(msg.caseId, 'case_item');
  const msgId = safeId(msg.id, 'msg_item');
  const path = `medicalCases/${caseId}/messages/${msgId}`;

  try {
    await setDoc(doc(db, 'medicalCases', caseId, 'messages', msgId), {
      id: msgId,
      caseId,
      senderUid: uid,
      senderRole: msg.senderRole,
      body: msg.body.slice(0, 2000),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
