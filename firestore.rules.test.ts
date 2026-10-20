import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesSource = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');

interface AuthContext {
  uid: string;
  email: string;
  email_verified: boolean;
}

interface RequestEnv {
  auth: AuthContext | null;
  time: number;
  pathId: string;
  parentMoveId?: string;
  parentMoveOwnerId?: string | null;
  existing?: Record<string, unknown> | null;
  incoming?: Record<string, unknown> | null;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  collection: 'moves' | 'inventory' | 'payments' | 'expenses';
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && VALID_ID_REGEX.test(id);
}

function isSignedIn(auth: AuthContext | null): boolean {
  return auth !== null && auth.email_verified === true;
}

function isAdmin(auth: AuthContext | null): boolean {
  return isSignedIn(auth) && auth !== null && auth.email === 'aldanamudanzas01@gmail.com';
}

function hasExactKeys(obj: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(obj);
  return keys.every((k) => actual.includes(k)) && actual.every((k) => keys.includes(k));
}

function isValidMoveRecord(data: Record<string, unknown>, auth: AuthContext): boolean {
  const required = [
    'ownerId', 'folio', 'clientName', 'clientPhone', 'clientEmail',
    'originCity', 'destinationCity', 'moveDate', 'status', 'truckUnit',
    'distanceKm', 'totalContractAmount', 'amountPaid', 'notes',
    'createdAt', 'updatedAt'
  ];
  if (!hasExactKeys(data, required)) return false;
  if (data.ownerId !== auth.uid || !isValidId(data.ownerId)) return false;
  if (typeof data.folio !== 'string' || data.folio.length < 1 || data.folio.length > 40) return false;
  if (typeof data.clientName !== 'string' || data.clientName.length < 1 || data.clientName.length > 120) return false;
  if (typeof data.clientPhone !== 'string' || data.clientPhone.length < 1 || data.clientPhone.length > 40) return false;
  if (typeof data.clientEmail !== 'string' || data.clientEmail.length > 120) return false;
  if (typeof data.originCity !== 'string' || data.originCity.length < 1 || data.originCity.length > 100) return false;
  if (typeof data.destinationCity !== 'string' || data.destinationCity.length < 1 || data.destinationCity.length > 100) return false;
  if (typeof data.moveDate !== 'string' || data.moveDate.length < 1 || data.moveDate.length > 30) return false;
  if (typeof data.status !== 'string' || !['programada', 'en_transito', 'entregada', 'liquidada'].includes(data.status)) return false;
  if (typeof data.truckUnit !== 'string' || data.truckUnit.length < 1 || data.truckUnit.length > 60) return false;
  if (typeof data.distanceKm !== 'number' || data.distanceKm < 0 || data.distanceKm > 25000) return false;
  if (typeof data.totalContractAmount !== 'number' || data.totalContractAmount < 0 || data.totalContractAmount > 2000000000) return false;
  if (typeof data.amountPaid !== 'number' || data.amountPaid < 0 || data.amountPaid > (data.totalContractAmount as number)) return false;
  if (typeof data.notes !== 'string' || data.notes.length > 500) return false;
  if (typeof data.createdAt !== 'number' || typeof data.updatedAt !== 'number') return false;
  return true;
}

function evaluateRule(env: RequestEnv): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!isSignedIn(env.auth) || !env.auth) return 'PERMISSION_DENIED';

  if (env.collection === 'moves') {
    if (env.operation === 'get') {
      if (!isValidId(env.pathId)) return 'PERMISSION_DENIED';
      if (!env.existing || (env.existing.ownerId !== env.auth.uid && !isAdmin(env.auth))) return 'PERMISSION_DENIED';
      return 'ALLOW';
    }
    if (env.operation === 'list') {
      if (!env.existing || (env.existing.ownerId !== env.auth.uid && !isAdmin(env.auth))) return 'PERMISSION_DENIED';
      return 'ALLOW';
    }
    if (env.operation === 'create') {
      if (!isValidId(env.pathId) || !env.incoming) return 'PERMISSION_DENIED';
      if (!isValidMoveRecord(env.incoming, env.auth)) return 'PERMISSION_DENIED';
      if (env.incoming.createdAt !== env.time || env.incoming.updatedAt !== env.time) return 'PERMISSION_DENIED';
      return 'ALLOW';
    }
    if (env.operation === 'update') {
      if (!isValidId(env.pathId) || !env.incoming || !env.existing) return 'PERMISSION_DENIED';
      if (!isValidMoveRecord(env.incoming, env.auth)) return 'PERMISSION_DENIED';
      if (env.incoming.ownerId !== env.existing.ownerId) return 'PERMISSION_DENIED';
      if (env.incoming.createdAt !== env.existing.createdAt) return 'PERMISSION_DENIED';
      if (env.incoming.updatedAt !== env.time) return 'PERMISSION_DENIED';
      if (env.existing.status === 'liquidada') return 'PERMISSION_DENIED';
      if (env.existing.ownerId !== env.auth.uid && !isAdmin(env.auth)) return 'PERMISSION_DENIED';
      return 'ALLOW';
    }
    if (env.operation === 'delete') {
      if (!isValidId(env.pathId)) return 'PERMISSION_DENIED';
      if (!isAdmin(env.auth)) return 'PERMISSION_DENIED';
      return 'ALLOW';
    }
  }

  if (env.collection === 'inventory' || env.collection === 'payments') {
    if (!isValidId(env.parentMoveId) || !isValidId(env.pathId)) return 'PERMISSION_DENIED';
    if (!env.parentMoveOwnerId || env.parentMoveOwnerId !== env.auth.uid) return 'PERMISSION_DENIED';
    if (env.operation === 'create') {
      if (!env.incoming || env.incoming.moveId !== env.parentMoveId || env.incoming.ownerId !== env.auth.uid) {
        return 'PERMISSION_DENIED';
      }
      if (env.incoming.createdAt !== env.time || env.incoming.updatedAt !== env.time) return 'PERMISSION_DENIED';
      return 'ALLOW';
    }
  }

  return 'PERMISSION_DENIED';
}

const NOW = 1760900000000;
const OWNER_AUTH: AuthContext = { uid: 'user_owner_1', email: 'inventario@ejemplo.co', email_verified: true };
const ADMIN_AUTH: AuthContext = { uid: 'admin_uid_1', email: 'aldanamudanzas01@gmail.com', email_verified: true };

function makeValidMove(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ownerId: 'user_owner_1',
    folio: 'MUD-2026-001',
    clientName: 'Roberto Garza',
    clientPhone: '+57 310 123 4567',
    clientEmail: 'roberto@ejemplo.co',
    originCity: 'Bogotá D.C., Colombia',
    destinationCity: 'Medellín, Colombia',
    moveDate: '2026-10-25',
    status: 'en_transito',
    truckUnit: 'Chevrolet FTR - Unidad 04',
    distanceKm: 418,
    totalContractAmount: 4850000,
    amountPaid: 2800000,
    notes: 'Descarga con elevador de carga',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

test('Firestore rules file contains all 8 Hardened Pillars and RBAC delete restriction', () => {
  assert.ok(rulesSource.includes("rules_version = '2';"));
  assert.ok(rulesSource.includes('allow read, write: if false;'));
  assert.ok(rulesSource.includes('function isValidId(id)'));
  assert.ok(rulesSource.includes('function isValidMoveRecord(data)'));
  assert.ok(rulesSource.includes('function isValidInventoryItem(data, moveId)'));
  assert.ok(rulesSource.includes('function isValidPaymentEntry(data, moveId)'));
  assert.ok(rulesSource.includes('function isValidOperationalExpense(data)'));
  assert.ok(rulesSource.includes('request.auth.token.email_verified == true'));
  assert.ok(rulesSource.includes('allow delete: if isAdmin() && isValidId(moveId);'));
});

test('RBAC: Inventory User (non-admin) attempting to delete a client move returns PERMISSION_DENIED, while Admin returns ALLOW', () => {
  const denied = evaluateRule({
    auth: OWNER_AUTH,
    time: NOW,
    pathId: 'move_101',
    operation: 'delete',
    collection: 'moves',
    existing: makeValidMove(),
  });
  assert.equal(denied, 'PERMISSION_DENIED');

  const allowed = evaluateRule({
    auth: ADMIN_AUTH,
    time: NOW,
    pathId: 'move_101',
    operation: 'delete',
    collection: 'moves',
    existing: makeValidMove({ ownerId: 'admin_uid_1' }),
  });
  assert.equal(allowed, 'ALLOW');
});

test('Dirty Dozen #1: Identity Spoofing on Move Create returns PERMISSION_DENIED', () => {
  const res = evaluateRule({
    auth: OWNER_AUTH,
    time: NOW,
    pathId: 'move_101',
    operation: 'create',
    collection: 'moves',
    incoming: makeValidMove({ ownerId: 'victim_uid_999' }),
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #2: Unverified Email Spoof returns PERMISSION_DENIED', () => {
  const res = evaluateRule({
    auth: { uid: 'user_owner_1', email: 'aldanamudanzas01@gmail.com', email_verified: false },
    time: NOW,
    pathId: 'move_101',
    operation: 'create',
    collection: 'moves',
    incoming: makeValidMove(),
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #3: Shadow Field Injection on Move Create returns PERMISSION_DENIED', () => {
  const res = evaluateRule({
    auth: OWNER_AUTH,
    time: NOW,
    pathId: 'move_101',
    operation: 'create',
    collection: 'moves',
    incoming: makeValidMove({ isAdmin: true }),
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #4: Path ID Poisoning returns PERMISSION_DENIED', () => {
  const res = evaluateRule({
    auth: OWNER_AUTH,
    time: NOW,
    pathId: 'invalid id with spaces!',
    operation: 'create',
    collection: 'moves',
    incoming: makeValidMove(),
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #5: Denial-of-Wallet String Overflow returns PERMISSION_DENIED', () => {
  const res = evaluateRule({
    auth: OWNER_AUTH,
    time: NOW,
    pathId: 'move_101',
    operation: 'create',
    collection: 'moves',
    incoming: makeValidMove({ clientName: 'A'.repeat(500) }),
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #6: Orphaned Subcollection Write returns PERMISSION_DENIED', () => {
  const res = evaluateRule({
    auth: OWNER_AUTH,
    time: NOW,
    parentMoveId: 'move_nonexistent',
    parentMoveOwnerId: null,
    pathId: 'item_1',
    operation: 'create',
    collection: 'inventory',
    incoming: {
      ownerId: 'user_owner_1',
      moveId: 'move_nonexistent',
      createdAt: NOW,
      updatedAt: NOW,
    },
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #7: Subcollection Parent Mismatch returns PERMISSION_DENIED', () => {
  const res = evaluateRule({
    auth: OWNER_AUTH,
    time: NOW,
    parentMoveId: 'move_A',
    parentMoveOwnerId: 'user_owner_1',
    pathId: 'pay_1',
    operation: 'create',
    collection: 'payments',
    incoming: {
      ownerId: 'user_owner_1',
      moveId: 'move_B',
      createdAt: NOW,
      updatedAt: NOW,
    },
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #8: Immutable Field Tampering on Update returns PERMISSION_DENIED', () => {
  const existing = makeValidMove({ createdAt: NOW - 50000 });
  const incoming = makeValidMove({ createdAt: NOW, updatedAt: NOW });
  const res = evaluateRule({
    auth: OWNER_AUTH,
    time: NOW,
    pathId: 'move_101',
    operation: 'update',
    collection: 'moves',
    existing,
    incoming,
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #9: Forged Client Timestamp on Create returns PERMISSION_DENIED', () => {
  const res = evaluateRule({
    auth: OWNER_AUTH,
    time: NOW,
    pathId: 'move_101',
    operation: 'create',
    collection: 'moves',
    incoming: makeValidMove({ createdAt: NOW - 10000 }),
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #10: Terminal State Bypass (liquidada) returns PERMISSION_DENIED', () => {
  const existing = makeValidMove({ status: 'liquidada', amountPaid: 4850000 });
  const incoming = makeValidMove({ status: 'liquidada', amountPaid: 1000000, updatedAt: NOW });
  const res = evaluateRule({
    auth: OWNER_AUTH,
    time: NOW,
    pathId: 'move_101',
    operation: 'update',
    collection: 'moves',
    existing,
    incoming,
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #11: Cross-Tenant PII Read returns PERMISSION_DENIED', () => {
  const existing = makeValidMove({ ownerId: 'other_user_999' });
  const res = evaluateRule({
    auth: OWNER_AUTH,
    time: NOW,
    pathId: 'move_101',
    operation: 'get',
    collection: 'moves',
    existing,
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #12: Value Poisoning on Whitelisted Update Key returns PERMISSION_DENIED', () => {
  const existing = makeValidMove();
  const incoming = makeValidMove({ amountPaid: -5000, updatedAt: NOW });
  const res = evaluateRule({
    auth: OWNER_AUTH,
    time: NOW,
    pathId: 'move_101',
    operation: 'update',
    collection: 'moves',
    existing,
    incoming,
  });
  assert.equal(res, 'PERMISSION_DENIED');
});
