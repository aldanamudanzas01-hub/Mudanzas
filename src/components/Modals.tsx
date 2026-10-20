import React, { useState } from 'react';
import { X, Plus, Trash2, AlertTriangle, ShieldAlert, Camera } from 'lucide-react';
import type {
  MoveRecord,
  InventoryCategory,
  PaymentMethod,
  ExpenseCategory,
  AndeanCountry,
} from '../types.ts';
import {
  validateNewMoveForm,
  validatePaymentInput,
  calculateClientBalance,
  formatCurrencyCOP,
  BLUEPRINT_LIMITS,
} from '../utils/finance.ts';
import { CameraEvidenceModal } from './CameraEvidenceModal.tsx';

export const ANDEAN_CITY_SUGGESTIONS: Record<AndeanCountry, string[]> = {
  Colombia: [
    'Bogotá D.C., Colombia',
    'Medellín, Colombia',
    'Cali, Colombia',
    'Barranquilla, Colombia',
    'Bucaramanga, Colombia',
    'Cartagena, Colombia',
    'Cúcuta, Colombia',
    'Pereira, Colombia',
    'Pasto, Colombia',
  ],
  Venezuela: [
    'Caracas, Venezuela',
    'Valencia, Venezuela',
    'Maracaibo, Venezuela',
    'San Cristóbal, Venezuela',
    'Barquisimeto, Venezuela',
    'Puerto La Cruz, Venezuela',
  ],
  Ecuador: [
    'Quito, Ecuador',
    'Guayaquil, Ecuador',
    'Cuenca, Ecuador',
    'Tulcán, Ecuador',
    'Ambato, Ecuador',
    'Manta, Ecuador',
  ],
};

/* -------------------------------------------------------------------------- */
/* 1. NEW MOVE / CLIENT MODAL                                                 */
/* -------------------------------------------------------------------------- */

interface DraftInventoryRow {
  tempId: string;
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
}

interface NewMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateMove: (payload: {
    clientName: string;
    clientPhone: string;
    clientEmail: string;
    originCity: string;
    destinationCity: string;
    moveDate: string;
    truckUnit: string;
    distanceKm: number;
    totalContractAmount: number;
    initialAdvance: number;
    advanceMethod: PaymentMethod;
    notes: string;
    items: Omit<DraftInventoryRow, 'tempId'>[];
  }) => void;
}

export const NewMoveModal: React.FC<NewMoveModalProps> = ({
  isOpen,
  onClose,
  onCreateMove,
}) => {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [originCountry, setOriginCountry] = useState<AndeanCountry>('Colombia');
  const [destCountry, setDestCountry] = useState<AndeanCountry>('Colombia');
  const [originCity, setOriginCity] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [moveDate, setMoveDate] = useState('2026-10-26');
  const [truckUnit, setTruckUnit] = useState('Chevrolet FTR · Furgón 65m³ (Placa WLU-412)');
  const [distanceKm, setDistanceKm] = useState('420');
  const [totalContractAmount, setTotalContractAmount] = useState('');
  const [initialAdvance, setInitialAdvance] = useState('');
  const [advanceMethod, setAdvanceMethod] = useState<PaymentMethod>(
    'Transferencia Bancolombia / PSE'
  );
  const [notes, setNotes] = useState('');

  // Quick inventory builder inside the New Move Modal
  const [draftItems, setDraftItems] = useState<DraftInventoryRow[]>([
    {
      tempId: 'd1',
      name: 'Sala modular de 3 cuerpos',
      category: 'Sala y Comedor',
      quantity: 1,
      volumeM3: 2.4,
      weightKg: 85,
      isFragile: false,
      conditionNotes: 'Emplayado protector en vinipel y manta',
    },
    {
      tempId: 'd2',
      name: 'Cajas medianas de menaje y loza',
      category: 'Cocina y Cajas',
      quantity: 12,
      volumeM3: 0.16,
      weightKg: 14,
      isFragile: true,
      conditionNotes: 'Cajas numeradas con burbuja',
    },
  ]);

  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] =
    useState<InventoryCategory>('Sala y Comedor');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemVol, setNewItemVol] = useState('0.8');
  const [newItemPhoto, setNewItemPhoto] = useState('');
  const [newItemHasDamage, setNewItemHasDamage] = useState(false);
  const [newItemDamageNotes, setNewItemDamageNotes] = useState('');
  const [cameraTargetTempId, setCameraTargetTempId] = useState<string | 'new_draft' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddDraftItem = () => {
    const trimmed = newItemName.trim();
    if (!trimmed) return;
    const qty = Math.max(1, Math.round(Number(newItemQty) || 1));
    const vol = Math.max(0.05, Number(newItemVol) || 0.5);

    setDraftItems((prev) => [
      ...prev,
      {
        tempId: `d_${Date.now()}`,
        name: trimmed.slice(0, BLUEPRINT_LIMITS.ITEM_NAME_MAX),
        category: newItemCategory,
        quantity: qty,
        volumeM3: vol,
        weightKg: Math.round(vol * 35),
        isFragile: newItemCategory === 'Especial / Frágil',
        conditionNotes: 'Registrado en cotización inicial',
        hasDamage: newItemHasDamage,
        damageNotes: newItemDamageNotes,
        evidencePhotoDataUrl: newItemPhoto,
      },
    ]);
    setNewItemName('');
    setNewItemQty('1');
    setNewItemPhoto('');
    setNewItemHasDamage(false);
    setNewItemDamageNotes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const totalNum = Number(totalContractAmount);
    const advanceNum = initialAdvance.trim() === '' ? 0 : Number(initialAdvance);

    const check = validateNewMoveForm({
      clientName,
      clientPhone,
      originCity,
      destinationCity,
      totalContractAmount: totalNum,
      initialAdvance: advanceNum,
    });

    if (!check.valid) {
      setError(check.error || 'Verifica los datos ingresados.');
      return;
    }

    onCreateMove({
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail.trim(),
      originCity: originCity.trim(),
      destinationCity: destinationCity.trim(),
      moveDate,
      truckUnit: truckUnit.trim() || 'Unidad Asignada',
      distanceKm: Math.max(1, Math.round(Number(distanceKm) || 100)),
      totalContractAmount: Math.round(totalNum),
      initialAdvance: Math.round(advanceNum),
      advanceMethod,
      notes: notes.trim(),
      items: draftItems.map(({ tempId: _t, ...rest }) => rest),
    });

    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setOriginCity('');
    setDestinationCity('');
    setTotalContractAmount('');
    setInitialAdvance('');
    setNotes('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-new-move-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="modal-new-move-title" className="text-lg font-bold text-slate-900">
              Registrar Nuevo Cliente, Ruta (Colombia / Venezuela / Ecuador) e Inventario
            </h2>
            <p className="text-xs text-slate-500">
              Define de qué ciudad a qué ciudad se dirige, qué cosas lleva y su estado de cuenta en Pesos Colombianos (COP)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de nueva mudanza"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          {/* Section 1: Client & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="new-client-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nombre del Cliente *
              </label>
              <input
                id="new-client-name"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej. Familia Morales Restrepo"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label
                htmlFor="new-client-phone"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Teléfono / WhatsApp *
              </label>
              <input
                id="new-client-phone"
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="Ej. +57 310 918 2340"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label
                htmlFor="new-client-email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Correo Electrónico
              </label>
              <input
                id="new-client-email"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="cliente@correo.co"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          {/* Section 2: Route Origin -> Destination (Colombia, Venezuela, Ecuador) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="new-origin-city"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Ciudad de Origen (De dónde sale) *
                </label>
                <div className="flex items-center gap-1">
                  {(['Colombia', 'Venezuela', 'Ecuador'] as AndeanCountry[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setOriginCountry(c);
                        if (!originCity) {
                          setOriginCity(ANDEAN_CITY_SUGGESTIONS[c][0]);
                        }
                      }}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded cursor-pointer ${
                        originCountry === c
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="new-origin-city"
                type="text"
                list="origin-cities-list"
                value={originCity}
                onChange={(e) => setOriginCity(e.target.value)}
                placeholder="Ej. Bogotá D.C., Colombia"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
              <datalist id="origin-cities-list">
                {ANDEAN_CITY_SUGGESTIONS[originCountry].map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="new-dest-city"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Ciudad de Destino (A dónde se dirige) *
                </label>
                <div className="flex items-center gap-1">
                  {(['Colombia', 'Venezuela', 'Ecuador'] as AndeanCountry[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setDestCountry(c);
                        if (!destinationCity) {
                          setDestinationCity(ANDEAN_CITY_SUGGESTIONS[c][0]);
                        }
                      }}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded cursor-pointer ${
                        destCountry === c
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="new-dest-city"
                type="text"
                list="dest-cities-list"
                value={destinationCity}
                onChange={(e) => setDestinationCity(e.target.value)}
                placeholder="Ej. Medellín, Colombia / Caracas / Quito"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
              <datalist id="dest-cities-list">
                {ANDEAN_CITY_SUGGESTIONS[destCountry].map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="new-move-date"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Fecha Programada
              </label>
              <input
                id="new-move-date"
                type="date"
                value={moveDate}
                onChange={(e) => setMoveDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label
                htmlFor="new-distance-km"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Distancia Estimada (km)
              </label>
              <input
                id="new-distance-km"
                type="number"
                min="1"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label
                htmlFor="new-truck-unit"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Camión / Unidad Asignada
              </label>
              <input
                id="new-truck-unit"
                type="text"
                value={truckUnit}
                onChange={(e) => setTruckUnit(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          {/* Section 3: Financial Contract & Initial Advance in COP */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 bg-slate-50 p-4 rounded-xl border">
            <div>
              <label
                htmlFor="new-total-amount"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Costo Total Cotizado (COP) *
              </label>
              <input
                id="new-total-amount"
                type="number"
                min="1"
                step="1000"
                value={totalContractAmount}
                onChange={(e) => setTotalContractAmount(e.target.value)}
                placeholder="4500000"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label
                htmlFor="new-advance-amount"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Saldo Pagado / Anticipo (COP)
              </label>
              <input
                id="new-advance-amount"
                type="number"
                min="0"
                step="1000"
                value={initialAdvance}
                onChange={(e) => setInitialAdvance(e.target.value)}
                placeholder="2000000"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label
                htmlFor="new-advance-method"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Método del Anticipo
              </label>
              <select
                id="new-advance-method"
                value={advanceMethod}
                onChange={(e) => setAdvanceMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="Transferencia Bancolombia / PSE">
                  Transferencia Bancolombia / PSE
                </option>
                <option value="Nequi / Daviplata">Nequi / Daviplata</option>
                <option value="Efectivo COP">Efectivo COP</option>
                <option value="Tarjeta / Datáfono">Tarjeta / Datáfono</option>
                <option value="Consignación Bancaria">Consignación Bancaria</option>
              </select>
            </div>
          </div>

          {/* Section 4: Initial Inventory Items with Camera Photo Support */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-900">
                Inventario de Cosas que Lleva ({draftItems.length} partidas iniciales)
              </h3>
              <button
                type="button"
                onClick={() => setCameraTargetTempId('new_draft')}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                {newItemPhoto ? 'Ver / Cambiar Foto del Nuevo Artículo' : 'Tomar Foto al Nuevo Artículo'}
              </button>
            </div>

            {newItemPhoto && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <img
                    src={newItemPhoto}
                    alt="Previsualización de foto"
                    referrerPolicy="no-referrer"
                    className="w-12 h-9 object-cover rounded border border-amber-300"
                  />
                  <div>
                    <span className="font-semibold text-amber-900 block">
                      Foto lista para adjuntar al artículo
                    </span>
                    <span className="text-[11px] text-amber-800">
                      {newItemDamageNotes || 'Con registro fotográfico'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewItemPhoto('');
                    setNewItemHasDamage(false);
                    setNewItemDamageNotes('');
                  }}
                  className="text-xs text-slate-500 hover:text-red-600 cursor-pointer"
                >
                  Quitar
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-5">
                <label
                  htmlFor="draft-item-name"
                  className="block text-[11px] text-slate-600 mb-1"
                >
                  Agregar mueble, electrodoméstico o cajas
                </label>
                <input
                  id="draft-item-name"
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Ej. Nevecón 700L, Lavadora..."
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-3">
                <label
                  htmlFor="draft-item-cat"
                  className="block text-[11px] text-slate-600 mb-1"
                >
                  Categoría
                </label>
                <select
                  id="draft-item-cat"
                  value={newItemCategory}
                  onChange={(e) =>
                    setNewItemCategory(e.target.value as InventoryCategory)
                  }
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="Sala y Comedor">Sala y Comedor</option>
                  <option value="Recámara">Recámara</option>
                  <option value="Línea Blanca">Línea Blanca</option>
                  <option value="Cocina y Cajas">Cocina y Cajas</option>
                  <option value="Oficina y Electrónicos">Oficina y Electrónicos</option>
                  <option value="Especial / Frágil">Especial / Frágil</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="draft-item-qty"
                  className="block text-[11px] text-slate-600 mb-1"
                >
                  Cant.
                </label>
                <input
                  id="draft-item-qty"
                  type="number"
                  min="1"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddDraftItem}
                  className="w-full inline-flex items-center justify-center gap-1 py-1.5 px-3 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Añadir
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-44 overflow-y-auto text-xs">
              {draftItems.map((item) => (
                <div
                  key={item.tempId}
                  className="px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.evidencePhotoDataUrl && (
                      <img
                        src={item.evidencePhotoDataUrl}
                        alt={`Foto de ${item.name}`}
                        referrerPolicy="no-referrer"
                        className="w-10 h-7 object-cover rounded border border-amber-300 shrink-0"
                      />
                    )}
                    <div className="truncate">
                      <strong className="font-mono tabular-nums text-slate-900">
                        {item.quantity}x
                      </strong>{' '}
                      <span className="font-medium text-slate-800">{item.name}</span>
                      <span className="text-slate-400 ml-2">· {item.category}</span>
                      {item.hasDamage && (
                        <span className="text-red-600 font-semibold ml-1.5">
                          · [{item.damageNotes || 'Con observación'}]
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCameraTargetTempId(item.tempId)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                        item.evidencePhotoDataUrl
                          ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      <Camera className="w-3 h-3" />
                      {item.evidencePhotoDataUrl ? 'Ver Foto' : 'Tomar Foto'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftItems((prev) =>
                          prev.filter((i) => i.tempId !== item.tempId)
                        )
                      }
                      aria-label={`Quitar ${item.name}`}
                      className="text-slate-400 hover:text-red-600 cursor-pointer p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="new-move-notes"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Notas Operativas / Paso Fronterizo o Permisos de Cargue
            </label>
            <input
              id="new-move-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Salida 6:00 AM, permiso de administración en edificio..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Guardar Mudanza y Estado de Cuenta
            </button>
          </div>
        </form>

        <CameraEvidenceModal
          isOpen={cameraTargetTempId !== null}
          itemName={
            cameraTargetTempId === 'new_draft'
              ? newItemName.trim() || 'Nuevo artículo por agregar'
              : draftItems.find((i) => i.tempId === cameraTargetTempId)?.name || 'Artículo'
          }
          folio="NUEVO-REGISTRO"
          initialHasDamage={
            cameraTargetTempId === 'new_draft'
              ? newItemHasDamage
              : draftItems.find((i) => i.tempId === cameraTargetTempId)?.hasDamage ?? true
          }
          initialDamageNotes={
            cameraTargetTempId === 'new_draft'
              ? newItemDamageNotes
              : draftItems.find((i) => i.tempId === cameraTargetTempId)?.damageNotes || ''
          }
          initialPhotoDataUrl={
            cameraTargetTempId === 'new_draft'
              ? newItemPhoto
              : draftItems.find((i) => i.tempId === cameraTargetTempId)?.evidencePhotoDataUrl || ''
          }
          onClose={() => setCameraTargetTempId(null)}
          onSaveEvidence={(payload) => {
            if (cameraTargetTempId === 'new_draft') {
              setNewItemHasDamage(payload.hasDamage);
              setNewItemDamageNotes(payload.damageNotes);
              setNewItemPhoto(payload.evidencePhotoDataUrl);
            } else if (cameraTargetTempId) {
              setDraftItems((prev) =>
                prev.map((it) =>
                  it.tempId === cameraTargetTempId
                    ? {
                        ...it,
                        hasDamage: payload.hasDamage,
                        damageNotes: payload.damageNotes,
                        evidencePhotoDataUrl: payload.evidencePhotoDataUrl,
                      }
                    : it
                )
              );
            }
            setCameraTargetTempId(null);
          }}
        />
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. REGISTER PAYMENT / ABONO MODAL                                          */
/* -------------------------------------------------------------------------- */

interface PaymentModalProps {
  move: MoveRecord | null;
  onClose: () => void;
  onSubmitPayment: (
    moveId: string,
    payload: {
      amount: number;
      date: string;
      method: PaymentMethod;
      concept: string;
      reference: string;
    }
  ) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  move,
  onClose,
  onSubmitPayment,
}) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('2026-10-20');
  const [method, setMethod] = useState<PaymentMethod>('Transferencia Bancolombia / PSE');
  const [concept, setConcept] = useState('Abono a cuenta de servicio de mudanza');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (move) {
      const bal = calculateClientBalance(move.totalContractAmount, move.amountPaid);
      setAmount(bal.balanceDue > 0 ? String(bal.balanceDue) : '');
      setConcept('Abono o liquidación de saldo de mudanza');
      setReference(`PSE-${Math.floor(100000 + Math.random() * 900000)}`);
      setError(null);
    }
  }, [move]);

  if (!move) return null;

  const bal = calculateClientBalance(move.totalContractAmount, move.amountPaid);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmt = Number(amount);
    const check = validatePaymentInput({
      amount: numAmt,
      maxPayable: bal.balanceDue,
      concept,
    });

    if (!check.valid) {
      setError(check.error || 'Verifica el monto del abono.');
      return;
    }

    onSubmitPayment(move.id, {
      amount: Math.round(numAmt),
      date,
      method,
      concept: concept.trim(),
      reference: reference.trim().slice(0, BLUEPRINT_LIMITS.PAYMENT_REF_MAX),
    });

    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-payment-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="modal-payment-title" className="text-base font-bold text-slate-900">
              Registrar Abono de Cliente (COP)
            </h2>
            <p className="text-xs text-slate-500">
              {move.clientName} · {move.folio}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar registro de abono"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Pagado hasta hoy</span>
              <span className="font-mono tabular-nums font-bold text-emerald-700 text-sm">
                {formatCurrencyCOP(bal.amountPaid)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Saldo que Debe</span>
              <span className="font-mono tabular-nums font-bold text-red-600 text-sm">
                {formatCurrencyCOP(bal.balanceDue)}
              </span>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="payment-amount-input"
                className="text-xs font-semibold text-slate-700"
              >
                Monto del Abono (COP) *
              </label>
              <button
                type="button"
                onClick={() => setAmount(String(bal.balanceDue))}
                className="text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer"
              >
                Liquidar total ({formatCurrencyCOP(bal.balanceDue)})
              </button>
            </div>
            <input
              id="payment-amount-input"
              type="number"
              step="1000"
              min="1"
              max={bal.balanceDue}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 text-base font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="payment-date-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Fecha de Pago
              </label>
              <input
                id="payment-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="payment-method-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Método de Pago
              </label>
              <select
                id="payment-method-select"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="Transferencia Bancolombia / PSE">
                  Transferencia Bancolombia / PSE
                </option>
                <option value="Nequi / Daviplata">Nequi / Daviplata</option>
                <option value="Efectivo COP">Efectivo COP</option>
                <option value="Tarjeta / Datáfono">Tarjeta / Datáfono</option>
                <option value="Consignación Bancaria">Consignación Bancaria</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="payment-concept-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Concepto del Movimiento *
            </label>
            <input
              id="payment-concept-input"
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="payment-ref-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Referencia / Comprobante Bancario
            </label>
            <input
              id="payment-ref-input"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
            >
              Aplicar Abono a Cuenta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. REGISTER OPERATIONAL EXPENSE MODAL                                      */
/* -------------------------------------------------------------------------- */

interface ExpenseModalProps {
  isOpen: boolean;
  moves: MoveRecord[];
  onClose: () => void;
  onSubmitExpense: (payload: {
    moveId: string;
    category: ExpenseCategory;
    description: string;
    amount: number;
    date: string;
    routeLabel: string;
  }) => void;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  moves,
  onClose,
  onSubmitExpense,
}) => {
  const [selectedMoveId, setSelectedMoveId] = useState(moves[0]?.id || '');
  const [category, setCategory] = useState<ExpenseCategory>('Combustible y Diésel');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('2026-10-20');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmt = Number(amount);
    if (!description.trim()) {
      setError('Ingresa la descripción del gasto operativo.');
      return;
    }
    if (!Number.isFinite(numAmt) || numAmt <= 0) {
      setError('Ingresa un monto de gasto mayor a $0 COP.');
      return;
    }

    const associatedMove = moves.find((m) => m.id === selectedMoveId);
    const routeLabel = associatedMove
      ? `${associatedMove.originCity.split(',')[0]} → ${associatedMove.destinationCity.split(',')[0]} (${associatedMove.folio})`
      : 'Gasto General de Flota';

    onSubmitExpense({
      moveId: selectedMoveId,
      category,
      description: description.trim().slice(0, BLUEPRINT_LIMITS.EXPENSE_DESC_MAX),
      amount: Math.round(numAmt),
      date,
      routeLabel: routeLabel.slice(0, BLUEPRINT_LIMITS.EXPENSE_ROUTE_MAX),
    });

    setDescription('');
    setAmount('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-expense-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="modal-expense-title" className="text-base font-bold text-slate-900">
              Registrar Gasto Operativo de Ruta (COP)
            </h2>
            <p className="text-xs text-slate-500">
              ACPM/Diésel, peajes INVIAS, cuadrilla de cargue o material de embalaje
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar registro de gasto"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="expense-category-select"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Categoría del Gasto
            </label>
            <select
              id="expense-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="Combustible y Diésel">Combustible y Diésel</option>
              <option value="Casetas y Peajes">Casetas y Peajes</option>
              <option value="Maniobras y Cargadores">Maniobras y Cargadores</option>
              <option value="Material de Embalaje">Material de Embalaje</option>
              <option value="Mantenimiento de Unidad">Mantenimiento de Unidad</option>
              <option value="Otros">Otros</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="expense-move-select"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Ruta / Cliente Asociado
            </label>
            <select
              id="expense-move-select"
              value={selectedMoveId}
              onChange={(e) => setSelectedMoveId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
            >
              {moves.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.folio} · {m.clientName} ({m.originCity.split(',')[0]} →{' '}
                  {m.destinationCity.split(',')[0]})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="expense-desc-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Concepto / Descripción del Gasto *
            </label>
            <input
              id="expense-desc-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Peajes ruta Bogotá - Medellín"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="expense-amount-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Monto (COP) *
              </label>
              <input
                id="expense-amount-input"
                type="number"
                step="1000"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="450000"
                className="w-full px-3 py-2 text-xs font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label
                htmlFor="expense-date-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Fecha
              </label>
              <input
                id="expense-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Guardar Gasto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. ADMIN-ONLY DELETE CLIENT CONFIRMATION MODAL                             */
/* -------------------------------------------------------------------------- */

interface DeleteClientModalProps {
  move: MoveRecord | null;
  canDelete: boolean;
  onClose: () => void;
  onConfirmDelete: (moveId: string) => void;
}

export const DeleteClientModal: React.FC<DeleteClientModalProps> = ({
  move,
  canDelete,
  onClose,
  onConfirmDelete,
}) => {
  if (!move) return null;

  const bal = calculateClientBalance(move.totalContractAmount, move.amountPaid);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-delete-client-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <h2 id="modal-delete-client-title" className="text-base font-bold text-slate-900">
              Eliminar Expediente de Cliente
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar confirmación de eliminación"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!canDelete ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-xs text-amber-900">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block">
                  Acción restringida al Administrador
                </strong>
                <p className="mt-1">
                  El perfil de Usuario de Inventario no tiene permisos para eliminar clientes creados. Cambia al perfil de Administrador para realizar esta acción.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-600 leading-relaxed">
                ¿Estás seguro de que deseas eliminar de forma permanente al cliente{' '}
                <strong className="text-slate-900">{move.clientName}</strong> ({move.folio}) junto con su inventario ({move.inventory.length} partidas) y su estado de cuenta?
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Ruta:</span>
                  <span className="font-semibold text-slate-800">
                    {move.originCity} → {move.destinationCity}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Flete:</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {formatCurrencyCOP(bal.totalContract)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Saldo Pendiente:</span>
                  <span className="font-mono tabular-nums font-semibold text-red-600">
                    {formatCurrencyCOP(bal.balanceDue)}
                  </span>
                </div>
              </div>
            </>
          )}

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  onConfirmDelete(move.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Confirmar Eliminación
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
