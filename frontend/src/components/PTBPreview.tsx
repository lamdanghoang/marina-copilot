"use client";

import { useState } from "react";
import type { ProcessIntentResponse, PTBStep, RiskWarning } from "@/types";

interface PTBPreviewProps {
  preview: NonNullable<ProcessIntentResponse["preview"]>;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting: boolean;
}

export function PTBPreview({
  preview,
  onConfirm,
  onCancel,
  isExecuting,
}: PTBPreviewProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const { steps, metadata, risks, assessment } = preview;
  const hasRisks = risks.length > 0;

  function handleConfirm() {
    setIsConfirming(true);
    onConfirm();
  }

  const isDisabled = isConfirming || isExecuting;

  return (
    <div className="w-full rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <h3 className="text-base font-semibold">📋 Transaction Preview</h3>

      {/* Steps */}
      <ol className="mt-3 flex flex-col gap-2">
        {steps.map((step) => (
          <StepItem key={step.index} step={step} />
        ))}
      </ol>

      {/* Metadata */}
      <MetadataGrid metadata={metadata} />

      {/* Risk Warnings or Safe Indicator */}
      {hasRisks ? (
        <RiskSection risks={risks} />
      ) : (
        <SafeIndicator />
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={isDisabled}
          aria-label={hasRisks ? "Confirm transaction anyway" : "Confirm and sign transaction"}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            hasRisks
              ? "bg-yellow-500 text-white hover:bg-yellow-600"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {hasRisks ? "⚠️ Confirm Anyway" : "✅ Confirm & Sign"}
        </button>
        <button
          onClick={onCancel}
          disabled={isExecuting}
          aria-label="Cancel transaction"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// --- Sub-components ---

function StepItem({ step }: { step: PTBStep }) {
  const icon = stepIcon(step.type);
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {step.index}
      </span>
      <span>
        {icon} {step.description}
      </span>
    </li>
  );
}

function stepIcon(type: PTBStep["type"]): string {
  switch (type) {
    case "split":
      return "✂️";
    case "swap":
      return "🔄";
    case "stake":
      return "🥩";
    case "receive":
      return "📥";
    default:
      return "•";
  }
}

interface MetadataGridProps {
  metadata: NonNullable<ProcessIntentResponse["preview"]>["metadata"];
}

function MetadataGrid({ metadata }: MetadataGridProps) {
  const items: Array<{ label: string; value: string }> = [];

  if (metadata.type === "swap") {
    if (metadata.exchangeRate != null) {
      items.push({ label: "Exchange Rate", value: `${metadata.exchangeRate}` });
    }
    if (metadata.minimumOutput != null) {
      items.push({ label: "Min Received", value: `${metadata.minimumOutput}` });
    }
    if (metadata.priceImpact != null) {
      items.push({ label: "Price Impact", value: `${metadata.priceImpact}%` });
    }
  }

  if (metadata.type === "stake") {
    if (metadata.validatorName) {
      items.push({ label: "Validator", value: metadata.validatorName });
    }
    if (metadata.estimatedApy != null) {
      items.push({ label: "Estimated APY", value: `${metadata.estimatedApy}%` });
    }
  }

  items.push({ label: "Gas Fee", value: `~${metadata.gasEstimate} SUI` });

  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-muted/50 p-3 text-xs">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RiskSection({ risks }: { risks: RiskWarning[] }) {
  return (
    <div className="mt-4" role="alert" aria-label="Transaction risk warnings">
      <h4 className="text-sm font-semibold">⚠️ Warnings</h4>
      <div className="mt-2 flex flex-col gap-2">
        {risks.map((risk, idx) => (
          <RiskCard key={idx} risk={risk} />
        ))}
      </div>
    </div>
  );
}

function RiskCard({ risk }: { risk: RiskWarning }) {
  const borderColor = severityBorderColor(risk.severity);
  const icon = severityIcon(risk.severity);
  const title =
    risk.class === "HIGH_SLIPPAGE" ? "High Slippage" : "Concentration Risk";

  return (
    <div
      className={`rounded-md border-l-4 bg-muted/30 p-3 ${borderColor}`}
    >
      <p className="text-sm font-medium">
        {icon} {title}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{risk.explanation}</p>
      <p className="mt-1 text-xs italic text-muted-foreground">
        💡 {risk.suggestion}
      </p>
    </div>
  );
}

function severityBorderColor(severity: RiskWarning["severity"]): string {
  switch (severity) {
    case "warning":
      return "border-yellow-500";
    case "elevated":
      return "border-orange-500";
    case "danger":
      return "border-red-500";
    default:
      return "border-yellow-500";
  }
}

function severityIcon(severity: RiskWarning["severity"]): string {
  switch (severity) {
    case "warning":
      return "🟡";
    case "elevated":
      return "🟠";
    case "danger":
      return "🔴";
    default:
      return "⚠️";
  }
}

function SafeIndicator() {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-md bg-green-500/10 p-2 text-sm text-green-700">
      <span>✅</span>
      <span>No risks detected</span>
    </div>
  );
}
