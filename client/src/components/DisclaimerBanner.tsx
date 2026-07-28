import { AlertTriangle } from "lucide-react";

export function DisclaimerBanner() {
  return (
    <div className="border-t border-border bg-muted/30 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-start gap-2.5 text-xs text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
        <p>
          <strong className="text-foreground font-medium">Educational Use Only — Not Investment Advice.</strong>{" "}
          PremiaOpts is a student-built educational tool. All content, AI-generated suggestions, and analysis are
          for informational purposes only and do not constitute financial, investment, or trading advice.
          Options trading involves significant risk of loss. Always conduct your own research and consult a
          qualified financial advisor before placing any trade. Past performance is not indicative of future results.
        </p>
      </div>
    </div>
  );
}
