import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  MoveRecord,
  InventoryItem,
  PaymentEntry,
  OperationalExpense,
} from '../types.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

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
  path: string | null
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

export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged, type User };

export async function fetchUserCloudData(uid: string): Promise<{
  moves: MoveRecord[];
  expenses: OperationalExpense[];
}> {
  const movesPath = 'moves';
  let moveDocs;
  try {
    const movesQ = query(collection(db, movesPath), where('ownerId', '==', uid));
    moveDocs = await getDocs(movesQ);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, movesPath);
  }

  const moves: MoveRecord[] = [];
  for (const mDoc of moveDocs.docs) {
    const data = mDoc.data();
    const moveId = mDoc.id;

    const invPath = `moves/${moveId}/inventory`;
    let invSnap;
    try {
      const invQ = query(collection(db, invPath), where('ownerId', '==', uid));
      invSnap = await getDocs(invQ);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, invPath);
    }

    const inventory: InventoryItem[] = invSnap.docs.map((d) => {
      const idata = d.data();
      return {
        id: d.id,
        ownerId: String(idata.ownerId),
        moveId: String(idata.moveId),
        name: String(idata.name),
        category: idata.category,
        quantity: Number(idata.quantity),
        volumeM3: Number(idata.volumeM3),
        weightKg: Number(idata.weightKg),
        isFragile: Boolean(idata.isFragile),
        conditionNotes: String(idata.conditionNotes || ''),
        hasDamage: Boolean(idata.hasDamage),
        damageNotes: String(idata.damageNotes || ''),
        evidencePhotoDataUrl: String(idata.evidencePhotoDataUrl || ''),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    const payPath = `moves/${moveId}/payments`;
    let paySnap;
    try {
      const payQ = query(collection(db, payPath), where('ownerId', '==', uid));
      paySnap = await getDocs(payQ);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, payPath);
    }

    const payments: PaymentEntry[] = paySnap.docs.map((d) => {
      const pdata = d.data();
      return {
        id: d.id,
        ownerId: String(pdata.ownerId),
        moveId: String(pdata.moveId),
        amount: Number(pdata.amount),
        date: String(pdata.date),
        method: pdata.method,
        concept: String(pdata.concept),
        reference: String(pdata.reference || ''),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    moves.push({
      id: moveId,
      ownerId: String(data.ownerId),
      folio: String(data.folio),
      clientName: String(data.clientName),
      clientPhone: String(data.clientPhone),
      clientEmail: String(data.clientEmail || ''),
      originCity: String(data.originCity),
      destinationCity: String(data.destinationCity),
      moveDate: String(data.moveDate),
      status: data.status,
      truckUnit: String(data.truckUnit),
      distanceKm: Number(data.distanceKm),
      totalContractAmount: Number(data.totalContractAmount),
      amountPaid: Number(data.amountPaid),
      notes: String(data.notes || ''),
      inventory,
      payments,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const expPath = 'expenses';
  let expDocs;
  try {
    const expQ = query(collection(db, expPath), where('ownerId', '==', uid));
    expDocs = await getDocs(expQ);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, expPath);
  }

  const expenses: OperationalExpense[] = expDocs.docs.map((d) => {
    const edata = d.data();
    return {
      id: d.id,
      ownerId: String(edata.ownerId),
      moveId: String(edata.moveId || ''),
      category: edata.category,
      description: String(edata.description),
      amount: Number(edata.amount),
      date: String(edata.date),
      routeLabel: String(edata.routeLabel || ''),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  return { moves, expenses };
}

export async function saveMoveToFirestore(uid: string, move: MoveRecord): Promise<void> {
  const movePath = `moves/${move.id}`;
  try {
    await setDoc(doc(db, 'moves', move.id), {
      ownerId: uid,
      folio: move.folio.slice(0, 40),
      clientName: move.clientName.slice(0, 120),
      clientPhone: move.clientPhone.slice(0, 40),
      clientEmail: (move.clientEmail || '').slice(0, 120),
      originCity: move.originCity.slice(0, 100),
      destinationCity: move.destinationCity.slice(0, 100),
      moveDate: move.moveDate.slice(0, 30),
      status: move.status,
      truckUnit: move.truckUnit.slice(0, 60),
      distanceKm: Math.min(25000, Math.max(0, Number(move.distanceKm) || 0)),
      totalContractAmount: Math.min(2000000000, Math.max(0, Number(move.totalContractAmount) || 0)),
      amountPaid: Math.min(
        Number(move.totalContractAmount) || 0,
        Math.max(0, Number(move.amountPaid) || 0)
      ),
      notes: (move.notes || '').slice(0, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, movePath);
  }

  for (const item of move.inventory) {
    await saveInventoryItemToFirestore(uid, move.id, item);
  }
  for (const pay of move.payments) {
    await savePaymentToFirestore(uid, move.id, pay);
  }
}

export async function deleteMoveFromFirestore(moveId: string): Promise<void> {
  const movePath = `moves/${moveId}`;
  try {
    await deleteDoc(doc(db, 'moves', moveId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, movePath);
  }
}

export async function updateMoveBalanceInFirestore(
  moveId: string,
  amountPaid: number,
  status: MoveRecord['status']
): Promise<void> {
  const path = `moves/${moveId}`;
  try {
    await updateDoc(doc(db, 'moves', moveId), {
      amountPaid,
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveInventoryItemToFirestore(
  uid: string,
  moveId: string,
  item: InventoryItem
): Promise<void> {
  const path = `moves/${moveId}/inventory/${item.id}`;
  try {
    await setDoc(doc(db, 'moves', moveId, 'inventory', item.id), {
      ownerId: uid,
      moveId,
      name: item.name.slice(0, 120),
      category: item.category,
      quantity: Math.min(10000, Math.max(1, Number(item.quantity) || 1)),
      volumeM3: Math.min(1000, Math.max(0, Number(item.volumeM3) || 0)),
      weightKg: Math.min(50000, Math.max(0, Number(item.weightKg) || 0)),
      isFragile: Boolean(item.isFragile),
      conditionNotes: (item.conditionNotes || '').slice(0, 250),
      hasDamage: Boolean(item.hasDamage),
      damageNotes: (item.damageNotes || '').slice(0, 300),
      evidencePhotoDataUrl: (item.evidencePhotoDataUrl || '').slice(0, 65000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateInventoryItemDamageInFirestore(
  moveId: string,
  itemId: string,
  payload: {
    hasDamage: boolean;
    damageNotes: string;
    evidencePhotoDataUrl: string;
    conditionNotes?: string;
  }
): Promise<void> {
  const path = `moves/${moveId}/inventory/${itemId}`;
  try {
    const updatePayload: Record<string, unknown> = {
      hasDamage: Boolean(payload.hasDamage),
      damageNotes: (payload.damageNotes || '').slice(0, 300),
      evidencePhotoDataUrl: (payload.evidencePhotoDataUrl || '').slice(0, 65000),
      updatedAt: serverTimestamp(),
    };
    if (typeof payload.conditionNotes === 'string') {
      updatePayload.conditionNotes = payload.conditionNotes.slice(0, 250);
    }
    await updateDoc(doc(db, 'moves', moveId, 'inventory', itemId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteInventoryItemFromFirestore(
  moveId: string,
  itemId: string
): Promise<void> {
  const path = `moves/${moveId}/inventory/${itemId}`;
  try {
    await deleteDoc(doc(db, 'moves', moveId, 'inventory', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function savePaymentToFirestore(
  uid: string,
  moveId: string,
  payment: PaymentEntry
): Promise<void> {
  const path = `moves/${moveId}/payments/${payment.id}`;
  try {
    await setDoc(doc(db, 'moves', moveId, 'payments', payment.id), {
      ownerId: uid,
      moveId,
      amount: Math.min(2000000000, Math.max(0.01, Number(payment.amount) || 0.01)),
      date: payment.date.slice(0, 30),
      method: payment.method,
      concept: payment.concept.slice(0, 160),
      reference: (payment.reference || '').slice(0, 80),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveExpenseToFirestore(
  uid: string,
  expense: OperationalExpense
): Promise<void> {
  const path = `expenses/${expense.id}`;
  try {
    await setDoc(doc(db, 'expenses', expense.id), {
      ownerId: uid,
      moveId: (expense.moveId || '').slice(0, 128),
      category: expense.category,
      description: expense.description.slice(0, 160),
      amount: Math.min(2000000000, Math.max(0.01, Number(expense.amount) || 0.01)),
      date: expense.date.slice(0, 30),
      routeLabel: (expense.routeLabel || '').slice(0, 120),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
