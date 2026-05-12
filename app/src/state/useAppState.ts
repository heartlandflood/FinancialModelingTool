// Centralized state for the cash-flow app. In-memory only — refresh = reset,
// per the design constraint of "no Firebase / no persistence."

import { useCallback, useMemo, useState } from 'react';
import { simulate } from '../engine/simulate';
import { mulberry32 } from '../engine/prng';
import { runMonteCarlo, type MonteCarloResult } from '../engine/monteCarlo';
import { importExcel } from '../excel/adapter';
import type { Inputs, Config, Debt, Expense, FloatStrategy } from '../engine/types';

const DEFAULT_SEED = 42;

export interface ImportInfo {
  fileName: string;
  importedAt: string;
  warnings: string[];
}

export type ToastKind = 'info' | 'warning' | 'error';
export interface Toast { kind: ToastKind; text: string; key: number; }

export function useAppState() {
  const [inputs, setInputs] = useState<Inputs>(() => emptyInputs());
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [importInfo, setImportInfo] = useState<ImportInfo | null>(null);
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const projection = useMemo(() => {
    try {
      return simulate(inputs, mulberry32(seed));
    } catch {
      return [];
    }
  }, [inputs, seed]);

  const pushToast = useCallback((text: string, kind: ToastKind = 'info') => {
    const key = Date.now() + Math.random();
    setToasts((prev) => [...prev, { kind, text, key }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.key !== key));
    }, 4500);
  }, []);

  const importFromFile = useCallback(async (file: File) => {
    try {
      const ab = await file.arrayBuffer();
      const result = importExcel(ab, file.name);
      // Merge imported partial Inputs onto current state — fields not present
      // in the workbook (e.g. floatStrategy) keep current values.
      setInputs((prev) => mergeInputs(prev, result.inputs));
      setImportInfo({
        fileName: result.source.fileName,
        importedAt: result.source.importedAt,
        warnings: result.warnings,
      });
      pushToast(`Imported ${file.name}`, 'info');
      if (result.warnings.length > 0) {
        pushToast(`${result.warnings.length} import warning${result.warnings.length === 1 ? '' : 's'} — see Inputs tab`, 'warning');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to read file';
      pushToast(`Import failed: ${msg}`, 'error');
    }
  }, [pushToast]);

  const replaceInputs = useCallback((next: Inputs) => setInputs(next), []);
  const updateConfig = useCallback((patch: Partial<Config>) =>
    setInputs((p) => ({ ...p, config: { ...p.config, ...patch } })), []);
  const updateFloat = useCallback((patch: Partial<FloatStrategy>) =>
    setInputs((p) => ({ ...p, floatStrategy: { ...p.floatStrategy, ...patch } })), []);
  const updateOwnerDraw = useCallback((value: number) =>
    setInputs((p) => ({ ...p, ownerDrawTarget: value })), []);

  const updateExpense = useCallback(
    (bucket: 'criticalOpex' | 'flexibleOpex' | 'oneTimeExpenses', id: number, patch: Partial<Expense>) =>
      setInputs((p) => ({
        ...p,
        [bucket]: p[bucket].map((e) => (e.id === id ? { ...e, ...patch } : e)),
      })),
    [],
  );

  const removeExpense = useCallback(
    (bucket: 'criticalOpex' | 'flexibleOpex' | 'oneTimeExpenses', id: number) =>
      setInputs((p) => ({
        ...p,
        [bucket]: p[bucket].filter((e) => e.id !== id),
      })),
    [],
  );

  const addExpense = useCallback(
    (bucket: 'criticalOpex' | 'flexibleOpex' | 'oneTimeExpenses') =>
      setInputs((p) => {
        const arr = p[bucket];
        const id = (arr.reduce((m, e) => Math.max(m, e.id), 0) || 0) + 1;
        const isOneTime = bucket === 'oneTimeExpenses';
        const isFlexible = bucket === 'flexibleOpex';
        const blank: Expense = {
          id,
          name: 'New expense',
          amount: 0,
          months: isOneTime ? [1] : [],
          useFloat: false,
          enabled: !isFlexible || true,
        };
        return { ...p, [bucket]: [...arr, blank] };
      }),
    [],
  );

  const updateDebt = useCallback((id: number, patch: Partial<Debt>) =>
    setInputs((p) => ({
      ...p,
      debts: p.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    })), []);

  const removeDebt = useCallback((id: number) =>
    setInputs((p) => ({ ...p, debts: p.debts.filter((d) => d.id !== id) })), []);

  const addDebt = useCallback(() =>
    setInputs((p) => {
      const id = (p.debts.reduce((m, d) => Math.max(m, d.id), 0) || 0) + 1;
      const blank: Debt = { id, name: 'New debt', balance: 0, payment: 0, apr: 0, type: 'fixed' };
      return { ...p, debts: [...p.debts, blank] };
    }), []);

  const runMC = useCallback((simulations: number) => {
    const result = runMonteCarlo(inputs, {
      simulations,
      percentiles: [10, 50, 90],
      rankBy: 'netPosition',
      baseSeed: seed,
    });
    setMcResult(result);
  }, [inputs, seed]);

  const resetMC = useCallback(() => setMcResult(null), []);

  return {
    inputs,
    seed, setSeed,
    projection,
    importInfo,
    toasts,
    mcResult,
    importFromFile,
    replaceInputs,
    updateConfig,
    updateFloat,
    updateOwnerDraw,
    addExpense,
    updateExpense,
    removeExpense,
    addDebt,
    updateDebt,
    removeDebt,
    runMonteCarlo: runMC,
    resetMC,
    pushToast,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function emptyInputs(): Inputs {
  return {
    config: {
      startingCash: 47000,
      months: 18,
      avgJobSize: 57584,
      minJobsPerMonth: 1,
      maxJobsPerMonth: 1,
      revenueVariation: 0.15,
      surplusPaydownFraction: 0.5,
      surplusPaydownFloor: 500,
    },
    debts: [],
    criticalOpex: [],
    flexibleOpex: [],
    oneTimeExpenses: [],
    floatStrategy: {
      enabled: false,
      primaryLocId: -1,
      secondaryLocId: -1,
      transferMonth: 2,
      dueMonth: 3,
    },
    ownerDrawTarget: 5000,
    revenueGoal: { enabled: false, annualTarget: 0, targetProfitMargin: 0.25 },
  };
}

function mergeInputs(current: Inputs, imported: Partial<Inputs>): Inputs {
  return {
    config:          imported.config          ?? current.config,
    debts:           imported.debts           ?? current.debts,
    criticalOpex:    imported.criticalOpex    ?? current.criticalOpex,
    flexibleOpex:    imported.flexibleOpex    ?? current.flexibleOpex,
    oneTimeExpenses: imported.oneTimeExpenses ?? current.oneTimeExpenses,
    floatStrategy:   imported.floatStrategy   ?? current.floatStrategy,
    ownerDrawTarget: imported.ownerDrawTarget ?? current.ownerDrawTarget,
    revenueGoal:     imported.revenueGoal     ?? current.revenueGoal,
  };
}
