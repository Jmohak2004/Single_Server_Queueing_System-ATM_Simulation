import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  IAT_DIST,
  ST_DIST,
  IAT_RULES,
  ST_RULES,
  runSimulation,
  type CustomerRow,
  type DayResult,
  type SimulationResult,
} from "./simulation";

const fmt = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "—");

/* ═══════════════════════════ HOOKS ═══════════════════════════ */

function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    setVal(0);
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setVal((1 - Math.pow(1 - p, 3)) * target);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return val;
}

function useBarReveal() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let r1: number, r2: number;
    r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setReady(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);
  return ready;
}

type PlaybackState = {
  visible: number; playing: boolean; speed: number;
  setSpeed: (n: number) => void;
  play: () => void; pause: () => void; reset: () => void;
};

function usePlayback(total: number): PlaybackState {
  const [visible, setVisible] = useState(total);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(420);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { setVisible(total); setPlaying(false); }, [total]);
  useEffect(() => {
    clearTimeout(timer.current);
    if (!playing) return;
    if (visible >= total) { setPlaying(false); return; }
    timer.current = setTimeout(() => setVisible((v) => Math.min(v + 1, total)), speed);
    return () => clearTimeout(timer.current);
  }, [playing, visible, total, speed]);

  const play  = useCallback(() => { setVisible((v) => (v >= total ? 0 : v)); setPlaying(true); }, [total]);
  const pause = useCallback(() => setPlaying(false), []);
  const reset = useCallback(() => { clearTimeout(timer.current); setPlaying(false); setVisible(total); }, [total]);

  return { visible, playing, speed, setSpeed, play, pause, reset };
}

/* ═══════════════════════════ ROOT ═══════════════════════════ */

export default function App() {
  const [days, setDays] = useState(3);
  const [customersPerDay, setCustomersPerDay] = useState(10);
  const [waitThreshold, setWaitThreshold] = useState(1.0);
  const [seedEnabled, setSeedEnabled] = useState(false);
  const [seed, setSeed] = useState(42);
  const [activeDay, setActiveDay] = useState(1);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [resultKey, setResultKey] = useState(0);

  const run = () => {
    const r = runSimulation(
      Math.max(1, days), Math.max(1, customersPerDay), Math.max(0, waitThreshold),
      seedEnabled ? seed : undefined,
    );
    setResult(r); setActiveDay(1); setResultKey((k) => k + 1);
  };

  const activeDayResult: DayResult | undefined = useMemo(
    () => result?.days.find((d) => d.day === activeDay),
    [result, activeDay],
  );

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <Controls
          days={days} setDays={setDays}
          customersPerDay={customersPerDay} setCustomersPerDay={setCustomersPerDay}
          waitThreshold={waitThreshold} setWaitThreshold={setWaitThreshold}
          seedEnabled={seedEnabled} setSeedEnabled={setSeedEnabled}
          seed={seed} setSeed={setSeed} onRun={run}
        />

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <DistributionCard
            title="Inter-Arrival Time (IAT)"
            subtitle="Chosen from a random number r ∈ [0, 1)"
            distribution={IAT_DIST.map((d) => ({ label: `${d.iat} min`, p: d.p }))}
            rules={IAT_RULES.map((r) => `${r.label} → ${r.value} min`)}
            accentBg="bg-[#1e4a96]/5"
          />
          <DistributionCard
            title="Service Time (ST)"
            subtitle="Chosen from a random number r ∈ [0, 1)"
            distribution={ST_DIST.map((d) => ({ label: `${d.st} min`, p: d.p }))}
            rules={ST_RULES.map((r) => `${r.label} → ${r.value} min`)}
            accentBg="bg-[#1d5c38]/5"
          />
        </div>

        <LogicCard />

        {result && (
          <div key={resultKey} className="anim-fade-in-up">
            <SummaryCards result={result} />

            <div className="paper-card mt-5 p-5">
              <h2 className="text-base font-semibold text-[#1e1810]">Daily Average Wait Time</h2>
              <p className="mt-0.5 text-xs text-[#7a6b54]">
                Dashed line = threshold of {fmt(result.waitThreshold)} min. Click a bar to inspect that day.
              </p>
              <div className="mt-4">
                <DailyAveragesChart result={result} onSelect={setActiveDay} activeDay={activeDay} />
              </div>
            </div>

            {activeDayResult && (
              <DayView
                key={activeDay}
                day={activeDayResult}
                threshold={result.waitThreshold}
                allDays={result.days}
                activeDay={activeDay}
                onDayChange={setActiveDay}
              />
            )}

            <VerdictCard result={result} />
          </div>
        )}

        {!result && <EmptyState onRun={run} />}
      </main>
      <Footer />
    </div>
  );
}

/* ═══════════════════════════ LAYOUT ═══════════════════════════ */

function Header() {
  return (
    <header className="border-b border-[#d8ccb8] bg-[#fdfaf4]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#1e4a96] to-[#1d5c38] text-xl font-bold text-white shadow">
            Q
          </div>
          <div>
            <h1 className="text-base font-semibold text-[#1e1810]">ATM Queue Simulation</h1>
            <p className="text-xs text-[#7a6b54]">Monte Carlo single-server queue · step-by-step</p>
          </div>
        </div>
        <a
          href="https://en.wikipedia.org/wiki/M/M/1_queue"
          target="_blank" rel="noreferrer"
          className="hidden text-xs text-[#7a6b54] hover:text-[#1e4a96] sm:block"
        >
          Queueing theory →
        </a>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mx-auto max-w-7xl px-4 py-8 text-center text-xs text-[#a89880] sm:px-6 lg:px-8">
      Built from <code className="font-mono text-[#4a3f2f]">app.py</code> — logic ported to TypeScript with identical distributions.
    </footer>
  );
}

/* ═══════════════════════════ CONTROLS ═══════════════════════════ */

type ControlsProps = {
  days: number; setDays: (n: number) => void;
  customersPerDay: number; setCustomersPerDay: (n: number) => void;
  waitThreshold: number; setWaitThreshold: (n: number) => void;
  seedEnabled: boolean; setSeedEnabled: (b: boolean) => void;
  seed: number; setSeed: (n: number) => void;
  onRun: () => void;
};

function Controls(p: ControlsProps) {
  return (
    <section className="paper-card mt-6 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <NumberField label="Days" value={p.days} min={1} max={365} onChange={p.setDays} hint="Simulation days" />
        <NumberField label="Customers / day" value={p.customersPerDay} min={1} max={500} onChange={p.setCustomersPerDay} hint="Arrivals per day" />
        <NumberField label="Wait threshold (min)" value={p.waitThreshold} min={0} step={0.1} onChange={p.setWaitThreshold} hint="ATM needed if exceeded" />
        <div>
          <label className="block text-xs font-medium text-[#4a3f2f]">Seed</label>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => p.setSeedEnabled(!p.seedEnabled)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                p.seedEnabled
                  ? "bg-[#1e4a96] text-white"
                  : "border border-[#d8ccb8] bg-[#f2ebe0] text-[#4a3f2f] hover:bg-[#e8dece]"
              }`}
            >
              {p.seedEnabled ? "On" : "Off"}
            </button>
            <input
              type="number"
              disabled={!p.seedEnabled}
              value={p.seed}
              onChange={(e) => p.setSeed(Number(e.target.value))}
              className="w-full rounded-lg border border-[#d8ccb8] bg-[#faf6ef] px-3 py-2 text-sm text-[#1e1810] outline-none transition focus:border-[#1e4a96] disabled:opacity-40"
            />
          </div>
          <p className="mt-1 text-[11px] text-[#a89880]">Reproducible runs</p>
        </div>
        <div className="flex items-end">
          <button
            onClick={p.onRun}
            className="w-full rounded-xl bg-gradient-to-r from-[#1e4a96] to-[#1d5c38] px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:brightness-110 active:scale-[0.99]"
          >
            Run Simulation
          </button>
        </div>
      </div>
    </section>
  );
}

function NumberField(p: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; hint?: string; }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#4a3f2f]">{p.label}</label>
      <input
        type="number"
        value={p.value} min={p.min} max={p.max} step={p.step ?? 1}
        onChange={(e) => p.onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-[#d8ccb8] bg-[#faf6ef] px-3 py-2 text-sm text-[#1e1810] outline-none transition focus:border-[#1e4a96]"
      />
      {p.hint && <p className="mt-1 text-[11px] text-[#a89880]">{p.hint}</p>}
    </div>
  );
}

/* ═══════════════════════════ DISTRIBUTIONS ═══════════════════════════ */

function DistributionCard(p: {
  title: string; subtitle: string;
  distribution: { label: string; p: number }[];
  rules: string[]; accentBg: string;
}) {
  const ready = useBarReveal();
  return (
    <div className={`paper-card relative overflow-hidden p-5 ${p.accentBg}`}>
      <h3 className="text-sm font-semibold text-[#1e1810]">{p.title}</h3>
      <p className="text-xs text-[#7a6b54]">{p.subtitle}</p>
      <div className="mt-4 space-y-2.5">
        {p.distribution.map((d, i) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-16 font-mono text-xs text-[#4a3f2f]">{d.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e8dece]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#1e4a96] to-[#1d5c38]"
                style={{ width: ready ? `${d.p * 100}%` : "0%", transition: `width 0.8s cubic-bezier(0.22,1,0.36,1) ${i * 120}ms` }}
              />
            </div>
            <span className="w-12 text-right font-mono text-xs text-[#7a6b54]">{(d.p * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-[#d8ccb8] bg-[#faf6ef] p-3">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-[#a89880]">Decision Rule</p>
        <ul className="space-y-1 font-mono text-xs text-[#4a3f2f]">
          {p.rules.map((r, i) => (
            <li key={i} className="anim-fade-in-right" style={{ animationDelay: `${i * 80}ms` }}>
              • {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LogicCard() {
  const steps = [
    { num: "1", title: "Draw r(IAT), r(ST)", body: "Two random numbers in [0, 1)." },
    { num: "2", title: "IAT = f(r)", body: "Lookup IAT from distribution." },
    { num: "3", title: "Arrival", body: "arrival = prev_arrival + IAT" },
    { num: "4", title: "Start / End", body: "start = max(arrival, prev_end)\nend = start + ST" },
    { num: "5", title: "Wait / Idle", body: "wait = max(0, start − arrival)\nidle = max(0, arrival − prev_end)" },
  ];
  return (
    <section className="paper-card mt-5 p-5">
      <h3 className="text-sm font-semibold text-[#1e1810]">How each customer is processed</h3>
      <p className="text-xs text-[#7a6b54]">Two uniform random numbers drive Inter-Arrival Time and Service Time per customer.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
        {steps.map((s, i) => (
          <div
            key={s.num}
            className="anim-fade-in-up rounded-lg border border-[#d8ccb8] bg-[#faf6ef] p-3"
            style={{ animationDelay: `${i * 75}ms` }}
          >
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1e4a96] to-[#1d5c38] text-[10px] font-bold text-white">
                {s.num}
              </span>
              <p className="text-xs font-semibold text-[#1e1810]">{s.title}</p>
            </div>
            <p className="mt-2 whitespace-pre-line font-mono text-[11px] leading-relaxed text-[#4a3f2f]">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════ SUMMARY ═══════════════════════════ */

function SummaryCards({ result }: { result: SimulationResult }) {
  const totalCustomers = result.days.reduce((s, d) => s + d.rows.length, 0);
  const totalWait = result.days.reduce((s, d) => s + d.totalWait, 0);
  const avgUtil = result.days.reduce((s, d) => s + d.utilization, 0) / result.days.length;
  const over = result.globalAvgWait > result.waitThreshold;

  const animDays = useCountUp(result.days.length);
  const animCust = useCountUp(totalCustomers);
  const animWait = useCountUp(result.globalAvgWait, 1000);
  const animUtil = useCountUp(avgUtil * 100, 1000);

  return (
    <section className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
      {[
        { label: "Days Simulated",    value: Math.round(animDays).toString(),    accent: "text-[#1e4a96]", delay: 0   },
        { label: "Total Customers",   value: Math.round(animCust).toString(),    accent: "text-[#1d5c38]", delay: 80  },
        { label: "Global Avg Wait",   value: `${animWait.toFixed(2)} min`,       accent: over ? "text-[#8b1c1c]" : "text-[#1d5c38]", delay: 160 },
        { label: "ATM Utilization",   value: `${animUtil.toFixed(1)}%`,          accent: "text-[#a05010]", delay: 240,
          sub: `Total wait: ${fmt(totalWait, 1)} min` },
      ].map((c) => (
        <div
          key={c.label}
          className="anim-fade-in-up paper-card p-4"
          style={{ animationDelay: `${c.delay}ms` }}
        >
          <p className="text-[10px] uppercase tracking-widest text-[#a89880]">{c.label}</p>
          <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${c.accent}`}>{c.value}</p>
          {"sub" in c && c.sub && <p className="mt-1 text-[11px] text-[#a89880]">{c.sub}</p>}
        </div>
      ))}
    </section>
  );
}

/* ═══════════════════════════ CHART ═══════════════════════════ */

function DailyAveragesChart(p: {
  result: SimulationResult; activeDay: number; onSelect: (day: number) => void;
}) {
  const data = p.result.days.map((d) => ({
    day: `Day ${d.day}`, dayNum: d.day, avgWait: Number(d.avgWait.toFixed(3)),
  }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(160,130,80,0.18)" vertical={false} />
          <XAxis dataKey="day" stroke="#a89880" fontSize={11} tick={{ fill: "#7a6b54" }} />
          <YAxis stroke="#a89880" fontSize={11} tick={{ fill: "#7a6b54" }} />
          <Tooltip
            contentStyle={{
              background: "#fdfaf4",
              border: "1px solid #d8ccb8",
              borderRadius: 10,
              color: "#1e1810",
              fontSize: 12,
              boxShadow: "0 2px 8px rgba(100,75,40,0.12)",
            }}
            cursor={{ fill: "rgba(160,130,80,0.08)" }}
          />
          <ReferenceLine
            y={p.result.waitThreshold}
            stroke="#8b1c1c"
            strokeDasharray="4 4"
            label={{ value: `Threshold ${p.result.waitThreshold}`, position: "insideTopRight", fill: "#8b1c1c", fontSize: 11 }}
          />
          <Bar
            dataKey="avgWait"
            radius={[6, 6, 0, 0]}
            isAnimationActive animationDuration={800} animationEasing="ease-out"
            onClick={(payload: unknown) => {
              const pl = payload as { dayNum?: number } | undefined;
              if (pl?.dayNum !== undefined) p.onSelect(pl.dayNum);
            }}
          >
            {data.map((entry) => {
              const over = entry.avgWait > p.result.waitThreshold;
              const active = entry.dayNum === p.activeDay;
              return (
                <Cell
                  key={entry.dayNum}
                  fill={over ? "#8b1c1c" : "#1d5c38"}
                  fillOpacity={active ? 0.9 : 0.45}
                  stroke={active ? (over ? "#8b1c1c" : "#1d5c38") : "transparent"}
                  strokeWidth={active ? 2 : 0}
                  cursor="pointer"
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ═══════════════════════════ DAY VIEW ═══════════════════════════ */

function DayView(p: {
  day: DayResult; threshold: number;
  allDays: DayResult[]; activeDay: number; onDayChange: (d: number) => void;
}) {
  const { visible, playing, speed, setSpeed, play, pause, reset } = usePlayback(p.day.rows.length);
  const inPlayback = visible < p.day.rows.length;
  const visibleRows = inPlayback ? p.day.rows.slice(0, visible) : p.day.rows;
  const currentRow: CustomerRow | undefined = inPlayback ? p.day.rows[visible - 1] : undefined;

  return (
    <>
      <DayTabs days={p.allDays} activeDay={p.activeDay} onChange={p.onDayChange} threshold={p.threshold} />
      <PlaybackControls
        total={p.day.rows.length} visible={visible} playing={playing}
        speed={speed} setSpeed={setSpeed}
        play={play} pause={pause} reset={reset}
        inPlayback={inPlayback} currentRow={currentRow}
      />
      <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TimelineCard day={p.day} visibleCount={visible} inPlayback={inPlayback} />
        </div>
        <DayStatsCard day={p.day} threshold={p.threshold} visibleRows={visibleRows} />
      </div>
      <SimulationTable day={p.day} visibleCount={visible} inPlayback={inPlayback} />
    </>
  );
}

function DayTabs(p: { days: DayResult[]; activeDay: number; onChange: (d: number) => void; threshold: number; }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {p.days.map((d) => {
        const over = d.avgWait > p.threshold;
        const active = d.day === p.activeDay;
        return (
          <button
            key={d.day}
            onClick={() => p.onChange(d.day)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              active
                ? "border-[#1e4a96]/40 bg-[#1e4a96]/10 text-[#1e4a96]"
                : "border-[#d8ccb8] bg-[#faf6ef] text-[#4a3f2f] hover:bg-[#f2ebe0]"
            }`}
          >
            Day {d.day}
            <span className={`ml-2 inline-block h-1.5 w-1.5 rounded-full ${over ? "bg-[#8b1c1c]" : "bg-[#1d5c38]"}`} />
            <span className="ml-2 font-mono text-[11px] text-[#7a6b54]">{fmt(d.avgWait)}m</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Playback Controls ─────────────────────────────────────── */

const SPEEDS = [
  { label: "0.5×", ms: 800 },
  { label: "1×",   ms: 420 },
  { label: "2×",   ms: 200 },
  { label: "4×",   ms: 80  },
];

function PlaybackControls(p: {
  total: number; visible: number; playing: boolean;
  speed: number; setSpeed: (n: number) => void;
  play: () => void; pause: () => void; reset: () => void;
  inPlayback: boolean; currentRow: CustomerRow | undefined;
}) {
  const progress = p.total > 0 ? p.visible / p.total : 1;
  return (
    <div className="paper-card mt-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        {!p.playing ? (
          <button
            onClick={p.play}
            className="flex items-center gap-1.5 rounded-lg bg-[#1e4a96] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1a3f82]"
          >
            <span>▶</span> {p.inPlayback ? "Resume" : "Replay"}
          </button>
        ) : (
          <button
            onClick={p.pause}
            className="flex items-center gap-1.5 rounded-lg bg-[#a05010] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#8b4410]"
          >
            <span>⏸</span> Pause
          </button>
        )}
        <button
          onClick={p.reset}
          className="rounded-lg border border-[#d8ccb8] bg-[#faf6ef] px-3 py-1.5 text-xs font-medium text-[#4a3f2f] transition hover:bg-[#f2ebe0]"
        >
          ↺ Reset
        </button>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-[#a89880]">Speed:</span>
          {SPEEDS.map((s) => (
            <button
              key={s.ms}
              onClick={() => p.setSpeed(s.ms)}
              className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                p.speed === s.ms ? "bg-[#1e4a96]/15 text-[#1e4a96] font-semibold" : "text-[#7a6b54] hover:text-[#1e1810]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-xs text-[#a89880]">{p.visible} / {p.total} customers</span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#e8dece]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#1e4a96] to-[#1d5c38] transition-all duration-200"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Live info bubble */}
      {p.inPlayback && p.currentRow && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-[#d8ccb8] bg-[#faf6ef] px-4 py-2 text-xs">
          <span className="anim-blink mr-1 inline-block h-2 w-2 rounded-full bg-[#1e4a96]" />
          <span className="text-[#4a3f2f]">
            Customer <span className="font-semibold text-[#1e1810]">#{p.currentRow.i}</span>
          </span>
          <InfoPill label="Arrival"  value={`${p.currentRow.arrival}m`} />
          <InfoPill label="IAT"      value={`${p.currentRow.iat}m`}     color="text-[#1e4a96]" />
          <InfoPill label="Service"  value={`${p.currentRow.st}m`}      color="text-[#1d5c38]" />
          <InfoPill label="Wait"     value={`${p.currentRow.wait}m`}    color={p.currentRow.wait > 0 ? "text-[#a05010]" : "text-[#4a3f2f]"} />
          <InfoPill label="Idle"     value={`${p.currentRow.idle}m`}    color={p.currentRow.idle > 0 ? "text-[#14556e]" : "text-[#4a3f2f]"} />
        </div>
      )}
    </div>
  );
}

function InfoPill(p: { label: string; value: string; color?: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-[#a89880]">{p.label}:</span>
      <span className={`font-mono font-semibold ${p.color ?? "text-[#1e1810]"}`}>{p.value}</span>
    </span>
  );
}

/* ─── Timeline ──────────────────────────────────────────────── */

function TimelineCard(p: { day: DayResult; visibleCount: number; inPlayback: boolean }) {
  const total = Math.max(p.day.finalEnd, 1);
  const barsReady = useBarReveal();

  return (
    <div className="paper-card p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#1e1810]">Day {p.day.day} — Timeline</h3>
          <p className="text-xs text-[#7a6b54]">
            <span className="font-medium text-[#a05010]">Amber</span> = waiting ·{" "}
            <span className="font-medium text-[#1d5c38]">Green</span> = in service
          </p>
        </div>
        <p className="font-mono text-xs text-[#a89880]">0 → {p.day.finalEnd} min</p>
      </div>

      {/* Time axis */}
      <div className="relative mb-2 h-4 text-[10px] text-[#a89880]">
        {Array.from({ length: 6 }).map((_, i) => {
          const t = Math.round((i / 5) * total);
          return (
            <span key={i} className="absolute -translate-x-1/2 font-mono" style={{ left: `${(t / total) * 100}%` }}>
              {t}m
            </span>
          );
        })}
      </div>

      {/* Rows */}
      <div className="thin-scroll max-h-[440px] space-y-1.5 overflow-auto pr-1">
        {p.day.rows.map((r, idx) => {
          const isVisible = !p.inPlayback || r.i <= p.visibleCount;
          const isCurrent = p.inPlayback && r.i === p.visibleCount;
          if (!isVisible) return null;

          const delay = p.inPlayback ? 0 : idx * 30;
          return (
            <div
              key={r.i}
              className="flex items-center gap-2 anim-fade-in-right"
              style={{ animationDelay: `${delay}ms` }}
            >
              <span className={`w-9 shrink-0 text-right font-mono text-[11px] ${isCurrent ? "anim-pulse-ring rounded text-[#1e4a96] font-bold" : "text-[#a89880]"}`}>
                #{r.i}
              </span>

              <div className="relative h-5 flex-1 overflow-hidden rounded bg-[#f2ebe0]">
                {/* Arrival tick */}
                <div
                  className="absolute top-0 h-full w-px bg-[#7a6b54]/50"
                  style={{ left: `${(r.arrival / total) * 100}%` }}
                  title={`Arrival @ ${r.arrival}`}
                />
                {/* Waiting */}
                {r.wait > 0 && (
                  <div
                    className="absolute top-0 h-full origin-left rounded-sm bg-[#a05010]/50"
                    style={{
                      left: `${(r.arrival / total) * 100}%`,
                      width: barsReady ? `${(r.wait / total) * 100}%` : "0%",
                      transition: `width 0.5s cubic-bezier(0.22,1,0.36,1) ${delay + 60}ms`,
                    }}
                    title={`Waiting ${r.wait} min`}
                  />
                )}
                {/* Service */}
                <div
                  className={`absolute top-0 flex h-full items-center justify-center overflow-hidden rounded-sm ${
                    isCurrent ? "shimmer-service" : "bg-gradient-to-r from-[#1d5c38] to-[#2e8a53]"
                  }`}
                  style={{
                    left: `${(r.start / total) * 100}%`,
                    width: barsReady ? `${(r.st / total) * 100}%` : "0%",
                    transition: `width 0.5s cubic-bezier(0.22,1,0.36,1) ${delay + 30}ms`,
                  }}
                  title={`Service ${r.st} min`}
                >
                  <span className="px-1 font-mono text-[10px] font-semibold text-white/90">{r.st}m</span>
                </div>
              </div>

              <span className={`w-12 shrink-0 text-right font-mono text-[11px] ${r.wait > 0 ? "text-[#a05010]" : "text-[#a89880]"}`}>
                w:{r.wait}
              </span>
            </div>
          );
        })}

        {/* Ghost next customer */}
        {p.inPlayback && p.visibleCount < p.day.rows.length && (
          <div className="flex items-center gap-2 opacity-30">
            <span className="w-9 shrink-0 text-right font-mono text-[11px] text-[#a89880]">#{p.visibleCount + 1}</span>
            <div className="h-5 flex-1 animate-pulse rounded bg-[#f2ebe0]" />
            <span className="w-12 shrink-0" />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-[#7a6b54]">
        <LegendDot color="bg-[#a05010]/50" label="Waiting" />
        <LegendDot color="bg-[#1d5c38]" label="In service" />
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-px bg-[#7a6b54]/50" /> Arrival moment
        </span>
        {p.inPlayback && (
          <span className="inline-flex items-center gap-1 text-[#1e4a96]">
            <span className="shimmer-service inline-block h-2.5 w-2.5 rounded-sm" /> Current
          </span>
        )}
      </div>
    </div>
  );
}

function LegendDot(p: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${p.color}`} />
      {p.label}
    </span>
  );
}

/* ─── Day Stats ─────────────────────────────────────────────── */

function DayStatsCard(p: { day: DayResult; threshold: number; visibleRows: CustomerRow[] }) {
  const rows = p.visibleRows;
  const n = rows.length;
  const totalWait = rows.reduce((s, r) => s + r.wait, 0);
  const totalIdle = rows.reduce((s, r) => s + r.idle, 0);
  const totalSvc  = rows.reduce((s, r) => s + r.st,   0);
  const avgWait   = n > 0 ? totalWait / n : 0;
  const avgSvc    = n > 0 ? totalSvc  / n : 0;
  const finalEnd  = rows[rows.length - 1]?.end ?? 0;
  const util      = finalEnd > 0 ? totalSvc / finalEnd : 0;
  const over      = avgWait > p.threshold;

  return (
    <div className="paper-card p-5">
      <h3 className="text-sm font-semibold text-[#1e1810]">Day {p.day.day} — Stats</h3>
      {n < p.day.rows.length && (
        <p className="mt-0.5 text-[11px] text-[#1e4a96]">Live · {n} of {p.day.rows.length} customers</p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <StatCell label="Customers"   value={`${n}`} />
        <StatCell label="Avg Wait"    value={`${fmt(avgWait)} m`} tone={n > 0 ? (over ? "danger" : "ok") : undefined} />
        <StatCell label="Avg Service" value={`${fmt(avgSvc)} m`} />
        <StatCell label="Total Wait"  value={`${fmt(totalWait, 1)} m`} />
        <StatCell label="Total Idle"  value={`${fmt(totalIdle, 1)} m`} />
        <StatCell label="Shift End"   value={`${finalEnd} m`} />
        <StatCell label="Utilization" value={`${fmt(util * 100, 1)}%`} />
        <StatCell label="vs Threshold" value={n > 0 ? (over ? "Over" : "Under") : "—"} tone={n > 0 ? (over ? "danger" : "ok") : undefined} />
      </div>
    </div>
  );
}

function StatCell(p: { label: string; value: string; tone?: "ok" | "danger" }) {
  const c = p.tone === "danger" ? "text-[#8b1c1c]" : p.tone === "ok" ? "text-[#1d5c38]" : "text-[#1e1810]";
  return (
    <div className="rounded-lg border border-[#e8dece] bg-[#faf6ef] p-2.5 transition-all duration-300">
      <p className="text-[10px] uppercase tracking-wider text-[#a89880]">{p.label}</p>
      <p className={`mt-1 font-mono text-sm font-semibold tabular-nums transition-colors duration-300 ${c}`}>{p.value}</p>
    </div>
  );
}

/* ─── Simulation Table ──────────────────────────────────────── */

function SimulationTable(p: { day: DayResult; visibleCount: number; inPlayback: boolean }) {
  const rows = p.inPlayback ? p.day.rows.slice(0, p.visibleCount) : p.day.rows;
  return (
    <div className="paper-card mt-5 p-5">
      <h3 className="text-sm font-semibold text-[#1e1810]">Day {p.day.day} — Per-Customer Table</h3>
      <p className="text-xs text-[#7a6b54]">Every row is one simulation step.</p>
      <div className="thin-scroll mt-4 overflow-auto">
        <table className="w-full min-w-[780px] border-collapse text-left font-mono text-xs">
          <thead>
            <tr className="border-b-2 border-[#d8ccb8]">
              {["#","r(IAT)","IAT","Arrival","r(ST)","ST","Start","End","Wait","Idle"].map((h) => (
                <th key={h} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-[#a89880]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const isCurrent = p.inPlayback && r.i === p.visibleCount;
              return (
                <tr
                  key={r.i}
                  className={`border-b border-[#ebe3d4] transition-colors ${isCurrent ? "bg-[#1e4a96]/6" : "hover:bg-[#faf6ef]"}`}
                  style={{ animation: `fadeInRight 0.22s ease-out ${p.inPlayback ? 0 : idx * 22}ms both` }}
                >
                  <td className={`px-3 py-2 ${isCurrent ? "font-bold text-[#1e4a96]" : "text-[#4a3f2f]"}`}>{r.i}</td>
                  <td className="px-3 py-2 text-[#4a3f2f]">{r.rIat.toFixed(4)}</td>
                  <td className="px-3 py-2 font-semibold text-[#1e4a96]">{r.iat}</td>
                  <td className="px-3 py-2 text-[#1e1810]">{r.arrival}</td>
                  <td className="px-3 py-2 text-[#4a3f2f]">{r.rSt.toFixed(4)}</td>
                  <td className="px-3 py-2 font-semibold text-[#1d5c38]">{r.st}</td>
                  <td className="px-3 py-2 text-[#1e1810]">{r.start}</td>
                  <td className="px-3 py-2 text-[#1e1810]">{r.end}</td>
                  <td className={`px-3 py-2 font-semibold ${r.wait > 0 ? "text-[#a05010]" : "text-[#4a3f2f]"}`}>{r.wait}</td>
                  <td className={`px-3 py-2 font-semibold ${r.idle > 0 ? "text-[#14556e]" : "text-[#4a3f2f]"}`}>{r.idle}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Verdict ───────────────────────────────────────────────── */

function VerdictCard({ result }: { result: SimulationResult }) {
  const over = result.verdict === "ACTION_REQUIRED";
  return (
    <section
      className={`anim-verdict mt-5 overflow-hidden rounded-2xl border p-5 ${
        over
          ? "border-[#8b1c1c]/30 bg-[#8b1c1c]/5"
          : "border-[#1d5c38]/30 bg-[#1d5c38]/5"
      }`}
      style={{ animationDelay: "200ms", boxShadow: "0 2px 8px rgba(100,75,40,0.08)" }}
    >
      <div className="flex items-start gap-4">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl font-bold ${
          over ? "bg-[#8b1c1c]/15 text-[#8b1c1c]" : "bg-[#1d5c38]/15 text-[#1d5c38]"
        }`}>
          {over ? "!" : "✓"}
        </div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-[#a89880]">Final Verdict</p>
          <h3 className={`mt-1 text-lg font-semibold ${over ? "text-[#8b1c1c]" : "text-[#1d5c38]"}`}>
            {over ? "Action Required — Install Additional ATM" : "Status Optimal"}
          </h3>
          <p className="mt-2 text-sm text-[#4a3f2f]">
            Simulated {result.days.length} {result.days.length === 1 ? "day" : "days"}. Global average wait time is{" "}
            <span className="font-mono font-semibold text-[#1e1810]">{fmt(result.globalAvgWait)} min</span>{" "}
            against a threshold of{" "}
            <span className="font-mono font-semibold text-[#1e1810]">{fmt(result.waitThreshold)} min</span>.
          </p>
          <p className="mt-1 text-xs text-[#7a6b54]">
            {over
              ? "Average customer wait time exceeds the acceptable threshold."
              : "Current infrastructure handles volume within acceptable limits."}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Empty State ───────────────────────────────────────────── */

function EmptyState({ onRun }: { onRun: () => void }) {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-[#c8b89a] bg-[#faf6ef] p-12 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#1e4a96]/20 to-[#1d5c38]/20 text-3xl font-bold text-[#1e4a96]">
        Q
      </div>
      <p className="text-base font-medium text-[#1e1810]">Ready to simulate</p>
      <p className="mt-1 text-sm text-[#7a6b54]">Configure days, customers and threshold above, then run.</p>
      <button
        onClick={onRun}
        className="mt-6 rounded-xl bg-gradient-to-r from-[#1e4a96] to-[#1d5c38] px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:brightness-110"
      >
        Run Simulation
      </button>
      <p className="mt-3 text-[11px] text-[#a89880]">
        Tip: enable <i>Seed</i> for reproducible runs · use <i>Replay</i> to step through customers one-by-one
      </p>
    </div>
  );
}
