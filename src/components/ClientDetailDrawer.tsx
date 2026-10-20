import React, { useState } from 'react';
import {
  X,
  ArrowRight,
  Plus,
  Trash2,
  DollarSign,
  Printer,
  Package,
  FileText,
  Camera,
  AlertTriangle,
  Lock,
  Download,
  Clock,
} from 'lucide-react';
import type {
  MoveRecord,
  InventoryCategory,
  InventoryItem,
  MoveStatus,
  UserRole,
} from '../types.ts';
import {
  calculateClientBalance,
  calculateInventoryMetrics,
  formatCurrencyCOP,
  canDeleteClientRecord,
  BLUEPRINT_LIMITS,
  getPhotoRetentionStatus,
} from '../utils/finance.ts';
import { CameraEvidenceModal } from './CameraEvidenceModal.tsx';

interface ClientDetailDrawerProps {
  move: MoveRecord | null;
  userRole: UserRole;
  initialTab: 'inventory' | 'statement';
  onClose: () => void;
  onOpenPdfModal: (move: MoveRecord) => void;
  onAddInventoryItem: (
    moveId: string,
    item: Omit<InventoryItem, 'id' | 'ownerId' | 'moveId' | 'createdAt' | 'updatedAt'>
  ) => void;
  onUpdateInventoryItemDamage: (
    moveId: string,
    itemId: string,
    payload: {
      hasDamage: boolean;
      damageNotes: string;
      evidencePhotoDataUrl: string;
      evidencePhotoCreatedAt?: string;
      evidencePhotoOriginalBytes?: number;
      evidencePhotoCompressedBytes?: number;
    }
  ) => void;
  onRemoveInventoryItem: (moveId: string, itemId: string) => void;
  onUpdateMoveStatus: (moveId: string, status: MoveStatus) => void;
  onOpenPaymentModal: (moveId: string) => void;
  onRequestDeleteMove: (moveId: string) => void;
}

const INVENTORY_CATEGORIES: InventoryCategory[] = [
  'Sala y Comedor',
  'Recámara',
  'Línea Blanca',
  'Cocina y Cajas',
  'Oficina y Electrónicos',
  'Especial / Frágil',
];

export const ClientDetailDrawer: React.FC<ClientDetailDrawerProps> = ({
  move,
  userRole,
  initialTab,
  onClose,
  onOpenPdfModal,
  onAddInventoryItem,
  onUpdateInventoryItemDamage,
  onRemoveInventoryItem,
  onUpdateMoveStatus,
  onOpenPaymentModal,
  onRequestDeleteMove,
}) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'statement'>(initialTab);

  // Add inventory item state
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState<InventoryCategory>('Sala y Comedor');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemVolume, setItemVolume] = useState('0.5');
  const [itemWeight, setItemWeight] = useState('25');
  const [itemFragile, setItemFragile] = useState(false);
  const [itemNotes, setItemNotes] = useState('');
  const [draftHasDamage, setDraftHasDamage] = useState(false);
  const [draftDamageNotes, setDraftDamageNotes] = useState('');
  const [draftEvidencePhoto, setDraftEvidencePhoto] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Camera modal state: either for draft ('draft') or for an existing item
  const [cameraModalTarget, setCameraModalTarget] = useState<
    | { mode: 'draft' }
    | { mode: 'existing'; item: InventoryItem }
    | null
  >(null);

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, move?.id]);

  if (!move) return null;

  const bal = calculateClientBalance(move.totalContractAmount, move.amountPaid);
  const inv = calculateInventoryMetrics(move.inventory);
  const isAdmin = canDeleteClientRecord(userRole);

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = itemName.trim();
    if (!trimmedName) {
      setFormError('Ingresa el nombre o descripción del mueble o caja.');
      return;
    }
    if (trimmedName.length > BLUEPRINT_LIMITS.ITEM_NAME_MAX) {
      setFormError('El nombre del artículo excede 120 caracteres.');
      return;
    }

    const qty = Number(itemQuantity);
    const vol = Number(itemVolume);
    const weight = Number(itemWeight);

    if (!Number.isFinite(qty) || qty < 1) {
      setFormError('La cantidad debe ser al menos 1.');
      return;
    }
    if (!Number.isFinite(vol) || vol < 0) {
      setFormError('El volumen en m³ debe ser un número válido.');
      return;
    }

    onAddInventoryItem(move.id, {
      name: trimmedName,
      category: itemCategory,
      quantity: Math.round(qty),
      volumeM3: Number(vol.toFixed(2)),
      weightKg: Number(Math.max(0, weight || 0).toFixed(1)),
      isFragile: itemFragile,
      conditionNotes: itemNotes.trim().slice(0, BLUEPRINT_LIMITS.ITEM_NOTES_MAX),
      hasDamage: draftHasDamage,
      damageNotes: draftDamageNotes.trim().slice(0, BLUEPRINT_LIMITS.DAMAGE_NOTES_MAX),
      evidencePhotoDataUrl: draftEvidencePhoto,
    });

    setItemName('');
    setItemQuantity('1');
    setItemVolume('0.5');
    setItemWeight('25');
    setItemFragile(false);
    setItemNotes('');
    setDraftHasDamage(false);
    setDraftDamageNotes('');
    setDraftEvidencePhoto('');
  };

  // Compute running balance ledger for detailed statement
  let runningDebt = bal.totalContract;
  const statementRows = move.payments.map((pay) => {
    runningDebt = Math.max(0, Number((runningDebt - pay.amount).toFixed(2)));
    return {
      ...pay,
      remainingAfter: runningDebt,
    };
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-client-title"
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs"
    >
      <div className="w-full max-w-4xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col justify-between">
        <div>
          {/* Sticky Top Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                <span className="font-mono tabular-nums font-semibold text-slate-800 whitespace-nowrap">
                  {move.folio}
                </span>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap">Tel: {move.clientPhone}</span>
                {move.clientEmail && (
                  <>
                    <span aria-hidden="true" className="hidden sm:inline">·</span>
                    <span className="hidden sm:inline truncate">{move.clientEmail}</span>
                  </>
                )}
              </div>
              <h2
                id="drawer-client-title"
                className="text-lg sm:text-xl font-bold text-slate-900 truncate mt-0.5"
              >
                {move.clientName}
              </h2>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
              <label htmlFor="drawer-status-select" className="sr-only">
                Estado operativo de la mudanza
              </label>
              <select
                id="drawer-status-select"
                value={move.status}
                onChange={(e) =>
                  onUpdateMoveStatus(move.id, e.target.value as MoveStatus)
                }
                disabled={move.status === 'liquidada'}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 border border-slate-300 rounded-lg text-slate-800 focus:outline-none"
              >
                <option value="programada">Estado: Programada</option>
                <option value="en_transito">Estado: En Tránsito</option>
                <option value="entregada">Estado: Entregada</option>
                <option value="liquidada">Estado: Liquidada</option>
              </select>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar expediente de cliente"
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Route & Financial Banner */}
          <div className="px-4 sm:px-6 py-4 bg-slate-50 border-b border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span>{move.originCity}</span>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{move.destinationCity}</span>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-600">
                {move.distanceKm} km · {move.truckUnit} · Salida: {move.moveDate}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-white border border-slate-200 rounded-xl p-4">
              <div>
                <span className="text-xs text-slate-500 block">Costo Total Mudanza (COP)</span>
                <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900 whitespace-nowrap">
                  {formatCurrencyCOP(bal.totalContract)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Saldo Pagado</span>
                <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-emerald-700 whitespace-nowrap block">
                  {formatCurrencyCOP(bal.amountPaid)}
                </span>
                <span className="text-[11px] font-medium text-emerald-700">
                  {bal.paidPercentage}% cubierto
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Saldo que Debe</span>
                <span
                  className={`text-base sm:text-lg font-bold font-mono tabular-nums whitespace-nowrap block ${
                    bal.balanceDue > 0 ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {formatCurrencyCOP(bal.balanceDue)}
                </span>
                <span className="text-[11px] text-slate-500">
                  {bal.paymentStateLabel}
                </span>
              </div>
              <div className="flex items-center justify-end">
                {bal.balanceDue > 0 ? (
                  <button
                    type="button"
                    onClick={() => onOpenPaymentModal(move.id)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <DollarSign className="w-4 h-4" />
                    Registrar Abono
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-emerald-700">
                    Cuenta Liquidada al 100%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Segmented View Switcher: Inventario vs Estado de Cuenta */}
          <div className="px-6 pt-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'inventory'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                Inventario de Cosas que Lleva ({inv.totalUnits})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('statement')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'statement'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Estado de Cuenta y Pagos ({move.payments.length})
              </button>
            </div>

            <div className="pb-3">
              <button
                type="button"
                data-testid="drawer-download-pdf-btn"
                onClick={() => onOpenPdfModal(move)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar Inventario PDF
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'inventory' ? (
              <div className="space-y-6">
                {/* Inventory Metrics Summary */}
                <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                  <div>
                    <span>Total de cosas inventariadas: </span>
                    <strong className="font-mono tabular-nums text-slate-900">
                      {inv.totalUnits} piezas ({inv.distinctLines} partidas)
                    </strong>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
                    <span>Volumen: {inv.totalVolumeM3} m³</span>
                    <span aria-hidden="true">·</span>
                    <span>Peso est.: {inv.totalWeightKg} kg</span>
                    <span aria-hidden="true">·</span>
                    <span>Frágiles: {inv.fragileUnits} pzas</span>
                    {inv.damagedUnits > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-red-700 font-semibold">
                          Con daño previo: {inv.damagedUnits} pzas
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Add Item Form with Camera Evidence Integration */}
                <form
                  onSubmit={handleCreateItem}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-900">
                      Agregar Cosa / Mueble / Caja al Inventario del Cliente
                    </h3>
                    <button
                      type="button"
                      onClick={() => setCameraModalTarget({ mode: 'draft' })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors cursor-pointer self-start"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {draftEvidencePhoto || draftHasDamage
                        ? 'Ver / Cambiar Foto del Artículo'
                        : 'Tomar Foto al Artículo con Cámara'}
                    </button>
                  </div>

                  {formError && (
                    <p role="alert" className="text-xs font-medium text-red-600">
                      {formError}
                    </p>
                  )}

                  {/* Draft Damage Evidence Banner if attached */}
                  {(draftHasDamage || draftEvidencePhoto || draftDamageNotes) && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {draftEvidencePhoto && (
                          <img
                            src={draftEvidencePhoto}
                            alt="Previsualización de evidencia"
                            referrerPolicy="no-referrer"
                            className="w-16 h-11 object-cover rounded border border-amber-300 shrink-0"
                          />
                        )}
                        <div className="text-xs">
                          <span className="font-bold text-amber-900 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                            Evidencia de Mal Estado Lista para Guardar
                          </span>
                          <p className="text-amber-800 mt-0.5">
                            {draftDamageNotes || 'Con fotografía de evidencia adjunta'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftHasDamage(false);
                          setDraftDamageNotes('');
                          setDraftEvidencePhoto('');
                        }}
                        className="text-xs text-slate-500 hover:text-red-600 shrink-0 cursor-pointer"
                      >
                        Quitar evidencia
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5">
                      <label
                        htmlFor="inv-item-name"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Descripción del mueble o caja
                      </label>
                      <input
                        id="inv-item-name"
                        type="text"
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        placeholder="Ej. Comedor 6 puestos, Nevecón, Cajas..."
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label
                        htmlFor="inv-item-category"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Categoría
                      </label>
                      <select
                        id="inv-item-category"
                        value={itemCategory}
                        onChange={(e) =>
                          setItemCategory(e.target.value as InventoryCategory)
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                      >
                        {INVENTORY_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="inv-item-qty"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Cantidad
                      </label>
                      <input
                        id="inv-item-qty"
                        type="number"
                        min="1"
                        max="1000"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="inv-item-vol"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Volumen Unit. (m³)
                      </label>
                      <input
                        id="inv-item-vol"
                        type="number"
                        step="0.05"
                        min="0"
                        value={itemVolume}
                        onChange={(e) => setItemVolume(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-6">
                      <label
                        htmlFor="inv-item-notes"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Condición / Notas de embalaje
                      </label>
                      <input
                        id="inv-item-notes"
                        type="text"
                        value={itemNotes}
                        onChange={(e) => setItemNotes(e.target.value)}
                        placeholder="Ej. Vinipel doble, vidrio templado, caja numerada..."
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>

                    <div className="sm:col-span-3 flex items-center gap-2 pb-2">
                      <input
                        id="inv-item-fragile"
                        type="checkbox"
                        checked={itemFragile}
                        onChange={(e) => setItemFragile(e.target.checked)}
                        className="rounded border-slate-300 text-slate-900"
                      />
                      <label
                        htmlFor="inv-item-fragile"
                        className="text-xs font-medium text-slate-700"
                      >
                        Manejo Frágil / Delicado
                      </label>
                    </div>

                    <div className="sm:col-span-3">
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Agregar al Inventario
                      </button>
                    </div>
                  </div>
                </form>

                {/* Inventory Table with Camera Evidence & Damage Observations */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                        <th className="py-2.5 px-4">Cant.</th>
                        <th className="py-2.5 px-4">Artículo / Cosa que Lleva</th>
                        <th className="py-2.5 px-4 text-right">Volumen</th>
                        <th className="py-2.5 px-4">Embalaje y Observación de Daño</th>
                        <th className="py-2.5 px-4 text-right">Evidencia Cámara</th>
                        <th className="py-2.5 px-4 text-right">Quitar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {move.inventory.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono tabular-nums font-bold text-slate-900 align-top">
                            {item.quantity}x
                          </td>
                          <td className="py-3 px-4 align-top">
                            <div className="font-medium text-slate-900">
                              {item.name}
                              {item.isFragile && (
                                <span className="ml-1.5 text-[11px] font-semibold text-amber-700">
                                  · Frágil
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {item.category}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 align-top whitespace-nowrap">
                            {(item.quantity * item.volumeM3).toFixed(2)} m³
                          </td>
                          <td className="py-3 px-4 align-top">
                            <div className="text-slate-600">
                              {item.conditionNotes || 'Embalaje estándar'}
                            </div>
                            {(item.hasDamage || item.damageNotes) && (
                              <div className="mt-1.5 p-2 rounded-md bg-red-50/80 border border-red-200 text-red-900">
                                <span className="font-semibold block text-[11px] text-red-800">
                                  Observación de Mal Estado / Daño Previo:
                                </span>
                                <p className="text-[11px] mt-0.5">
                                  {item.damageNotes || 'Daño previo documentado en cargue'}
                                </p>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right align-top">
                            <div className="inline-flex flex-col items-end gap-1.5">
                              {item.evidencePhotoDataUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCameraModalTarget({ mode: 'existing', item })
                                  }
                                  className="group relative rounded overflow-hidden border border-slate-300 hover:border-slate-900 cursor-pointer"
                                  title="Ver evidencia fotográfica"
                                >
                                  <img
                                    src={item.evidencePhotoDataUrl}
                                    alt={`Evidencia de ${item.name}`}
                                    referrerPolicy="no-referrer"
                                    className="w-16 h-10 object-cover"
                                  />
                                </button>
                              )}
                              {item.evidencePhotoDataUrl && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800">
                                  <Clock className="w-2.5 h-2.5" />
                                  {
                                    getPhotoRetentionStatus(
                                      item.evidencePhotoCreatedAt ||
                                        item.updatedAt ||
                                        item.createdAt
                                    ).daysRemaining
                                  }
                                  d vigencia
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setCameraModalTarget({ mode: 'existing', item })
                                }
                                aria-label={`Tomar o ver evidencia con cámara para ${item.name}`}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                                  item.hasDamage || item.evidencePhotoDataUrl
                                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                                    : 'bg-slate-900 text-white hover:bg-slate-800'
                                }`}
                              >
                                <Camera className="w-3 h-3" />
                                {item.hasDamage || item.evidencePhotoDataUrl
                                  ? 'Ver / Cambiar Foto'
                                  : 'Tomar Foto'}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right align-top">
                            <button
                              type="button"
                              onClick={() => onRemoveInventoryItem(move.id, item.id)}
                              aria-label={`Eliminar ${item.name} del inventario`}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Detailed Account Statement Tab */
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Desglose de Estado de Cuenta del Cliente (COP)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Historial cronológico de cargos, anticipos, abonos y saldo insoluto en Pesos Colombianos
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir Estado de Cuenta
                    </button>
                    {bal.balanceDue > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenPaymentModal(move.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Nuevo Abono
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar of Account Liquidation */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-slate-800">
                      Avance de Liquidación del Servicio ({bal.paidPercentage}%)
                    </span>
                    <span className="font-mono tabular-nums text-slate-600">
                      Pagado {formatCurrencyCOP(bal.amountPaid)} de{' '}
                      {formatCurrencyCOP(bal.totalContract)}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${bal.paidPercentage}%` }}
                      className="h-full bg-emerald-600 transition-all"
                    />
                  </div>
                </div>

                {/* Chronological Ledger Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                        <th className="py-2.5 px-4">Fecha</th>
                        <th className="py-2.5 px-4">Movimiento / Concepto</th>
                        <th className="py-2.5 px-4">Método / Referencia</th>
                        <th className="py-2.5 px-4 text-right">Cargo (+)</th>
                        <th className="py-2.5 px-4 text-right">Abono Pagado (-)</th>
                        <th className="py-2.5 px-4 text-right">Saldo que Debe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {/* Initial Contract Row */}
                      <tr className="bg-slate-50/50">
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {move.moveDate}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          Cargo inicial por contrato de mudanza ({move.originCity} →{' '}
                          {move.destinationCity})
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          {move.folio}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {formatCurrencyCOP(bal.totalContract)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          —
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {formatCurrencyCOP(bal.totalContract)}
                        </td>
                      </tr>

                      {/* Payment Rows */}
                      {statementRows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {row.date}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900">
                            {row.concept}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {row.method}{' '}
                            {row.reference && (
                              <span className="font-mono tabular-nums text-slate-400">
                                · {row.reference}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">
                            —
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                            -{formatCurrencyCOP(row.amount)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                            {formatCurrencyCOP(row.remainingAfter)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-xs">
                        <td colSpan={3} className="py-3.5 px-4 text-slate-900">
                          Totales del Estado de Cuenta ({move.clientName})
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                          {formatCurrencyCOP(bal.totalContract)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                          {formatCurrencyCOP(bal.amountPaid)}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap ${
                            bal.balanceDue > 0 ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {formatCurrencyCOP(bal.balanceDue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span className="truncate max-w-md">
            Observaciones: {move.notes || 'Sin observaciones adicionales'}
          </span>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => onRequestDeleteMove(move.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar Cliente
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] text-slate-400 bg-slate-50 border border-slate-200 rounded-lg">
                <Lock className="w-3 h-3" />
                Rol Inventario: No puede eliminar cliente
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Camera Evidence Modal */}
      <CameraEvidenceModal
        isOpen={cameraModalTarget !== null}
        itemName={
          cameraModalTarget?.mode === 'existing'
            ? cameraModalTarget.item.name
            : itemName || 'Nuevo artículo'
        }
        folio={move.folio}
        initialHasDamage={
          cameraModalTarget?.mode === 'existing'
            ? Boolean(cameraModalTarget.item.hasDamage)
            : draftHasDamage || true
        }
        initialDamageNotes={
          cameraModalTarget?.mode === 'existing'
            ? cameraModalTarget.item.damageNotes || ''
            : draftDamageNotes
        }
        initialPhotoDataUrl={
          cameraModalTarget?.mode === 'existing'
            ? cameraModalTarget.item.evidencePhotoDataUrl || ''
            : draftEvidencePhoto
        }
        onClose={() => setCameraModalTarget(null)}
        onSaveEvidence={(payload) => {
          if (cameraModalTarget?.mode === 'existing') {
            onUpdateInventoryItemDamage(
              move.id,
              cameraModalTarget.item.id,
              payload
            );
          } else {
            setDraftHasDamage(payload.hasDamage);
            setDraftDamageNotes(payload.damageNotes);
            setDraftEvidencePhoto(payload.evidencePhotoDataUrl);
          }
        }}
      />
    </div>
  );
};
