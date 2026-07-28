import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState } from "react";
import OptionPayoffChart from "@/components/OptionPayoffChart";
import {
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle2,
  Upload,
  BookOpen,
  Lightbulb,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const STRATEGY_PLAIN: Record<string, { label: string; tutorialPage: string; plain: (ticker: string, strike: number, premium: number) => string }> = {
  covered_call: {
    label: "Covered Call",
    tutorialPage: "covered-calls",
    plain: (ticker, strike, premium) =>
      `Sell someone the right to buy your ${ticker} shares at $${strike.toFixed(0)}. You collect $${premium.toFixed(0)} upfront and keep it no matter what.`,
  },
  cash_secured_put: {
    label: "Cash-Secured Put",
    tutorialPage: "csp",
    plain: (ticker, strike, premium) =>
      `Get paid $${premium.toFixed(0)} to agree to buy ${ticker} at $${strike.toFixed(0)} — a lower price than today. Keep the cash if the stock stays above that price.`,
  },
  bull_call_spread: {
    label: "Bull Call Spread",
    tutorialPage: "iron-condors",
    plain: (ticker, strike, premium) =>
      `A two-leg bet that ${ticker} will rise. You pay a small amount upfront and profit if the stock moves up past $${strike.toFixed(0)}.`,
  },
  bull_put_spread: {
    label: "Bull Put Spread",
    tutorialPage: "csp",
    plain: (ticker, strike, premium) =>
      `Collect $${premium.toFixed(0)} by betting ${ticker} stays above $${strike.toFixed(0)}. Your maximum loss is capped upfront.`,
  },
};

function StrategyExplainer() {
  return (
    <Card className="card-elegant border-primary/20 bg-primary/5">
      <div className="flex items-start gap-3">
        <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="font-semibold text-sm">What are these suggestions?</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            PremiaOpts looks at your portfolio and finds opportunities to earn income by selling options contracts.
            Each suggestion below shows a trade you <em>could</em> place in your brokerage account.
            You're not committing to anything here — just reviewing ideas.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The <strong>premium</strong> is cash you'd collect the moment you place the trade. The{" "}
            <strong>chance of keeping it</strong> is the estimated probability the option expires worthless — meaning you keep the full premium.
          </p>
        </div>
      </div>
    </Card>
  );
}

export default function LearningOpportunities() {
  const [, setLocation] = useLocation();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const suggestionsQuery = trpc.trades.getSuggestions.useQuery();
  const suggestions = suggestionsQuery.data || [];

  if (suggestionsQuery.isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="card-elegant animate-pulse">
            <div className="space-y-3">
              <div className="h-5 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <StrategyExplainer />
        <Card className="card-elegant">
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center">
              <TrendingUp className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-base mb-1">No suggestions yet</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Upload your portfolio so PremiaOpts can find options income opportunities that fit your holdings.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={() => setLocation("/upload")}>
                <Upload className="mr-1.5 h-4 w-4" /> Upload Portfolio
              </Button>
              <Button variant="outline" onClick={() => setLocation("/tutorials")}>
                <BookOpen className="mr-1.5 h-4 w-4" /> Learn the Strategies
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <StrategyExplainer />

      <div className="space-y-4">
        {suggestions.map((s) => {
          const meta = STRATEGY_PLAIN[s.strategy] ?? {
            label: s.strategy,
            tutorialPage: "covered-calls",
            plain: () => "",
          };
          const plainText = meta.plain(s.ticker, s.strikePrice, s.potentialMonthlyIncome);
          const daysLabel = s.daysToExpiration === 1 ? "1 day" : `${s.daysToExpiration} days`;

          return (
            <Card key={s.id} className="card-elegant">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl font-bold text-foreground">{s.ticker}</span>
                      <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-medium">
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{plainText}</p>
                  </div>
                </div>

                {/* Key numbers — plain labels */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-accent/10 rounded-lg p-3 text-center">
                    <DollarSign className="h-4 w-4 text-accent mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">You'd earn</p>
                    <p className="font-bold text-accent">${s.potentialMonthlyIncome.toFixed(0)}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <Clock className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Expires in</p>
                    <p className="font-bold text-foreground">{daysLabel}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Chance of keeping it</p>
                    <p className="font-bold text-foreground">{s.probabilityOfProfit}%</p>
                  </div>
                </div>

                {/* Payoff chart toggle */}
                <button
                  onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground py-1.5 border border-dashed border-border rounded-lg hover:border-primary/40 transition-colors"
                >
                  {expandedId === s.id ? (
                    <><ChevronUp className="h-3 w-3" /> Hide payoff diagram</>
                  ) : (
                    <><ChevronDown className="h-3 w-3" /> Show payoff diagram & Greeks</>
                  )}
                </button>

                {expandedId === s.id && (
                  <OptionPayoffChart
                    strategy={s.strategy}
                    strikePrice={s.strikePrice}
                    premium={s.premium}
                    daysToExpiration={s.daysToExpiration}
                    delta={s.delta}
                    isLearning={true}
                  />
                )}

                {/* CTA */}
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    To place this trade, log into your brokerage and enter the details above.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:text-primary shrink-0"
                    onClick={() => setLocation("/tutorials")}
                  >
                    Learn more <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Reminder */}
      <Card className="card-elegant border-l-4 border-l-accent">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Ready to go deeper?</span>{" "}
            The Tutorials page explains each strategy step-by-step with worked examples, so you know exactly what you're doing before placing a trade.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setLocation("/tutorials")}
        >
          <BookOpen className="mr-1.5 h-3.5 w-3.5" /> Open Tutorials
        </Button>
      </Card>
    </div>
  );
}
