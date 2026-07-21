const SELF_SERVE_PLAN_CODES = new Set(["starter", "growth", "business"]);

export type PlanVariantInput = {
  code: string;
  name: string;
  ls_variant_id: string | null;
};

export type ResolvedVariant = {
  id: string;
  source: "env" | "database" | "lemon_squeezy_discovery";
  productId?: string;
};

type LemonList<T> = {
  data?: Array<{ id?: string; attributes?: T }>;
  links?: { next?: string | null };
};

type LemonProductAttributes = {
  name?: string;
  store_id?: number | string;
};

type LemonVariantAttributes = {
  name?: string;
  status?: string;
  product_id?: number | string;
};

export function envVariantForPlan(code: string): string | undefined {
  const envVariantByCode: Record<string, string | undefined> = {
    starter: process.env.LEMONSQUEEZY_VARIANT_STARTER,
    growth: process.env.LEMONSQUEEZY_VARIANT_GROWTH,
    business: process.env.LEMONSQUEEZY_VARIANT_BUSINESS,
    scale: process.env.LEMONSQUEEZY_VARIANT_SCALE,
  };
  return envVariantByCode[code];
}

export function cleanVariantId(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v || v.startsWith("ls_variant_")) return null;
  return /^\d+$/.test(v) ? v : null;
}

export function lemonHeaders(apiKey: string): HeadersInit {
  return {
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    Authorization: `Bearer ${apiKey}`,
  };
}

export function isSelfServePlan(code: string): boolean {
  return SELF_SERVE_PLAN_CODES.has(code);
}

export async function resolveLemonSqueezyVariant({
  plan,
  apiKey,
  storeId,
}: {
  plan: PlanVariantInput;
  apiKey: string;
  storeId: string;
}): Promise<ResolvedVariant | null> {
  const envId = cleanVariantId(envVariantForPlan(plan.code));
  if (envId) return { id: envId, source: "env" };

  const dbId = cleanVariantId(plan.ls_variant_id);
  if (dbId) return { id: dbId, source: "database" };

  // Final production fallback: discover the published variant from the LS
  // store by matching the plan's code/name. This prevents stale DB placeholder
  // rows from disabling Starter/Growth/Business checkout.
  try {
    const products = await fetchLemonPages<LemonProductAttributes>(
      `https://api.lemonsqueezy.com/v1/products?filter[store_id]=${encodeURIComponent(storeId)}`,
      apiKey,
    );
    for (const product of products) {
      if (!product.id) continue;
      const variants = await fetchLemonPages<LemonVariantAttributes>(
        `https://api.lemonsqueezy.com/v1/variants?filter[product_id]=${encodeURIComponent(product.id)}`,
        apiKey,
      );
      const match = variants
        .filter((v) => v.id && isPublishedVariant(v.attributes?.status))
        .find((v) => variantMatchesPlan(v.attributes?.name, plan));
      if (match?.id) {
        return { id: match.id, source: "lemon_squeezy_discovery", productId: product.id };
      }
    }
  } catch (err) {
    console.error("[checkout] Lemon Squeezy variant discovery failed", {
      planCode: plan.code,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return null;
}

async function fetchLemonPages<T>(
  url: string,
  apiKey: string,
): Promise<Array<{ id?: string; attributes?: T }>> {
  const rows: Array<{ id?: string; attributes?: T }> = [];
  let next: string | null | undefined = url;
  for (let page = 0; next && page < 5; page += 1) {
    const res = await fetch(next, { headers: lemonHeaders(apiKey) });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Lemon Squeezy API ${res.status}: ${text}`);
    }
    const json = JSON.parse(text) as LemonList<T>;
    rows.push(...(json.data ?? []));
    next = json.links?.next;
  }
  return rows;
}

function isPublishedVariant(status: string | undefined): boolean {
  return !status || status === "published";
}

function variantMatchesPlan(variantName: string | undefined, plan: PlanVariantInput): boolean {
  const normalized = normalizePlanText(variantName);
  if (!normalized) return false;
  const aliases = new Set([normalizePlanText(plan.code), normalizePlanText(plan.name)]);
  if (plan.code === "business") aliases.add("scale");
  return aliases.has(normalized);
}

function normalizePlanText(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
