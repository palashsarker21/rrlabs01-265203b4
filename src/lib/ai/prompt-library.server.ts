/**
 * Prompt library — resolves the published version for a prompt slug and
 * renders `{{variables}}` from a data record.
 */

export interface RenderedPrompt {
  slug: string;
  version: number;
  system_prompt: string;
  user_prompt: string;
}

function render(template: string, vars: Record<string, unknown>): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, k: string) => {
    const raw = vars[k];
    if (raw == null) return "";
    return typeof raw === "string" ? raw : JSON.stringify(raw);
  });
}

export async function loadPublishedPrompt(slug: string): Promise<{
  system_prompt: string;
  user_template: string | null;
  version: number;
} | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lib } = await supabaseAdmin
    .from("ai_prompt_library")
    .select("id, active_version_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!lib?.active_version_id) return null;
  const { data: ver } = await supabaseAdmin
    .from("ai_prompt_versions")
    .select("version, system_prompt, user_template, status")
    .eq("id", lib.active_version_id)
    .maybeSingle();
  if (!ver || ver.status !== "published") return null;
  return {
    system_prompt: ver.system_prompt,
    user_template: ver.user_template,
    version: ver.version,
  };
}

export async function renderPrompt(
  slug: string,
  vars: Record<string, unknown>,
  fallback: { system: string; user: string },
): Promise<RenderedPrompt> {
  const published = await loadPublishedPrompt(slug);
  if (published) {
    return {
      slug,
      version: published.version,
      system_prompt: render(published.system_prompt, vars),
      user_prompt: render(published.user_template ?? fallback.user, vars),
    };
  }
  return {
    slug,
    version: 0,
    system_prompt: render(fallback.system, vars),
    user_prompt: render(fallback.user, vars),
  };
}
