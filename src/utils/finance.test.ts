import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateClientBalance,
  calculateInventoryMetrics,
  calculateFinancialSummary,
  calculateFinancialPeriods,
  getPeriodKeyAndLabel,
  validateNewMoveForm,
  validatePaymentInput,
  validateDamageEvidenceInput,
  formatCurrencyCOP,
  getRolePermissions,
  canDeleteClientRecord,
  authenticateSystemUser,
  validateNewSystemUser,
  estimateDataUrlBytes,
  computeOptimalDimensions,
  calculateImageCompressionStats,
  getPhotoRetentionStatus,
  purgeExpiredInventoryPhotos,
  resolveSelectedPeriodBucket,
} from './finance.ts';
import type { MoveRecord, InventoryItem, OperationalExpense, SystemUser } from '../types.ts';

const MOCK_USERS: SystemUser[] = [
  {
    id: 'usr_admin_01',
    username: 'admin',
    password: 'Aldana2026*',
    fullName: 'Andrés Aldana (Administrador General)',
    role: 'administrador',
    branchCity: 'Bogotá D.C., Colombia',
    active: true,
    createdAt: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 'usr_inv_01',
    username: 'inventario',
    password: 'Inventario2026*',
    fullName: 'Sebastián Gómez (Operador de Inventario)',
    role: 'usuario_inventario',
    branchCity: 'Medellín, Colombia',
    active: true,
    createdAt: '2026-02-15T09:30:00.000Z',
  },
];

test('authenticateSystemUser validates independent username and password credentials and returns user role', () => {
  const emptyUser = authenticateSystemUser(MOCK_USERS, '', 'Aldana2026*');
  assert.equal(emptyUser.authenticated, false);

  const wrongPass = authenticateSystemUser(MOCK_USERS, 'admin', 'WrongPass');
  assert.equal(wrongPass.authenticated, false);

  const adminLogin = authenticateSystemUser(MOCK_USERS, 'ADMIN', 'Aldana2026*');
  assert.equal(adminLogin.authenticated, true);
  assert.equal(adminLogin.user?.role, 'administrador');
  assert.equal(canDeleteClientRecord(adminLogin.user!.role), true);

  const invLogin = authenticateSystemUser(MOCK_USERS, 'inventario', 'Inventario2026*');
  assert.equal(invLogin.authenticated, true);
  assert.equal(invLogin.user?.role, 'usuario_inventario');
  assert.equal(canDeleteClientRecord(invLogin.user!.role), false);
});

test('validateNewSystemUser enforces unique username, password length, and required fields', () => {
  const duplicateRes = validateNewSystemUser(MOCK_USERS, {
    username: 'admin',
    password: 'Secret123',
    fullName: 'Otro Admin',
    role: 'administrador',
    branchCity: 'Cali, Colombia',
  });
  assert.equal(duplicateRes.valid, false);

  const shortPassRes = validateNewSystemUser(MOCK_USERS, {
    username: 'operador_cali',
    password: '12',
    fullName: 'Operador Cali',
    role: 'usuario_inventario',
    branchCity: 'Cali, Colombia',
  });
  assert.equal(shortPassRes.valid, false);

  const validRes = validateNewSystemUser(MOCK_USERS, {
    username: 'operador_cali',
    password: 'Cali2026*',
    fullName: 'Diana Morales (Inventarios Cali)',
    role: 'usuario_inventario',
    branchCity: 'Cali, Colombia',
  });
  assert.equal(validRes.valid, true);
});

test('calculateClientBalance computes paid, debt, and percentage accurately in COP', () => {
  const partial = calculateClientBalance(4500000, 1800000);
  assert.equal(partial.totalContract, 4500000);
  assert.equal(partial.amountPaid, 1800000);
  assert.equal(partial.balanceDue, 2700000);
  assert.equal(partial.paidPercentage, 40);
  assert.equal(partial.debtPercentage, 60);
  assert.equal(partial.isSettled, false);
  assert.equal(partial.paymentStateLabel, 'Abono Parcial');

  const settled = calculateClientBalance(3800000, 3800000);
  assert.equal(settled.balanceDue, 0);
  assert.equal(settled.paidPercentage, 100);
  assert.equal(settled.isSettled, true);
  assert.equal(settled.paymentStateLabel, 'Liquidado');

  const unpaid = calculateClientBalance(5200000, 0);
  assert.equal(unpaid.balanceDue, 5200000);
  assert.equal(unpaid.paymentStateLabel, 'Pendiente de Anticipo');
});

test('formatCurrencyCOP formats Colombian Pesos with COP suffix', () => {
  const formatted = formatCurrencyCOP(4850000);
  assert.ok(formatted.includes('4.850.000') || formatted.includes('4,850,000'));
  assert.ok(formatted.endsWith('COP'));
});

test('Role permissions enforce that only administrador can delete clients while usuario_inventario cannot', () => {
  const adminPerms = getRolePermissions('administrador');
  assert.equal(adminPerms.canDeleteClient, true);
  assert.equal(adminPerms.canManageInventory, true);
  assert.equal(adminPerms.canManageUsers, true);
  assert.equal(canDeleteClientRecord('administrador'), true);

  const inventoryUserPerms = getRolePermissions('usuario_inventario');
  assert.equal(inventoryUserPerms.canDeleteClient, false);
  assert.equal(inventoryUserPerms.canManageInventory, true);
  assert.equal(inventoryUserPerms.canCaptureCameraEvidence, true);
  assert.equal(inventoryUserPerms.canManageUsers, false);
  assert.equal(canDeleteClientRecord('usuario_inventario'), false);
});

test('calculateInventoryMetrics aggregates volume, weight, fragile, damaged, and evidence counts', () => {
  const sampleItems: InventoryItem[] = [
    {
      id: 'i1',
      ownerId: 'u1',
      moveId: 'm1',
      name: 'Nevecón Duplex 22 pies',
      category: 'Línea Blanca',
      quantity: 1,
      volumeM3: 1.8,
      weightKg: 110,
      isFragile: true,
      conditionNotes: 'Emplayado doble',
      hasDamage: true,
      damageNotes: 'Abolladura leve en puerta inferior derecha',
      evidencePhotoDataUrl: 'data:image/jpeg;base64,stub',
      createdAt: '2026-10-19T10:00:00Z',
      updatedAt: '2026-10-19T10:00:00Z',
    },
    {
      id: 'i2',
      ownerId: 'u1',
      moveId: 'm1',
      name: 'Cajas de cartón medianas',
      category: 'Cocina y Cajas',
      quantity: 10,
      volumeM3: 0.15,
      weightKg: 12,
      isFragile: false,
      conditionNotes: 'Selladas con cinta',
      hasDamage: false,
      damageNotes: '',
      evidencePhotoDataUrl: '',
      createdAt: '2026-10-19T10:00:00Z',
      updatedAt: '2026-10-19T10:00:00Z',
    },
  ];

  const summary = calculateInventoryMetrics(sampleItems);
  assert.equal(summary.totalUnits, 11);
  assert.equal(summary.distinctLines, 2);
  assert.equal(summary.totalVolumeM3, 3.3);
  assert.equal(summary.totalWeightKg, 230);
  assert.equal(summary.fragileUnits, 1);
  assert.equal(summary.damagedUnits, 1);
  assert.equal(summary.itemsWithEvidenceCount, 1);
  assert.equal(summary.byCategory['Línea Blanca'], 1);
  assert.equal(summary.byCategory['Cocina y Cajas'], 10);
});

test('calculateFinancialSummary aggregates revenue, receivables, and operational expenses in COP', () => {
  const moves: MoveRecord[] = [
    {
      id: 'm1',
      ownerId: 'u1',
      folio: 'MUD-01',
      clientName: 'Cliente Uno',
      clientPhone: '310 456 7890',
      clientEmail: 'uno@test.co',
      originCity: 'Bogotá D.C., Colombia',
      destinationCity: 'Medellín, Colombia',
      moveDate: '2026-10-20',
      status: 'en_transito',
      truckUnit: 'Unidad 01',
      distanceKm: 415,
      totalContractAmount: 6000000,
      amountPaid: 3600000,
      notes: '',
      inventory: [],
      payments: [],
      createdAt: '2026-10-19T10:00:00Z',
      updatedAt: '2026-10-19T10:00:00Z',
    },
    {
      id: 'm2',
      ownerId: 'u1',
      folio: 'MUD-02',
      clientName: 'Cliente Dos',
      clientPhone: '315 987 6543',
      clientEmail: 'dos@test.co',
      originCity: 'Cali, Colombia',
      destinationCity: 'Quito, Ecuador',
      moveDate: '2026-10-18',
      status: 'liquidada',
      truckUnit: 'Unidad 02',
      distanceKm: 790,
      totalContractAmount: 4000000,
      amountPaid: 4000000,
      notes: '',
      inventory: [],
      payments: [],
      createdAt: '2026-10-18T10:00:00Z',
      updatedAt: '2026-10-18T10:00:00Z',
    },
  ];

  const expenses: OperationalExpense[] = [
    {
      id: 'e1',
      ownerId: 'u1',
      moveId: 'm1',
      category: 'Combustible y Diésel',
      description: 'Tanqueo ACPM ruta Bogotá - Medellín',
      amount: 1300000,
      date: '2026-10-19',
      routeLabel: 'Bogotá → Medellín',
      createdAt: '2026-10-19T10:00:00Z',
      updatedAt: '2026-10-19T10:00:00Z',
    },
  ];

  const fin = calculateFinancialSummary(moves, expenses);
  assert.equal(fin.totalContracted, 10000000);
  assert.equal(fin.totalCollected, 7600000);
  assert.equal(fin.totalReceivableDebt, 2400000);
  assert.equal(fin.totalOperationalExpenses, 1300000);
  assert.equal(fin.netOperatingBalance, 6300000);
  assert.equal(fin.netContractMargin, 8700000);
  assert.equal(fin.collectionRatePct, 76);
  assert.equal(fin.clientsWithDebtCount, 1);
  assert.equal(fin.settledClientsCount, 1);
});

test('calculateFinancialPeriods groups financial status accurately by dias, semanas, meses, and anios', () => {
  const moves: MoveRecord[] = [
    {
      id: 'm1',
      ownerId: 'u1',
      folio: 'MUD-01',
      clientName: 'Cliente Octubre',
      clientPhone: '3101112233',
      clientEmail: '',
      originCity: 'Bogotá D.C., Colombia',
      destinationCity: 'Medellín, Colombia',
      moveDate: '2026-10-19',
      status: 'en_transito',
      truckUnit: 'U1',
      distanceKm: 415,
      totalContractAmount: 5000000,
      amountPaid: 3000000,
      notes: '',
      inventory: [],
      payments: [
        {
          id: 'p1',
          ownerId: 'u1',
          moveId: 'm1',
          amount: 2000000,
          date: '2026-10-14',
          method: 'Transferencia Bancolombia / PSE',
          concept: 'Anticipo',
          reference: 'R1',
          createdAt: '2026-10-14T10:00:00Z',
          updatedAt: '2026-10-14T10:00:00Z',
        },
        {
          id: 'p2',
          ownerId: 'u1',
          moveId: 'm1',
          amount: 1000000,
          date: '2026-10-19',
          method: 'Nequi / Daviplata',
          concept: 'Abono',
          reference: 'R2',
          createdAt: '2026-10-19T10:00:00Z',
          updatedAt: '2026-10-19T10:00:00Z',
        },
      ],
      createdAt: '2026-10-14T10:00:00Z',
      updatedAt: '2026-10-19T10:00:00Z',
    },
    {
      id: 'm2',
      ownerId: 'u1',
      folio: 'MUD-02',
      clientName: 'Cliente Año Pasado',
      clientPhone: '3159998877',
      clientEmail: '',
      originCity: 'Cali, Colombia',
      destinationCity: 'Quito, Ecuador',
      moveDate: '2025-12-18',
      status: 'liquidada',
      truckUnit: 'U2',
      distanceKm: 780,
      totalContractAmount: 8000000,
      amountPaid: 8000000,
      notes: '',
      inventory: [],
      payments: [
        {
          id: 'p3',
          ownerId: 'u1',
          moveId: 'm2',
          amount: 8000000,
          date: '2025-12-18',
          method: 'Efectivo COP',
          concept: 'Pago total',
          reference: 'R3',
          createdAt: '2025-12-18T10:00:00Z',
          updatedAt: '2025-12-18T10:00:00Z',
        },
      ],
      createdAt: '2025-12-18T10:00:00Z',
      updatedAt: '2025-12-18T10:00:00Z',
    },
  ];

  const expenses: OperationalExpense[] = [
    {
      id: 'e1',
      ownerId: 'u1',
      moveId: 'm1',
      category: 'Combustible y Diésel',
      description: 'ACPM',
      amount: 400000,
      date: '2026-10-19',
      routeLabel: 'Bogotá → Medellín',
      createdAt: '2026-10-19T10:00:00Z',
      updatedAt: '2026-10-19T10:00:00Z',
    },
    {
      id: 'e2',
      ownerId: 'u1',
      moveId: 'm2',
      category: 'Casetas y Peajes',
      description: 'Peajes',
      amount: 500000,
      date: '2025-12-18',
      routeLabel: 'Cali → Quito',
      createdAt: '2025-12-18T10:00:00Z',
      updatedAt: '2025-12-18T10:00:00Z',
    },
  ];

  const byDay = calculateFinancialPeriods(moves, expenses, 'dia');
  assert.equal(byDay.length, 3);
  const oct19 = byDay.find((b) => b.periodKey === '2026-10-19')!;
  assert.equal(oct19.collectedAmount, 1000000);
  assert.equal(oct19.expensesAmount, 400000);
  assert.equal(oct19.netCashFlow, 600000);

  const oct14 = byDay.find((b) => b.periodKey === '2026-10-14')!;
  assert.equal(oct14.collectedAmount, 2000000);
  assert.equal(oct14.contractedAmount, 5000000);
  assert.equal(oct14.pendingDebtAmount, 2000000);

  const byWeek = calculateFinancialPeriods(moves, expenses, 'semana');
  assert.equal(byWeek.length, 3); // Week of Oct 19, Week of Oct 12, Week of Dec 15 2025
  assert.equal(getPeriodKeyAndLabel('2026-10-19', 'semana').periodKey, '2026-10-19');

  const byMonth = calculateFinancialPeriods(moves, expenses, 'mes');
  assert.equal(byMonth.length, 2); // 2026-10 and 2025-12
  const octMonth = byMonth.find((b) => b.periodKey === '2026-10')!;
  assert.equal(octMonth.collectedAmount, 3000000);
  assert.equal(octMonth.expensesAmount, 400000);
  assert.equal(octMonth.netCashFlow, 2600000);

  const byYear = calculateFinancialPeriods(moves, expenses, 'anio');
  assert.equal(byYear.length, 2); // 2026 and 2025
  const year2025 = byYear.find((b) => b.periodKey === '2025')!;
  assert.equal(year2025.collectedAmount, 8000000);
  assert.equal(year2025.expensesAmount, 500000);
  assert.equal(year2025.netCashFlow, 7500000);
});

test('validateNewMoveForm, validatePaymentInput, and validateDamageEvidenceInput enforce strict rules', () => {
  assert.equal(
    validateNewMoveForm({
      clientName: '',
      clientPhone: '3101234567',
      originCity: 'Bogotá, Colombia',
      destinationCity: 'Cali, Colombia',
      totalContractAmount: 3500000,
      initialAdvance: 1500000,
    }).valid,
    false
  );

  assert.equal(
    validatePaymentInput({
      amount: 2500000,
      maxPayable: 1500000,
      concept: 'Liquidación',
    }).valid,
    false
  );

  assert.equal(
    validateDamageEvidenceInput({
      hasDamage: true,
      damageNotes: '',
      evidencePhotoDataUrl: 'data:image/jpeg;base64,abc',
    }).valid,
    false
  );

  assert.equal(
    validateDamageEvidenceInput({
      hasDamage: true,
      damageNotes: 'Rayón en esquina trasera',
      evidencePhotoDataUrl: 'data:image/jpeg;base64,abc',
    }).valid,
    true
  );
});

test('image compression helpers preserve aspect ratio and calculate weight reduction accurately', () => {
  const dims = computeOptimalDimensions(1600, 1200, 800);
  assert.equal(dims.width, 800);
  assert.equal(dims.height, 600);
  assert.equal(dims.scaleFactor, 0.5);

  const smallDims = computeOptimalDimensions(640, 480, 800);
  assert.equal(smallDims.width, 640);
  assert.equal(smallDims.height, 480);
  assert.equal(smallDims.scaleFactor, 1);

  const fakeBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(4000);
  const bytes = estimateDataUrlBytes(fakeBase64);
  assert.equal(bytes, 3000);

  const stats = calculateImageCompressionStats(120_000, fakeBase64);
  assert.equal(stats.originalBytes, 120_000);
  assert.equal(stats.compressedBytes, 3000);
  assert.ok(stats.savedPercentage >= 95);
  assert.equal(stats.withinFirestoreLimit, true);
});

test('getPhotoRetentionStatus and purgeExpiredInventoryPhotos enforce 15-day auto-deletion cycle', () => {
  const activeStatus = getPhotoRetentionStatus('2026-10-14', '2026-10-19');
  assert.equal(activeStatus.isExpired, false);
  assert.equal(activeStatus.daysElapsed, 5);
  assert.equal(activeStatus.daysRemaining, 10);
  assert.equal(activeStatus.expiresDate, '2026-10-29');

  const expiredStatus = getPhotoRetentionStatus('2026-10-01', '2026-10-19');
  assert.equal(expiredStatus.isExpired, true);
  assert.equal(expiredStatus.daysElapsed, 18);
  assert.equal(expiredStatus.daysRemaining, 0);

  const sampleMoves: MoveRecord[] = [
    {
      id: 'm_ret',
      ownerId: 'u1',
      folio: 'ALD-RET-01',
      clientName: 'Cliente Prueba Retención',
      clientPhone: '3001112233',
      clientEmail: 'test@co.com',
      originCity: 'Bogotá D.C., Colombia',
      destinationCity: 'Medellín, Colombia',
      moveDate: '2026-10-01',
      status: 'en_transito',
      truckUnit: 'Camión 1',
      distanceKm: 415,
      totalContractAmount: 4000000,
      amountPaid: 2000000,
      notes: '',
      payments: [],
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-01T10:00:00Z',
      inventory: [
        {
          id: 'item_expired',
          ownerId: 'u1',
          moveId: 'm_ret',
          name: 'Mueble con foto de hace 18 días',
          category: 'Sala y Comedor',
          quantity: 1,
          volumeM3: 1.5,
          weightKg: 40,
          isFragile: false,
          conditionNotes: 'Emplayado',
          hasDamage: true,
          damageNotes: 'Rayón lateral',
          evidencePhotoDataUrl: 'data:image/jpeg;base64,OLDPHOTO',
          evidencePhotoCreatedAt: '2026-10-01T10:00:00Z',
          createdAt: '2026-10-01T10:00:00Z',
          updatedAt: '2026-10-01T10:00:00Z',
        },
        {
          id: 'item_recent',
          ownerId: 'u1',
          moveId: 'm_ret',
          name: 'Mueble con foto de hace 3 días',
          category: 'Recámara',
          quantity: 1,
          volumeM3: 1.2,
          weightKg: 35,
          isFragile: false,
          conditionNotes: 'Manta',
          hasDamage: true,
          damageNotes: 'Esquina golpeada',
          evidencePhotoDataUrl: 'data:image/jpeg;base64,RECENTPHOTO',
          evidencePhotoCreatedAt: '2026-10-16T10:00:00Z',
          createdAt: '2026-10-16T10:00:00Z',
          updatedAt: '2026-10-16T10:00:00Z',
        },
      ],
    },
  ];

  const purged = purgeExpiredInventoryPhotos(sampleMoves, '2026-10-19');
  assert.equal(purged.purgedCount, 1);
  assert.equal(purged.activePhotosCount, 1);
  assert.equal(purged.moves[0].inventory[0].evidencePhotoDataUrl, '');
  assert.equal(purged.moves[0].inventory[0].damageNotes, 'Rayón lateral');
  assert.equal(
    purged.moves[0].inventory[1].evidencePhotoDataUrl,
    'data:image/jpeg;base64,RECENTPHOTO'
  );
});

test('resolveSelectedPeriodBucket resolves existing or empty calendar dates, months, and years', () => {
  const buckets = calculateFinancialPeriods([], [], 'dia');
  const emptyDay = resolveSelectedPeriodBucket(buckets, 'dia', '2026-10-25');
  assert.ok(emptyDay);
  assert.equal(emptyDay.periodKey, '2026-10-25');
  assert.equal(emptyDay.periodLabel, '25 Oct 2026');
  assert.equal(emptyDay.netCashFlow, 0);

  const emptyMonth = resolveSelectedPeriodBucket([], 'mes', '2026-11');
  assert.ok(emptyMonth);
  assert.equal(emptyMonth.periodKey, '2026-11');
  assert.equal(emptyMonth.periodLabel, 'Noviembre 2026');

  const emptyYear = resolveSelectedPeriodBucket([], 'anio', '2025');
  assert.ok(emptyYear);
  assert.equal(emptyYear.periodKey, '2025');
  assert.equal(emptyYear.periodLabel, 'Año 2025');

  const allPeriods = resolveSelectedPeriodBucket(buckets, 'dia', 'todos');
  assert.equal(allPeriods, null);
});


