import React, { useState, useMemo } from 'react';
import {
  Download,
  Printer,
  Plus,
  DollarSign,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
} from 'lucide-react';
import type {
  MoveRecord,
  OperationalExpense,
  FinancialPeriodGranularity,
} from '../types.ts';
import {
  calculateFinancialSummary,
  calculateFinancialPeriods,
  getPeriodKeyAndLabel,
  calculateClientBalance,
  calculateInventoryMetrics,
  formatCurrencyCOP,
} from '../utils/finance.ts';

interface FinancesLedgerViewProps {
  moves: MoveRecord[];
  expenses: OperationalExpense[];
  mode: 'finanzas' | 'estados_cuenta';
  selectedStatementMoveId: string;
  onChangeSelectedStatementMoveId: (moveId: string) => void;
  onOpenPaymentModal: (moveId: string) => void;
  onOpenExpenseModal: () => void;
}

const GRANULARITY_OPTIONS: {
  id: FinancialPeriodGranularity;
  label: string;
  singularLabel: string;
}[] = [
  { id: 'dia', label: 'Por Días', singularLabel: 'Día' },
  { id: 'semana', label: 'Por Semanas', singularLabel: 'Semana' },
  { id: 'mes', label: 'Por Meses', singularLabel: 'Mes' },
  { id: 'anio', label: 'Por Años', singularLabel: 'Año' },
];

export const FinancesLedgerView: React.FC<FinancesLedgerViewProps> = ({
  moves,
  expenses,
  mode,
  selectedStatementMoveId,
  onChangeSelectedStatementMoveId,
  onOpenPaymentModal,
  onOpenExpenseModal,
}) => {
  const [ledgerFilter, setLedgerFilter] = useState<'todos' | 'ingresos' | 'egresos'>(
    'todos'
  );
  const [periodGranularity, setPeriodGranularity] =
    useState<FinancialPeriodGranularity>('mes');
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>('todos');

  const metrics = useMemo(
    () => calculateFinancialSummary(moves, expenses),
    [moves, expenses]
  );

  const periodBuckets = useMemo(
    () => calculateFinancialPeriods(moves, expenses, periodGranularity),
    [moves, expenses, periodGranularity]
  );

  const activePeriodBucket = useMemo(
    () =>
      selectedPeriodKey === 'todos'
        ? null
        : periodBuckets.find((b) => b.periodKey === selectedPeriodKey) || null,
    [periodBuckets, selectedPeriodKey]
  );

  const activeGranularityMeta =
    GRANULARITY_OPTIONS.find((g) => g.id === periodGranularity) ||
    GRANULARITY_OPTIONS[2];

  const activeStatementMove =
    moves.find((m) => m.id === selectedStatementMoveId) || moves[0] || null;

  // Build unified cash flow ledger combining client payments (Ingresos) and operational expenses (Egresos)
  const unifiedLedger = useMemo(() => {
    const entries: {
      id: string;
      date: string;
      type: 'ingreso' | 'egreso';
      categoryOrMethod: string;
      description: string;
      routeOrClient: string;
      amount: number;
    }[] = [];

    for (const move of moves) {
      for (const pay of move.payments) {
        entries.push({
          id: `in_${pay.id}`,
          date: pay.date,
          type: 'ingreso',
          categoryOrMethod: pay.method,
          description: `${pay.concept} (${move.folio})`,
          routeOrClient: `${move.clientName} · ${move.originCity.split(',')[0]} → ${move.destinationCity.split(',')[0]}`,
          amount: pay.amount,
        });
      }
    }

    for (const exp of expenses) {
      entries.push({
        id: `out_${exp.id}`,
        date: exp.date,
        type: 'egreso',
        categoryOrMethod: exp.category,
        description: exp.description,
        routeOrClient: exp.routeLabel || 'Operación General de Flota',
        amount: exp.amount,
      });
    }

    return entries
      .filter((e) => {
        if (ledgerFilter === 'ingresos' && e.type !== 'ingreso') return false;
        if (ledgerFilter === 'egresos' && e.type !== 'egreso') return false;
        if (activePeriodBucket) {
          const entryPeriod = getPeriodKeyAndLabel(e.date, periodGranularity);
          if (entryPeriod.periodKey !== activePeriodBucket.periodKey) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [moves, expenses, ledgerFilter, activePeriodBucket, periodGranularity]);

  const handleGranularityChange = (nextGranularity: FinancialPeriodGranularity) => {
    setPeriodGranularity(nextGranularity);
    setSelectedPeriodKey('todos');
  };

  const handleExportCSV = () => {
    const headers = [
      'Folio',
      'Cliente',
      'Telefono',
      'Ciudad Origen',
      'Ciudad Destino',
      'Piezas Inventario',
      'Volumen m3',
      'Total Contrato COP',
      'Saldo Pagado COP',
      'Saldo que Debe COP',
      'Estado',
    ];
    const rows = moves.map((m) => {
      const bal = calculateClientBalance(m.totalContractAmount, m.amountPaid);
      const inv = calculateInventoryMetrics(m.inventory);
      return [
        m.folio,
        `"${m.clientName}"`,
        `"${m.clientPhone}"`,
        `"${m.originCity}"`,
        `"${m.destinationCity}"`,
        inv.totalUnits,
        inv.totalVolumeM3,
        bal.totalContract,
        bal.amountPaid,
        bal.balanceDue,
        bal.paymentStateLabel,
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estados-de-cuenta-mudanzas-cop-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (mode === 'estados_cuenta' && activeStatementMove) {
    const bal = calculateClientBalance(
      activeStatementMove.totalContractAmount,
      activeStatementMove.amountPaid
    );
    const inv = calculateInventoryMetrics(activeStatementMove.inventory);

    let runningDebt = bal.totalContract;
    const ledgerSteps = activeStatementMove.payments.map((p) => {
      runningDebt = Math.max(0, Number((runningDebt - p.amount).toFixed(2)));
      return { ...p, remainingAfter: runningDebt };
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-5 no-print">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">
              Certificación Financiera por Servicio · Colombia, Venezuela y Ecuador · Moneda: COP
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Estados de Cuenta Detallados por Cliente (COP)
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Exportar Cartera CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir Estado de Cuenta
            </button>
            {bal.balanceDue > 0 && (
              <button
                type="button"
                onClick={() => onOpenPaymentModal(activeStatementMove.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
              >
                <DollarSign className="w-4 h-4" />
                Registrar Abono a esta Cuenta
              </button>
            )}
          </div>
        </div>

        {/* Client Selector Strip */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 no-print">
          <label
            htmlFor="statement-client-selector"
            className="block text-xs font-semibold text-slate-700 mb-2"
          >
            Seleccionar Cliente para Consultar su Estado de Cuenta Detallado (COP):
          </label>
          <div className="flex flex-wrap gap-2">
            {moves.map((m) => {
              const mBal = calculateClientBalance(m.totalContractAmount, m.amountPaid);
              const isSelected = m.id === activeStatementMove.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeSelectedStatementMoveId(m.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs text-left transition-colors border cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="block">{m.clientName}</span>
                  <span
                    className={`font-mono tabular-nums text-[11px] ${
                      isSelected
                        ? 'text-slate-300'
                        : mBal.balanceDue > 0
                        ? 'text-red-600'
                        : 'text-emerald-700'
                    }`}
                  >
                    Debe: {formatCurrencyCOP(mBal.balanceDue)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Formal Account Statement Sheet */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <span className="text-xs font-semibold text-slate-500">
                ESTADO DE CUENTA E INVENTARIO DE MUDANZA (COP)
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">
                {activeStatementMove.clientName}
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Tel: {activeStatementMove.clientPhone} · Correo:{' '}
                {activeStatementMove.clientEmail || 'No especificado'} · Folio:{' '}
                <strong className="font-mono tabular-nums">
                  {activeStatementMove.folio}
                </strong>
              </p>
            </div>

            <div className="sm:text-right">
              <div className="text-xs text-slate-500">Ruta Contratada</div>
              <div className="text-sm font-bold text-slate-900 flex sm:justify-end items-center gap-1.5 mt-0.5">
                <span>{activeStatementMove.originCity}</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <span>{activeStatementMove.destinationCity}</span>
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-500 mt-1">
                {activeStatementMove.distanceKm} km · {activeStatementMove.truckUnit}
              </div>
            </div>
          </div>

          {/* 4-Column Statement Balance Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div>
              <span className="text-xs text-slate-500 block">Total Cotizado (COP)</span>
              <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
                {formatCurrencyCOP(bal.totalContract)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Total Pagado a la Fecha</span>
              <span className="text-lg font-bold font-mono tabular-nums text-emerald-700">
                {formatCurrencyCOP(bal.amountPaid)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Saldo Pendiente (Deuda)</span>
              <span
                className={`text-lg font-bold font-mono tabular-nums ${
                  bal.balanceDue > 0 ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                {formatCurrencyCOP(bal.balanceDue)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Carga Inventariada</span>
              <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
                {inv.totalUnits} pzas ({inv.totalVolumeM3} m³)
              </span>
            </div>
          </div>

          {/* Chronological Account Movements */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              1. Desglose de Cargos, Anticipos y Abonos (COP)
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 px-4">Fecha</th>
                    <th className="py-2.5 px-4">Concepto</th>
                    <th className="py-2.5 px-4">Método / Referencia</th>
                    <th className="py-2.5 px-4 text-right">Cargo</th>
                    <th className="py-2.5 px-4 text-right">Abono</th>
                    <th className="py-2.5 px-4 text-right">Saldo Insoluto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  <tr>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {activeStatementMove.moveDate}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Contrato de Flete y Mudanza ({activeStatementMove.originCity} →{' '}
                      {activeStatementMove.destinationCity})
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {activeStatementMove.folio}
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
                  {ledgerSteps.map((step) => (
                    <tr key={step.id}>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {step.date}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {step.concept}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {step.method} ·{' '}
                        <span className="font-mono tabular-nums">
                          {step.reference || 'S/R'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">
                        —
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                        -{formatCurrencyCOP(step.amount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrencyCOP(step.remainingAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary of Inventory Carried on Statement */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              2. Manifiesto de Inventario de Cosas que Lleva ({inv.totalUnits} piezas ·{' '}
              {inv.totalVolumeM3} m³ · {inv.totalWeightKg} kg)
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 px-4">Cant.</th>
                    <th className="py-2.5 px-4">Descripción del Mueble / Caja</th>
                    <th className="py-2.5 px-4">Categoría</th>
                    <th className="py-2.5 px-4 text-right">Volumen</th>
                    <th className="py-2.5 px-4">Notas de Condición y Evidencia de Daño</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {activeStatementMove.inventory.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-4 font-mono tabular-nums font-bold text-slate-900 align-top">
                        {item.quantity}x
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 align-top">
                        {item.name}
                        {item.isFragile && (
                          <span className="ml-1.5 text-amber-700 font-semibold">
                            · Frágil
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 align-top">{item.category}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 align-top whitespace-nowrap">
                        {(item.quantity * item.volumeM3).toFixed(2)} m³
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 align-top">
                        <div>{item.conditionNotes || 'Sin observaciones'}</div>
                        {(item.hasDamage || item.damageNotes || item.evidencePhotoDataUrl) && (
                          <div className="mt-1.5 flex items-center gap-2.5 p-2 bg-red-50/70 border border-red-200 rounded-md">
                            {item.evidencePhotoDataUrl && (
                              <img
                                src={item.evidencePhotoDataUrl}
                                alt={`Evidencia de ${item.name}`}
                                referrerPolicy="no-referrer"
                                className="w-14 h-9 object-cover rounded border border-red-300 shrink-0"
                              />
                            )}
                            <div className="text-[11px] text-red-900">
                              <strong className="font-semibold">Mal Estado Previo: </strong>
                              <span>{item.damageNotes || 'Evidencia fotográfica tomada'}</span>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Compute displayed KPI values (either filtered to the selected Day/Week/Month/Year or global totals)
  const displayedCollected = activePeriodBucket
    ? activePeriodBucket.collectedAmount
    : metrics.totalCollected;
  const displayedExpenses = activePeriodBucket
    ? activePeriodBucket.expensesAmount
    : metrics.totalOperationalExpenses;
  const displayedNetBalance = activePeriodBucket
    ? activePeriodBucket.netCashFlow
    : metrics.netOperatingBalance;
  const displayedContracted = activePeriodBucket
    ? activePeriodBucket.contractedAmount
    : metrics.totalContracted;
  const displayedDebt = activePeriodBucket
    ? activePeriodBucket.pendingDebtAmount
    : metrics.totalReceivableDebt;

  const maxPeriodValue = Math.max(
    ...periodBuckets.map((b) =>
      Math.max(b.collectedAmount, b.expensesAmount, b.contractedAmount, 1)
    ),
    1
  );

  // Default mode: 'finanzas' (Organización Financiera por Días, Semanas, Meses y Años + Libro Mayor)
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">
            Control de Caja en Pesos Colombianos (COP) · Colombia, Venezuela y Ecuador
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Estado de Mis Finanzas por Días, Semanas, Meses y Años (COP)
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Descargar Reporte CSV
          </button>
          <button
            type="button"
            onClick={onOpenExpenseModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Registrar Gasto Operativo
          </button>
        </div>
      </div>

      {/* Period Granularity Selector Bar: Días | Semanas | Meses | Años */}
      <section
        aria-label="Selector de estado financiero por días, semanas, meses y años"
        className="bg-white border border-slate-200 rounded-xl p-5 space-y-5"
      >
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
              <h2 className="text-base font-bold text-slate-900">
                Consultar Estado de Finanzas por Temporalidad ({activeGranularityMeta.label})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Analiza tus ingresos cobrados, gastos operativos, deudas por cobrar y utilidad neta agrupados por días, semanas, meses o años
            </p>
          </div>

          <div
            role="group"
            aria-label="Agrupar finanzas por temporalidad"
            className="grid grid-cols-2 sm:inline-flex sm:flex-nowrap items-center gap-1.5 p-1.5 bg-slate-100 border border-slate-200 rounded-xl shrink-0 self-start"
          >
            {GRANULARITY_OPTIONS.map((opt) => {
              const isActive = periodGranularity === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`period-tab-${opt.id}`}
                  onClick={() => handleGranularityChange(opt.id)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap text-center ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Specific Period Filter Strip */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 mr-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            Filtrar {activeGranularityMeta.singularLabel}:
          </span>
          <button
            type="button"
            onClick={() => setSelectedPeriodKey('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              selectedPeriodKey === 'todos'
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Todos ({periodBuckets.length} {activeGranularityMeta.label.replace('Por ', '').toLowerCase()})
          </button>
          {periodBuckets.map((bucket) => {
            const isSelected = selectedPeriodKey === bucket.periodKey;
            return (
              <button
                key={bucket.periodKey}
                type="button"
                onClick={() => setSelectedPeriodKey(bucket.periodKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-700 text-white border-emerald-700 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{bucket.periodLabel}</span>
                <span
                  className={`ml-1.5 font-mono text-[11px] ${
                    isSelected ? 'text-emerald-100' : 'text-emerald-700 font-semibold'
                  }`}
                >
                  {formatCurrencyCOP(bucket.netCashFlow)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Visual Bar Comparison Across Periods (Días, Semanas, Meses o Años) */}
        <div className="pt-2 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">
              Comparativa Visual de Ingresos vs. Gastos y Flujo Neto ({activeGranularityMeta.label})
            </span>
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block" />
                Ingresos Cobrados (COP)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-red-500 inline-block" />
                Gastos Operativos (COP)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" />
                Deuda por Cobrar (COP)
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {periodBuckets.map((bucket) => {
              const collectedPct =
                bucket.collectedAmount > 0
                  ? Math.max(3, Math.round((bucket.collectedAmount / maxPeriodValue) * 100))
                  : 0;
              const expensesPct =
                bucket.expensesAmount > 0
                  ? Math.max(3, Math.round((bucket.expensesAmount / maxPeriodValue) * 100))
                  : 0;
              const isSelected = selectedPeriodKey === bucket.periodKey;

              return (
                <div
                  key={bucket.periodKey}
                  onClick={() =>
                    setSelectedPeriodKey(
                      isSelected ? 'todos' : bucket.periodKey
                    )
                  }
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/50 border-emerald-400 shadow-xs'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {bucket.periodLabel}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {bucket.paymentsCount} abonos · {bucket.expensesCount} gastos ·{' '}
                        {bucket.movesCount} mudanzas
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
                      <span className="text-emerald-700 font-semibold">
                        Ingresos: +{formatCurrencyCOP(bucket.collectedAmount)}
                      </span>
                      <span className="text-red-600 font-semibold">
                        Gastos: -{formatCurrencyCOP(bucket.expensesAmount)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          bucket.netCashFlow >= 0
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-red-100 text-red-900'
                        }`}
                      >
                        Neto: {bucket.netCashFlow >= 0 ? '+' : ''}
                        {formatCurrencyCOP(bucket.netCashFlow)}
                      </span>
                    </div>
                  </div>

                  {/* Dual Horizontal Bars: Ingresos vs Gastos */}
                  <div className="space-y-1.5">
                    <div className="w-full h-3 bg-slate-200/70 rounded-full overflow-hidden flex items-center">
                      {collectedPct > 0 && (
                        <div
                          style={{ width: `${collectedPct}%` }}
                          className="h-full bg-emerald-600 rounded-full transition-all"
                          title={`Ingresos cobrados: ${formatCurrencyCOP(bucket.collectedAmount)}`}
                        />
                      )}
                    </div>
                    {expensesPct > 0 && (
                      <div className="w-full h-2 bg-slate-200/70 rounded-full overflow-hidden flex items-center">
                        <div
                          style={{ width: `${expensesPct}%` }}
                          className="h-full bg-red-500 rounded-full transition-all"
                          title={`Gastos operativos: ${formatCurrencyCOP(bucket.expensesAmount)}`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Period Financial State Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900">
              Tabla de Estado Financiero Detallado ({activeGranularityMeta.label})
            </h3>
            <span className="text-[11px] text-slate-500">
              Haz clic en una fila para filtrar el Libro Mayor a ese {activeGranularityMeta.singularLabel.toLowerCase()}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">{activeGranularityMeta.singularLabel}</th>
                  <th className="py-2.5 px-4 text-right">Fletes Contratados</th>
                  <th className="py-2.5 px-4 text-right">Ingresos Cobrados</th>
                  <th className="py-2.5 px-4 text-right">Deuda por Cobrar</th>
                  <th className="py-2.5 px-4 text-right">Gastos Operativos</th>
                  <th className="py-2.5 px-4 text-right">Flujo Neto (Utilidad Caja)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {periodBuckets.map((bucket) => {
                  const isSelected = selectedPeriodKey === bucket.periodKey;
                  return (
                    <tr
                      key={bucket.periodKey}
                      onClick={() =>
                        setSelectedPeriodKey(
                          isSelected ? 'todos' : bucket.periodKey
                        )
                      }
                      className={`transition-colors cursor-pointer ${
                        isSelected ? 'bg-emerald-50/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{bucket.periodLabel}</span>
                          {isSelected && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-700 text-white">
                              Activo
                            </span>
                          )}
                        </div>
                        <span className="block text-[11px] font-normal text-slate-500 font-mono">
                          {bucket.movesCount} mudanzas · {bucket.paymentsCount} abonos ·{' '}
                          {bucket.expensesCount} gastos
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                        {formatCurrencyCOP(bucket.contractedAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                        + {formatCurrencyCOP(bucket.collectedAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-amber-700 whitespace-nowrap">
                        {formatCurrencyCOP(bucket.pendingDebtAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-red-600 whitespace-nowrap">
                        - {formatCurrencyCOP(bucket.expensesAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                        <span
                          className={
                            bucket.netCashFlow >= 0
                              ? 'text-emerald-700'
                              : 'text-red-600'
                          }
                        >
                          {bucket.netCashFlow >= 0 ? '+ ' : ''}
                          {formatCurrencyCOP(bucket.netCashFlow)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Financial Health Summary Strip (Reacts to Selected Period or Total) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>
              {activePeriodBucket
                ? `Ingresos Recibidos (${activePeriodBucket.periodLabel})`
                : 'Total Ingresos Recibidos (Abonos COP)'}
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
            + {formatCurrencyCOP(displayedCollected)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            De {formatCurrencyCOP(displayedContracted)} contratados en rutas
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>
              {activePeriodBucket
                ? `Gastos Operativos (${activePeriodBucket.periodLabel})`
                : 'Total Gastos Operativos (ACPM, Peajes, Cargue)'}
            </span>
            <TrendingDown className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            - {formatCurrencyCOP(displayedExpenses)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {activePeriodBucket
              ? `${activePeriodBucket.expensesCount} pólizas de gasto en este periodo`
              : `${expenses.length} pólizas de gasto registradas`}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>
              {activePeriodBucket
                ? `Utilidad / Flujo Neto (${activePeriodBucket.periodLabel})`
                : 'Utilidad Operativa Disponible en Caja'}
            </span>
            <DollarSign className="w-4 h-4 text-slate-700" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatCurrencyCOP(displayedNetBalance)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Más {formatCurrencyCOP(displayedDebt)} pendientes por cobrar
          </p>
        </div>
      </div>

      {/* Unified Cash Flow Ledger */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Libro Mayor de Movimientos Financieros (COP)
              {activePeriodBucket ? ` · ${activePeriodBucket.periodLabel}` : ''}
            </h2>
            <p className="text-xs text-slate-500">
              Registro consolidado de cada abono pagado por clientes y cada egreso operativo de mudanza
            </p>
          </div>

          <div
            role="group"
            aria-label="Filtrar movimientos financieros"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start"
          >
            {(
              [
                { id: 'todos', label: 'Todos los Movimientos' },
                { id: 'ingresos', label: 'Ingresos (Pagos Clientes)' },
                { id: 'egresos', label: 'Egresos (Gastos Ruta)' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setLedgerFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  ledgerFilter === f.id
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Categoría / Método</th>
                <th className="py-3 px-4">Concepto / Descripción</th>
                <th className="py-3 px-4">Cliente o Ruta Asociada</th>
                <th className="py-3 px-4 text-right">Monto (COP)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
              {unifiedLedger.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-xs text-slate-500">
                    No hay movimientos registrados para el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                unifiedLedger.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      {entry.date}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold whitespace-nowrap">
                      {entry.type === 'ingreso' ? (
                        <span className="text-emerald-700">Ingreso (+)</span>
                      ) : (
                        <span className="text-red-600">Gasto (-)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      {entry.categoryOrMethod}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 text-xs sm:text-sm">
                      {entry.description}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {entry.routeOrClient}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                        entry.type === 'ingreso' ? 'text-emerald-700' : 'text-slate-900'
                      }`}
                    >
                      {entry.type === 'ingreso' ? '+' : '-'}{' '}
                      {formatCurrencyCOP(entry.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
