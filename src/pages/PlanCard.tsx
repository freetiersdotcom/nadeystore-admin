// src/pages/PlanCard.tsx — on the "Team" page: the plan and what is used (everyone who manages the team), and the look of the admin (settings access).
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { api, ApiError, type Branding } from "../lib/api";
import { rememberBranding, useBranding, usePT, usePlan } from "../lib/plan";
import { useT } from "../lib/locale-context";

const card = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
};
const input = {
  background: "var(--bg-content)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  ["--tw-ring-color" as string]: "var(--accent)",
};
const inputClass =
  "w-full px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2";
const labelClass = "block text-xs font-medium mb-1.5";

function Meter({
  label,
  used,
  max,
  unlimited,
}: {
  label: string;
  used: number;
  max: number | null;
  unlimited: string;
}) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div>
      <div
        className="flex justify-between text-xs mb-1"
        style={{ color: "var(--text-secondary)" }}
      >
        <span>{label}</span>
        <span data-testid={`meter-${label}`}>
          {used} / {max ?? unlimited}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full"
          style={{
            width: max ? `${pct}%` : "0%",
            background: pct >= 100 ? "#dc2626" : "var(--accent)",
          }}
        />
      </div>
    </div>
  );
}

export function PlanCard() {
  const p = usePT();
  const { caps } = usePlan();
  if (!caps) return null;
  const kinds = caps.sells.map((k) => p(k)).join(", ");
  return (
    <section
      className="rounded-lg p-5 space-y-4"
      style={card}
      data-testid="plan-card"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          {p("planTitle")}
        </h2>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
        >
          {caps.label}
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Meter
          label={p("products")}
          used={caps.usage.products}
          max={caps.limits.max_products}
          unlimited={p("unlimited")}
        />
        <Meter
          label={p("staff")}
          used={caps.usage.staff}
          max={caps.limits.max_staff}
          unlimited={p("unlimited")}
        />
      </div>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {p("sells")}: {kinds}
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {p("upgrade")}
      </p>
    </section>
  );
}

export function BrandingCard() {
  const p = usePT();
  const t = useT();
  const qc = useQueryClient();
  const { data } = useBranding();
  const [form, setForm] = useState<Branding | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);
  const save = useMutation({
    mutationFn: (b: Branding) => api.saveBranding(b),
    onSuccess: (b) => {
      rememberBranding(b);
      qc.setQueryData(["branding"], b);
      setForm(b);
      setSaved(true);
      setError("");
    },
    onError: (e) => {
      setSaved(false);
      setError(e instanceof ApiError ? e.message : t("common.error"));
    },
  });
  if (!form) return null;
  const set = <K extends keyof Branding>(k: K, v: Branding[K]) => {
    setSaved(false);
    setForm({ ...form, [k]: v });
  };
  const hex = /^#[0-9a-f]{6}$/i.test(form.primary_color)
    ? form.primary_color
    : "#f5c747";
  return (
    <section
      className="rounded-lg p-5 space-y-4"
      style={card}
      data-testid="branding-card"
    >
      <div>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          {p("brandTitle")}
        </h2>
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          {p("brandHelp")}
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label
            className={labelClass}
            style={{ color: "var(--text-secondary)" }}
          >
            {p("name")}
          </label>
          <input
            data-testid="brand-name"
            className={inputClass}
            style={input}
            value={form.name}
            maxLength={60}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div>
          <label
            className={labelClass}
            style={{ color: "var(--text-secondary)" }}
          >
            {p("language")}
          </label>
          <select
            data-testid="brand-locale"
            className={inputClass}
            style={input}
            value={form.locale}
            onChange={(e) =>
              set("locale", e.target.value as Branding["locale"])
            }
          >
            <option value="auto">{p("auto")}</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label
            className={labelClass}
            style={{ color: "var(--text-secondary)" }}
          >
            {p("logo")}
          </label>
          <input
            data-testid="brand-logo"
            className={inputClass}
            style={input}
            value={form.logo_url}
            onChange={(e) => set("logo_url", e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div>
          <label
            className={labelClass}
            style={{ color: "var(--text-secondary)" }}
          >
            {p("favicon")}
          </label>
          <input
            data-testid="brand-favicon"
            className={inputClass}
            style={input}
            value={form.favicon_url}
            onChange={(e) => set("favicon_url", e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="sm:col-span-2">
          <label
            className={labelClass}
            style={{ color: "var(--text-secondary)" }}
          >
            {p("color")}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={p("color")}
              value={hex}
              onChange={(e) => set("primary_color", e.target.value)}
              className="h-9 w-12 rounded-sm"
            />
            <input
              data-testid="brand-color"
              className={inputClass}
              style={{ ...input, maxWidth: "10rem" }}
              value={form.primary_color}
              placeholder="#0F6B4B"
              onChange={(e) => set("primary_color", e.target.value)}
            />
            <button
              type="button"
              className="text-xs underline"
              style={{ color: "var(--text-secondary)" }}
              onClick={() => set("primary_color", "")}
            >
              {p("colorNone")}
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-testid="brand-save"
          disabled={save.isPending}
          onClick={() => save.mutate(form)}
          className="px-3 py-1.5 text-sm rounded font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
        >
          {save.isPending && <Loader2 size={14} className="animate-spin" />}
          {p("save")}
        </button>
        {saved && (
          <span
            className="text-xs"
            style={{ color: "var(--text-secondary)" }}
            data-testid="brand-saved"
          >
            {p("saved")}
          </span>
        )}
        {error && (
          <span
            className="text-xs"
            style={{ color: "#dc2626" }}
            data-testid="brand-error"
          >
            {error}
          </span>
        )}
      </div>
    </section>
  );
}
