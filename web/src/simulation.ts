// Faithful port of app.py's ATM queue simulation.

export type IATRule = { test: (r: number) => boolean; value: number; label: string };
export type STRule = { test: (r: number) => boolean; value: number; label: string };

// Inter-arrival-time distribution (minutes)
// r < 0.2 -> 1, r < 0.5 -> 4, else 6
export const IAT_RULES: IATRule[] = [
  { test: (r) => r < 0.2, value: 1, label: "r < 0.20" },
  { test: (r) => r < 0.5, value: 4, label: "0.20 ≤ r < 0.50" },
  { test: () => true, value: 6, label: "r ≥ 0.50" },
];

// Service-time distribution (minutes)
// r < 0.3 -> 2, else 4
export const ST_RULES: STRule[] = [
  { test: (r) => r < 0.3, value: 2, label: "r < 0.30" },
  { test: () => true, value: 4, label: "r ≥ 0.30" },
];

// Probabilities derived from the cumulative rules above.
export const IAT_DIST = [
  { iat: 1, p: 0.2 },
  { iat: 4, p: 0.3 },
  { iat: 6, p: 0.5 },
];

export const ST_DIST = [
  { st: 2, p: 0.3 },
  { st: 4, p: 0.7 },
];

export const getIAT = (r: number): number => {
  for (const rule of IAT_RULES) if (rule.test(r)) return rule.value;
  return 0;
};

export const getST = (r: number): number => {
  for (const rule of ST_RULES) if (rule.test(r)) return rule.value;
  return 0;
};

export type CustomerRow = {
  i: number;
  rIat: number;
  iat: number;
  arrival: number;
  rSt: number;
  st: number;
  start: number;
  end: number;
  wait: number;
  idle: number;
};

export type DayResult = {
  day: number;
  rows: CustomerRow[];
  avgWait: number;
  avgService: number;
  totalWait: number;
  totalIdle: number;
  finalEnd: number;
  utilization: number; // total service time / final end time
};

export type SimulationResult = {
  days: DayResult[];
  globalAvgWait: number;
  waitThreshold: number;
  verdict: "ACTION_REQUIRED" | "OPTIMAL";
};

// Seeded RNG (mulberry32) so re-runs are reproducible when a seed is supplied.
export const makeRng = (seed?: number): (() => number) => {
  if (seed === undefined || seed === null || Number.isNaN(seed)) return Math.random;
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const runSimulationDay = (
  day: number,
  numCustomers: number,
  rand: () => number,
): DayResult => {
  const rows: CustomerRow[] = [];
  let prevEnd = 0;
  let prevArrival = 0;
  let totalWait = 0;
  let totalIdle = 0;
  let totalService = 0;

  for (let i = 1; i <= numCustomers; i++) {
    const rIat = rand();
    const iat = i > 1 ? getIAT(rIat) : 0;
    const rSt = rand();
    const st = getST(rSt);

    const arrival = prevArrival + iat;
    const start = Math.max(arrival, prevEnd);
    const end = start + st;
    const wait = Math.max(0, start - arrival);
    const idle = i > 1 ? Math.max(0, arrival - prevEnd) : 0;

    totalWait += wait;
    totalIdle += idle;
    totalService += st;

    rows.push({ i, rIat, iat, arrival, rSt, st, start, end, wait, idle });

    prevEnd = end;
    prevArrival = arrival;
  }

  const avgWait = totalWait / numCustomers;
  const avgService = totalService / numCustomers;
  const finalEnd = rows[rows.length - 1]?.end ?? 0;
  const utilization = finalEnd > 0 ? totalService / finalEnd : 0;

  return {
    day,
    rows,
    avgWait,
    avgService,
    totalWait,
    totalIdle,
    finalEnd,
    utilization,
  };
};

export const runSimulation = (
  days: number,
  customersPerDay: number,
  waitThreshold: number,
  seed?: number,
): SimulationResult => {
  const rand = makeRng(seed);
  const dayResults: DayResult[] = [];
  for (let d = 1; d <= days; d++) {
    dayResults.push(runSimulationDay(d, customersPerDay, rand));
  }
  const globalAvgWait =
    dayResults.reduce((s, d) => s + d.avgWait, 0) / Math.max(1, dayResults.length);
  return {
    days: dayResults,
    globalAvgWait,
    waitThreshold,
    verdict: globalAvgWait > waitThreshold ? "ACTION_REQUIRED" : "OPTIMAL",
  };
};
