export type MoveStatus = 'programada' | 'en_transito' | 'entregada' | 'liquidada';

export type UserRole = 'administrador' | 'usuario_inventario';

export type AndeanCountry = 'Colombia' | 'Venezuela' | 'Ecuador';

export type FinancialPeriodGranularity = 'dia' | 'semana' | 'mes' | 'anio';

export interface FinancialPeriodBucket {
  periodKey: string;
  periodLabel: string;
  shortLabel: string;
  granularity: FinancialPeriodGranularity;
  contractedAmount: number;
  collectedAmount: number;
  pendingDebtAmount: number;
  expensesAmount: number;
  netCashFlow: number;
  movesCount: number;
  paymentsCount: number;
  expensesCount: number;
}

export interface SystemUser {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  branchCity: string;
  active: boolean;
  createdAt: string;
}

export type InventoryCategory =
  | 'Sala y Comedor'
  | 'Recámara'
  | 'Línea Blanca'
  | 'Cocina y Cajas'
  | 'Oficina y Electrónicos'
  | 'Especial / Frágil';

export type PaymentMethod =
  | 'Transferencia Bancolombia / PSE'
  | 'Nequi / Daviplata'
  | 'Efectivo COP'
  | 'Tarjeta / Datáfono'
  | 'Consignación Bancaria'
  | 'Transferencia SPEI'
  | 'Efectivo'
  | 'Tarjeta'
  | 'Depósito Bancario';

export type ExpenseCategory =
  | 'Combustible y Diésel'
  | 'Casetas y Peajes'
  | 'Maniobras y Cargadores'
  | 'Material de Embalaje'
  | 'Mantenimiento de Unidad'
  | 'Otros';

export interface InventoryItem {
  id: string;
  ownerId: string;
  moveId: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  volumeM3: number;
  weightKg: number;
  isFragile: boolean;
  conditionNotes: string;
  hasDamage?: boolean;
  damageNotes?: string;
  evidencePhotoDataUrl?: string;
  evidencePhotoCreatedAt?: string;
  evidencePhotoOriginalBytes?: number;
  evidencePhotoCompressedBytes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentEntry {
  id: string;
  ownerId: string;
  moveId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  concept: string;
  reference: string;
  createdAt: string;
  updatedAt: string;
}

export interface MoveRecord {
  id: string;
  ownerId: string;
  folio: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  originCity: string;
  destinationCity: string;
  moveDate: string;
  status: MoveStatus;
  truckUnit: string;
  distanceKm: number;
  totalContractAmount: number;
  amountPaid: number;
  notes: string;
  inventory: InventoryItem[];
  payments: PaymentEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface OperationalExpense {
  id: string;
  ownerId: string;
  moveId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
  routeLabel: string;
  createdAt: string;
  updatedAt: string;
}

export type ActiveTab = 'dashboard' | 'clientes' | 'finanzas' | 'estados_cuenta';
