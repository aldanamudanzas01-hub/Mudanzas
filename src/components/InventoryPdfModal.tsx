import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  X,
  CheckCircle2,
  Camera,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import type { MoveRecord } from '../types.ts';
import {
  calculateClientBalance,
  calculateInventoryMetrics,
  formatCurrencyCOP,
  getPhotoRetentionStatus,
  estimateDataUrlBytes,
  PHOTO_RETENTION_DAYS,
} from '../utils/finance.ts';
import {
  downloadClientInventoryPdf,
  generateClientInventoryPdfFilename,
} from '../utils/pdfInventoryGenerator.ts';

interface InventoryPdfModalProps {
  move: MoveRecord | null;
  moves?: MoveRecord[];
  onSelectMoveId?: (moveId: string) => void;
  onClose: () => void;
}

export const InventoryPdfModal: React.FC<InventoryPdfModalProps> = ({
  move,
  moves = [],
  onSelectMoveId,
  onClose,
}) => {
  const [downloadedFile, setDownloadedFile] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!move) return null;

  const bal = calculateClientBalance(move.totalContractAmount, move.amountPaid);
  const inv = calculateInventoryMetrics(move.inventory);
  const expectedFilename = generateClientInventoryPdfFilename(move);

  const handleDownloadPdf = () => {
    setIsGenerating(true);
    try {
      const savedName = downloadClientInventoryPdf(move);
      setDownloadedFile(savedName);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Vista previa de Manifiesto PDF para ${move.clientName}`}
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Top Action Bar */}
        <div className="bg-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                  Documento Oficial para Cliente · PDF Ejecutivo
                </span>
              </div>
              <h2 className="text-base font-bold text-white">
                Manifiesto de Inventario y Estado de Cuenta ({move.folio})
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {moves.length > 1 && onSelectMoveId && (
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="pdf-client-selector"
                  className="text-[11px] font-mono text-slate-300 hidden sm:inline"
                >
                  Cliente:
                </label>
                <select
                  id="pdf-client-selector"
                  value={move.id}
                  onChange={(e) => {
                    setDownloadedFile(null);
                    onSelectMoveId(e.target.value);
                  }}
                  aria-label="Seleccionar cliente para descargar PDF de inventario"
                  className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                >
                  {moves.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.clientName} ({m.folio})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              data-testid="confirm-download-pdf-btn"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" />
              {isGenerating ? 'Generando PDF...' : 'Descargar PDF para Cliente'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Cerrar vista previa PDF"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {downloadedFile && (
          <div className="bg-emerald-950 text-emerald-200 px-5 py-2.5 text-xs flex items-center justify-between border-b border-emerald-800 shrink-0">
            <span className="inline-flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              Archivo PDF descargado correctamente:{' '}
              <strong className="font-mono text-white">{downloadedFile}</strong> — Listo para enviar por WhatsApp o correo al cliente.
            </span>
            <span className="text-[11px] font-mono text-emerald-400">Formato A4 Ejecutivo</span>
          </div>
        )}

        {/* Executive Document Preview Sheet */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 bg-slate-100/80 flex-1">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* Sheet Banner */}
            <div className="bg-slate-900 text-white p-6 border-b-4 border-amber-500">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-semibold">
                    ALDANA MUDANZAS CONTROL · COLOMBIA, VENEZUELA Y ECUADOR
                  </p>
                  <h3 className="text-xl font-bold mt-1">
                    CERTIFICADO DE INVENTARIO Y ESTADO DE CARGA
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Documento verificable con fotografías comprimidas HD y control de saldo en Pesos Colombianos (COP)
                  </p>
                </div>
                <div className="sm:text-right bg-slate-800/90 border border-slate-700 rounded-lg px-3.5 py-2 shrink-0">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">
                    FOLIO OFICIAL
                  </span>
                  <span className="text-base font-bold font-mono text-amber-400">
                    {move.folio}
                  </span>
                  <span className="block text-[11px] text-slate-300 mt-0.5">
                    Fecha: {move.moveDate}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Client & Route Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Datos del Cliente Titular
                  </span>
                  <p className="text-base font-bold text-slate-900 mt-0.5">
                    {move.clientName}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Teléfono: <strong className="font-mono">{move.clientPhone}</strong> · Email:{' '}
                    {move.clientEmail || 'No especificado'}
                  </p>
                </div>
                <div className="md:border-l md:border-slate-200 md:pl-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Ruta Logística y Unidad
                  </span>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 mt-0.5">
                    <span>{move.originCity}</span>
                    <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{move.destinationCity}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-mono">
                    {move.distanceKm} km · {move.truckUnit}
                  </p>
                </div>
              </div>

              {/* Financial & Cargo 4-Column Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
                  <span className="text-[11px] text-slate-500 block">Total Contrato (COP)</span>
                  <span className="text-base font-bold font-mono text-slate-900 mt-0.5 block">
                    {formatCurrencyCOP(bal.totalContract)}
                  </span>
                </div>
                <div className="border border-emerald-200 rounded-xl p-3.5 bg-emerald-50/40">
                  <span className="text-[11px] text-emerald-800 block">Total Abonado</span>
                  <span className="text-base font-bold font-mono text-emerald-700 mt-0.5 block">
                    {formatCurrencyCOP(bal.amountPaid)}
                  </span>
                </div>
                <div
                  className={`border rounded-xl p-3.5 ${
                    bal.balanceDue > 0
                      ? 'border-red-200 bg-red-50/40'
                      : 'border-emerald-200 bg-emerald-50/40'
                  }`}
                >
                  <span className="text-[11px] text-slate-600 block">Saldo Pendiente</span>
                  <span
                    className={`text-base font-bold font-mono mt-0.5 block ${
                      bal.balanceDue > 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {formatCurrencyCOP(bal.balanceDue)}
                  </span>
                </div>
                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Carga Total</span>
                  <span className="text-base font-bold font-mono text-slate-900 mt-0.5 block">
                    {inv.totalUnits} pzas · {inv.totalVolumeM3} m³
                  </span>
                </div>
              </div>

              {/* 15-Day Photo Retention & Compression Policy Notice */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50/90 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-950">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    <strong>Política de Retención Fotográfica ({PHOTO_RETENTION_DAYS} días):</strong>{' '}
                    Las imágenes cargadas se comprimen en alta definición sin pérdida visual y se eliminan automáticamente a los 15 días de su publicación.
                  </span>
                </div>
                <span className="font-mono text-[11px] font-semibold text-amber-800">
                  {inv.itemsWithEvidenceCount} foto(s) activas en el manifiesto
                </span>
              </div>

              {/* Inventory Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] font-semibold">
                      <th className="py-2.5 px-3">Cant.</th>
                      <th className="py-2.5 px-3">Artículo / Descripción</th>
                      <th className="py-2.5 px-3">Categoría</th>
                      <th className="py-2.5 px-3 text-right">Volumen / Peso</th>
                      <th className="py-2.5 px-3">Estado Físico y Fotografía HD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {move.inventory.map((item) => {
                      const hasPhoto = Boolean(
                        item.evidencePhotoDataUrl && item.evidencePhotoDataUrl.trim().length > 0
                      );
                      const retention = hasPhoto
                        ? getPhotoRetentionStatus(
                            item.evidencePhotoCreatedAt || item.updatedAt || item.createdAt
                          )
                        : null;
                      const kbSize = hasPhoto
                        ? (
                            (item.evidencePhotoCompressedBytes ||
                              estimateDataUrlBytes(item.evidencePhotoDataUrl || '')) / 1024
                          ).toFixed(1)
                        : null;

                      return (
                        <tr
                          key={item.id}
                          className={item.hasDamage ? 'bg-red-50/40' : 'bg-white'}
                        >
                          <td className="py-3 px-3 font-mono font-bold text-slate-900 align-top">
                            {item.quantity}x
                          </td>
                          <td className="py-3 px-3 align-top">
                            <div className="font-semibold text-slate-900">{item.name}</div>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {item.isFragile && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                                  Frágil
                                </span>
                              )}
                              {item.hasDamage ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                                  <AlertTriangle className="w-3 h-3" />
                                  Mal Estado Previo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800">
                                  <ShieldCheck className="w-3 h-3" />
                                  Buen Estado
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 align-top">
                            {item.category}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-700 align-top whitespace-nowrap">
                            <div>{(item.quantity * item.volumeM3).toFixed(2)} m³</div>
                            <div className="text-[11px] text-slate-400">
                              {(item.quantity * item.weightKg).toFixed(0)} kg
                            </div>
                          </td>
                          <td className="py-3 px-3 align-top">
                            <p className="text-slate-700">
                              {item.conditionNotes || 'Embalaje estándar verificado'}
                            </p>
                            {item.damageNotes && (
                              <p className="text-red-700 font-semibold mt-0.5">
                                Observación: {item.damageNotes}
                              </p>
                            )}
                            {hasPhoto && (
                              <div className="mt-2 flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-200">
                                <img
                                  src={item.evidencePhotoDataUrl}
                                  alt={item.name}
                                  referrerPolicy="no-referrer"
                                  className="w-16 h-12 object-cover rounded border border-slate-300 shrink-0"
                                />
                                <div className="text-[11px] text-slate-600 space-y-0.5">
                                  <div className="font-semibold text-slate-900 inline-flex items-center gap-1">
                                    <Camera className="w-3 h-3 text-emerald-700" />
                                    Foto HD Comprimida ({kbSize} KB)
                                  </div>
                                  {retention && (
                                    <div className="text-amber-800 font-medium">
                                      {retention.statusLabel}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Dual Signature Footer Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-200 text-center">
                <div className="pt-8 border-t border-slate-400 mx-6">
                  <p className="text-xs font-bold text-slate-900">
                    FIRMA DE CONFORMIDAD DEL CLIENTE
                  </p>
                  <p className="text-[11px] text-slate-500">{move.clientName}</p>
                </div>
                <div className="pt-8 border-t border-slate-400 mx-6">
                  <p className="text-xs font-bold text-slate-900">
                    SUPERVISOR DE INVENTARIO ALDANA MUDANZAS
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Control Operativo · Folio {move.folio}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="bg-white border-t border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-500 font-mono">
            Archivo de salida: <strong className="text-slate-800">{expectedFilename}</strong>
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Descargar PDF Oficial Ahora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
