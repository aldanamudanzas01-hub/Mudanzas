import React, { useState } from 'react';
import { Smartphone, Download, CheckCircle2, X, Share2 } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall.ts';

export const PWAInstallButton: React.FC<{ variant?: 'sidebar' | 'header' }> = ({
  variant = 'sidebar',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {variant === 'header' ? (
        <button
          type="button"
          onClick={handleClick}
          data-testid="pwa-install-header-btn"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>Instalar App en Celular</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          data-testid="pwa-install-sidebar-btn"
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Smartphone className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="truncate">Instalar App en Celular (PWA)</span>
          </span>
          <Download className="w-3.5 h-3.5 text-amber-800 shrink-0" />
        </button>
      )}

      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 block">
                    Aplicación Web Progresiva (PWA)
                  </span>
                  <h3 id="pwa-install-modal-title" className="text-sm font-bold">
                    Instalar Aldana Mudanzas en tu Celular
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Cerrar guía de instalación móvil"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-950">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    PWA Activa con Soporte Offline y Cámara Móvil
                  </p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Instala la app en la pantalla de inicio de tu celular para usar la cámara en terreno, comprimir fotos en HD y descargar inventarios en PDF sin depender del navegador.
                  </p>
                </div>
              </div>

              {isInstallable && (
                <button
                  type="button"
                  onClick={async () => {
                    await install();
                    setShowGuideModal(false);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  Instalar Aplicación Ahora
                </button>
              )}

              <div className="space-y-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 text-[10px] font-mono bg-slate-900 text-white rounded">
                      ANDROID / CHROME
                    </span>
                    <span>Instalación directa en Android</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px]">
                    <li>
                      Abre esta página en <strong>Google Chrome</strong> desde tu celular Android.
                    </li>
                    <li>
                      Toca el menú de 3 puntos <strong>(⋮)</strong> arriba a la derecha y selecciona <strong>&ldquo;Instalar aplicación&rdquo;</strong> o <strong>&ldquo;Agregar a la pantalla principal&rdquo;</strong>.
                    </li>
                  </ol>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 text-[10px] font-mono bg-slate-800 text-white rounded">
                      iPHONE / iPAD (iOS)
                    </span>
                    <span>Instalación en Safari {isIOS ? '(Tu dispositivo)' : ''}</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px]">
                    <li className="flex items-center gap-1 flex-wrap">
                      <span>1. Toca el botón</span>
                      <strong className="inline-flex items-center gap-0.5 text-slate-900">
                        <Share2 className="w-3 h-3" /> Compartir
                      </strong>
                      <span>en la barra inferior de Safari.</span>
                    </li>
                    <li>
                      2. Desliza hacia abajo y selecciona <strong>&ldquo;Agregar a inicio&rdquo; (Add to Home Screen)</strong>.
                    </li>
                  </ol>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
    >
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
      Modo Sin Conexión (Offline PWA) — Usando datos locales respaldados.
    </div>
  );
};
