import DashboardLayout from "@/components/DashboardLayout";
import LearningOpportunities from "@/components/LearningOpportunities";
import OptionPayoffChart from "@/components/OptionPayoffChart";
import { useUserMode } from "@/hooks/useUserMode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { TrendingUp, Calendar, Target, DollarSign, Activity, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const strategyLabels: Record<string, string> = {
  covered_call: "Covered Call",
  cash_secured_put: "Cash-Secured Put",
  bull_call_spread: "Bull Call Spread",
  bull_put_spread: "Bull Put Spread",
};

const strategyColors: Record<string, string> = {
  covered_call: "bg-blue-100 text-blue-800",
  cash_secured_put: "bg-green-100 text-green-800",
  bull_call_spread: "bg-purple-100 text-purple-800",
  bull_put_spread: "bg-orange-100 text-orange-800",
};

export default function Opportunities() {
  const { isLearning } = useUserMode();

  // All hooks must be called before any early return
  const [filterStrategy, setFilterStrategy] = useState<string>("all");
  const [minYield, setMinYield] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"annualizedYield" | "premium" | "daysToExpiration">("annualizedYield");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const suggestionsQuery = trpc.trades.getSuggestions.useQuery();
  const decideM = trpc.trades.createDecision.useMutation({
    onSuccess: () => suggestionsQuery.refetch(),
  });

  const suggestions = suggestionsQuery.data || [];

  const filtered = suggestions
    .filter(s => filterStrategy === "all" || s.strategy === filterStrategy)
    .filter(s => parseFloat(s.annualizedYield) >= minYield)
    .sort((a, b) => {
      if (sortBy === "annualizedYield") return parseFloat(b.annualizedYield) - parseFloat(a.annualizedYield);
      if (sortBy === "premium") return b.premium - a.premium;
      if (sortBy === "daysToExpiration") return a.daysToExpiration - b.daysToExpiration;
      return 0;
    });

  const handleDecision = (suggestionId: number, ticker: string, strategy: string, status: "accepted" | "rejected" | "under_consideration") => {
    decideM.mutate({ tradeSuggestionId: suggestionId, ticker, strategy, status });
  };

  if (isLearning) {
    return (
      <DashboardLayout>
        <LearningOpportunities />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-green-700 mb-1">Opportunities</h1>
          <p className="text-muted-foreground">AI-generated options income opportunities ranked by annualized yield</p>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Strategy:</label>
              <select
                value={filterStrategy}
                onChange={e => setFilterStrategy(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Strategies</option>
                <option value="covered_call">Covered Call</option>
                <option value="cash_secured_put">Cash-Secured Put</option>
                <option value="bull_call_spread">Bull Call Spread</option>
                <option value="bull_put_spread">Bull Put Spread</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Min Yield:</label>
              <select
                value={minYield}
                onChange={e => setMinYield(Number(e.target.value))}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value={0}>Any</option>
                <option value={10}>10%+</option>
                <option value={20}>20%+</option>
                <option value={30}>30%+</option>
                <option value={50}>50%+</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Sort by:</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="annualizedYield">Annualized Yield</option>
                <option value="premium">Premium</option>
                <option value="daysToExpiration">Days to Expiration</option>
              </select>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              {filtered.length} opportunities
            </div>
          </div>
        </Card>

        {/* Loading */}
        {suggestionsQuery.isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <Card key={i} className="p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-4" />
                <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!suggestionsQuery.isLoading && filtered.length === 0 && (
          <Card className="p-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No opportunities found</h3>
            <p className="text-muted-foreground text-sm">
              Upload your portfolio to generate AI-powered trade suggestions.
            </p>
            <Button className="mt-4 bg-green-700 hover:bg-green-800" onClick={() => window.location.href = "/upload"}>
              Upload Portfolio
            </Button>
          </Card>
        )}

        {/* Opportunity Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => {
            const isExpanded = expandedId === s.id;
            return (
              <Card key={s.id} className="p-5 hover:shadow-md transition-shadow">
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-2xl font-bold text-gray-900">{s.ticker}</span>
                    <div className="mt-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${strategyColors[s.strategy]}`}>
                        {strategyLabels[s.strategy]}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-700">{s.annualizedYield}%</div>
                    <div className="text-xs text-muted-foreground">annualized</div>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 mb-1">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Premium</span>
                    </div>
                    <div className="font-semibold text-sm">${s.premium.toFixed(2)}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 mb-1">
                      <Target className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Strike</span>
                    </div>
                    <div className="font-semibold text-sm">${s.strikePrice.toFixed(2)}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 mb-1">
                      <Activity className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Delta</span>
                    </div>
                    <div className="font-semibold text-sm">{s.delta}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 mb-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">DTE</span>
                    </div>
                    <div className="font-semibold text-sm">{s.daysToExpiration}d</div>
                  </div>
                </div>

                {/* Probability & Monthly Income */}
                <div className="flex items-center justify-between mb-4 p-2.5 bg-green-50 rounded-lg">
                  <div>
                    <div className="text-xs text-muted-foreground">Prob. of Profit</div>
                    <div className="font-semibold text-green-700">{s.probabilityOfProfit}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Monthly Income</div>
                    <div className="font-semibold text-green-700">${s.potentialMonthlyIncome.toFixed(2)}</div>
                  </div>
                </div>

                {/* Expiration */}
                {s.expirationDate && (
                  <div className="text-xs text-muted-foreground mb-3">
                    Expires: {new Date(s.expirationDate).toLocaleDateString()}
                  </div>
                )}

                {/* Greeks & Payoff toggle */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground py-1.5 mb-3 border border-dashed border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  {isExpanded ? (
                    <><ChevronUp className="h-3 w-3" /> Hide Greeks & Payoff</>
                  ) : (
                    <><ChevronDown className="h-3 w-3" /> Show Greeks & Payoff Diagram</>
                  )}
                </button>

                {/* Expandable: Greeks + Payoff Chart */}
                {isExpanded && (
                  <OptionPayoffChart
                    strategy={s.strategy}
                    strikePrice={s.strikePrice}
                    premium={s.premium}
                    daysToExpiration={s.daysToExpiration}
                    delta={s.delta}
                    isLearning={false}
                  />
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-700 hover:bg-green-800 text-white text-xs"
                    onClick={() => handleDecision(s.id, s.ticker, s.strategy, "accepted")}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => handleDecision(s.id, s.ticker, s.strategy, "under_consideration")}
                  >
                    Consider
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => handleDecision(s.id, s.ticker, s.strategy, "rejected")}
                  >
                    Reject
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
