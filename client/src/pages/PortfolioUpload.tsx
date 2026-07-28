import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import Papa from "papaparse";

interface ParsedHolding {
  ticker: string;
  shares: number;
  averageCost: number;
  currentPrice: number;
  purchaseDate?: string;
  sector?: string;
}

export default function PortfolioUpload() {
  const [parsedData, setParsedData] = useState<ParsedHolding[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  const uploadMutation = trpc.portfolio.uploadHoldings.useMutation();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        try {
          const holdings: ParsedHolding[] = results.data
            .filter((row: any) => {
              const type = row.Type_of_Investment || row.type_of_investment || row.type || "";
              return type.toLowerCase() !== "option";
            })
            .map((row: any) => ({
              ticker: (row.ticker || row.TICKER || row.Ticker_Symbol || row.ticker_symbol || "").toUpperCase(),
              shares: Number(row.shares || row.SHARES || row.Shares || 0),
              averageCost: Number(row.averageCost || row.AVERAGE_COST || row.Average_Cost || row.average_cost || row.cost || 0),
              currentPrice: Number(row.currentPrice || row.CURRENT_PRICE || row.Current_Price || row.current_price || row.price || 0),
              purchaseDate: row.purchaseDate || row.PURCHASE_DATE || row.Purchase_Date || row.purchase_date || "",
              sector: row.sector || row.SECTOR || row.Sector || "",
            }))
            .filter((h: ParsedHolding) => h.ticker && h.shares > 0);

          if (holdings.length === 0) {
            toast.error("No valid holdings found in CSV");
            setIsLoading(false);
            return;
          }

          setParsedData(holdings);
          toast.success(`Parsed ${holdings.length} holdings`);
        } catch (error) {
          toast.error("Failed to parse CSV file");
        } finally {
          setIsLoading(false);
        }
      },
      error: () => {
        toast.error("Failed to read CSV file");
        setIsLoading(false);
      },
    });
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) {
      toast.error("No holdings to upload");
      return;
    }

    try {
      await uploadMutation.mutateAsync({
        holdings: parsedData,
      });
      toast.success(`Successfully uploaded ${parsedData.length} holdings!`);
      setParsedData([]);
      setFileName("");
    } catch (error) {
      toast.error("Failed to upload holdings");
    }
  };

  return (
    <DashboardLayout>
    <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold gradient-text mb-2">Upload Portfolio</h1>
          <p className="text-muted-foreground">Import your current holdings from a CSV file</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <div className="lg:col-span-1">
            <Card className="card-elegant">
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold mb-2">Import Holdings</h2>
                  <p className="text-sm text-muted-foreground">Upload a CSV file with your portfolio</p>
                </div>

                {/* File Input */}
                <div className="space-y-2">
                  <Label htmlFor="csv-upload" className="text-base font-semibold">
                    Select CSV File
                  </Label>
                  <div className="relative">
                    <Input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      disabled={isLoading}
                      className="cursor-pointer"
                    />
                    <Upload className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                {fileName && (
                  <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg flex items-center gap-2">
                    <FileText className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium text-foreground">{fileName}</span>
                  </div>
                )}

                {/* CSV Format Info */}
                <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
                  <p className="text-sm font-semibold text-foreground">CSV Format Required:</p>
                  <code className="text-xs bg-background p-2 rounded block overflow-auto text-muted-foreground">
                    ticker,shares,averageCost,currentPrice,<br />purchaseDate,sector
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Example: AAPL,100,150.00,185.50,2023-01-15,Technology
                  </p>
                  <a
                    href="/income_engine_template.csv"
                    download="income_engine_template.csv"
                    className="inline-block text-xs text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Download template CSV
                  </a>
                </div>

                {/* Upload Button */}
                <Button
                  onClick={handleUpload}
                  disabled={parsedData.length === 0 || uploadMutation.isPending}
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                >
                  {uploadMutation.isPending ? "Uploading..." : `Upload ${parsedData.length} Holdings`}
                  {parsedData.length > 0 && <CheckCircle className="ml-2 h-4 w-4" />}
                </Button>
              </div>
            </Card>
          </div>

          {/* Preview Section */}
          <div className="lg:col-span-2">
            <Card className="card-elegant">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold mb-2">Preview</h2>
                  <p className="text-sm text-muted-foreground">
                    {parsedData.length > 0
                      ? `${parsedData.length} holdings ready to upload`
                      : "Upload a CSV file to preview holdings"}
                  </p>
                </div>

                {parsedData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticker</TableHead>
                          <TableHead className="text-right">Shares</TableHead>
                          <TableHead className="text-right">Avg Cost</TableHead>
                          <TableHead className="text-right">Current Price</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead>Sector</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.map((holding, idx) => {
                          const value = holding.shares * holding.currentPrice;
                          const gain = (holding.currentPrice - holding.averageCost) * holding.shares;
                          const gainPercent = ((holding.currentPrice - holding.averageCost) / holding.averageCost) * 100;

                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-semibold">{holding.ticker}</TableCell>
                              <TableCell className="text-right">{holding.shares.toLocaleString()}</TableCell>
                              <TableCell className="text-right">${holding.averageCost.toFixed(2)}</TableCell>
                              <TableCell className="text-right">${holding.currentPrice.toFixed(2)}</TableCell>
                              <TableCell className="text-right">
                                <div className="font-semibold">${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                                <div className={`text-xs ${gain >= 0 ? "text-accent" : "text-destructive"}`}>
                                  {gain >= 0 ? "+" : ""}{gain.toLocaleString("en-US", { maximumFractionDigits: 2 })} ({gainPercent.toFixed(1)}%)
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{holding.sector || "-"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    {/* Summary */}
                    <div className="mt-6 pt-4 border-t border-border space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Portfolio Value:</span>
                        <span className="font-bold text-lg">
                          ${parsedData.reduce((sum, h) => sum + h.shares * h.currentPrice, 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Cost Basis:</span>
                        <span className="font-bold">
                          ${parsedData.reduce((sum, h) => sum + h.shares * h.averageCost, 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-border">
                        <span className="text-muted-foreground">Unrealized Gain/Loss:</span>
                        <span className="font-bold text-lg text-accent">
                          ${(parsedData.reduce((sum, h) => sum + h.shares * h.currentPrice, 0) - parsedData.reduce((sum, h) => sum + h.shares * h.averageCost, 0)).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-muted-foreground">No holdings to display</p>
                    <p className="text-sm text-muted-foreground mt-1">Upload a CSV file to see your portfolio</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
