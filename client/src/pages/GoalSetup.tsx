import { useState, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ChevronRight, CheckCircle, Download, Upload, Plus, Trash2, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import Papa from "papaparse";

type Step = "account" | "income" | "risk" | "strategies" | "capital" | "horizon" | "portfolio" | "review";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  taxable: "Taxable Brokerage",
  traditional_ira: "Traditional IRA",
  roth_ira: "Roth IRA",
  "401k": "401(k) / Employer Plan",
};

interface GoalFormData {
  accountType: "taxable" | "traditional_ira" | "roth_ira" | "401k";
  monthlyIncomeGoal: number;
  riskTolerance: "conservative" | "balanced" | "aggressive";
  preferredStrategies: string[];
  maxCapitalExposure: number;
  timeHorizon: string;
}

interface PortfolioHolding {
  ticker: string;
  shares: number;
  averageCost: number;
  currentPrice: number;
  purchaseDate?: string;
  sector?: string;
}

const STRATEGY_OPTIONS = [
  { id: "covered_calls", label: "Covered Calls", desc: "Sell calls against shares you own" },
  { id: "cash_secured_puts", label: "Cash Secured Puts", desc: "Sell puts backed by cash reserves" },
  { id: "wheel", label: "Wheel Strategy", desc: "Combine puts and calls for continuous income" },
];

const StrategiesStep = memo(function StrategiesStep({
  preferredStrategies,
  toggleStrategy,
}: {
  preferredStrategies: string[];
  toggleStrategy: (s: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Preferred Strategies</h2>
        <p className="text-muted-foreground">Which options strategies interest you most?</p>
      </div>
      <div className="space-y-3">
        {STRATEGY_OPTIONS.map((strategy) => (
          <div
            key={strategy.id}
            className="flex items-center space-x-3 p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
          >
            <Checkbox
              id={strategy.id}
              checked={preferredStrategies.includes(strategy.id)}
              onCheckedChange={() => toggleStrategy(strategy.id)}
            />
            <Label htmlFor={strategy.id} className="flex-1 cursor-pointer">
              <span className="font-semibold">{strategy.label}</span>
              <p className="text-sm text-muted-foreground">{strategy.desc}</p>
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
});

export default function GoalSetup() {
  const [step, setStep] = useState<Step>("account");
  const [formData, setFormData] = useState<GoalFormData>({
    accountType: "taxable",
    monthlyIncomeGoal: 1000,
    riskTolerance: "balanced",
    preferredStrategies: ["covered_calls"],
    maxCapitalExposure: 50000,
    timeHorizon: "medium_term",
  });

  const [portfolioMode, setPortfolioMode] = useState<"manual" | "upload" | "skip">("skip");
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [manualHolding, setManualHolding] = useState<PortfolioHolding>({
    ticker: "",
    shares: 0,
    averageCost: 0,
    currentPrice: 0,
    purchaseDate: "",
    sector: "",
  });

  const setGoalsMutation = trpc.portfolio.setGoals.useMutation();
  const uploadHoldingsMutation = trpc.portfolio.uploadHoldings.useMutation();
  const [, setLocation] = useLocation();

  const steps: Step[] = ["account", "income", "risk", "strategies", "capital", "horizon", "portfolio", "review"];
  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setStep(steps[currentStepIndex + 1]);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setStep(steps[currentStepIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    try {
      // Save goals
      await setGoalsMutation.mutateAsync({
        accountType: formData.accountType,
        monthlyIncomeGoal: formData.monthlyIncomeGoal,
        riskTolerance: formData.riskTolerance,
        preferredStrategies: JSON.stringify(formData.preferredStrategies),
        maxCapitalExposure: formData.maxCapitalExposure,
        timeHorizon: formData.timeHorizon,
      });

      // Upload holdings if any
      if (holdings.length > 0) {
        await uploadHoldingsMutation.mutateAsync({
          holdings: holdings,
        });
      }

      toast.success("Setup completed successfully!");
      // Navigate to dashboard after successful setup
      setLocation("/dashboard");
    } catch (error) {
      toast.error("Failed to complete setup");
    }
  };

  const toggleStrategy = useCallback((strategy: string) => {
    setFormData((prev) => ({
      ...prev,
      preferredStrategies: prev.preferredStrategies.includes(strategy)
        ? prev.preferredStrategies.filter((s) => s !== strategy)
        : [...prev.preferredStrategies, strategy],
    }));
  }, []);

  const downloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/income_engine_template.csv";
    link.download = "income_engine_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Template downloaded!");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const parsedHoldings = results.data.map((row: any) => {
          // Support both old format (Ticker, Current Price) and new format (Ticker_Symbol)
          const ticker = (row.Ticker_Symbol || row.Ticker || "").toUpperCase();
          const shares = parseFloat(row.Shares) || 0;
          const averageCost = parseFloat(row.Average_Cost || row["Average Cost"]) || 0;
          
          // For new format: use Average_Cost as currentPrice if not provided
          // For old format: use Current Price
          const currentPrice = parseFloat(row["Current Price"]) || averageCost || 0;
          
          return {
            ticker,
            shares,
            averageCost,
            currentPrice,
            purchaseDate: row.Purchase_Date || row["Purchase Date"] || "",
            sector: row.Sector || "",
          };
        });

        const validHoldings = parsedHoldings.filter((h: PortfolioHolding) => h.ticker && h.shares > 0);
        if (validHoldings.length > 0) {
          setHoldings(validHoldings);
          setPortfolioMode("upload");
          toast.success(`Loaded ${validHoldings.length} holdings from file`);
        } else {
          toast.error("No valid holdings found in file");
        }
      },
      error: () => {
        toast.error("Failed to parse file");
      },
    });
  };

  const addManualHolding = () => {
    if (!manualHolding.ticker || manualHolding.shares <= 0 || manualHolding.currentPrice <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setHoldings([...holdings, manualHolding]);
    setManualHolding({
      ticker: "",
      shares: 0,
      averageCost: 0,
      currentPrice: 0,
      purchaseDate: "",
      sector: "",
    });
    toast.success("Holding added!");
  };

  const removeHolding = (index: number) => {
    setHoldings(holdings.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold gradient-text mb-2">PremiaOpts — Goal Setup</h1>
          <p className="text-muted-foreground">Configure your investment goals and preferences</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
            <span className="text-sm font-medium text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Card Container */}
        <Card className="card-elegant mb-8">
          {/* Account Type Step */}
          {step === "account" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Account Type</h2>
                <p className="text-muted-foreground">Where will you be trading options? This affects which strategies are available and how gains are taxed.</p>
              </div>
              <RadioGroup
                value={formData.accountType}
                onValueChange={(value: any) => setFormData((prev) => ({ ...prev, accountType: value }))}
              >
                <div className="space-y-3">
                  {[
                    {
                      value: "taxable",
                      label: "Taxable Brokerage",
                      desc: "Standard account. All strategies available. Premiums taxed as short-term gains. Wash sale rules apply.",
                    },
                    {
                      value: "traditional_ira",
                      label: "Traditional IRA",
                      desc: "Tax-deferred growth. Covered calls and cash-secured puts available. No wash sale rules. Withdrawal tax applies.",
                    },
                    {
                      value: "roth_ira",
                      label: "Roth IRA",
                      desc: "Tax-free growth. Covered calls and cash-secured puts available. No wash sale rules. Best for long-term income.",
                    },
                    {
                      value: "401k",
                      label: "401(k) / Employer Plan",
                      desc: "Very limited options access depending on your plan provider. Check with your plan administrator.",
                    },
                  ].map((option) => (
                    <div
                      key={option.value}
                      className="flex items-center space-x-3 p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                        <span className="font-semibold">{option.label}</span>
                        <p className="text-sm text-muted-foreground">{option.desc}</p>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Income Goal Step */}
          {step === "income" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Monthly Income Goal</h2>
                <p className="text-muted-foreground">How much monthly income do you want to generate from options?</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="income" className="text-base">
                  Target Monthly Income
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold text-primary">$</span>
                  <Input
                    id="income"
                    type="number"
                    value={formData.monthlyIncomeGoal || ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        monthlyIncomeGoal: Number(e.target.value),
                      }))
                    }
                    className="text-2xl font-semibold"
                    min="100"
                    step="100"
                  />
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">Tip:</span> Start with a realistic goal based on your portfolio size. A typical target is 1-3% monthly return.
                </p>
              </div>
            </div>
          )}

          {/* Risk Tolerance Step */}
          {step === "risk" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Risk Tolerance</h2>
                <p className="text-muted-foreground">How comfortable are you with portfolio volatility?</p>
              </div>
              <RadioGroup
                value={formData.riskTolerance}
                onValueChange={(value: any) =>
                  setFormData((prev) => ({ ...prev, riskTolerance: value }))
                }
              >
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <RadioGroupItem value="conservative" id="conservative" />
                    <Label htmlFor="conservative" className="flex-1 cursor-pointer">
                      <span className="font-semibold">Conservative</span>
                      <p className="text-sm text-muted-foreground">
                        Lower risk, stable income. Prefer covered calls and protective strategies.
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <RadioGroupItem value="balanced" id="balanced" />
                    <Label htmlFor="balanced" className="flex-1 cursor-pointer">
                      <span className="font-semibold">Balanced</span>
                      <p className="text-sm text-muted-foreground">
                        Moderate risk, mix of strategies. Blend of calls and puts.
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <RadioGroupItem value="aggressive" id="aggressive" />
                    <Label htmlFor="aggressive" className="flex-1 cursor-pointer">
                      <span className="font-semibold">Aggressive</span>
                      <p className="text-sm text-muted-foreground">
                        Higher risk, higher returns. Spreads and leveraged strategies.
                      </p>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Strategies Step */}
          {step === "strategies" && (
            <StrategiesStep
              preferredStrategies={formData.preferredStrategies}
              toggleStrategy={toggleStrategy}
            />
          )}

          {/* Capital Exposure Step */}
          {step === "capital" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Maximum Capital Exposure</h2>
                <p className="text-muted-foreground">
                  What's the maximum capital you want to expose to options?
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capital" className="text-base">
                  Maximum Capital
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold text-primary">$</span>
                  <Input
                    id="capital"
                    type="number"
                    value={formData.maxCapitalExposure || ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        maxCapitalExposure: Number(e.target.value),
                      }))
                    }
                    className="text-2xl font-semibold"
                    min="1000"
                    step="1000"
                  />
                </div>
              </div>
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">Tip:</span> This limits the total capital tied up in options
                  positions at any time.
                </p>
              </div>
            </div>
          )}

          {/* Time Horizon Step */}
          {step === "horizon" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Time Horizon</h2>
                <p className="text-muted-foreground">How long do you plan to run this income strategy?</p>
              </div>
              <RadioGroup
                value={formData.timeHorizon}
                onValueChange={(value: any) =>
                  setFormData((prev) => ({ ...prev, timeHorizon: value }))
                }
              >
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <RadioGroupItem value="short_term" id="short_term" />
                    <Label htmlFor="short_term" className="flex-1 cursor-pointer">
                      <span className="font-semibold">Short Term (0-1 year)</span>
                      <p className="text-sm text-muted-foreground">
                        Quick income generation with frequent adjustments
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <RadioGroupItem value="medium_term" id="medium_term" />
                    <Label htmlFor="medium_term" className="flex-1 cursor-pointer">
                      <span className="font-semibold">Medium Term (1-3 years)</span>
                      <p className="text-sm text-muted-foreground">Balanced approach with steady income</p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <RadioGroupItem value="long_term" id="long_term" />
                    <Label htmlFor="long_term" className="flex-1 cursor-pointer">
                      <span className="font-semibold">Long Term (3+ years)</span>
                      <p className="text-sm text-muted-foreground">
                        Build wealth over time with consistent strategy
                      </p>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Portfolio Step */}
          {step === "portfolio" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Portfolio Data</h2>
                <p className="text-muted-foreground">
                  Add your current investments (optional - you can skip and add later)
                </p>
              </div>

              {portfolioMode === "skip" && (
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto p-4"
                    onClick={() => setPortfolioMode("manual")}
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    <div className="text-left">
                      <p className="font-semibold">Enter Investments Manually</p>
                      <p className="text-sm text-muted-foreground">Add holdings one by one</p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto p-4"
                    onClick={() => setPortfolioMode("upload")}
                  >
                    <Upload className="mr-2 h-5 w-5" />
                    <div className="text-left">
                      <p className="font-semibold">Upload CSV or Excel File</p>
                      <p className="text-sm text-muted-foreground">Import from income_engine_data file</p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto p-4"
                    onClick={downloadTemplate}
                  >
                    <Download className="mr-2 h-5 w-5" />
                    <div className="text-left">
                      <p className="font-semibold">Download Template</p>
                      <p className="text-sm text-muted-foreground">Get a CSV template to fill in</p>
                    </div>
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      handleNext();
                    }}
                  >
                    Skip for Now
                  </Button>
                </div>
              )}

              {portfolioMode === "manual" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Ticker *</Label>
                      <Input
                        placeholder="e.g., AAPL"
                        value={manualHolding.ticker}
                        onChange={(e) =>
                          setManualHolding({ ...manualHolding, ticker: e.target.value.toUpperCase() })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Shares *</Label>
                      <Input
                        type="number"
                        placeholder="100"
                        value={manualHolding.shares || ""}
                        onChange={(e) =>
                          setManualHolding({ ...manualHolding, shares: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Avg Cost</Label>
                      <Input
                        type="number"
                        placeholder="150.00"
                        value={manualHolding.averageCost || ""}
                        onChange={(e) =>
                          setManualHolding({
                            ...manualHolding,
                            averageCost: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Current Price *</Label>
                      <Input
                        type="number"
                        placeholder="180.50"
                        value={manualHolding.currentPrice || ""}
                        onChange={(e) =>
                          setManualHolding({
                            ...manualHolding,
                            currentPrice: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Purchase Date</Label>
                      <Input
                        type="date"
                        value={manualHolding.purchaseDate || ""}
                        onChange={(e) =>
                          setManualHolding({ ...manualHolding, purchaseDate: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Sector</Label>
                      <Input
                        placeholder="Technology"
                        value={manualHolding.sector || ""}
                        onChange={(e) => setManualHolding({ ...manualHolding, sector: e.target.value })}
                      />
                    </div>
                  </div>

                  <Button onClick={addManualHolding} className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Add Holding
                  </Button>

                  {holdings.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold">Added Holdings ({holdings.length})</h3>
                      {holdings.map((holding, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div>
                            <p className="font-semibold">{holding.ticker}</p>
                            <p className="text-sm text-muted-foreground">
                              {holding.shares} shares @ ${holding.currentPrice.toFixed(2)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeHolding(idx)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPortfolioMode("skip");
                        setHoldings([]);
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={() => setPortfolioMode("upload")}
                      variant="outline"
                      className="flex-1"
                    >
                      Switch to Upload
                    </Button>
                  </div>
                </div>
              )}

              {portfolioMode === "upload" && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="font-semibold mb-2">Upload CSV or Excel File</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Drag and drop your income_engine_data file or click to browse
                    </p>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      onClick={() => document.getElementById("file-upload")?.click()}
                      variant="outline"
                    >
                      Choose File
                    </Button>
                  </div>

                  {holdings.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold">Loaded Holdings ({holdings.length})</h3>
                      {holdings.map((holding, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div>
                            <p className="font-semibold">{holding.ticker}</p>
                            <p className="text-sm text-muted-foreground">
                              {holding.shares} shares @ ${holding.currentPrice.toFixed(2)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeHolding(idx)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPortfolioMode("skip");
                        setHoldings([]);
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={() => setPortfolioMode("manual")}
                      variant="outline"
                      className="flex-1"
                    >
                      Switch to Manual
                    </Button>
                  </div>

                  <Button onClick={downloadTemplate} variant="outline" className="w-full">
                    <Download className="mr-2 h-4 w-4" /> Download Template
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Review Step */}
          {step === "review" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Review Your Settings</h2>
                <p className="text-muted-foreground">Please confirm your investment preferences</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Account Type</p>
                    <p className="text-lg font-semibold">{ACCOUNT_TYPE_LABELS[formData.accountType]}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Monthly Income Goal</p>
                    <p className="text-2xl font-bold text-primary">
                      ${formData.monthlyIncomeGoal.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Risk Tolerance</p>
                    <p className="text-lg font-semibold capitalize">{formData.riskTolerance}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Max Capital Exposure</p>
                    <p className="text-2xl font-bold text-secondary">
                      ${formData.maxCapitalExposure.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Time Horizon</p>
                    <p className="text-lg font-semibold capitalize">
                      {formData.timeHorizon.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Preferred Strategies</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.preferredStrategies.map((strategy) => (
                      <span
                        key={strategy}
                        className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium"
                      >
                        {strategy.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>

                {holdings.length > 0 && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Portfolio Holdings</p>
                    <p className="text-lg font-semibold">{holdings.length} holdings loaded</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Navigation Buttons */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="flex-1"
          >
            Back
          </Button>
          {step === "review" ? (
            <Button
              onClick={handleSubmit}
              disabled={setGoalsMutation.isPending}
              className="flex-1"
            >
              {setGoalsMutation.isPending ? "Completing..." : "Complete Setup"}
              <CheckCircle className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleNext} className="flex-1">
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
