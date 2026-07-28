import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface Props {
  strategy: string;
  strikePrice: number;  // dollars
  premium: number;      // dollars per share
  daysToExpiration: number;
  delta: string;
  isLearning?: boolean;
}

// ── Black-Scholes helpers ──────────────────────────────────────────────────

function erf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normalCdf(x: number) {
  return (1 + erf(x / Math.sqrt(2))) / 2;
}

function computeGreeks(deltaN: number, strikePrice: number, daysToExpiration: number, strategy: string) {
  const T = Math.max(daysToExpiration, 1) / 365;
  const S = strikePrice;
  const K = strikePrice;
  const r = 0.05;
  // Rough IV estimate from absolute delta
  const absD = Math.abs(deltaN);
  const sigma = absD > 0.45 ? 0.25 : absD > 0.35 ? 0.30 : absD > 0.25 ? 0.35 : 0.40;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const nd1 = Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI);
  const isCall = strategy === "covered_call" || strategy === "bull_call_spread";
  const gamma = nd1 / (S * sigma * sqrtT);
  const theta =
    (-S * nd1 * sigma) / (2 * sqrtT) -
    (isCall
      ? r * K * Math.exp(-r * T) * normalCdf(d2)
      : -r * K * Math.exp(-r * T) * normalCdf(-d2));
  // Sellers (short strategies) collect theta; negate so display shows what they earn per day
  const isShort = strategy === "covered_call" || strategy === "cash_secured_put";
  const thetaPerDay = (theta / 365) * (isShort ? -1 : 1);
  const vega = S * nd1 * sqrtT * 0.01;
  return {
    gamma: Math.abs(gamma),
    thetaPerDay,
    vega: Math.abs(vega),
  };
}

// ── Payoff at expiration (per contract = 100 shares) ───────────────────────

function payoffAt(strategy: string, K: number, P: number, X: number): number {
  switch (strategy) {
    case "covered_call":
      // Long stock @ K (ATM approx) + short call @ K for P
      return X < K
        ? (X - K + P) * 100
        : P * 100;
    case "cash_secured_put":
      // Short put @ K for P
      return X >= K ? P * 100 : (X - K + P) * 100;
    case "bull_call_spread": {
      // Long call @ K, short call @ K2 = K*1.05, net debit P
      const K2 = K * 1.05;
      if (X <= K) return -P * 100;
      if (X >= K2) return (K2 - K - P) * 100;
      return (X - K - P) * 100;
    }
    case "bull_put_spread": {
      // Short put @ K, long put @ K1 = K*0.95, net credit P
      const K1 = K * 0.95;
      if (X >= K) return P * 100;
      if (X <= K1) return (P - (K - K1)) * 100;
      return (P - (K - X)) * 100;
    }
    default:
      return 0;
  }
}

function buildChartData(strategy: string, K: number, P: number) {
  const lo = K * 0.70;
  const hi = K * 1.30;
  const step = (hi - lo) / 60;
  const data = [];
  for (let X = lo; X <= hi; X += step) {
    const pnl = payoffAt(strategy, K, P, X);
    data.push({
      price: parseFloat(X.toFixed(2)),
      pnl: parseFloat(pnl.toFixed(2)),
      fill: pnl >= 0 ? "#16a34a" : "#dc2626",
    });
  }
  return data;
}

function breakeven(strategy: string, K: number, P: number): number {
  switch (strategy) {
    case "covered_call":   return K - P;
    case "cash_secured_put": return K - P;
    case "bull_call_spread": return K + P;
    case "bull_put_spread":  return K - P;
    default: return K;
  }
}

function maxProfit(strategy: string, K: number, P: number): number {
  switch (strategy) {
    case "covered_call":   return P * 100;
    case "cash_secured_put": return P * 100;
    case "bull_call_spread": return (K * 0.05 - P) * 100;
    case "bull_put_spread":  return P * 100;
    default: return P * 100;
  }
}

function maxLoss(strategy: string, K: number, P: number): number {
  switch (strategy) {
    case "covered_call":   return (K - P) * 100;
    case "cash_secured_put": return (K - P) * 100;
    case "bull_call_spread": return P * 100;
    case "bull_put_spread":  return Math.max(0, (K * 0.05 - P) * 100);
    default: return P * 100;
  }
}

// ── Greek display labels ───────────────────────────────────────────────────

const GREEK_LABELS: Record<string, { label: string; plain: string; unit: string }> = {
  delta: {
    label: "Delta",
    plain: "How much the option price moves when the stock moves $1",
    unit: "",
  },
  gamma: {
    label: "Gamma",
    plain: "How fast delta changes — higher means the position can shift quickly",
    unit: "",
  },
  thetaPerDay: {
    label: "Theta (daily)",
    plain: "How much value you earn (sell) or lose (buy) each day as time passes",
    unit: "/day",
  },
  vega: {
    label: "Vega (per 1% IV)",
    plain: "How much the option price changes if implied volatility moves 1%",
    unit: "",
  },
};

// ── Custom tooltip ─────────────────────────────────────────────────────────

function PayoffTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { price, pnl } = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-md text-xs">
      <div className="text-muted-foreground mb-0.5">Stock @ ${price.toFixed(2)}</div>
      <div className={`font-bold ${pnl >= 0 ? "text-green-700" : "text-red-600"}`}>
        {pnl >= 0 ? "+" : ""}${pnl.toFixed(0)} P&L
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function OptionPayoffChart({ strategy, strikePrice, premium, daysToExpiration, delta, isLearning }: Props) {
  const K = strikePrice;
  const P = premium;
  const deltaN = parseFloat(delta) || 0.30;

  const data = buildChartData(strategy, K, P);
  const be = breakeven(strategy, K, P);
  const mp = maxProfit(strategy, K, P);
  const ml = maxLoss(strategy, K, P);
  const { gamma, thetaPerDay, vega } = computeGreeks(deltaN, K, daysToExpiration, strategy);

  // Segment the line by profitability for green/red coloring
  const greenData = data.map(d => ({ ...d, profitPnl: d.pnl >= 0 ? d.pnl : null }));
  const redData   = data.map(d => ({ ...d, lossPnl:   d.pnl <  0 ? d.pnl : null }));

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">

      {/* Greeks Grid */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Greeks
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: "delta",      value: deltaN.toFixed(3) },
            { key: "gamma",      value: gamma.toFixed(4) },
            { key: "thetaPerDay", value: `$${thetaPerDay.toFixed(3)}` },
            { key: "vega",       value: `$${vega.toFixed(3)}` },
          ].map(({ key, value }) => {
            const meta = GREEK_LABELS[key];
            return (
              <div key={key} className="bg-gray-50 rounded-lg p-2.5">
                <div className="font-semibold text-sm">{meta.label}</div>
                <div className="text-base font-bold text-gray-900">{value}{meta.unit}</div>
                {isLearning && (
                  <div className="text-xs text-muted-foreground mt-1 leading-snug">{meta.plain}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-green-50 rounded-lg p-2">
          <div className="text-muted-foreground mb-0.5">Max Profit</div>
          <div className="font-bold text-green-700">+${mp.toFixed(0)}</div>
          {isLearning && <div className="text-muted-foreground">per contract</div>}
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-muted-foreground mb-0.5">Breakeven</div>
          <div className="font-bold">${be.toFixed(2)}</div>
          {isLearning && <div className="text-muted-foreground">stock price</div>}
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <div className="text-muted-foreground mb-0.5">Max Loss</div>
          <div className="font-bold text-red-600">-${ml.toFixed(0)}</div>
          {isLearning && <div className="text-muted-foreground">per contract</div>}
        </div>
      </div>

      {/* Payoff Chart */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Payoff at Expiration {isLearning ? "(1 contract)" : ""}
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="price"
              tickFormatter={v => `$${v.toFixed(0)}`}
              tick={{ fontSize: 10 }}
              tickCount={5}
            />
            <YAxis
              tickFormatter={v => `$${v}`}
              tick={{ fontSize: 10 }}
              width={48}
            />
            <Tooltip content={<PayoffTooltip />} />
            {/* Profit zone — green */}
            <Line
              data={greenData}
              dataKey="profitPnl"
              stroke="#16a34a"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            {/* Loss zone — red */}
            <Line
              data={redData}
              dataKey="lossPnl"
              stroke="#dc2626"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            {/* Zero P&L reference */}
            <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 2" strokeWidth={1.5} />
            {/* Strike price */}
            <ReferenceLine
              x={K}
              stroke="#3b82f6"
              strokeDasharray="3 3"
              label={{ value: `Strike $${K.toFixed(0)}`, position: "top", fontSize: 9, fill: "#3b82f6" }}
            />
            {/* Breakeven */}
            <ReferenceLine
              x={parseFloat(be.toFixed(2))}
              stroke="#f59e0b"
              strokeDasharray="3 3"
              label={{ value: `B/E $${be.toFixed(0)}`, position: "insideTopLeft", fontSize: 9, fill: "#f59e0b" }}
            />
          </LineChart>
        </ResponsiveContainer>
        {isLearning && (
          <p className="text-xs text-muted-foreground mt-1">
            Green = profit zone · Red = loss zone · Blue line = your strike · Yellow line = breakeven price
          </p>
        )}
      </div>
    </div>
  );
}
