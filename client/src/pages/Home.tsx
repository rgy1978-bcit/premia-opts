import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  ArrowRight,
  TrendingUp,
  PieChart,
  Zap,
  BarChart3,
  Shield,
  Lightbulb,
  CheckCircle,
  Briefcase,
  DollarSign,
  LineChart,
  Target,
  AlertCircle,
} from "lucide-react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: TrendingUp,
      title: "PremiaOpts",
      description: "AI-powered options income strategies for serious investors and learners",
    },
    {
      icon: PieChart,
      title: "Portfolio Analysis",
      description: "Deep insights into your holdings, concentration risk, sector exposure, and Greeks calculations",
    },
    {
      icon: Zap,
      title: "Tax Optimization",
      description: "Identify tax-loss harvesting opportunities to maximize returns and reduce tax liability",
    },
    {
      icon: BarChart3,
      title: "Trade Suggestions",
      description: "AI-powered recommendations for covered calls, puts, spreads, and collars based on market conditions",
    },
    {
      icon: Shield,
      title: "Risk Management",
      description: "Monitor Greeks (Delta, Gamma, Theta, Vega), allocation limits, and portfolio concentration",
    },
    {
      icon: Lightbulb,
      title: "Decision Tracking",
      description: "Log and analyze all trades to improve your strategy and measure performance over time",
    },
  ];

  const requirements = [
    {
      title: "Your Brokerage Account",
      description: "Use your existing account at any broker that supports options (Schwab, Fidelity, TD Ameritrade, etc.) — no new account needed",
      icon: Briefcase,
    },
    {
      title: "Options Trading Approval",
      description: "Enable options trading at your broker (Level 1 minimum for covered calls and cash-secured puts)",
      icon: CheckCircle,
    },
    {
      title: "Available Capital",
      description: "Start with an amount you're comfortable with — $500 can work for some strategies. PremiaOpts will recommend trades that fit your budget.",
      icon: DollarSign,
    },
    {
      title: "Portfolio Holdings",
      description: "Upload your current stocks and options via CSV or manual entry to get personalized suggestions",
      icon: LineChart,
    },
  ];

  const strategies = [
    {
      name: "Covered Calls",
      income: "2-4% monthly",
      risk: "Low",
      description: "Sell call options on stocks you own to generate income while keeping upside capped",
      best: "Neutral or slightly bullish outlook",
    },
    {
      name: "Cash-Secured Puts",
      income: "1-3% monthly",
      risk: "Medium",
      description: "Sell put options to generate income while potentially buying stocks at a discount",
      best: "Want to own a stock at lower prices",
    },
    {
      name: "Iron Condors",
      income: "1-2% monthly",
      risk: "Medium",
      description: "Sell both call and put spreads to profit from neutral market conditions",
      best: "Neutral outlook with defined risk",
    },
    {
      name: "Collars",
      income: "0-1% monthly",
      risk: "Very Low",
      description: "Protect gains with puts while selling calls to offset the cost",
      best: "Protecting profits in uncertain markets",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">PremiaOpts</span>
          </div>
          {isAuthenticated ? (
            <Button
              onClick={() => setLocation("/dashboard")}
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            >
              Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => (window.location.href = getLoginUrl())}
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            >
              Sign In
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                <span className="gradient-text">Generate Consistent Income</span>
                <br />
                From Your Portfolio
              </h1>
              <p className="text-xl text-muted-foreground max-w-lg">
                PremiaOpts is an AI-powered options income advisor. Get expert trade suggestions, analyze your portfolio, and make informed decisions — then execute in your own brokerage account.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {isAuthenticated ? (
                <>
                  <Button
                    onClick={() => setLocation("/dashboard")}
                    size="lg"
                    className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                  >
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button
                    onClick={() => setLocation("/setup")}
                    size="lg"
                    variant="outline"
                  >
                    Configure Goals
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => (window.location.href = getLoginUrl())}
                    size="lg"
                    className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                  >
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                  >
                    Learn More
                  </Button>
                </>
              )}
            </div>

            <div className="pt-8 border-t border-border">
              <p className="text-sm text-muted-foreground mb-4">Built for income investors at any stage</p>
              <div className="flex gap-6 text-sm font-medium text-foreground">
                <div>
                  <p className="text-2xl font-bold text-primary">Advisory</p>
                  <p className="text-muted-foreground">You keep full control</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-secondary">Learn Fast</p>
                  <p className="text-muted-foreground">AI-powered guidance included</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-accent">Scale Up</p>
                  <p className="text-muted-foreground">Grow your income strategy</p>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl blur-3xl" />
            <div className="relative bg-gradient-to-br from-card to-muted border border-border rounded-2xl p-8 shadow-elegant">
              <div className="space-y-6">
                <div className="h-48 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-24 w-24 text-primary/30" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Monthly Goal</span>
                    <span className="font-bold text-primary">$5,000</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Current Income</span>
                    <span className="font-bold text-accent">$3,850</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Progress</span>
                    <span className="font-bold text-secondary">77%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What You Need Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-border">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">What You Need to Get Started</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            PremiaOpts is advisory-only — trade in your own brokerage, no new accounts required
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {requirements.map((req, idx) => {
            const Icon = req.icon;
            return (
              <Card key={idx} className="card-elegant">
                <div className="space-y-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-2">{req.title}</h3>
                    <p className="text-sm text-muted-foreground">{req.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10 rounded-xl p-8">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-bold mb-2">Capital Needed Varies by Strategy</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• <strong>Vertical Spreads:</strong> From ~$100–$500 (your max loss is defined upfront)</li>
                <li>• <strong>Covered Calls:</strong> Depends on the stock — cheaper stocks mean less capital needed</li>
                <li>• <strong>Cash-Secured Puts:</strong> Scales with the strike price you choose</li>
                <li>• <strong>PremiaOpts</strong> tailors suggestions to your available budget — you decide what you're comfortable risking</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-border">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Powerful Features</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to manage a sophisticated options income strategy
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <Card key={idx} className="card-elegant group hover:shadow-md transition-all">
                <div className="space-y-4">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Strategies Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-border">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Supported Options Strategies</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            PremiaOpts supports multiple income-generating strategies with detailed analysis and recommendations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {strategies.map((strategy, idx) => (
            <Card key={idx} className="card-elegant">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-1">{strategy.name}</h3>
                    <p className="text-sm text-muted-foreground">{strategy.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Monthly Income</p>
                    <p className="font-bold text-primary">{strategy.income}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Risk Level</p>
                    <p className="font-bold text-secondary">{strategy.risk}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Best For</p>
                    <p className="font-bold text-accent text-sm">{strategy.best}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-12 bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10 rounded-xl p-8">
          <div className="flex items-start gap-4">
            <Target className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-bold mb-2">Strategy Selection Guide</h3>
              <p className="text-muted-foreground mb-4">
                PremiaOpts analyzes your portfolio and risk tolerance to recommend the best strategies for your situation. Each strategy has different capital requirements, risk profiles, and income potential.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• <strong>Conservative investors:</strong> Start with covered calls and collars</li>
                <li>• <strong>Balanced investors:</strong> Mix covered calls with cash-secured puts</li>
                <li>• <strong>Aggressive investors:</strong> Add spreads and iron condors for higher income</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-border">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Dashboard & Analytics</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Track your income strategy with comprehensive analytics and visualizations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="card-elegant">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <LineChart className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold">Income Tracking</h3>
              <p className="text-muted-foreground">Monitor daily income progress toward your monthly goal with interactive charts and trend analysis</p>
            </div>
          </Card>

          <Card className="card-elegant">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <PieChart className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold">Portfolio Allocation</h3>
              <p className="text-muted-foreground">Visualize your portfolio by sector, asset class, and strategy type with concentration risk alerts</p>
            </div>
          </Card>

          <Card className="card-elegant">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold">Risk Analysis</h3>
              <p className="text-muted-foreground">Monitor Greeks, margin requirements, and portfolio Greeks to understand your risk exposure</p>
            </div>
          </Card>

          <Card className="card-elegant">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold">Trade History</h3>
              <p className="text-muted-foreground">Log and analyze all executed trades to track performance and optimize your strategy over time</p>
            </div>
          </Card>

          <Card className="card-elegant">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold">Tax Optimization</h3>
              <p className="text-muted-foreground">Identify tax-loss harvesting opportunities and track wash-sale violations automatically</p>
            </div>
          </Card>

          <Card className="card-elegant">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <Lightbulb className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold">Trade Suggestions</h3>
              <p className="text-muted-foreground">Get AI-powered recommendations based on your portfolio, market conditions, and income goals</p>
            </div>
          </Card>
        </div>
      </section>

      {/* Getting Started Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-border">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Getting Started in 5 Steps</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start getting expert options income guidance in minutes
          </p>
        </div>

        <div className="space-y-6">
          {[
            {
              step: "1",
              title: "Have a Brokerage Account",
              description: "Use any broker that supports options trading (Schwab, Fidelity, TD Ameritrade, etc.) — PremiaOpts is advisory-only, so you trade in your own account",
              time: "Already done",
            },
            {
              step: "2",
              title: "Enable Options Trading",
              description: "Request options approval (Level 1 minimum) from your broker if not already enabled, and ensure you have capital available for your chosen strategies",
              time: "1–5 days",
            },
            {
              step: "3",
              title: "Create Your PremiaOpts Account",
              description: "Sign up and complete a quick profile so we can tailor recommendations to your situation",
              time: "5 minutes",
            },
            {
              step: "4",
              title: "Set Your Goals",
              description: "Configure your monthly income target, risk tolerance, and preferred strategies",
              time: "10 minutes",
            },
            {
              step: "5",
              title: "Upload Your Portfolio",
              description: "Add your current holdings via CSV upload or manual entry to get personalized trade suggestions",
              time: "5 minutes",
            },
          ].map((item, idx) => (
            <div key={idx} className="flex gap-6 items-start">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-bold text-white">{item.step}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-muted-foreground mb-2">{item.description}</p>
                <p className="text-sm text-primary font-medium">⏱️ {item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-border">
        <div className="relative bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-2xl p-12 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 blur-3xl" />
          <div className="relative space-y-6">
            <h2 className="text-4xl font-bold">Ready to Generate Consistent Income?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join investors using PremiaOpts to optimize their options income strategies
            </p>
            {!isAuthenticated && (
              <Button
                onClick={() => (window.location.href = getLoginUrl())}
                size="lg"
                className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-20">
        <DisclaimerBanner />
        <div className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold">PremiaOpts</span>
              </div>
              <p className="text-sm text-muted-foreground">
                © 2026 PremiaOpts. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
