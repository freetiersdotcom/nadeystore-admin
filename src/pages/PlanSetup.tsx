// src/pages/PlanSetup.tsx — agency only: choose this client's tier, what it sells, extra modules and limits (PUT /v1/tier).
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  api,
  ApiError,
  type Kind,
  type StoredPlan,
  type TierList,
} from "../lib/api";
import { usePT } from "../lib/plan";
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
const KINDS: Kind[] = ["physical", "digital", "service"];
type Limit = { mode: "default" | "unlimited" | "custom"; n: string };

const toLimit = (
  stored: StoredPlan | null,
  key: "max_products" | "max_staff",
): Limit =>
  !stored || !(key in stored) || stored[key] === undefined
    ? { mode: "default", n: "" }
    : stored[key] === null
      ? { mode: "unlimited", n: "" }
      : { mode: "custom", n: String(stored[key]) };

function LimitField({
  label,
  value,
  onChange,
  testid,
  p,
}: {
  label: string;
  value: Limit;
  onChange: (l: Limit) => void;
  testid: string;
  p: ReturnType<typeof usePT>;
}) {
  return (
    <div>
      <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
        {label}
      </label>
      <div className="flex gap-2">
        <select
          data-testid={`${testid}-mode`}
          className={inputClass}
          style={input}
          value={value.mode}
          onChange={(e) =>
            onChange({ ...value, mode: e.target.value as Limit["mode"] })
          }
        >
          <option value="default">{p("tierDefault")}</option>
          <option value="unlimited">{p("unlimited")}</option>
          <option value="custom">{p("custom")}</option>
        </select>
        {value.mode === "custom" && (
          <input
            data-testid={`${testid}-n`}
            type="number"
            min={0}
            className={inputClass}
            style={{ ...input, maxWidth: "7rem" }}
            value={value.n}
            onChange={(e) => onChange({ ...value, n: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}

export function PlanSetup() {
  const p = usePT();
  const t = useT();
  const qc = useQueryClient();
  const [token, setToken] = useState("");
  const [list, setList] = useState<TierList | null>(null);
  const [tier, setTier] = useState("pro");
  const [sells, setSells] = useState<Kind[]>(KINDS);
  const [extra, setExtra] = useState<string[]>([]);
  const [maxP, setMaxP] = useState<Limit>({ mode: "default", n: "" });
  const [maxS, setMaxS] = useState<Limit>({ mode: "default", n: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fail = (e: unknown) =>
    setMsg({
      ok: false,
      text: e instanceof ApiError ? e.message : t("common.error"),
    });

  const load = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.getTierAdmin(token.trim());
      setList(r);
      const s = r.stored;
      setTier(s?.tier ?? "pro");
      setSells(s?.sells?.length ? s.sells : KINDS);
      setExtra(s?.extra_modules ?? []);
      setMaxP(toLimit(s, "max_products"));
      setMaxS(toLimit(s, "max_staff"));
    } catch (e) {
      setList(null);
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const lim = (l: Limit) =>
    l.mode === "default"
      ? {}
      : {
          v:
            l.mode === "unlimited"
              ? null
              : Math.max(0, Math.floor(Number(l.n) || 0)),
        };
  const save = async () => {
    setBusy(true);
    setMsg(null);
    const body: StoredPlan = {
      tier,
      sells,
      ...(extra.length ? { extra_modules: extra } : {}),
    };
    const a = lim(maxP);
    const b = lim(maxS);
    if ("v" in a) body.max_products = a.v ?? null;
    if ("v" in b) body.max_staff = b.v ?? null;
    try {
      await api.putTierAdmin(token.trim(), body);
      void qc.invalidateQueries({ queryKey: ["capabilities"] });
      void qc.invalidateQueries({ queryKey: ["modules"] });
      setMsg({ ok: true, text: p("saved") });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const toggle = <T,>(arr: T[], v: T) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  return (
    <div className="max-w-2xl space-y-6" data-testid="plan-setup">
      <h1 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
        {p("planSetup")}
      </h1>
      <section className="rounded-lg p-5 space-y-3" style={card}>
        <label
          className={labelClass}
          style={{ color: "var(--text-secondary)" }}
        >
          {p("token")}
        </label>
        <div className="flex gap-2">
          <input
            data-testid="plan-token"
            type="password"
            autoComplete="off"
            className={inputClass}
            style={input}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button
            type="button"
            data-testid="plan-load"
            disabled={busy || !token.trim()}
            onClick={load}
            className="px-3 py-1.5 text-sm rounded font-semibold disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "var(--text-inverse)",
            }}
          >
            {p("load")}
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {p("setupHelp")}
        </p>
      </section>
      {list && (
        <section className="rounded-lg p-5 space-y-4" style={card}>
          <div>
            <label
              className={labelClass}
              style={{ color: "var(--text-secondary)" }}
            >
              {p("tier")}
            </label>
            <select
              data-testid="plan-tier"
              className={inputClass}
              style={input}
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            >
              {Object.entries(list.tiers).map(([id, d]) => (
                <option key={id} value={id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span
              className={labelClass}
              style={{ color: "var(--text-secondary)" }}
            >
              {p("sells")}
            </span>
            <div
              className="flex flex-wrap gap-4 text-sm"
              style={{ color: "var(--text)" }}
            >
              {KINDS.map((k) => (
                <label key={k} className="inline-flex items-center gap-1.5">
                  <input
                    data-testid={`plan-sells-${k}`}
                    type="checkbox"
                    checked={sells.includes(k)}
                    onChange={() => {
                      const n = toggle(sells, k);
                      if (n.length) setSells(n);
                    }}
                  />
                  {p(k)}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span
              className={labelClass}
              style={{ color: "var(--text-secondary)" }}
            >
              {p("extraModules")}
            </span>
            <div
              className="flex flex-wrap gap-4 text-sm"
              style={{ color: "var(--text)" }}
            >
              {list.modules.map((m) => {
                const inTier =
                  list.tiers[tier]?.modules === "*" ||
                  (list.tiers[tier]?.modules as string[] | undefined)?.includes(
                    m,
                  );
                return (
                  <label
                    key={m}
                    className="inline-flex items-center gap-1.5"
                    style={{ opacity: inTier ? 0.5 : 1 }}
                  >
                    <input
                      data-testid={`plan-mod-${m}`}
                      type="checkbox"
                      disabled={!!inTier}
                      checked={!!inTier || extra.includes(m)}
                      onChange={() => setExtra(toggle(extra, m))}
                    />
                    {m}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <LimitField
              label={p("maxProducts")}
              value={maxP}
              onChange={setMaxP}
              testid="plan-maxp"
              p={p}
            />
            <LimitField
              label={p("maxStaff")}
              value={maxS}
              onChange={setMaxS}
              testid="plan-maxs"
              p={p}
            />
          </div>
          <button
            type="button"
            data-testid="plan-save"
            disabled={busy}
            onClick={save}
            className="px-3 py-1.5 text-sm rounded font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "var(--text-inverse)",
            }}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {p("save")}
          </button>
        </section>
      )}
      {msg && (
        <p
          className="text-sm"
          data-testid="plan-msg"
          style={{ color: msg.ok ? "var(--text-secondary)" : "#dc2626" }}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
