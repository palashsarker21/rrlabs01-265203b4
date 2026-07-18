/**
 * Admin-only preview and test-send for reusable email templates.
 * - previewEmailTemplateFn: renders subject/html/text for a template + data payload
 * - sendTemplateTestFn: sends the rendered template to a real recipient via the send pipeline
 * Both are super_admin-gated to prevent arbitrary template blasting.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const dataSchema = z.record(z.string(), z.unknown()).default({});

export const previewEmailTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { template: string; data?: Record<string, unknown> }) =>
    z
      .object({
        template: z.string().min(1).max(64),
        data: dataSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { TEMPLATES, isTemplateName } = await import("./email/templates/registry");
    if (!isTemplateName(data.template)) {
      return { ok: false as const, error: "unknown_template" };
    }
    const React = (await import("react")).default;
    const { render } = await import("@react-email/render");
    const entry = TEMPLATES[data.template];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Component = entry.component as React.ComponentType<any>;
    const props = (data.data ?? {}) as object;
    try {
      const element = React.createElement(Component, props);
      const [html, text] = await Promise.all([
        render(element),
        render(element, { plainText: true }),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subject = entry.subject(props as any);
      return { ok: true as const, subject, html, text };
    } catch (err) {
      return {
        ok: false as const,
        error: "render_failed",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  });

export const sendTemplateTestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { template: string; to: string; data?: Record<string, unknown> }) =>
      z
        .object({
          template: z.string().min(1).max(64),
          to: z.string().trim().email().max(255),
          data: dataSchema.optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { isTemplateName } = await import("./email/templates/registry");
    if (!isTemplateName(data.template)) {
      return { ok: false as const, error: "unknown_template" };
    }
    const { sendEmail } = await import("./email/service.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sendEmail<any>({
      template: data.template,
      to: data.to,
      data: (data.data ?? {}) as never,
      idempotencyKey: `admin-preview-${data.template}-${context.userId}-${Date.now()}`,
      metadata: { source: "admin_preview", actor: context.userId },
    });
    return result;
  });
