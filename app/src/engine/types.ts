// Engine input/output types. The engine is pure: no React, no DOM, no I/O.
// All fields are required at the type level; defaults live in src/state.

export interface Debt {
  id: number;
  name: string;
  balance: number;
  apr: number;
  type: 'fixed' | 'loc';
  payment?: number;          // required when type === 'fixed'
  limit?: number;            // required when type === 'loc'
  minPaymentPct?: number;    // required when type === 'loc' (e.g. 2 means 2%)
}

export interface Expense {
  id: number;
  name: string;
  amount: number;
  months: number[];          // empty array = every month; otherwise 1-indexed months
  useFloat: boolean;
  enabled: boolean;
}

export interface Config {
  startingCash: number;
  months: number;
  avgJobSize: number;
  minJobsPerMonth: number;
  maxJobsPerMonth: number;
  revenueVariation: number;  // e.g. 0.15 = ±15%
  surplusPaydownFraction: number;  // 0..1; default 0.5 (rules §8 OPEN-D)
  surplusPaydownFloor: number;     // dollar amount; below this, skip paydown
}

export interface FloatStrategy {
  enabled: boolean;
  primaryLocId: number;       // accepts the initial charge
  secondaryLocId: number;     // receives the transfer
  transferMonth: number;      // 1-indexed
  dueMonth: number;           // 1-indexed
}

export interface RevenueGoal {
  enabled: boolean;
  annualTarget: number;
  targetProfitMargin: number; // 0..1
}

export interface Inputs {
  config: Config;
  debts: Debt[];
  criticalOpex: Expense[];
  flexibleOpex: Expense[];
  oneTimeExpenses: Expense[];
  floatStrategy: FloatStrategy;
  ownerDrawTarget: number;    // monthly target; treated as an expense in the sim
  revenueGoal: RevenueGoal;
}

export type DebtEventType =
  | 'float_charge'
  | 'float_transfer'
  | 'float_due_settled'
  | 'float_due_unpaid'
  | 'loc_draw'
  | 'paydown'
  | 'shortage';

export interface DebtEvent {
  type: DebtEventType;
  debtId?: number;
  debtName?: string;
  amount: number;
  description: string;
  critical?: boolean;
}

export interface MonthResult {
  month: number;              // 1-indexed (M1, M2, ...)
  monthLabel: string;
  jobCount: number;
  revenue: number;
  collections: number;
  criticalOpex: number;       // total critical OpEx this month (incl. float-routed)
  flexibleOpex: number;
  oneTimeExpense: number;
  ownerDraw: number;          // target amount actually paid this month
  debtPayments: number;       // cash leaving for debt service (fixed + LOC min)
  interest: number;           // interest accrued across all debts
  principalPaid: number;
  cash: number;               // end-of-month cash position
  totalDebt: number;          // end-of-month
  debtBalances: Record<number, number>;
  cashShortage: number;       // 0 if covered; otherwise uncovered amount
  events: DebtEvent[];
  // Accrual & cash views (see rules.md §9):
  operatingProfit: number;            // single-month: collections − opex − interest − ownerDraw
  cumulativeOperatingProfit: number;
  cumulativeNetCashChange: number;    // running (cash − startingCash)
  monthEndCashSurplus: number;        // informational; cash on hand at month-end (rules §4.1 OPEN-B)
  endingAccountsReceivable: number;   // pending collections still outstanding
}

export type Rng = () => number;       // returns a uniform [0,1) value
