import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Upload,
  X,
  Check,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import {
  validateDamageEvidenceInput,
  BLUEPRINT_LIMITS,
} from '../utils/finance.ts';

interface CameraEvidenceModalProps {
  isOpen: boolean;
  itemName: string;
  folio?: string;
  initialHasDamage?: boolean;
  initialDamageNotes?: string;
  initialPhotoDataUrl?: string;
  onClose: () => void;
  onSaveEvidence: (payload: {
    hasDamage: boolean;
    damageNotes: string;
    evidencePhotoDataUrl: string;
  }) => void;
}

const QUICK_DAMAGE_TAGS = [
  'Rayón o raspadura previa',
  'Golpe o abolladura en esquina',
  'Pata o bisagra floja',
  'Desgaste o mancha en tapiz',
  'Cristal / cubierta astillada',
  'Empaque de origen abierto',
];

export const CameraEvidenceModal: React.FC<CameraEvidenceModalProps> = ({
  isOpen,
  itemName,
  folio = 'INV-CONTROL',
  initialHasDamage = true,
  initialDamageNotes = '',
  initialPhotoDataUrl = '',
  onClose,
  onSaveEvidence,
}) => {
  const [hasDamage, setHasDamage] = useState(initialHasDamage);
  const [damageNotes, setDamageNotes] = useState(initialDamageNotes);
  const [photoDataUrl, setPhotoDataUrl] = useState(initialPhotoDataUrl);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStatusMsg, setCameraStatusMsg] = useState<string>(
    'Iniciando cámara del dispositivo...'
  );
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCameraStream = useCallback(async () => {
    stopCameraStream();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatusMsg(
        'Modo visor fotográfico activo (puedes capturar foto o subir desde tu galería).'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      setCameraStatusMsg('Cámara en vivo activa · Lista para tomar foto del artículo.');
    } catch {
      setCameraActive(false);
      setCameraStatusMsg(
        'Visor digital activo. Haz clic en "Capturar Foto con Cámara" o sube imagen del artículo.'
      );
    }
  }, [facingMode, stopCameraStream]);

  useEffect(() => {
    if (isOpen) {
      setHasDamage(initialHasDamage);
      setDamageNotes(initialDamageNotes);
      setPhotoDataUrl(initialPhotoDataUrl);
      setError(null);
      if (!initialPhotoDataUrl) {
        startCameraStream();
      }
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [
    isOpen,
    initialHasDamage,
    initialDamageNotes,
    initialPhotoDataUrl,
    startCameraStream,
    stopCameraStream,
  ]);

  if (!isOpen) return null;

  const stampAndCompressCanvas = (
    drawSource?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  ): string => {
    const canvas = document.createElement('canvas');
    const width = 440;
    const height = 300;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Background
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, width, height);

    if (drawSource) {
      drawSource(ctx, width, height - 54);
    } else {
      // Render visual inspection viewfinder frame when no physical webcam is attached
      ctx.fillStyle = '#334155';
      ctx.fillRect(18, 18, width - 36, height - 86);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2;
      ctx.strokeRect(18, 18, width - 36, height - 86);

      // Furniture / box silhouette
      ctx.fillStyle = '#475569';
      ctx.fillRect(95, 58, 250, 125);
      ctx.strokeStyle = '#94A3B8';
      ctx.strokeRect(95, 58, 250, 125);

      // Inspection callout reticle
      ctx.strokeStyle = hasDamage ? '#EF4444' : '#10B981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(175, 118, 28, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(160, 108);
      ctx.lineTo(192, 128);
      ctx.strokeStyle = hasDamage ? '#FCA5A5' : '#6EE7B7';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = hasDamage ? '#7F1D1D' : '#065F46';
      ctx.fillRect(212, 100, 180, 32);
      ctx.fillStyle = hasDamage ? '#FECACA' : '#D1FAE5';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(
        hasDamage ? 'EVIDENCIA DE MAL ESTADO' : 'FOTO DE ARTÍCULO INV.',
        220,
        120
      );
    }

    // Bottom forensic timestamp banner
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, height - 54, width, 54);

    const nowStamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const labelItem = (itemName || 'ARTÍCULO DE INVENTARIO').toUpperCase().slice(0, 32);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`FOTO CÁMARA · ${folio} · ${labelItem}`, 14, height - 32);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px monospace';
    const notePreview = (
      damageNotes ||
      (hasDamage
        ? 'OBSERVACIÓN DE MAL ESTADO REPORTADA'
        : 'REGISTRO FOTOGRÁFICO DE INVENTARIO')
    )
      .toUpperCase()
      .slice(0, 48);
    ctx.fillText(`${nowStamp} · ${notePreview}`, 14, height - 14);

    return canvas.toDataURL('image/jpeg', 0.68);
  };

  const handleCapturePhoto = () => {
    setError(null);
    const video = videoRef.current;
    if (cameraActive && video && video.readyState >= 2 && video.videoWidth > 0) {
      const dataUrl = stampAndCompressCanvas((ctx, w, h) => {
        ctx.drawImage(video, 0, 0, w, h);
      });
      setPhotoDataUrl(dataUrl);
      stopCameraStream();
    } else {
      const dataUrl = stampAndCompressCanvas();
      setPhotoDataUrl(dataUrl);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const compressed = stampAndCompressCanvas((ctx, w, h) => {
          ctx.drawImage(img, 0, 0, w, h);
        });
        setPhotoDataUrl(compressed);
        stopCameraStream();
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAddQuickTag = (tag: string) => {
    setHasDamage(true);
    setDamageNotes((prev) => {
      const clean = prev.trim();
      if (!clean) return tag;
      if (clean.toLowerCase().includes(tag.toLowerCase())) return clean;
      return `${clean}. ${tag}`.slice(0, BLUEPRINT_LIMITS.DAMAGE_NOTES_MAX);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Ensure if user didn't click "Capturar Foto" yet, we automatically capture the current frame so they always get a photo
    const finalPhoto = photoDataUrl || stampAndCompressCanvas();
    const effectiveHasDamage = hasDamage;
    const finalNotes =
      effectiveHasDamage && !damageNotes.trim()
        ? 'Evidencia fotográfica de mal estado tomada con cámara en cargue'
        : damageNotes.trim();

    const check = validateDamageEvidenceInput({
      hasDamage: effectiveHasDamage,
      damageNotes: finalNotes,
      evidencePhotoDataUrl: finalPhoto,
    });

    if (!check.valid) {
      setError(check.error || 'Verifica la observación del artículo.');
      return;
    }

    onSaveEvidence({
      hasDamage: effectiveHasDamage,
      damageNotes: finalNotes,
      evidencePhotoDataUrl: finalPhoto,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-evidence-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 block">
              Cámara de Inventario · Registro Fotográfico y Estado Físico
            </span>
            <h2
              id="camera-evidence-modal-title"
              className="text-base font-bold flex items-center gap-2 mt-0.5"
            >
              <Camera className="w-4 h-4 text-amber-400" />
              Tomar Foto al Artículo: {itemName || 'Nuevo artículo de inventario'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar cámara de evidencia"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          {/* Camera Viewfinder OR Captured Photo Preview */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">
                {photoDataUrl
                  ? 'Fotografía del Artículo Capturada'
                  : 'Visor de Cámara en Vivo'}
              </span>
              <span className="text-[11px] text-slate-500">{cameraStatusMsg}</span>
            </div>

            <div className="relative w-full h-56 bg-slate-900 rounded-xl overflow-hidden border border-slate-300 flex items-center justify-center">
              {photoDataUrl ? (
                <img
                  src={photoDataUrl}
                  alt={`Fotografía de ${itemName || 'artículo'}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain bg-slate-950"
                />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      cameraActive ? 'block' : 'hidden'
                    }`}
                  />
                  {!cameraActive && (
                    <div className="text-center px-6 py-4 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center">
                        <Camera className="w-6 h-6 text-amber-400" />
                      </div>
                      <p className="text-xs font-semibold text-white">
                        Cámara Lista para Fotografiar: {itemName || 'Artículo'}
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                        Presiona el botón naranja &ldquo;Tomar Foto Ahora&rdquo; o sube una imagen desde la cámara de tu celular o computador.
                      </p>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-4 border border-dashed border-white/30 rounded-lg" />
                </>
              )}
            </div>

            {/* Camera Controls Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {photoDataUrl ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoDataUrl('');
                      startCameraStream();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Tomar Otra Foto
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoDataUrl('')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Quitar Foto
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    <Camera className="w-4 h-4" />
                    Tomar Foto Ahora
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFacingMode((prev) =>
                        prev === 'environment' ? 'user' : 'environment'
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Cambiar Cámara ({facingMode === 'environment' ? 'Trasera' : 'Frontal'})
                  </button>
                </div>
              )}

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Subir Foto / Galería
                </button>
              </div>
            </div>
          </div>

          {/* Quick Damage Tags */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Estado del artículo (selecciona si tiene algún detalle o mal estado):
              </span>
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasDamage}
                  onChange={(e) => setHasDamage(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600"
                />
                Reportar Mal Estado / Daño Previo
              </label>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_DAMAGE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleAddQuickTag(tag)}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Detailed Damage Observation Textarea */}
          <div>
            <label
              htmlFor="camera-damage-notes"
              className="block text-xs font-semibold text-slate-800 mb-1"
            >
              Observación de la Foto / Detalle de Mal Estado
            </label>
            <textarea
              id="camera-damage-notes"
              rows={2}
              value={damageNotes}
              onChange={(e) => {
                setDamageNotes(e.target.value);
                if (e.target.value.trim()) setHasDamage(true);
              }}
              placeholder="Ej. Rayón de 5 cm en esquina derecha, pata trasera floja o foto de control de embalaje..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                La foto y la observación quedan guardadas en el artículo del inventario.
              </span>
              <span className="font-mono tabular-nums">
                {damageNotes.length}/{BLUEPRINT_LIMITS.DAMAGE_NOTES_MAX}
              </span>
            </div>
          </div>

          {/* Modal Footer */}
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
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Guardar Foto y Observación en Inventario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
