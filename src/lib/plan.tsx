// src/lib/plan.tsx
// What this client's plan allows (GET /v1/capabilities) and how this admin looks (GET /v1/branding).
// The API decides; this file only reads the answers. Until the answer arrives, gated menu items stay hidden (no flash);
// if the API is older and has no such route, nothing is hidden.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Branding, type Capabilities, type Kind } from "./api";
import { getAuth } from "./store";
import { useLocale } from "./locale-context";

const KINDS: Kind[] = ["physical", "digital", "service"];

/** Pages hidden when the plan or the kind of shop does not need them. */
const PAGE_RULE: Record<string, (c: Capabilities) => boolean> = {
  discounts: (c) => c.features.discounts,
  profit: (c) => c.features.profit,
  downloads: (c) => c.sells.includes("digital"),
  appointments: (c) => c.sells.includes("service"),
  shipping: (c) => c.sells.includes("physical"),
};

export function usePlan(enabled = true) {
  const q = useQuery({
    queryKey: ["capabilities"],
    queryFn: () => api.getCapabilities(),
    enabled,
    staleTime: 60_000,
    retry: 0,
  });
  const caps = q.data;
  const ready = !enabled || q.isError || !!caps;
  return {
    caps,
    ready,
    /** The kinds of product this shop sells (all three when unknown). */
    sellsKind: (k: Kind) => (caps ? caps.sells.includes(k) : true),
    firstKind: (): Kind =>
      KINDS.find((k) => !caps || caps.sells.includes(k)) ?? "physical",
    feature: (f: keyof Capabilities["features"]) =>
      caps ? caps.features[f] : q.isError,
    /** May this admin page be shown? Gated pages stay hidden until the plan is known. */
    allowsPage: (id: string) => {
      const rule = PAGE_RULE[id];
      if (!rule) return true;
      return caps ? rule(caps) : q.isError;
    },
  };
}

const CACHE = "merchant_branding";
const FALLBACK_NAME = import.meta.env.VITE_STORE_NAME || "merchant";

function cachedBranding(): Branding | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE) || "null");
    return v && typeof v.name === "string" ? (v as Branding) : undefined;
  } catch {
    return undefined;
  }
}

export function rememberBranding(b: Branding) {
  try {
    localStorage.setItem(CACHE, JSON.stringify(b));
  } catch {
    /* storage unavailable */
  }
}

export function useBranding() {
  return useQuery({
    queryKey: ["branding"],
    queryFn: async () => {
      const b = await api.getBranding();
      rememberBranding(b);
      return b;
    },
    enabled: !!getAuth().apiUrl,
    staleTime: 60_000,
    retry: 0,
    placeholderData: cachedBranding(),
  });
}

/** The name and logo to show in the menu and on the sign-in page. */
export function useBrandView() {
  const { data } = useBranding();
  return { name: data?.name || FALLBACK_NAME, logo: data?.logo_url || "" };
}

function hexParts(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

export function applyAccent(hex: string) {
  const root = document.documentElement.style;
  const names = ["--accent", "--accent-hover", "--text-inverse"];
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    names.forEach((n) => root.removeProperty(n));
    return;
  }
  const [r, g, b] = hexParts(hex);
  const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
  const hover =
    "#" +
    [r, g, b]
      .map((v) =>
        Math.round(v * 0.88)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  root.setProperty("--accent", hex);
  root.setProperty("--accent-hover", hover);
  root.setProperty("--text-inverse", light ? "#1c1917" : "#ffffff");
}

/** Renders nothing; applies name (tab title), icon, colour and language. Mounted once, around the whole admin. */
export function BrandingEffect() {
  const { data } = useBranding();
  const { setLocale } = useLocale();
  const name = data?.name;
  const favicon = data?.favicon_url;
  const color = data?.primary_color ?? "";
  const language = data?.locale;

  useEffect(() => {
    if (name) {
      document.title = name;
      document
        .querySelector('meta[name="apple-mobile-web-app-title"]')
        ?.setAttribute("content", name);
    }
  }, [name]);
  useEffect(() => {
    if (!favicon) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.removeAttribute("type");
    link.href = favicon;
  }, [favicon]);
  useEffect(() => {
    if (data) applyAccent(color);
  }, [data, color]);
  useEffect(() => {
    // A language the person picked themselves always wins; the setting is only the starting language.
    if (language !== "fr" && language !== "en") return;
    try {
      if (!localStorage.getItem("locale")) setLocale(language);
    } catch {
      /* storage unavailable */
    }
  }, [language, setLocale]);
  return null;
}

// ── Texts of the plan and branding screens (kept here so the main dictionary stays untouched) ──
const TEXT = {
  fr: {
    limitTitle: "Non inclus dans votre offre",
    limitHelp:
      "Contactez votre prestataire pour passer à une offre supérieure.",
    notInPlan: "Cette page n'est pas disponible pour votre boutique.",
    close: "Fermer",
    planTitle: "Votre offre",
    products: "Produits",
    staff: "Comptes équipe",
    unlimited: "illimité",
    sells: "Vous vendez",
    physical: "Produits physiques",
    digital: "Produits numériques",
    service: "Services",
    upgrade: "Pour changer d’offre, contactez votre prestataire.",
    brandTitle: "Apparence de l’administration",
    brandHelp:
      "Nom, logo et couleur affichés dans ce tableau de bord et sur sa page de connexion.",
    name: "Nom",
    logo: "Adresse du logo (https://…)",
    favicon: "Adresse de l’icône de l’onglet (https://…)",
    color: "Couleur principale",
    colorNone: "Couleur par défaut",
    language: "Langue de départ",
    auto: "Automatique",
    save: "Enregistrer",
    saved: "Enregistré.",
    planSetup: "Offre du client",
    token: "Jeton d’installation (SETUP_TOKEN)",
    load: "Charger",
    tier: "Offre",
    extraModules: "Modules en plus de l’offre",
    maxProducts: "Limite de produits",
    maxStaff: "Limite de comptes équipe",
    tierDefault: "Valeur de l’offre",
    custom: "Nombre précis",
    setupHelp:
      "Réservé à l’agence. Le jeton n’est gardé que dans cette page, jamais enregistré.",
  },
  en: {
    limitTitle: "Not included in your plan",
    limitHelp: "Contact your provider to move to a higher plan.",
    notInPlan: "This page is not available for your shop.",
    close: "Close",
    planTitle: "Your plan",
    products: "Products",
    staff: "Staff accounts",
    unlimited: "unlimited",
    sells: "You sell",
    physical: "Physical products",
    digital: "Digital products",
    service: "Services",
    upgrade: "To change plan, contact your provider.",
    brandTitle: "Look of the admin",
    brandHelp:
      "Name, logo and colour shown in this dashboard and on its sign-in page.",
    name: "Name",
    logo: "Logo address (https://…)",
    favicon: "Tab icon address (https://…)",
    color: "Main colour",
    colorNone: "Default colour",
    language: "Starting language",
    auto: "Automatic",
    save: "Save",
    saved: "Saved.",
    planSetup: "Client plan",
    token: "Setup token (SETUP_TOKEN)",
    load: "Load",
    tier: "Plan",
    extraModules: "Modules on top of the plan",
    maxProducts: "Product limit",
    maxStaff: "Staff account limit",
    tierDefault: "Plan default",
    custom: "Exact number",
    setupHelp: "Agency only. The token stays in this page and is never saved.",
  },
} as const;
export type PlanTextKey = keyof (typeof TEXT)["en"];

export function usePT() {
  const { locale } = useLocale();
  return (k: PlanTextKey): string => TEXT[locale === "en" ? "en" : "fr"][k];
}
