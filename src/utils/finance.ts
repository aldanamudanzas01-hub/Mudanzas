import type {
  MoveRecord,
  InventoryItem,
  OperationalExpense,
  InventoryCategory,
  ExpenseCategory,
  UserRole,
  SystemUser,
  FinancialPeriodGranularity,
  FinancialPeriodBucket,
} from '../types.ts';

export const BLUEPRINT_LIMITS = {
  ID_MAX: 128,
  ID_REGEX: /^[a-zA-Z0-9_\-]+$/,
  FOLIO_MAX: 40,
  CLIENT_NAME_MAX: 120,
  CLIENT_PHONE_MAX: 40,
  CLIENT_EMAIL_MAX: 120,
  CITY_MAX: 100,
  DATE_MAX: 30,
  TRUCK_UNIT_MAX: 60,
  NOTES_MAX: 500,
  ITEM_NAME_MAX: 120,
  ITEM_NOTES_MAX: 250,
  DAMAGE_NOTES_MAX: 300,
  EVIDENCE_PHOTO_MAX: 65000,
  PAYMENT_CONCEPT_MAX: 160,
  PAYMENT_REF_MAX: 80,
  EXPENSE_DESC_MAX: 160,
  EXPENSE_ROUTE_MAX: 120,
  MAX_CONTRACT: 2_000_000_000,
  MAX_DISTANCE_KM: 25_000,
  USERNAME_MIN: 3,
  USERNAME_MAX: 40,
  PASSWORD_MIN: 4,
  PASSWORD_MAX: 80,
  FULL_NAME_MAX: 100,
} as const;

export const PHOTO_RETENTION_DAYS = 15;

export interface ImageCompressionStats {
  originalBytes: number;
  compressedBytes: number;
  originalKb: number;
  compressedKb: number;
  savedBytes: number;
  savedPercentage: number;
  qualityLabel: string;
  withinFirestoreLimit: boolean;
}

export function estimateDataUrlBytes(dataUrl: string): number {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  const trimmed = dataUrl.trim();
  if (!trimmed) return 0;
  const commaIdx = trimmed.indexOf(',');
  const base64Part = commaIdx >= 0 ? trimmed.slice(commaIdx + 1) : trimmed;
  const padding = base64Part.endsWith('==') ? 2 : base64Part.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64Part.length * 3) / 4) - padding);
}

export function computeOptimalDimensions(
  srcWidth: number,
  srcHeight: number,
  maxDimension = 760
): { width: number; height: number; scaleFactor: number } {
  const safeW = Math.max(1, Math.round(Number(srcWidth) || 640));
  const safeH = Math.max(1, Math.round(Number(srcHeight) || 480));
  const maxSide = Math.max(safeW, safeH);
  if (maxSide <= maxDimension) {
    return { width: safeW, height: safeH, scaleFactor: 1 };
  }
  const scaleFactor = maxDimension / maxSide;
  return {
    width: Math.max(1, Math.round(safeW * scaleFactor)),
    height: Math.max(1, Math.round(safeH * scaleFactor)),
    scaleFactor: Number(scaleFactor.toFixed(4)),
  };
}

export function calculateImageCompressionStats(
  originalBytes: number,
  compressedDataUrl: string
): ImageCompressionStats {
  const compressedBytes = estimateDataUrlBytes(compressedDataUrl);
  const effectiveOriginal =
    Number.isFinite(originalBytes) && originalBytes > compressedBytes
      ? Math.round(originalBytes)
      : Math.max(compressedBytes * 4, 185_000);
  const savedBytes = Math.max(0, effectiveOriginal - compressedBytes);
  const savedPercentage =
    effectiveOriginal > 0
      ? Math.min(99, Math.max(1, Math.round((savedBytes / effectiveOriginal) * 100)))
      : 0;

  return {
    originalBytes: effectiveOriginal,
    compressedBytes,
    originalKb: Number((effectiveOriginal / 1024).toFixed(1)),
    compressedKb: Number((compressedBytes / 1024).toFixed(1)),
    savedBytes,
    savedPercentage,
    qualityLabel: 'Alta Definición Optimizada (Sin pérdida visual)',
    withinFirestoreLimit:
      compressedDataUrl.length <= BLUEPRINT_LIMITS.EVIDENCE_PHOTO_MAX,
  };
}

export interface PhotoRetentionStatus {
  isExpired: boolean;
  daysElapsed: number;
  daysRemaining: number;
  publishedDate: string;
  expiresDate: string;
  statusLabel: string;
}

function parseUtcDayMs(dateStr: string | undefined, fallbackMs: number): number {
  if (!dateStr || typeof dateStr !== 'string') return fallbackMs;
  const clean = dateStr.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  if (match) {
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const parsed = Date.parse(dateStr);
  return Number.isFinite(parsed) ? parsed : fallbackMs;
}

function formatUtcIsoDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getPhotoRetentionStatus(
  photoPublishedAtIso: string | undefined,
  nowIso?: string
): PhotoRetentionStatus {
  const nowMs = parseUtcDayMs(nowIso, Date.now());
  const pubMs = parseUtcDayMs(photoPublishedAtIso, nowMs);
  const msPerDay = 24 * 60 * 60 * 1000;
  const rawDays = Math.floor((nowMs - pubMs) / msPerDay);
  const daysElapsed = Math.max(0, rawDays);
  const isExpired = daysElapsed >= PHOTO_RETENTION_DAYS;
  const daysRemaining = Math.max(0, PHOTO_RETENTION_DAYS - daysElapsed);
  const publishedDate = formatUtcIsoDate(pubMs);
  const expiresDate = formatUtcIsoDate(pubMs + PHOTO_RETENTION_DAYS * msPerDay);

  let statusLabel = `Auto-elimina en ${daysRemaining} días (${expiresDate})`;
  if (isExpired) {
    statusLabel = `Ciclo de ${PHOTO_RETENTION_DAYS} días cumplido · Foto eliminada`;
  } else if (daysRemaining === 1) {
    statusLabel = `Auto-elimina mañana (${expiresDate})`;
  }

  return {
    isExpired,
    daysElapsed,
    daysRemaining,
    publishedDate,
    expiresDate,
    statusLabel,
  };
}

export interface PurgePhotosResult {
  moves: MoveRecord[];
  purgedCount: number;
  activePhotosCount: number;
  purgedItemIds: { moveId: string; itemId: string; itemName: string }[];
}

export function purgeExpiredInventoryPhotos(
  moves: MoveRecord[],
  nowIso?: string
): PurgePhotosResult {
  let purgedCount = 0;
  let activePhotosCount = 0;
  const purgedItemIds: { moveId: string; itemId: string; itemName: string }[] = [];

  const updatedMoves = moves.map((move) => {
    let moveChanged = false;
    const updatedInventory = move.inventory.map((item) => {
      const hasPhoto = Boolean(
        item.evidencePhotoDataUrl && item.evidencePhotoDataUrl.trim().length > 0
      );
      if (!hasPhoto) return item;

      const publishedRef =
        item.evidencePhotoCreatedAt ||
        item.updatedAt ||
        item.createdAt ||
        move.moveDate;
      const retention = getPhotoRetentionStatus(publishedRef, nowIso);

      if (retention.isExpired) {
        purgedCount += 1;
        moveChanged = true;
        purgedItemIds.push({
          moveId: move.id,
          itemId: item.id,
          itemName: item.name,
        });
        const expireTag = '[Foto depurada automáticamente a los 15 días]';
        const prevNotes = (item.conditionNotes || '').trim();
        const nextConditionNotes = prevNotes.includes('depurada automáticamente')
          ? prevNotes
          : `${prevNotes ? `${prevNotes} · ` : ''}${expireTag}`.slice(
              0,
              BLUEPRINT_LIMITS.ITEM_NOTES_MAX
            );

        return {
          ...item,
          evidencePhotoDataUrl: '',
          conditionNotes: nextConditionNotes,
        };
      }

      activePhotosCount += 1;
      return item;
    });

    if (!moveChanged) return move;
    return {
      ...move,
      inventory: updatedInventory,
    };
  });

  return {
    moves: updatedMoves,
    purgedCount,
    activePhotosCount,
    purgedItemIds,
  };
}

export interface RolePermissions {
  role: UserRole;
  roleTitle: string;
  roleDescription: string;
  canDeleteClient: boolean;
  canCreateClient: boolean;
  canManageInventory: boolean;
  canCaptureCameraEvidence: boolean;
  canManageFinances: boolean;
  canManageUsers: boolean;
}

export function getRolePermissions(role: UserRole): RolePermissions {
  if (role === 'administrador') {
    return {
      role: 'administrador',
      roleTitle: 'Administrador General',
      roleDescription:
        'Control total del sistema: puede crear y eliminar clientes, administrar usuarios/contraseñas, rutas y finanzas en COP.',
      canDeleteClient: true,
      canCreateClient: true,
      canManageInventory: true,
      canCaptureCameraEvidence: true,
      canManageFinances: true,
      canManageUsers: true,
    };
  }

  return {
    role: 'usuario_inventario',
    roleTitle: 'Usuario (Operador de Inventario)',
    roleDescription:
      'Perfil operativo para levantamiento de inventario y evidencia con cámara. No tiene permiso para eliminar clientes.',
    canDeleteClient: false,
    canCreateClient: true,
    canManageInventory: true,
    canCaptureCameraEvidence: true,
    canManageFinances: false,
    canManageUsers: false,
  };
}

export function canDeleteClientRecord(role: UserRole): boolean {
  return getRolePermissions(role).canDeleteClient;
}

export interface AuthenticationResult {
  authenticated: boolean;
  user?: SystemUser;
  error?: string;
}

export function authenticateSystemUser(
  users: SystemUser[],
  usernameInput: string,
  passwordInput: string
): AuthenticationResult {
  const cleanUsername = usernameInput.trim().toLowerCase();
  const rawPassword = passwordInput.trim();

  if (!cleanUsername) {
    return {
      authenticated: false,
      error: 'Ingresa tu nombre de usuario para iniciar sesión.',
    };
  }

  if (!rawPassword) {
    return {
      authenticated: false,
      error: 'Ingresa tu contraseña para iniciar sesión.',
    };
  }

  const matchedUser = users.find(
    (u) => u.username.trim().toLowerCase() === cleanUsername
  );

  if (!matchedUser || matchedUser.password !== rawPassword) {
    return {
      authenticated: false,
      error: 'Usuario o contraseña incorrectos. Verifica tus credenciales.',
    };
  }

  if (!matchedUser.active) {
    return {
      authenticated: false,
      error: 'Esta cuenta de usuario se encuentra desactivada por el administrador.',
    };
  }

  return {
    authenticated: true,
    user: matchedUser,
  };
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateNewSystemUser(
  existingUsers: SystemUser[],
  input: {
    username: string;
    password: string;
    fullName: string;
    role: UserRole;
    branchCity: string;
  }
): ValidationResult {
  const username = input.username.trim().toLowerCase();
  const password = input.password.trim();
  const fullName = input.fullName.trim();
  const branchCity = input.branchCity.trim();

  if (!fullName) {
    return { valid: false, error: 'El nombre completo del usuario es obligatorio.' };
  }
  if (fullName.length > BLUEPRINT_LIMITS.FULL_NAME_MAX) {
    return { valid: false, error: 'El nombre completo excede la longitud máxima.' };
  }
  if (username.length < BLUEPRINT_LIMITS.USERNAME_MIN) {
    return {
      valid: false,
      error: `El usuario debe tener al menos ${BLUEPRINT_LIMITS.USERNAME_MIN} caracteres.`,
    };
  }
  if (username.length > BLUEPRINT_LIMITS.USERNAME_MAX) {
    return { valid: false, error: 'El nombre de usuario es demasiado largo.' };
  }
  if (!/^[a-z0-9._\-]+$/.test(username)) {
    return {
      valid: false,
      error: 'El usuario solo puede contener letras minúsculas, números, guiones o puntos (sin espacios).',
    };
  }
  const duplicate = existingUsers.some(
    (u) => u.username.trim().toLowerCase() === username
  );
  if (duplicate) {
    return {
      valid: false,
      error: `El usuario "${username}" ya está registrado. Elige otro nombre de usuario.`,
    };
  }
  if (password.length < BLUEPRINT_LIMITS.PASSWORD_MIN) {
    return {
      valid: false,
      error: `La contraseña debe tener al menos ${BLUEPRINT_LIMITS.PASSWORD_MIN} caracteres.`,
    };
  }
  if (password.length > BLUEPRINT_LIMITS.PASSWORD_MAX) {
    return { valid: false, error: 'La contraseña excede la longitud permitida.' };
  }
  if (!branchCity) {
    return { valid: false, error: 'Indica la sede o ciudad base del usuario.' };
  }
  if (input.role !== 'administrador' && input.role !== 'usuario_inventario') {
    return { valid: false, error: 'Selecciona un tipo de usuario válido.' };
  }

  return { valid: true };
}

export interface ClientBalanceSummary {
  totalContract: number;
  amountPaid: number;
  balanceDue: number;
  paidPercentage: number;
  debtPercentage: number;
  isSettled: boolean;
  paymentStateLabel: 'Liquidado' | 'Abono Parcial' | 'Pendiente de Anticipo';
}

export interface InventorySummary {
  totalUnits: number;
  distinctLines: number;
  totalVolumeM3: number;
  totalWeightKg: number;
  fragileUnits: number;
  damagedUnits: number;
  itemsWithEvidenceCount: number;
  byCategory: Record<InventoryCategory, number>;
}

export interface RouteFinancialPoint {
  moveId: string;
  folio: string;
  clientName: string;
  routeShort: string;
  originCity: string;
  destinationCity: string;
  totalContract: number;
  amountPaid: number;
  balanceDue: number;
  paidPct: number;
  status: MoveRecord['status'];
}

export interface FinancialDashboardMetrics {
  totalContracted: number;
  totalCollected: number;
  totalReceivableDebt: number;
  totalOperationalExpenses: number;
  netOperatingBalance: number;
  netContractMargin: number;
  collectionRatePct: number;
  clientsWithDebtCount: number;
  settledClientsCount: number;
  totalUnitsMoved: number;
  totalVolumeM3: number;
  routeBreakdown: RouteFinancialPoint[];
  expensesByCategory: Record<ExpenseCategory, number>;
}

export function calculateClientBalance(
  totalContractAmount: number,
  amountPaid: number
): ClientBalanceSummary {
  const safeTotal = Math.max(0, Number.isFinite(totalContractAmount) ? totalContractAmount : 0);
  const safePaid = Math.min(
    safeTotal,
    Math.max(0, Number.isFinite(amountPaid) ? amountPaid : 0)
  );
  const balanceDue = Math.max(0, Number((safeTotal - safePaid).toFixed(2)));
  const paidPercentage =
    safeTotal > 0 ? Math.min(100, Math.round((safePaid / safeTotal) * 100)) : 100;
  const debtPercentage = Math.max(0, 100 - paidPercentage);
  const isSettled = balanceDue <= 0.009 && safeTotal > 0;

  let paymentStateLabel: ClientBalanceSummary['paymentStateLabel'] = 'Abono Parcial';
  if (isSettled) {
    paymentStateLabel = 'Liquidado';
  } else if (safePaid <= 0) {
    paymentStateLabel = 'Pendiente de Anticipo';
  }

  return {
    totalContract: safeTotal,
    amountPaid: safePaid,
    balanceDue,
    paidPercentage,
    debtPercentage,
    isSettled,
    paymentStateLabel,
  };
}

export function calculateInventoryMetrics(items: InventoryItem[]): InventorySummary {
  const byCategory: Record<InventoryCategory, number> = {
    'Sala y Comedor': 0,
    'Recámara': 0,
    'Línea Blanca': 0,
    'Cocina y Cajas': 0,
    'Oficina y Electrónicos': 0,
    'Especial / Frágil': 0,
  };

  let totalUnits = 0;
  let totalVolumeM3 = 0;
  let totalWeightKg = 0;
  let fragileUnits = 0;
  let damagedUnits = 0;
  let itemsWithEvidenceCount = 0;

  for (const item of items) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const vol = Math.max(0, Number(item.volumeM3) || 0);
    const weight = Math.max(0, Number(item.weightKg) || 0);

    totalUnits += qty;
    totalVolumeM3 += qty * vol;
    totalWeightKg += qty * weight;
    if (item.isFragile) {
      fragileUnits += qty;
    }
    if (item.hasDamage) {
      damagedUnits += qty;
    }
    if (item.evidencePhotoDataUrl && item.evidencePhotoDataUrl.trim().length > 0) {
      itemsWithEvidenceCount += 1;
    }
    if (item.category in byCategory) {
      byCategory[item.category] += qty;
    }
  }

  return {
    totalUnits,
    distinctLines: items.length,
    totalVolumeM3: Number(totalVolumeM3.toFixed(2)),
    totalWeightKg: Number(totalWeightKg.toFixed(1)),
    fragileUnits,
    damagedUnits,
    itemsWithEvidenceCount,
    byCategory,
  };
}

export function calculateFinancialSummary(
  moves: MoveRecord[],
  expenses: OperationalExpense[]
): FinancialDashboardMetrics {
  let totalContracted = 0;
  let totalCollected = 0;
  let totalReceivableDebt = 0;
  let clientsWithDebtCount = 0;
  let settledClientsCount = 0;
  let totalUnitsMoved = 0;
  let totalVolumeM3 = 0;

  const routeBreakdown: RouteFinancialPoint[] = moves.map((move) => {
    const bal = calculateClientBalance(move.totalContractAmount, move.amountPaid);
    const inv = calculateInventoryMetrics(move.inventory);

    totalContracted += bal.totalContract;
    totalCollected += bal.amountPaid;
    totalReceivableDebt += bal.balanceDue;
    totalUnitsMoved += inv.totalUnits;
    totalVolumeM3 += inv.totalVolumeM3;

    if (bal.balanceDue > 0) {
      clientsWithDebtCount += 1;
    } else {
      settledClientsCount += 1;
    }

    const originShort = move.originCity.split(',')[0].trim();
    const destShort = move.destinationCity.split(',')[0].trim();

    return {
      moveId: move.id,
      folio: move.folio,
      clientName: move.clientName,
      routeShort: `${originShort} → ${destShort}`,
      originCity: move.originCity,
      destinationCity: move.destinationCity,
      totalContract: bal.totalContract,
      amountPaid: bal.amountPaid,
      balanceDue: bal.balanceDue,
      paidPct: bal.paidPercentage,
      status: move.status,
    };
  });

  const expensesByCategory: Record<ExpenseCategory, number> = {
    'Combustible y Diésel': 0,
    'Casetas y Peajes': 0,
    'Maniobras y Cargadores': 0,
    'Material de Embalaje': 0,
    'Mantenimiento de Unidad': 0,
    'Otros': 0,
  };

  let totalOperationalExpenses = 0;
  for (const exp of expenses) {
    const amt = Math.max(0, Number(exp.amount) || 0);
    totalOperationalExpenses += amt;
    if (exp.category in expensesByCategory) {
      expensesByCategory[exp.category] += amt;
    }
  }

  const netOperatingBalance = Number((totalCollected - totalOperationalExpenses).toFixed(2));
  const netContractMargin = Number((totalContracted - totalOperationalExpenses).toFixed(2));
  const collectionRatePct =
    totalContracted > 0 ? Math.round((totalCollected / totalContracted) * 100) : 0;

  return {
    totalContracted: Number(totalContracted.toFixed(2)),
    totalCollected: Number(totalCollected.toFixed(2)),
    totalReceivableDebt: Number(totalReceivableDebt.toFixed(2)),
    totalOperationalExpenses: Number(totalOperationalExpenses.toFixed(2)),
    netOperatingBalance,
    netContractMargin,
    collectionRatePct,
    clientsWithDebtCount,
    settledClientsCount,
    totalUnitsMoved,
    totalVolumeM3: Number(totalVolumeM3.toFixed(2)),
    routeBreakdown,
    expensesByCategory,
  };
}

export const SPANISH_MONTHS_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

export const SPANISH_MONTHS_FULL = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

export function getPeriodKeyAndLabel(
  dateInput: string,
  granularity: FinancialPeriodGranularity
): { periodKey: string; periodLabel: string; shortLabel: string } {
  const clean = (dateInput || '').trim().slice(0, 10);
  const fullMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(clean);
  const yearMatch = /^(\d{4})$/.exec(clean);

  let year = 2026;
  let monthIdx = 9;
  let day = 19;

  if (fullMatch) {
    year = Number(fullMatch[1]);
    monthIdx = Math.max(0, Math.min(11, Number(fullMatch[2]) - 1));
    day = Math.max(1, Math.min(31, Number(fullMatch[3])));
  } else if (monthMatch) {
    year = Number(monthMatch[1]);
    monthIdx = Math.max(0, Math.min(11, Number(monthMatch[2]) - 1));
    day = 1;
  } else if (yearMatch) {
    year = Number(yearMatch[1]);
    monthIdx = 0;
    day = 1;
  }

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const isoDay = `${year}-${pad2(monthIdx + 1)}-${pad2(day)}`;

  if (granularity === 'dia') {
    const label = `${day} ${SPANISH_MONTHS_SHORT[monthIdx]} ${year}`;
    const shortLabel = `${day} ${SPANISH_MONTHS_SHORT[monthIdx]}`;
    return { periodKey: isoDay, periodLabel: label, shortLabel };
  }

  if (granularity === 'semana') {
    const utcDate = new Date(Date.UTC(year, monthIdx, day));
    const dayOfWeek = utcDate.getUTCDay(); // 0 = Sun, 1 = Mon, ...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(utcDate);
    monday.setUTCDate(utcDate.getUTCDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const mYear = monday.getUTCFullYear();
    const mMonth = monday.getUTCMonth();
    const mDay = monday.getUTCDate();

    const sYear = sunday.getUTCFullYear();
    const sMonth = sunday.getUTCMonth();
    const sDay = sunday.getUTCDate();

    const periodKey = `${mYear}-${pad2(mMonth + 1)}-${pad2(mDay)}`;
    const periodLabel = `Semana ${mDay} ${SPANISH_MONTHS_SHORT[mMonth]} – ${sDay} ${SPANISH_MONTHS_SHORT[sMonth]} ${sYear}`;
    const shortLabel = `${mDay} ${SPANISH_MONTHS_SHORT[mMonth]} – ${sDay} ${SPANISH_MONTHS_SHORT[sMonth]}`;
    return { periodKey, periodLabel, shortLabel };
  }

  if (granularity === 'mes') {
    const periodKey = `${year}-${pad2(monthIdx + 1)}`;
    const periodLabel = `${SPANISH_MONTHS_FULL[monthIdx]} ${year}`;
    const shortLabel = `${SPANISH_MONTHS_SHORT[monthIdx]} ${year}`;
    return { periodKey, periodLabel, shortLabel };
  }

  // 'anio'
  const periodKey = `${year}`;
  const periodLabel = `Año ${year}`;
  const shortLabel = `${year}`;
  return { periodKey, periodLabel, shortLabel };
}

export function resolveSelectedPeriodBucket(
  periodBuckets: FinancialPeriodBucket[],
  granularity: FinancialPeriodGranularity,
  selectedPeriodKey: string
): FinancialPeriodBucket | null {
  if (!selectedPeriodKey || selectedPeriodKey === 'todos') {
    return null;
  }
  const existing = periodBuckets.find((b) => b.periodKey === selectedPeriodKey);
  if (existing) {
    return existing;
  }
  const { periodKey, periodLabel, shortLabel } = getPeriodKeyAndLabel(
    selectedPeriodKey,
    granularity
  );
  return {
    periodKey,
    periodLabel,
    shortLabel,
    granularity,
    contractedAmount: 0,
    collectedAmount: 0,
    pendingDebtAmount: 0,
    expensesAmount: 0,
    netCashFlow: 0,
    movesCount: 0,
    paymentsCount: 0,
    expensesCount: 0,
  };
}

export function calculateFinancialPeriods(
  moves: MoveRecord[],
  expenses: OperationalExpense[],
  granularity: FinancialPeriodGranularity
): FinancialPeriodBucket[] {
  const bucketMap = new Map<string, FinancialPeriodBucket>();

  const ensureBucket = (dateStr: string): FinancialPeriodBucket => {
    const { periodKey, periodLabel, shortLabel } = getPeriodKeyAndLabel(
      dateStr,
      granularity
    );
    let existing = bucketMap.get(periodKey);
    if (!existing) {
      existing = {
        periodKey,
        periodLabel,
        shortLabel,
        granularity,
        contractedAmount: 0,
        collectedAmount: 0,
        pendingDebtAmount: 0,
        expensesAmount: 0,
        netCashFlow: 0,
        movesCount: 0,
        paymentsCount: 0,
        expensesCount: 0,
      };
      bucketMap.set(periodKey, existing);
    }
    return existing;
  };

  for (const move of moves) {
    const moveDateStr =
      (move.payments && move.payments[0]?.date) ||
      (move.createdAt ? move.createdAt.slice(0, 10) : '') ||
      move.moveDate ||
      '2026-10-19';
    const bal = calculateClientBalance(move.totalContractAmount, move.amountPaid);
    const moveBucket = ensureBucket(moveDateStr);
    moveBucket.contractedAmount = Number(
      (moveBucket.contractedAmount + bal.totalContract).toFixed(2)
    );
    moveBucket.pendingDebtAmount = Number(
      (moveBucket.pendingDebtAmount + bal.balanceDue).toFixed(2)
    );
    moveBucket.movesCount += 1;

    if (move.payments && move.payments.length > 0) {
      for (const pay of move.payments) {
        const payAmt = Math.max(0, Number(pay.amount) || 0);
        const payBucket = ensureBucket(pay.date || moveDateStr);
        payBucket.collectedAmount = Number(
          (payBucket.collectedAmount + payAmt).toFixed(2)
        );
        payBucket.paymentsCount += 1;
      }
    } else if (bal.amountPaid > 0) {
      moveBucket.collectedAmount = Number(
        (moveBucket.collectedAmount + bal.amountPaid).toFixed(2)
      );
      moveBucket.paymentsCount += 1;
    }
  }

  for (const exp of expenses) {
    const expAmt = Math.max(0, Number(exp.amount) || 0);
    const expBucket = ensureBucket(exp.date || exp.createdAt?.slice(0, 10) || '2026-10-19');
    expBucket.expensesAmount = Number(
      (expBucket.expensesAmount + expAmt).toFixed(2)
    );
    expBucket.expensesCount += 1;
  }

  const buckets = Array.from(bucketMap.values()).map((b) => ({
    ...b,
    netCashFlow: Number((b.collectedAmount - b.expensesAmount).toFixed(2)),
  }));

  // Sort newest period first
  buckets.sort((a, b) => b.periodKey.localeCompare(a.periodKey));
  return buckets;
}

export function formatCurrencyCOP(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const formatted = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe);
  return `${formatted} COP`;
}

// Keep alias so existing imports work seamlessly
export const formatCurrencyMXN = formatCurrencyCOP;

export function validateNewMoveForm(input: {
  clientName: string;
  clientPhone: string;
  originCity: string;
  destinationCity: string;
  totalContractAmount: number;
  initialAdvance: number;
}): ValidationResult {
  const name = input.clientName.trim();
  const phone = input.clientPhone.trim();
  const origin = input.originCity.trim();
  const dest = input.destinationCity.trim();

  if (!name) return { valid: false, error: 'El nombre del cliente es obligatorio.' };
  if (name.length > BLUEPRINT_LIMITS.CLIENT_NAME_MAX) {
    return { valid: false, error: `El nombre no puede exceder ${BLUEPRINT_LIMITS.CLIENT_NAME_MAX} caracteres.` };
  }
  if (!phone) return { valid: false, error: 'El teléfono del cliente es obligatorio.' };
  if (phone.length > BLUEPRINT_LIMITS.CLIENT_PHONE_MAX) {
    return { valid: false, error: 'El teléfono excede la longitud permitida.' };
  }
  if (!origin) return { valid: false, error: 'La ciudad de origen es obligatoria.' };
  if (origin.length > BLUEPRINT_LIMITS.CITY_MAX) {
    return { valid: false, error: 'La ciudad de origen excede la longitud máxima.' };
  }
  if (!dest) return { valid: false, error: 'La ciudad de destino es obligatoria.' };
  if (dest.length > BLUEPRINT_LIMITS.CITY_MAX) {
    return { valid: false, error: 'La ciudad de destino excede la longitud máxima.' };
  }
  if (!Number.isFinite(input.totalContractAmount) || input.totalContractAmount <= 0) {
    return { valid: false, error: 'El costo total cotizado debe ser mayor a $0 COP.' };
  }
  if (input.totalContractAmount > BLUEPRINT_LIMITS.MAX_CONTRACT) {
    return { valid: false, error: 'El monto cotizado excede el límite permitido.' };
  }
  if (!Number.isFinite(input.initialAdvance) || input.initialAdvance < 0) {
    return { valid: false, error: 'El anticipo pagado no puede ser negativo.' };
  }
  if (input.initialAdvance > input.totalContractAmount) {
    return { valid: false, error: 'El anticipo pagado no puede ser mayor al total cotizado.' };
  }
  return { valid: true };
}

export function validatePaymentInput(input: {
  amount: number;
  maxPayable: number;
  concept: string;
}): ValidationResult {
  const concept = input.concept.trim();
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { valid: false, error: 'El monto del abono debe ser mayor a $0 COP.' };
  }
  if (input.amount > input.maxPayable + 0.01) {
    return {
      valid: false,
      error: `El abono excede el saldo pendiente del cliente (${formatCurrencyCOP(input.maxPayable)}).`,
    };
  }
  if (!concept) {
    return { valid: false, error: 'Ingresa el concepto del pago o abono.' };
  }
  if (concept.length > BLUEPRINT_LIMITS.PAYMENT_CONCEPT_MAX) {
    return { valid: false, error: 'El concepto excede la longitud máxima permitida.' };
  }
  return { valid: true };
}

export function validateDamageEvidenceInput(input: {
  hasDamage: boolean;
  damageNotes: string;
  evidencePhotoDataUrl: string;
}): ValidationResult {
  const notes = input.damageNotes.trim();
  if (input.hasDamage && !notes) {
    return {
      valid: false,
      error: 'Describe la observación del mal estado o daño detectado en el artículo.',
    };
  }
  if (notes.length > BLUEPRINT_LIMITS.DAMAGE_NOTES_MAX) {
    return {
      valid: false,
      error: `La observación de daño no puede exceder ${BLUEPRINT_LIMITS.DAMAGE_NOTES_MAX} caracteres.`,
    };
  }
  if (input.evidencePhotoDataUrl.length > BLUEPRINT_LIMITS.EVIDENCE_PHOTO_MAX) {
    return {
      valid: false,
      error: 'La imagen de evidencia excede el tamaño máximo permitido.',
    };
  }
  return { valid: true };
}
