import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowRight,
  Package,
  DollarSign,
  Plus,
  FileText,
  Trash2,
  ShieldCheck,
  Lock,
  Camera,
  Download,
  Clock,
} from 'lucide-react';
import type { MoveRecord, InventoryItem, UserRole } from '../types.ts';
import {
  calculateClientBalance,
  calculateInventoryMetrics,
  formatCurrencyCOP,
  canDeleteClientRecord,
  getPhotoRetentionStatus,
  PHOTO_RETENTION_DAYS,
} from '../utils/finance.ts';
import { CameraEvidenceModal } from './CameraEvidenceModal.tsx';

interface ClientsInventoryViewProps {
  moves: MoveRecord[];
  userRole: UserRole;
  onSelectMove: (moveId: string, initialTab?: 'inventory' | 'statement') => void;
  onOpenPaymentModal: (moveId: string) => void;
  onOpenNewMoveModal: () => void;
  onRequestDeleteMove: (moveId: string) => void;
  onOpenPdfModal: (move: MoveRecord) => void;
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
}

type ClientFilter =
  | 'todos'
  | 'colombia'
  | 'venezuela'
  | 'ecuador'
  | 'con_deuda'
  | 'liquidados';

const STATUS_LABELS: Record<MoveRecord['status'], string> = {
  programada: 'Programada',
  en_transito: 'En Tránsito',
  entregada: 'Entregada',
  liquidada: 'Liquidada',
};

export const ClientsInventoryView: React.FC<ClientsInventoryViewProps> = ({
  moves,
  userRole,
  onSelectMove,
  onOpenPaymentModal,
  onOpenNewMoveModal,
  onRequestDeleteMove,
  onOpenPdfModal,
  onUpdateInventoryItemDamage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('todos');
  const [activeCameraTarget, setActiveCameraTarget] = useState<{
    move: MoveRecord;
    item: InventoryItem;
  } | null>(null);

  const isAdmin = canDeleteClientRecord(userRole);

  const filteredMoves = useMemo(() => {
    return moves.filter((move) => {
      const bal = calculateClientBalance(move.totalContractAmount, move.amountPaid);
      const routeText = `${move.originCity} ${move.destinationCity}`.toLowerCase();

      if (filter === 'con_deuda' && bal.balanceDue <= 0) return false;
      if (filter === 'liquidados' && bal.balanceDue > 0) return false;
      if (filter === 'colombia' && !routeText.includes('colombia')) return false;
      if (filter === 'venezuela' && !routeText.includes('venezuela')) return false;
      if (filter === 'ecuador' && !routeText.includes('ecuador')) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchesClient =
        move.clientName.toLowerCase().includes(q) ||
        move.folio.toLowerCase().includes(q) ||
        move.originCity.toLowerCase().includes(q) ||
        move.destinationCity.toLowerCase().includes(q) ||
        move.inventory.some((item) => item.name.toLowerCase().includes(q));

      return matchesClient;
    });
  }, [moves, searchQuery, filter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">
            Padrón de Clientes · Rutas en Colombia, Venezuela y Ecuador · Moneda: COP
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Control de Clientes, Inventario con Cámara y Saldos (COP)
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {filteredMoves.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenPdfModal(filteredMoves[0])}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              Descargar Inventario PDF
            </button>
          )}
          <button
            type="button"
            onClick={onOpenNewMoveModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva Mudanza / Cliente
          </button>
        </div>
      </div>

      {/* Role Permission Banner */}
      <div
        data-testid="role-permission-banner"
        className={`px-4 py-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
          isAdmin
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            : 'bg-amber-50/80 border-amber-200 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : (
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
          )}
          <span>
            {isAdmin ? (
              <>
                <strong>Perfil Activo: Administrador General</strong> — Tienes permisos completos para tomar fotos de artículos con cámara, gestionar inventario y <strong>eliminar clientes creados</strong>.
              </>
            ) : (
              <>
                <strong>Perfil Activo: Usuario (Operador de Inventario)</strong> — Puedes gestionar el inventario de cosas que lleva el cliente y <strong>tomar fotos a los artículos con cámara</strong>, pero <strong>no puedes eliminar clientes</strong>.
              </>
            )}
          </span>
        </div>
        <span className="font-mono text-[11px] font-semibold shrink-0">
          {isAdmin ? 'Permiso Eliminar: HABILITADO' : 'Permiso Eliminar: BLOQUEADO'}
        </span>
      </div>

      {/* Search & Interactive Segmented Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <label htmlFor="client-search-input" className="sr-only">
            Buscar por cliente, ciudad de origen, ciudad de destino o artículo de inventario
          </label>
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="client-search-input"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar cliente, ciudad (Bogotá, Caracas, Quito) o mueble..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div
          role="group"
          aria-label="Filtrar clientes por país o estado de saldo"
          className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
        >
          {(
            [
              { id: 'todos', label: 'Todos' },
              { id: 'colombia', label: 'Colombia' },
              { id: 'venezuela', label: 'Venezuela' },
              { id: 'ecuador', label: 'Ecuador' },
              { id: 'con_deuda', label: 'Con Deuda' },
              { id: 'liquidados', label: 'Liquidados' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client Cards with Interactive Inventory + Direct Camera Buttons */}
      {filteredMoves.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-base font-semibold text-slate-900">
            No se encontraron clientes con ese criterio de búsqueda
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Intenta limpiar el filtro activo o registra un nuevo expediente de mudanza con su ruta e inventario.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilter('todos');
            }}
            className="mt-4 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Mostrar Todos los Clientes
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMoves.map((move) => {
            const bal = calculateClientBalance(move.totalContractAmount, move.amountPaid);
            const inv = calculateInventoryMetrics(move.inventory);

            return (
              <article
                key={move.id}
                className="bg-white border border-slate-200 rounded-xl p-6 transition-colors hover:border-slate-300"
              >
                {/* Top Row: Client Info, Route Origin -> Destination, and Financial Totals */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono tabular-nums font-semibold text-slate-700">
                        {move.folio}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{STATUS_LABELS[move.status]}</span>
                      <span aria-hidden="true">·</span>
                      <span>Salida: {move.moveDate}</span>
                      <span aria-hidden="true">·</span>
                      <span>Tel: {move.clientPhone}</span>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900">
                      {move.clientName}
                    </h2>

                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800 pt-0.5">
                      <span>Origen: {move.originCity}</span>
                      <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Destino: {move.destinationCity}</span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-xs font-mono tabular-nums text-slate-500">
                        {move.distanceKm} km ({move.truckUnit})
                      </span>
                    </div>
                  </div>

                  {/* Financial Summary Block */}
                  <div className="grid grid-cols-3 gap-4 sm:gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Total Flete (COP)</span>
                      <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-slate-900">
                        {formatCurrencyCOP(bal.totalContract)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Saldo Pagado</span>
                      <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-emerald-700">
                        {formatCurrencyCOP(bal.amountPaid)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Saldo que Debe</span>
                      <span
                        className={`text-sm sm:text-base font-bold font-mono tabular-nums ${
                          bal.balanceDue > 0 ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {formatCurrencyCOP(bal.balanceDue)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Inventory Articles List with Direct Camera Photo Buttons */}
                <div className="pt-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
                      <span>
                        Artículos del Inventario ({inv.totalUnits} piezas en {inv.distinctLines}{' '}
                        partidas)
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Volumen: {inv.totalVolumeM3} m³
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Peso: {inv.totalWeightKg} kg
                      </span>
                      {inv.itemsWithEvidenceCount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-700 font-mono tabular-nums">
                            {inv.itemsWithEvidenceCount} con foto de cámara
                          </span>
                        </>
                      )}
                      {inv.damagedUnits > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-red-700 font-mono tabular-nums">
                            {inv.damagedUnits} pzas con observación de mal estado
                          </span>
                        </>
                      )}
                    </div>

                    <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md font-medium inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" />
                      Fotos comprimidas HD sin pérdida · Se auto-eliminan a los {PHOTO_RETENTION_DAYS} días de publicadas
                    </span>
                  </div>

                  {/* Interactive Article Cards with Direct Camera Button & Photo Thumbnail */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {move.inventory.map((item) => {
                      const hasPhoto = Boolean(
                        item.evidencePhotoDataUrl &&
                          item.evidencePhotoDataUrl.trim().length > 0
                      );
                      const retention = hasPhoto
                        ? getPhotoRetentionStatus(
                            item.evidencePhotoCreatedAt ||
                              item.updatedAt ||
                              item.createdAt
                          )
                        : null;
                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                            item.hasDamage
                              ? 'bg-red-50/40 border-red-200'
                              : hasPhoto
                              ? 'bg-amber-50/40 border-amber-200'
                              : 'bg-slate-50/80 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {hasPhoto && (
                              <button
                                type="button"
                                onClick={() => setActiveCameraTarget({ move, item })}
                                className="shrink-0 rounded-lg overflow-hidden border border-amber-300 hover:border-slate-900 cursor-pointer"
                                title="Ver o cambiar foto del artículo"
                              >
                                <img
                                  src={item.evidencePhotoDataUrl}
                                  alt={`Foto de ${item.name}`}
                                  referrerPolicy="no-referrer"
                                  className="w-14 h-10 object-cover"
                                />
                              </button>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">
                                <span className="font-mono tabular-nums font-bold">
                                  {item.quantity}x
                                </span>{' '}
                                {item.name}
                              </div>
                              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span>{item.category}</span>
                                <span>·</span>
                                <span className="font-mono">
                                  {(item.quantity * item.volumeM3).toFixed(1)} m³
                                </span>
                                {item.hasDamage && (
                                  <span className="text-red-700 font-semibold">
                                    · Daño: {item.damageNotes || 'Reportado'}
                                  </span>
                                )}
                                {retention && (
                                  <span className="text-amber-800 font-medium inline-flex items-center gap-0.5">
                                    · <Clock className="w-2.5 h-2.5" /> {retention.daysRemaining}d vigencia
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setActiveCameraTarget({ move, item })}
                            aria-label={`Tomar foto con cámara al artículo ${item.name}`}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 cursor-pointer ${
                              hasPhoto || item.hasDamage
                                ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                                : 'bg-slate-900 text-white hover:bg-slate-800'
                            }`}
                          >
                            <Camera className="w-3.5 h-3.5" />
                            {hasPhoto ? 'Ver / Cambiar Foto' : 'Tomar Foto'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Card Footer Action Bar */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      data-testid={`download-pdf-btn-${move.id}`}
                      onClick={() => onOpenPdfModal(move)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar Inventario PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectMove(move.id, 'inventory')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-amber-800" />
                      Abrir Inventario Completo y Cámara ({inv.totalUnits})
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectMove(move.id, 'statement')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Estado de Cuenta
                    </button>
                    {bal.balanceDue > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenPaymentModal(move.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Registrar Abono
                      </button>
                    )}

                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => onRequestDeleteMove(move.id)}
                        aria-label={`Eliminar cliente ${move.clientName}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar Cliente
                      </button>
                    ) : (
                      <span
                        title="El usuario de inventario no puede eliminar clientes creados"
                        className="inline-flex items-center gap-1 px-3 py-2 text-[11px] font-medium text-slate-400 bg-slate-50 border border-slate-200 rounded-lg whitespace-nowrap shrink-0 select-none"
                      >
                        <Lock className="w-3 h-3" />
                        Solo Admin elimina
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Direct Camera Modal from Clients & Inventory View */}
      <CameraEvidenceModal
        isOpen={activeCameraTarget !== null}
        itemName={activeCameraTarget?.item.name || ''}
        folio={activeCameraTarget?.move.folio || 'INV-CONTROL'}
        initialHasDamage={activeCameraTarget?.item.hasDamage ?? true}
        initialDamageNotes={activeCameraTarget?.item.damageNotes || ''}
        initialPhotoDataUrl={activeCameraTarget?.item.evidencePhotoDataUrl || ''}
        onClose={() => setActiveCameraTarget(null)}
        onSaveEvidence={(payload) => {
          if (activeCameraTarget) {
            onUpdateInventoryItemDamage(
              activeCameraTarget.move.id,
              activeCameraTarget.item.id,
              payload
            );
          }
          setActiveCameraTarget(null);
        }}
      />
    </div>
  );
};
