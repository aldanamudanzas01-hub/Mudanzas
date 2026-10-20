import React, { useState, useMemo } from 'react';
import {
  ArrowRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Package,
  Plus,
  DollarSign,
  FileText,
  Truck,
  Trash2,
  ShieldCheck,
  UserCheck,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Download,
} from 'lucide-react';
import type {
  MoveRecord,
  OperationalExpense,
  ActiveTab,
  UserRole,
  FinancialPeriodGranularity,
} from '../types.ts';
import {
  calculateFinancialSummary,
  calculateFinancialPeriods,
  resolveSelectedPeriodBucket,
  calculateClientBalance,
  calculateInventoryMetrics,
  formatCurrencyCOP,
  canDeleteClientRecord,
  SPANISH_MONTHS_FULL,
  SPANISH_MONTHS_SHORT,
} from '../utils/finance.ts';

interface DashboardViewProps {
  moves: MoveRecord[];
  expenses: OperationalExpense[];
  userRole: UserRole;
  onSelectMove: (moveId: string, initialTab?: 'inventory' | 'statement') => void;
  onOpenPaymentModal: (moveId: string) => void;
  onOpenNewMoveModal: () => void;
  onOpenExpenseModal: () => void;
  onRequestDeleteMove: (moveId: string) => void;
  onOpenPdfModal: (move: MoveRecord) => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

const STATUS_LABELS: Record<MoveRecord['status'], string> = {
  programada: 'Programada',
  en_transito: 'En Tránsito',
  entregada: 'Entregada',
  liquidada: 'Liquidada',
};

const DASHBOARD_PERIOD_TABS: {
  id: FinancialPeriodGranularity;
  label: string;
}[] = [
  { id: 'dia', label: 'Por Fecha (Calendario)' },
  { id: 'mes', label: 'Por Mes' },
  { id: 'anio', label: 'Por Año' },
];

const DASHBOARD_YEARS = [2024, 2025, 2026, 2027];
const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const DashboardView: React.FC<DashboardViewProps> = ({
  moves,
  expenses,
  userRole,
  onSelectMove,
  onOpenPaymentModal,
  onOpenNewMoveModal,
  onOpenExpenseModal,
  onRequestDeleteMove,
  onOpenPdfModal,
  onNavigateTab,
}) => {
  const [dashboardPeriod, setDashboardPeriod] =
    useState<FinancialPeriodGranularity>('dia');
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>('todos');
  const [isDashCalendarOpen, setIsDashCalendarOpen] = useState<boolean>(false);
  const [calYear, setCalYear] = useState<number>(2026);
  const [calMonthIdx, setCalMonthIdx] = useState<number>(9);

  const metrics = calculateFinancialSummary(moves, expenses);
  const isAdmin = canDeleteClientRecord(userRole);

  const periodBuckets = useMemo(
    () => calculateFinancialPeriods(moves, expenses, dashboardPeriod),
    [moves, expenses, dashboardPeriod]
  );

  const dailyBucketsMap = useMemo(() => {
    const daily = calculateFinancialPeriods(moves, expenses, 'dia');
    const map = new Map<string, (typeof daily)[number]>();
    for (const b of daily) {
      map.set(b.periodKey, b);
    }
    return map;
  }, [moves, expenses]);

  const activeDashBucket = useMemo(
    () =>
      resolveSelectedPeriodBucket(
        periodBuckets,
        dashboardPeriod,
        selectedPeriodKey
      ),
    [periodBuckets, dashboardPeriod, selectedPeriodKey]
  );

  const calendarCells = useMemo(() => {
    const firstUtc = new Date(Date.UTC(calYear, calMonthIdx, 1));
    const daysCount = new Date(Date.UTC(calYear, calMonthIdx + 1, 0)).getUTCDate();
    const startOffset = (firstUtc.getUTCDay() + 6) % 7;
    const cells: { day: number | null; iso: string | null }[] = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ day: null, iso: null });
    }
    const pad2 = (n: number) => String(n).padStart(2, '0');
    for (let d = 1; d <= daysCount; d++) {
      cells.push({
        day: d,
        iso: `${calYear}-${pad2(calMonthIdx + 1)}-${pad2(d)}`,
      });
    }
    return cells;
  }, [calYear, calMonthIdx]);

  const handlePickDashDate = (isoDate: string) => {
    if (!isoDate) return;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
    if (m) {
      setCalYear(Number(m[1]));
      setCalMonthIdx(Math.max(0, Math.min(11, Number(m[2]) - 1)));
    }
    setDashboardPeriod('dia');
    setSelectedPeriodKey(isoDate);
    setIsDashCalendarOpen(false);
  };

  const maxContract = Math.max(
    ...metrics.routeBreakdown.map((r) => r.totalContract),
    1
  );

  const expenseCategories = Object.entries(metrics.expensesByCategory).filter(
    ([, val]) => val > 0
  ) as [string, number][];

  return (
    <div className="space-y-8">
      {/* Executive Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <span>Corredor Logístico: Colombia · Venezuela · Ecuador</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-semibold text-slate-700">
              Moneda: Peso Colombiano (COP)
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
              {isAdmin ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  Rol: Administrador (Puede eliminar clientes)
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                  Rol: Usuario Inventario (Sin permiso de eliminar clientes)
                </>
              )}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
            Dashboard de Ingresos, Deudas e Inventario por Ruta (COP)
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenExpenseModal}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Registrar Gasto Operativo
          </button>
          <button
            type="button"
            onClick={onOpenNewMoveModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar Cliente y Ruta
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <section
        aria-label="Indicadores financieros principales en COP"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
      >
        <div className="p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Total Contratado (Fletes COP)</span>
            <Truck className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <p
            data-testid="kpi-total-contracted"
            className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums"
          >
            {formatCurrencyCOP(metrics.totalContracted)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
            <span className="font-mono tabular-nums">{moves.length} clientes</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{metrics.totalUnitsMoved} piezas</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{metrics.totalVolumeM3} m³</span>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Saldo Pagado (Ingresos Cobrados)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <p
            data-testid="kpi-total-collected"
            className="text-xl sm:text-2xl font-bold text-emerald-700 font-mono tabular-nums"
          >
            {formatCurrencyCOP(metrics.totalCollected)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-600">
            <span className="font-semibold text-emerald-700 font-mono tabular-nums">
              {metrics.collectionRatePct}% cobrado
            </span>
            <span aria-hidden="true">·</span>
            <span>{metrics.settledClientsCount} cuentas liquidadas</span>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Saldo por Cobrar (Deuda Clientes)</span>
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <p
            data-testid="kpi-total-debt"
            className="text-xl sm:text-2xl font-bold text-red-600 font-mono tabular-nums"
          >
            {formatCurrencyCOP(metrics.totalReceivableDebt)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-600">
            <span className="font-semibold text-red-700 font-mono tabular-nums">
              {100 - metrics.collectionRatePct}% pendiente
            </span>
            <span aria-hidden="true">·</span>
            <span>{metrics.clientsWithDebtCount} con saldo deudor</span>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Flujo Neto en Caja (Cobrado - Gastos)</span>
            <TrendingUp className="w-4 h-4 text-slate-700 shrink-0" />
          </div>
          <p
            data-testid="kpi-net-cash"
            className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums"
          >
            {formatCurrencyCOP(metrics.netOperatingBalance)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
            <span>Gastos:</span>
            <span className="font-mono tabular-nums text-slate-700">
              {formatCurrencyCOP(metrics.totalOperationalExpenses)}
            </span>
            <span aria-hidden="true">·</span>
            <span>Margen: {formatCurrencyCOP(metrics.netContractMargin)}</span>
          </div>
        </div>
      </section>

      {/* Estado de Mis Finanzas con Calendario Desplegable, Mes y Año */}
      <section
        aria-label="Estado de mis finanzas con calendario desplegable, mes y año"
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
              <h2 className="text-base font-bold text-slate-900">
                Estado de Mis Finanzas · Calendario Desplegable, Mes y Año (COP)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Escoge una fecha exacta en el calendario desplegable o consulta tus finanzas por mes y año
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label="Seleccionar temporalidad financiera en dashboard"
              className="grid grid-cols-3 sm:inline-flex sm:flex-nowrap items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl w-full sm:w-auto"
            >
              {DASHBOARD_PERIOD_TABS.map((tab) => {
                const active = dashboardPeriod === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-testid={`dashboard-period-${tab.id}`}
                    onClick={() => {
                      setDashboardPeriod(tab.id);
                      if (tab.id === 'mes') {
                        const pad2 = (n: number) => String(n).padStart(2, '0');
                        setSelectedPeriodKey(`${calYear}-${pad2(calMonthIdx + 1)}`);
                      } else if (tab.id === 'anio') {
                        setSelectedPeriodKey(`${calYear}`);
                      } else {
                        setSelectedPeriodKey('todos');
                      }
                      setIsDashCalendarOpen(false);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap text-center ${
                      active
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('finanzas')}
              className="px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Ver detalle en Finanzas →
            </button>
          </div>
        </div>

        {/* Interactive Dropdown Calendar + Month + Year Selector Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="md:col-span-5 relative">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Calendario Desplegable (Escoger Fecha)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="dash-calendar-dropdown-trigger"
                onClick={() => setIsDashCalendarOpen((prev) => !prev)}
                className={`flex-1 flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  dashboardPeriod === 'dia' && selectedPeriodKey !== 'todos'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-800 border-slate-300 hover:border-slate-400'
                }`}
              >
                <span className="inline-flex items-center gap-2 truncate">
                  <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    {dashboardPeriod === 'dia' && activeDashBucket
                      ? `Fecha: ${activeDashBucket.periodLabel}`
                      : 'Escoger Fecha en Calendario'}
                  </span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 transition-transform ${
                    isDashCalendarOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <input
                type="date"
                aria-label="Escoger fecha en dashboard"
                value={
                  dashboardPeriod === 'dia' &&
                  /^\d{4}-\d{2}-\d{2}$/.test(selectedPeriodKey)
                    ? selectedPeriodKey
                    : ''
                }
                onChange={(e) => {
                  if (e.target.value) handlePickDashDate(e.target.value);
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-800 cursor-pointer"
              />
            </div>

            {isDashCalendarOpen && (
              <div
                data-testid="dash-calendar-dropdown-popover"
                className="absolute left-0 top-full mt-2 z-30 w-full sm:w-84 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      if (calMonthIdx === 0) {
                        setCalMonthIdx(11);
                        setCalYear((y) => y - 1);
                      } else {
                        setCalMonthIdx((m) => m - 1);
                      }
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label="Seleccionar mes del calendario"
                      value={calMonthIdx}
                      onChange={(e) => setCalMonthIdx(Number(e.target.value))}
                      className="px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 cursor-pointer"
                    >
                      {SPANISH_MONTHS_FULL.map((mName, idx) => (
                        <option key={mName} value={idx}>
                          {mName}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Seleccionar año del calendario"
                      value={calYear}
                      onChange={(e) => setCalYear(Number(e.target.value))}
                      className="px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold font-mono text-slate-900 cursor-pointer"
                    >
                      {DASHBOARD_YEARS.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (calMonthIdx === 11) {
                        setCalMonthIdx(0);
                        setCalYear((y) => y + 1);
                      } else {
                        setCalMonthIdx((m) => m + 1);
                      }
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    aria-label="Mes siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAYS_SHORT.map((wd) => (
                    <span
                      key={wd}
                      className="text-[10px] font-bold uppercase text-slate-400 py-0.5"
                    >
                      {wd}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((c, idx) => {
                    if (!c.day || !c.iso) {
                      return <div key={`empty_${idx}`} className="h-8" />;
                    }
                    const dayAct = dailyBucketsMap.get(c.iso);
                    const isSel =
                      dashboardPeriod === 'dia' && selectedPeriodKey === c.iso;
                    return (
                      <button
                        key={c.iso}
                        type="button"
                        onClick={() => handlePickDashDate(c.iso!)}
                        className={`h-8 rounded-lg flex flex-col items-center justify-center text-xs font-mono transition-all cursor-pointer border ${
                          isSel
                            ? 'bg-slate-900 text-white border-slate-900 font-bold'
                            : dayAct
                            ? 'bg-emerald-50 text-slate-900 border-emerald-300 font-bold hover:bg-emerald-100'
                            : 'bg-white text-slate-700 border-transparent hover:bg-slate-100'
                        }`}
                      >
                        <span>{c.day}</span>
                        {dayAct && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSel
                                ? 'bg-amber-400'
                                : dayAct.netCashFlow >= 0
                                ? 'bg-emerald-600'
                                : 'bg-red-500'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="dash-month-select"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Opción de Mes
            </label>
            <select
              id="dash-month-select"
              data-testid="dash-month-select"
              value={
                dashboardPeriod === 'mes' && selectedPeriodKey !== 'todos'
                  ? String(calMonthIdx)
                  : 'todos'
              }
              onChange={(e) => {
                if (e.target.value === 'todos') {
                  setDashboardPeriod('mes');
                  setSelectedPeriodKey('todos');
                } else {
                  const mIdx = Number(e.target.value);
                  setCalMonthIdx(mIdx);
                  const pad2 = (n: number) => String(n).padStart(2, '0');
                  setDashboardPeriod('mes');
                  setSelectedPeriodKey(`${calYear}-${pad2(mIdx + 1)}`);
                }
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <option value="todos">Todos los Meses</option>
              {SPANISH_MONTHS_FULL.map((mName, idx) => (
                <option key={mName} value={String(idx)}>
                  {mName} ({calYear})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="dash-year-select"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Opción de Año
            </label>
            <select
              id="dash-year-select"
              data-testid="dash-year-select"
              value={
                (dashboardPeriod === 'anio' || dashboardPeriod === 'mes') &&
                selectedPeriodKey !== 'todos'
                  ? String(calYear)
                  : 'todos'
              }
              onChange={(e) => {
                if (e.target.value === 'todos') {
                  setDashboardPeriod('anio');
                  setSelectedPeriodKey('todos');
                } else {
                  const yr = Number(e.target.value);
                  setCalYear(yr);
                  if (dashboardPeriod === 'mes' && selectedPeriodKey !== 'todos') {
                    const pad2 = (n: number) => String(n).padStart(2, '0');
                    setSelectedPeriodKey(`${yr}-${pad2(calMonthIdx + 1)}`);
                  } else {
                    setDashboardPeriod('anio');
                    setSelectedPeriodKey(`${yr}`);
                  }
                }
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold font-mono text-slate-800 cursor-pointer"
            >
              <option value="todos">Todos los Años</option>
              {DASHBOARD_YEARS.map((yr) => (
                <option key={yr} value={String(yr)}>
                  Año {yr}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => {
                setSelectedPeriodKey('todos');
                setIsDashCalendarOpen(false);
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Ver Todos
            </button>
          </div>
        </div>

        {/* Period Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {(activeDashBucket ? [activeDashBucket] : periodBuckets.slice(0, 4)).map(
            (bucket) => (
              <div
                key={bucket.periodKey}
                className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${
                  activeDashBucket
                    ? 'bg-emerald-50/50 border-emerald-400 sm:col-span-2 xl:col-span-4'
                    : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      {activeDashBucket
                        ? `Estado Financiero Seleccionado: ${bucket.periodLabel}`
                        : bucket.periodLabel}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 block mt-0.5 whitespace-nowrap">
                      {bucket.movesCount} mudanzas · {bucket.paymentsCount} abonos ·{' '}
                      {bucket.expensesCount} gastos
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded shrink-0 ${
                      bucket.netCashFlow >= 0
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-red-100 text-red-900'
                    }`}
                  >
                    {bucket.netCashFlow >= 0 ? 'SUPERÁVIT' : 'DÉFICIT'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs border-t border-slate-200/80 pt-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Ingresos:</span>
                    <span className="font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                      +{formatCurrencyCOP(bucket.collectedAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Gastos:</span>
                    <span className="font-mono tabular-nums font-semibold text-red-600 whitespace-nowrap">
                      -{formatCurrencyCOP(bucket.expensesAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Por Cobrar:</span>
                    <span className="font-mono tabular-nums font-medium text-amber-700 whitespace-nowrap">
                      {formatCurrencyCOP(bucket.pendingDebtAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200 font-bold text-slate-900">
                    <span className="shrink-0">Flujo Neto:</span>
                    <span
                      className={`font-mono tabular-nums whitespace-nowrap ${
                        bucket.netCashFlow >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {bucket.netCashFlow >= 0 ? '+' : ''}
                      {formatCurrencyCOP(bucket.netCashFlow)}
                    </span>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </section>

      {/* Visual Charts Row: Ingresos vs Deudas por Cliente + Flujo Financiero */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Main Visual Chart: Ingresos Pagados vs. Saldo que Debe por Cliente / Ruta */}
        <section
          aria-label="Gráfica de ingresos pagados contra deuda por cliente"
          className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Ingresos Cobrados vs. Saldo que Debe por Cliente y Ruta (Colombia, Venezuela, Ecuador)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparativa visual en Pesos Colombianos (COP) de cuánto ha pagado cada cliente y cuánto debe
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block" />
                  Pagado (COP)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" />
                  Saldo Pendiente (Deuda)
                </span>
              </div>
            </div>

            {/* Interactive Bar Chart */}
            <div className="mt-5 space-y-4">
              {metrics.routeBreakdown.map((item) => {
                const paidWidthPct = Math.max(
                  2,
                  Math.round((item.amountPaid / maxContract) * 100)
                );
                const debtWidthPct =
                  item.balanceDue > 0
                    ? Math.max(2, Math.round((item.balanceDue / maxContract) * 100))
                    : 0;

                return (
                  <div
                    key={item.moveId}
                    className="group p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => onSelectMove(item.moveId, 'statement')}
                          className="text-sm font-semibold text-slate-900 hover:underline truncate text-left cursor-pointer"
                        >
                          {item.clientName}
                        </button>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="text-xs font-medium text-slate-600 truncate">
                          {item.originCity} → {item.destinationCity}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono tabular-nums shrink-0">
                        <span className="text-emerald-700 font-semibold">
                          Pagado: {formatCurrencyCOP(item.amountPaid)}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          /
                        </span>
                        <span
                          className={
                            item.balanceDue > 0
                              ? 'text-red-600 font-semibold'
                              : 'text-slate-500'
                          }
                        >
                          Debe: {formatCurrencyCOP(item.balanceDue)}
                        </span>
                      </div>
                    </div>

                    {/* Stacked Bar */}
                    <div className="w-full h-6 bg-slate-100 rounded-md overflow-hidden flex items-center p-0.5 gap-0.5">
                      <div
                        style={{ width: `${paidWidthPct}%` }}
                        className="h-full bg-emerald-600 rounded-l-xs transition-all flex items-center justify-end pr-2 overflow-hidden"
                        title={`Pagado: ${formatCurrencyCOP(item.amountPaid)} (${item.paidPct}%)`}
                      >
                        {paidWidthPct >= 14 && (
                          <span className="text-[11px] font-mono font-semibold text-white tabular-nums">
                            {item.paidPct}%
                          </span>
                        )}
                      </div>
                      {debtWidthPct > 0 && (
                        <div
                          style={{ width: `${debtWidthPct}%` }}
                          className="h-full bg-amber-500 rounded-r-xs transition-all flex items-center justify-end pr-2 overflow-hidden"
                          title={`Debe: ${formatCurrencyCOP(item.balanceDue)} (${100 - item.paidPct}%)`}
                        >
                          {debtWidthPct >= 14 && (
                            <span className="text-[11px] font-mono font-semibold text-slate-950 tabular-nums">
                              {100 - item.paidPct}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Haz clic en cualquier cliente para abrir su Estado de Cuenta o Inventario detallado.
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('estados_cuenta')}
              className="font-semibold text-slate-900 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Ver todos los estados de cuenta →
            </button>
          </div>
        </section>

        {/* Right Column: Financial Structure & Expense Breakdown */}
        <section
          aria-label="Distribución de finanzas y gastos operativos"
          className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
        >
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Estructura de Cobranza y Finanzas (COP)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 pb-4 border-b border-slate-100">
              Proporción de cartera cobrada vs. deuda pendiente y gastos de ruta
            </p>

            {/* SVG Donut & Meter */}
            <div className="my-5 flex items-center gap-5">
              <div className="relative w-28 h-28 shrink-0">
                <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="transparent"
                    stroke="#F1F5F9"
                    strokeWidth="3.8"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="transparent"
                    stroke="#D97706"
                    strokeWidth="3.8"
                    strokeDasharray="100 0"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="transparent"
                    stroke="#059669"
                    strokeWidth="3.8"
                    strokeDasharray={`${metrics.collectionRatePct} ${100 - metrics.collectionRatePct}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
                    {metrics.collectionRatePct}%
                  </span>
                  <span className="text-[10px] text-slate-500">Cobrado</span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs flex-1 min-w-0">
                <div>
                  <span className="text-slate-500 block">Cobrado Efectivo</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-700 text-sm">
                    {formatCurrencyCOP(metrics.totalCollected)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Deuda por Cobrar</span>
                  <span className="font-mono tabular-nums font-bold text-amber-700 text-sm">
                    {formatCurrencyCOP(metrics.totalReceivableDebt)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Gastos de Operación</span>
                  <span className="font-mono tabular-nums font-bold text-slate-800 text-sm">
                    {formatCurrencyCOP(metrics.totalOperationalExpenses)}
                  </span>
                </div>
              </div>
            </div>

            {/* Operational Expenses Breakdown */}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-800">
                  Desglose de Gastos Operativos
                </h3>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {expenses.length} registros
                </span>
              </div>
              <div className="space-y-2.5">
                {expenseCategories.map(([category, amount]) => {
                  const pct =
                    metrics.totalOperationalExpenses > 0
                      ? Math.round((amount / metrics.totalOperationalExpenses) * 100)
                      : 0;
                  return (
                    <div key={category} className="text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-700 truncate">{category}</span>
                        <span className="font-mono tabular-nums text-slate-900 font-medium">
                          {formatCurrencyCOP(amount)} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-slate-700 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigateTab('finanzas')}
              className="w-full py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Organizar Finanzas por Días, Semanas, Meses y Años
            </button>
          </div>
        </section>
      </div>

      {/* Control por Cliente Table: Ruta Origen -> Destino, Inventario, Pagado y Saldo que Debe */}
      <section
        aria-label="Resumen de control por cliente"
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Control por Cliente: Rutas Ciudad a Ciudad, Inventario y Saldos (COP)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Seguimiento de inventario que lleva cada cliente en Colombia, Venezuela y Ecuador, cuánto ha pagado y cuánto debe
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {moves.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenPdfModal(moves[0])}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar Inventario PDF
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab('clientes')}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Ver Catálogo Completo de Clientes
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">Cliente / Folio</th>
                <th className="py-3 px-4">Ruta (Ciudad Origen → Ciudad Destino)</th>
                <th className="py-3 px-4">Inventario que Lleva</th>
                <th className="py-3 px-4 text-right">Total Flete</th>
                <th className="py-3 px-4 text-right">Saldo Pagado</th>
                <th className="py-3 px-4 text-right">Saldo que Debe</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {moves.map((move) => {
                const bal = calculateClientBalance(
                  move.totalContractAmount,
                  move.amountPaid
                );
                const inv = calculateInventoryMetrics(move.inventory);

                return (
                  <tr
                    key={move.id}
                    className="hover:bg-slate-50/90 transition-colors"
                  >
                    <td className="py-3.5 px-4 align-top">
                      <button
                        type="button"
                        onClick={() => onSelectMove(move.id, 'inventory')}
                        className="font-semibold text-slate-900 hover:underline text-left block cursor-pointer"
                      >
                        {move.clientName}
                      </button>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono tabular-nums">{move.folio}</span>
                        <span aria-hidden="true">·</span>
                        <span>{STATUS_LABELS[move.status]}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 align-top">
                      <div className="flex items-center gap-1.5 font-medium text-slate-900 text-xs sm:text-sm">
                        <span>{move.originCity}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{move.destinationCity}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                        {move.distanceKm} km · Salida: {move.moveDate}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 align-top">
                      <div className="text-xs font-semibold text-slate-800 font-mono tabular-nums">
                        {inv.totalUnits} cosas ({inv.distinctLines} partidas) · {inv.totalVolumeM3} m³
                      </div>
                      <p className="text-xs text-slate-500 truncate max-w-xs mt-0.5">
                        {move.inventory.map((i) => `${i.quantity}x ${i.name}`).join(', ') ||
                          'Sin artículos registrados'}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {formatCurrencyCOP(bal.totalContract)}
                    </td>

                    <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                      {formatCurrencyCOP(bal.amountPaid)}
                      <span className="block text-[11px] font-normal text-slate-500">
                        {bal.paidPercentage}% cubierto
                      </span>
                    </td>

                    <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={
                          bal.balanceDue > 0
                            ? 'font-bold text-red-600'
                            : 'font-semibold text-emerald-700'
                        }
                      >
                        {formatCurrencyCOP(bal.balanceDue)}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {bal.paymentStateLabel}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 align-top text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenPdfModal(move)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF Inventario
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectMove(move.id, 'inventory')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Package className="w-3.5 h-3.5" />
                          Inventario
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectMove(move.id, 'statement')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Cuenta
                        </button>
                        {bal.balanceDue > 0 && (
                          <button
                            type="button"
                            onClick={() => onOpenPaymentModal(move.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Abonar
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => onRequestDeleteMove(move.id)}
                            aria-label={`Eliminar cliente ${move.clientName}`}
                            title="Eliminar cliente (Solo Administrador)"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
