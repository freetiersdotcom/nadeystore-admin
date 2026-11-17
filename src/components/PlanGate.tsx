// src/components/PlanGate.tsx
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, X } from "lucide-react";
import { usePlan, usePT } from "../lib/plan";
import type { Capabilities } from "../lib/api";

/** Shows its content only when the plan includes the feature. <Feature name="import_export"><ExportButton /></Feature> */
export function Feature({
  name,
  children,
}: {
  name: keyof Capabilities["features"];
  children: ReactNode;
}) {
  const plan = usePlan();
  return plan.feature(name) ? <>{children}</> : null;
}

export function NotInPlan() {
  const p = usePT();
  return (
    <div
      className="p-6 text-sm flex items-center gap-2"
      style={{ color: "var(--text-secondary)" }}
      data-testid="not-in-plan"
    >
      <Lock size={16} /> {p("notInPlan")}
    </div>
  );
}

/** The API refused something because of the plan (error code tier_limit): say so once, in plain words. */
export function TierLimitBanner() {
  const p = usePT();
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      setMsg(String((e as CustomEvent).detail || ""));
      void qc.invalidateQueries({ queryKey: ["capabilities"] });
    };
    window.addEventListener("tier:limit", on);
    return () => window.removeEventListener("tier:limit", on);
  }, [qc]);
  if (msg === null) return null;
  return (
    <div
      role="alert"
      data-testid="tier-limit"
      className="mb-4 p-3 rounded-sm text-sm flex items-start gap-3"
      style={{
        background: "var(--bg-subtle)",
        border: "1px solid var(--accent)",
        color: "var(--text)",
      }}
    >
      <Lock size={16} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <div className="font-medium">{p("limitTitle")}</div>
        {msg && <div style={{ color: "var(--text-secondary)" }}>{msg}</div>}
        <div style={{ color: "var(--text-secondary)" }}>{p("limitHelp")}</div>
      </div>
      <button
        type="button"
        aria-label={p("close")}
        onClick={() => setMsg(null)}
      >
        <X size={16} />
      </button>
    </div>
  );
}
