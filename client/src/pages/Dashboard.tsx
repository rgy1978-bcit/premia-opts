import DashboardLayout from "@/components/DashboardLayout";
import LearningDashboard from "@/components/LearningDashboard";
import { useUserMode } from "@/hooks/useUserMode";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { TrendingUp, Target, AlertCircle, DollarSign, Activity, CheckCircle, Upload, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, PieChart as RechartsChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { isLearning } = useUserMode();
  const [, setLocation] = useLocation();
  const [selectedTab, setSelectedTab] = useState<"overview" | "portfolio" | "opportunities" | "decisions" | "research">("overview");

  // All hooks must be called unconditionally before any early return
  const goalsQuery = trpc.portfolio.getGoals.useQuery();
  const holdingsQuery = trpc.portfolio.getHoldings.useQuery();
  const capitalQuery = trpc.portfolio.getCapital.useQuery();
  const analysisQuery = trpc.analysis.analyzePortfolio.useQuery();
  const taxHarvestQuery = trpc.analysis.getTaxHarvest.useQuery();
  const suggestionsQuery = trpc.trades.getSuggestions.useQuery();
  const decisionsQuery = trpc.trades.getDecisions.useQuery();
  const analyzeAiM = trpc.ai.analyzeWithAi.useMutation({
    onSuccess: (data) => {
      toast.success(`Generated ${data.savedCount} trade suggestions`);
      suggestionsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const analyticsQuery = trpc.analytics.getDailyAnalytics.useQuery({ days: 30 });

  // Redirect new users to setup wizard once goals query resolves with no data
  useEffect(() => {
    if (!goalsQuery.isLoading && goalsQuery.data === null) {
      setLocation("/setup");
    }
  }, [goalsQuery.isLoading, goalsQuery.data]);

  if (isLearning) {
    return (
      <DashboardLayout>
        <LearningDashboard />
      </DashboardLayout>
    );
  }

  const goals = goalsQuery.data || null;
  const holdings = holdingsQuery.data || [];
  const capital = capitalQuery.data || null;
  const analysis = analysisQuery.data || null;
  const taxOpportunities = taxHarvestQuery.data || [];
  const suggestions = suggestionsQuery.data || [];
  const decisions = decisionsQuery.data || [];
  const analytics = analyticsQuery.data || [];

  // Calculate metrics
  const portfolioValue = analysis?.totalValue ?? 0;
  const unrealizedGains = analysis?.unrealizedGains ?? 0;
  const monthlyGoal = goals?.monthlyIncomeGoal ?? 0;
  const availableCash = capital?.availableCash ?? 0;

  // getSuggestions already returns potentialMonthlyIncome in dollars
  const estimatedMonthlyIncome = (suggestions || []).reduce((sum, s) => sum + (s?.potentialMonthlyIncome ?? 0), 0);
  const progressPercent = monthlyGoal > 0 ? (estimatedMonthlyIncome / monthlyGoal) * 100 : 0;

  // Prepare chart data
  const analyticsChartData = analytics.map((a) => ({
    date: new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: a.totalPortfolioValue,
    income: a.estimatedMonthlyIncome,
  }));

  const concentrationData = Object.entries(analysis?.concentrationRisk || {})
    .slice(0, 5)
    .map(([ticker, percent]) => ({
      name: ticker,
      value: percent,
    }));

  const sectorData = Object.entries(analysis?.sectorExposure || {}).map(([sector, percent]) => ({
    name: sector || "Other",
    value: percent,
  }));

  const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

  return (
   <DashboardLayout>
   <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-2">PremiaOpts Dashboard</h1>
          <p className="text-muted-foreground">Monitor your options income strategy in real-time</p>
        </div>
       
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="card-elegant">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Portfolio Value</p>
                <p className="text-3xl font-bold text-primary">${portfolioValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                <p className={`text-sm mt-2 ${unrealizedGains >= 0 ? "text-accent" : "text-destructive"}`}>
                  {unrealizedGains >= 0 ? "+" : ""}{unrealizedGains.toLocaleString("en-US", { maximumFractionDigits: 0 })} unrealized
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-primary/30" />
            </div>
          </Card>

          <Card className="card-elegant">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Available Cash</p>
                <p className="text-3xl font-bold text-secondary">${(availableCash / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                <p className="text-sm text-muted-foreground mt-2">Ready for deployment</p>
              </div>
              <Activity className="h-8 w-8 text-secondary/30" />
            </div>
          </Card>

          <Card className="card-elegant">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Monthly Income</p>
                {suggestionsQuery.isLoading ? (
                  <Loader2 className="h-7 w-7 animate-spin text-accent/50 my-1" />
                ) : (
                  <p className="text-3xl font-bold text-accent">${estimatedMonthlyIncome.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                )}
                <p className="text-sm text-muted-foreground mt-2">From open positions</p>
              </div>
              <TrendingUp className="h-8 w-8 text-accent/30" />
            </div>
          </Card>

          <Card className="card-elegant">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tax Harvest Opportunities</p>
                <p className="text-3xl font-bold text-destructive">{taxOpportunities.length}</p>
                <p className="text-sm text-muted-foreground mt-2">Available to harvest</p>
              </div>
              <AlertCircle className="h-8 w-8 text-destructive/30" />
            </div>
          </Card>
        </div>

        {/* Income Goal Progress */}
        <Card className="card-elegant mb-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold mb-1">Monthly Income Goal</h2>
                <p className="text-muted-foreground">Progress toward your target</p>
              </div>
              <button
                onClick={() => setLocation("/setup")}
                className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
              >
                Edit Goals <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">${estimatedMonthlyIncome.toLocaleString("en-US", { maximumFractionDigits: 0 })} / ${monthlyGoal.toLocaleString()}</span>
                <span className="text-sm font-medium text-primary">{Math.min(100, progressPercent).toFixed(1)}%</span>
              </div>
              <Progress value={Math.min(100, progressPercent)} className="h-3" />
            </div>
            {progressPercent < 100 && (
              <p className="text-sm text-muted-foreground">
                Need ${(monthlyGoal - estimatedMonthlyIncome).toLocaleString("en-US", { maximumFractionDigits: 0 })} more to reach your goal
              </p>
            )}
          </div>
        </Card>

        {/* Getting Started — shown when setup is incomplete */}
        {(holdings.length === 0 || monthlyGoal === 0) && (
          <Card className="card-elegant mb-8 border-primary/20 bg-primary/5">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold mb-0.5">Getting Started</h2>
                <p className="text-sm text-muted-foreground">Complete these steps to get your first trade suggestions</p>
              </div>
              <div className="space-y-2">
                {[
                  {
                    label: "Upload your portfolio",
                    done: holdings.length > 0,
                    cta: "Upload CSV",
                    path: "/upload",
                    icon: Upload,
                  },
                  {
                    label: "Set your monthly income goal",
                    done: monthlyGoal > 0,
                    cta: "Set Goal",
                    path: "/setup",
                    icon: Target,
                  },
                  {
                    label: "Review trade suggestions",
                    done: suggestions.length > 0 && holdings.length > 0,
                    cta: "View Suggestions",
                    path: "/opportunities",
                    icon: TrendingUp,
                  },
                ].map((step) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.label} className="flex items-center gap-3 py-1.5">
                      <CheckCircle className={`h-4 w-4 shrink-0 ${step.done ? "text-accent" : "text-muted-foreground/30"}`} />
                      <span className={`text-sm flex-1 ${step.done ? "text-foreground line-through decoration-muted-foreground/50" : "text-foreground"}`}>
                        {step.label}
                      </span>
                      {!step.done && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs shrink-0"
                          onClick={() => setLocation(step.path)}
                        >
                          {step.cta}
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
          {["overview", "portfolio", "opportunities", "decisions", "research"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab as any)}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                selectedTab === tab
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {selectedTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Portfolio Value Trend */}
            <Card className="card-elegant">
              <h3 className="text-lg font-bold mb-4">Portfolio Value Trend</h3>
              {analyticsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" stroke="var(--color-muted-foreground)" />
                    <YAxis stroke="var(--color-muted-foreground)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                  <p className="text-sm text-muted-foreground">No portfolio history yet</p>
                  <Button size="sm" variant="outline" onClick={() => setLocation("/upload")}>
                    <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload Portfolio
                  </Button>
                </div>
              )}
            </Card>

            {/* Concentration Risk */}
            <Card className="card-elegant">
              <h3 className="text-lg font-bold mb-4">Portfolio Concentration</h3>
              {concentrationData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={concentrationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" stroke="var(--color-muted-foreground)" />
                    <YAxis stroke="var(--color-muted-foreground)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="value" fill="var(--color-primary)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                  <p className="text-sm text-muted-foreground">Upload your portfolio to see concentration analysis</p>
                  <Button size="sm" variant="outline" onClick={() => setLocation("/upload")}>
                    <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload Portfolio
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}

        {selectedTab === "portfolio" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sector Exposure */}
            <Card className="card-elegant">
              <h3 className="text-lg font-bold mb-4">Sector Exposure</h3>
              {sectorData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsChart>
                    <Pie
                      data={sectorData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {sectorData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "8px",
                      }}
                    />
                  </RechartsChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                  <p className="text-sm text-muted-foreground">Add sector info in your CSV to see exposure</p>
                  <Button size="sm" variant="outline" onClick={() => setLocation("/upload")}>
                    <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload Portfolio
                  </Button>
                </div>
              )}
            </Card>

            {/* Holdings Summary */}
            <Card className="card-elegant">
              <h3 className="text-lg font-bold mb-4">Holdings Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between pb-3 border-b border-border">
                  <span className="text-muted-foreground">Total Holdings</span>
                  <span className="font-semibold">{holdings.length}</span>
                </div>
                <div className="flex justify-between pb-3 border-b border-border">
                  <span className="text-muted-foreground">Total Shares</span>
                  <span className="font-semibold">{holdings.reduce((sum, h) => sum + h.shares, 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pb-3 border-b border-border">
                  <span className="text-muted-foreground">Cost Basis</span>
                  <span className="font-semibold">${analysis?.totalCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unrealized Gain %</span>
                  <span className={`font-semibold ${(analysis?.unrealizedGainsPercent || 0) >= 0 ? "text-accent" : "text-destructive"}`}>
                    {(analysis?.unrealizedGainsPercent || 0).toFixed(2)}%
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {selectedTab === "opportunities" && (
          <div className="space-y-4">
            <Card className="card-elegant">
              <h3 className="text-lg font-bold mb-4">Trade Suggestions ({suggestions.length})</h3>
              {suggestionsQuery.isLoading || holdingsQuery.isLoading ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : suggestions.length > 0 ? (
                <div className="space-y-3">
                  {suggestions.slice(0, 5).map((s) => (
                    <div key={s.id} className="p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{s.ticker}</p>
                          <p className="text-sm text-muted-foreground capitalize">{s.strategy.replace(/_/g, " ")}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-primary">{s.annualizedYield}% yield</p>
                          <p className="text-sm text-muted-foreground">${s.premium.toFixed(2)} premium</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <p className="text-sm text-muted-foreground">No trade suggestions yet</p>
                  {holdings.length === 0 ? (
                    <Button size="sm" variant="outline" onClick={() => setLocation("/upload")}>
                      <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload Portfolio First
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-green-700 hover:bg-green-800 text-white"
                      onClick={() => analyzeAiM.mutate()}
                      disabled={analyzeAiM.isPending}
                    >
                      {analyzeAiM.isPending
                        ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Generating...</>
                        : <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate AI Suggestions</>}
                    </Button>
                  )}
                </div>
              )}
            </Card>

            <Card className="card-elegant">
              <h3 className="text-lg font-bold mb-4">Tax Harvest Opportunities ({taxOpportunities.length})</h3>
              {taxOpportunities.length > 0 ? (
                <div className="space-y-3">
                  {taxOpportunities.slice(0, 5).map((t) => (
                    <div key={t.id} className="p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{t.ticker}</p>
                          <p className="text-sm text-muted-foreground">Loss: ${t.unrealizedLoss.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-accent">${t.estimatedTaxSavings.toFixed(2)} tax savings</p>
                          {t.washSaleRisk && <p className="text-xs text-destructive">Wash sale risk</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No tax harvest opportunities available</p>
              )}
            </Card>
          </div>
        )}

        {selectedTab === "research" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Do Iron Condors Beat the S&P 500?",
                  description: "Comprehensive analysis comparing iron condor returns against traditional index investing over 10 years.",
                  category: "Strategy Analysis",
                  readTime: "8 min",
                  date: "Mar 8, 2024",
                },
                {
                  title: "Best Options Strategies in High Volatility",
                  description: "Learn which options strategies perform best when market volatility spikes and how to position your portfolio.",
                  category: "Market Conditions",
                  readTime: "6 min",
                  date: "Mar 5, 2024",
                },
                {
                  title: "Theta Decay Income Study",
                  description: "Deep dive into how theta decay generates consistent income and optimal ways to harvest it across different market conditions.",
                  category: "Income Generation",
                  readTime: "10 min",
                  date: "Mar 1, 2024",
                },
                {
                  title: "Tax-Loss Harvesting with Options",
                  description: "Strategic guide to using options for tax-loss harvesting while maintaining portfolio exposure.",
                  category: "Tax Strategy",
                  readTime: "7 min",
                  date: "Feb 28, 2024",
                },
                {
                  title: "Covered Calls vs Cash-Secured Puts",
                  description: "Detailed comparison of two popular income strategies and when to use each based on market outlook.",
                  category: "Strategy Comparison",
                  readTime: "9 min",
                  date: "Feb 25, 2024",
                },
                {
                  title: "Managing Risk in Income Portfolios",
                  description: "Essential risk management techniques for options income traders to protect capital during market downturns.",
                  category: "Risk Management",
                  readTime: "8 min",
                  date: "Feb 22, 2024",
                },
              ].map((article, idx) => (
                <Card key={idx} className="card-elegant hover:shadow-lg transition-shadow cursor-pointer group">
                  <div className="flex flex-col h-full">
                    <div className="mb-3">
                      <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                        {article.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4 flex-grow">
                      {article.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                      <span>{article.readTime} read</span>
                      <span>{article.date}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {selectedTab === "decisions" && (
          <Card className="card-elegant">
            <h3 className="text-lg font-bold mb-4">Trade Decision History</h3>
            {decisions.length > 0 ? (
              <div className="space-y-3">
                {decisions.slice(0, 10).map((d) => (
                  <div key={d.id} className="p-3 border border-border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{d.ticker}</p>
                        <p className="text-sm text-muted-foreground capitalize">{d.strategy.replace(/_/g, " ")}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          d.status === "executed" ? "bg-accent/20 text-accent" :
                          d.status === "accepted" ? "bg-primary/20 text-primary" :
                          d.status === "rejected" ? "bg-destructive/20 text-destructive" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {d.status.replace(/_/g, " ")}
                        </span>
                        {d.outcome && d.outcome !== "pending" && (
                          <p className={`text-sm font-semibold mt-1 ${
                            d.outcome === "profit" ? "text-accent" :
                            d.outcome === "loss" ? "text-destructive" :
                            "text-muted-foreground"
                          }`}>
                            {d.outcome === "profit" ? "+" : ""}{d.profitLoss?.toFixed(2) || "0.00"}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No trade decisions yet</p>
            )}
          </Card>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
