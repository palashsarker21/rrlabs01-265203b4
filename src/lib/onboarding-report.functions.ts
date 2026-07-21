import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROVIDER_STEP_ORDER, type ProviderKind } from "@/lib/providers/kinds";

const activationFailureSchema = z.object({
  stepId: z.string(),
  label: z.string(),
  error: z.string(),
});

const activationTimelineEntrySchema = z.object({
  stepId: z.string(),
  label: z.string(),
  state: z.enum(["idle", "running", "success", "failed", "skipped"]),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
});

const inputSchema = z.object({
  workspaceId: z.string().uuid(),
  activationFailures: z.array(activationFailureSchema).optional(),
  activationTimeline: z.array(activationTimelineEntrySchema).optional(),
});

const KIND_LABEL: Record<ProviderKind, { label: string; required: boolean }> = {
  store: { label: "Store", required: true },
  gateway: { label: "Payment gateway", required: true },
  email: { label: "Email delivery", required: true },
  messaging: { label: "Messaging", required: false },
};

/**
 * Generate a downloadable PDF onboarding completion report for a workspace.
 * Returns { filename, base64, mimeType } so the client can trigger a download.
 */
export const generateOnboardingReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => inputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: workspace, error: wsErr } = await supabase
      .from("workspaces")
      .select("id, name, status, recovery_engine_enabled, setup_completed_at, created_at")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (wsErr) throw new Error(wsErr.message);
    if (!workspace) throw new Error("Workspace not found.");

    const { data: integrations = [], error: intErr } = await supabase
      .from("integrations")
      .select(
        "id, provider, status, verification_status, last_test_ok, last_verified_at, display_name, created_at",
      )
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: true });
    if (intErr) throw new Error(intErr.message);

    const { data: catalog = [], error: catErr } = await supabase
      .from("provider_catalog")
      .select("code, kind, name");
    if (catErr) throw new Error(catErr.message);

    const kindByProvider = new Map<string, ProviderKind>();
    const nameByProvider = new Map<string, string>();
    for (const p of catalog ?? []) {
      kindByProvider.set(p.code, p.kind as ProviderKind);
      nameByProvider.set(p.code, p.name);
    }

    const groups = PROVIDER_STEP_ORDER.map((step) => {
      const items = (integrations ?? [])
        .filter((i) => kindByProvider.get(i.provider) === step.kind)
        .map((i) => ({
          provider: nameByProvider.get(i.provider) ?? i.provider,
          status: i.status as string,
          verified:
            (i.verification_status === "verified" || i.last_test_ok === true) &&
            i.status === "connected",
          verifiedAt: i.last_verified_at as string | null,
        }));
      const connected = items.some((i) => i.verified);
      return { kind: step.kind, title: step.title, items, connected };
    });

    const requiredMissing = groups.filter((g) => KIND_LABEL[g.kind].required && !g.connected);
    const allReady = requiredMissing.length === 0;
    const engineActive = !!workspace.recovery_engine_enabled;

    // ---------- PDF ----------
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage([612, 792]); // Letter
    const { width, height } = page.getSize();
    const marginX = 48;
    let y = height - 56;

    const brand = rgb(0.055, 0.647, 0.514); // teal/green
    const text = rgb(0.09, 0.11, 0.14);
    const muted = rgb(0.45, 0.5, 0.55);
    const amber = rgb(0.85, 0.55, 0.05);
    const green = rgb(0.09, 0.65, 0.4);
    const red = rgb(0.82, 0.24, 0.24);
    const border = rgb(0.85, 0.87, 0.9);

    const ensureSpace = (needed: number) => {
      if (y - needed < 56) {
        page = pdf.addPage([612, 792]);
        y = height - 56;
      }
    };

    const drawText = (
      s: string,
      opts: { x?: number; size?: number; font?: typeof font; color?: ReturnType<typeof rgb> } = {},
    ) => {
      const f = opts.font ?? font;
      const size = opts.size ?? 11;
      page.drawText(s, {
        x: opts.x ?? marginX,
        y,
        size,
        font: f,
        color: opts.color ?? text,
      });
    };

    // Header band
    page.drawRectangle({
      x: 0,
      y: height - 8,
      width,
      height: 8,
      color: brand,
    });

    // Title
    y = height - 64;
    drawText("Onboarding Completion Report", { size: 22, font: bold });
    y -= 22;
    drawText("RRLabs Recovery Engine", { size: 11, color: muted });

    y -= 28;
    // Workspace summary block
    page.drawRectangle({
      x: marginX,
      y: y - 90,
      width: width - marginX * 2,
      height: 96,
      borderColor: border,
      borderWidth: 1,
      color: rgb(0.98, 0.99, 0.99),
    });
    const innerX = marginX + 16;
    let innerY = y - 8;
    page.drawText("Workspace", { x: innerX, y: innerY, size: 9, font: bold, color: muted });
    innerY -= 14;
    page.drawText(workspace.name ?? "—", {
      x: innerX,
      y: innerY,
      size: 14,
      font: bold,
      color: text,
    });
    innerY -= 20;

    const activationLabel = engineActive
      ? "ACTIVE"
      : allReady
        ? "READY TO ACTIVATE"
        : "SETUP INCOMPLETE";
    const activationColor = engineActive ? green : allReady ? brand : amber;
    page.drawText("Activation status", {
      x: innerX,
      y: innerY,
      size: 9,
      font: bold,
      color: muted,
    });
    innerY -= 14;
    page.drawText(activationLabel, {
      x: innerX,
      y: innerY,
      size: 12,
      font: bold,
      color: activationColor,
    });

    // Right side of block
    const rightX = width - marginX - 200;
    let rightY = y - 8;
    page.drawText("Generated", { x: rightX, y: rightY, size: 9, font: bold, color: muted });
    rightY -= 14;
    page.drawText(new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC", {
      x: rightX,
      y: rightY,
      size: 10,
      font,
      color: text,
    });
    rightY -= 18;
    page.drawText("Workspace ID", { x: rightX, y: rightY, size: 9, font: bold, color: muted });
    rightY -= 14;
    page.drawText(workspace.id, { x: rightX, y: rightY, size: 8, font, color: text });
    rightY -= 16;
    if (workspace.setup_completed_at) {
      page.drawText("Setup completed", { x: rightX, y: rightY, size: 9, font: bold, color: muted });
      rightY -= 14;
      page.drawText(
        new Date(workspace.setup_completed_at as string)
          .toISOString()
          .replace("T", " ")
          .slice(0, 19) + " UTC",
        { x: rightX, y: rightY, size: 9, font, color: text },
      );
    }

    y -= 110;

    // Summary bullets
    ensureSpace(60);
    drawText("Summary", { size: 13, font: bold });
    y -= 18;
    const summaryLine = engineActive
      ? "Recovery Engine is live. New failed payments are being captured automatically."
      : allReady
        ? "All required integrations are verified. Activation can be triggered from the app."
        : `${requiredMissing.length} required module${requiredMissing.length === 1 ? "" : "s"} still need setup: ${requiredMissing.map((g) => KIND_LABEL[g.kind].label).join(", ")}.`;
    // wrap
    for (const line of wrap(summaryLine, 90)) {
      drawText(line, { size: 10, color: muted });
      y -= 14;
    }

    y -= 10;

    // What's connected
    ensureSpace(30);
    drawText("What's connected", { size: 13, font: bold });
    y -= 6;
    page.drawLine({
      start: { x: marginX, y },
      end: { x: width - marginX, y },
      thickness: 0.5,
      color: border,
    });
    y -= 16;

    for (const g of groups) {
      ensureSpace(60);
      const meta = KIND_LABEL[g.kind];
      const badgeColor = g.connected ? green : meta.required ? amber : muted;
      const badgeText = g.connected ? "CONNECTED" : meta.required ? "REQUIRED" : "OPTIONAL";

      drawText(g.title, { size: 12, font: bold });
      // badge on the right
      const badgeWidth = bold.widthOfTextAtSize(badgeText, 8) + 12;
      page.drawRectangle({
        x: width - marginX - badgeWidth,
        y: y - 2,
        width: badgeWidth,
        height: 14,
        color: badgeColor,
        opacity: 0.15,
      });
      page.drawText(badgeText, {
        x: width - marginX - badgeWidth + 6,
        y: y + 1,
        size: 8,
        font: bold,
        color: badgeColor,
      });
      y -= 16;

      if (g.items.length === 0) {
        drawText(meta.required ? "  Not connected yet." : "  No provider connected.", {
          size: 10,
          color: muted,
        });
        y -= 14;
      } else {
        for (const it of g.items) {
          ensureSpace(16);
          const statusLabel = it.verified
            ? "Verified"
            : it.status === "connected"
              ? "Needs verification"
              : it.status;
          const statusColor = it.verified ? green : it.status === "connected" ? amber : red;
          drawText(`  • ${it.provider}`, { size: 10 });
          page.drawText(statusLabel, {
            x: width - marginX - font.widthOfTextAtSize(statusLabel, 9) - 4,
            y,
            size: 9,
            font: bold,
            color: statusColor,
          });
          y -= 14;
          if (it.verifiedAt) {
            drawText(
              `      Verified ${new Date(it.verifiedAt).toISOString().replace("T", " ").slice(0, 19)} UTC`,
              { size: 8, color: muted },
            );
            y -= 12;
          }
        }
      }
      y -= 6;
    }

    // Activation failures (only when the caller supplies them)
    const failures = data.activationFailures ?? [];
    if (failures.length > 0 && !engineActive) {
      y -= 6;
      ensureSpace(40);
      drawText("Activation failures", { size: 13, font: bold, color: red });
      y -= 6;
      page.drawLine({
        start: { x: marginX, y },
        end: { x: width - marginX, y },
        thickness: 0.5,
        color: border,
      });
      y -= 16;
      drawText(
        `The last activation attempt did not complete. ${failures.length} step${failures.length === 1 ? "" : "s"} failed:`,
        { size: 10, color: muted },
      );
      y -= 16;

      for (const f of failures) {
        ensureSpace(60);
        // Step label with red bullet
        page.drawCircle({ x: marginX + 4, y: y + 3, size: 2.5, color: red });
        drawText(`   ${f.label}`, { size: 11, font: bold });
        // step id badge
        const badgeText = f.stepId.toUpperCase();
        const badgeWidth = bold.widthOfTextAtSize(badgeText, 8) + 12;
        page.drawRectangle({
          x: width - marginX - badgeWidth,
          y: y - 2,
          width: badgeWidth,
          height: 14,
          color: red,
          opacity: 0.12,
        });
        page.drawText(badgeText, {
          x: width - marginX - badgeWidth + 6,
          y: y + 1,
          size: 8,
          font: bold,
          color: red,
        });
        y -= 16;

        // Error message, wrapped, verbatim
        drawText("      Error:", { size: 9, color: muted });
        y -= 12;
        for (const line of wrap(f.error, 82)) {
          ensureSpace(14);
          drawText(`      ${line}`, { size: 10, color: text });
          y -= 12;
        }
        y -= 6;
      }
    }

    // Activation timeline — chronological order of step start/finish
    const timeline = (data.activationTimeline ?? []).slice().sort((a, b) => {
      const at = a.startedAt ?? a.finishedAt ?? "";
      const bt = b.startedAt ?? b.finishedAt ?? "";
      return at.localeCompare(bt);
    });
    if (timeline.length > 0) {
      y -= 6;
      ensureSpace(40);
      drawText("Activation timeline", { size: 13, font: bold });
      y -= 6;
      page.drawLine({
        start: { x: marginX, y },
        end: { x: width - marginX, y },
        thickness: 0.5,
        color: border,
      });
      y -= 16;
      drawText("Chronological record of each activation step (times in UTC).", {
        size: 10,
        color: muted,
      });
      y -= 16;

      // Column headers
      const colStep = marginX;
      const colStart = marginX + 200;
      const colFinish = marginX + 330;
      const colDur = marginX + 440;
      const colState = width - marginX - 60;
      ensureSpace(20);
      page.drawText("Step", { x: colStep, y, size: 9, font: bold, color: muted });
      page.drawText("Started", { x: colStart, y, size: 9, font: bold, color: muted });
      page.drawText("Finished", { x: colFinish, y, size: 9, font: bold, color: muted });
      page.drawText("Duration", { x: colDur, y, size: 9, font: bold, color: muted });
      page.drawText("State", { x: colState, y, size: 9, font: bold, color: muted });
      y -= 6;
      page.drawLine({
        start: { x: marginX, y },
        end: { x: width - marginX, y },
        thickness: 0.5,
        color: border,
      });
      y -= 14;

      const fmt = (iso?: string) =>
        iso ? new Date(iso).toISOString().replace("T", " ").slice(11, 19) : "—";
      const fmtDate = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
      const duration = (a?: string, b?: string) => {
        if (!a || !b) return "—";
        const ms = new Date(b).getTime() - new Date(a).getTime();
        if (!Number.isFinite(ms) || ms < 0) return "—";
        if (ms < 1000) return `${ms}ms`;
        const s = ms / 1000;
        if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)}s`;
        const m = Math.floor(s / 60);
        const rem = Math.round(s - m * 60);
        return `${m}m ${rem}s`;
      };
      const stateColor = (st: string) =>
        st === "success"
          ? green
          : st === "failed"
            ? red
            : st === "skipped"
              ? muted
              : st === "running"
                ? amber
                : muted;

      let lastDate = "";
      for (const t of timeline) {
        ensureSpace(18);
        const day = fmtDate(t.startedAt ?? t.finishedAt);
        if (day && day !== lastDate) {
          drawText(day, { size: 8, color: muted });
          y -= 12;
          lastDate = day;
        }
        page.drawText(truncate(t.label, 30), {
          x: colStep,
          y,
          size: 10,
          font,
          color: text,
        });
        page.drawText(fmt(t.startedAt), {
          x: colStart,
          y,
          size: 9,
          font,
          color: text,
        });
        page.drawText(fmt(t.finishedAt), {
          x: colFinish,
          y,
          size: 9,
          font,
          color: text,
        });
        page.drawText(duration(t.startedAt, t.finishedAt), {
          x: colDur,
          y,
          size: 9,
          font,
          color: text,
        });
        const st = t.state.toUpperCase();
        page.drawText(st, {
          x: colState,
          y,
          size: 8,
          font: bold,
          color: stateColor(t.state),
        });
        y -= 14;
      }
    }

    // Footer note on last page
    ensureSpace(40);
    y -= 8;
    page.drawLine({
      start: { x: marginX, y },
      end: { x: width - marginX, y },
      thickness: 0.5,
      color: border,
    });
    y -= 14;
    drawText(
      "This report reflects the workspace state at generation time. Manage integrations at /integrations.",
      { size: 9, color: muted },
    );

    const bytes = await pdf.save();
    const base64 = Buffer.from(bytes).toString("base64");
    const safeName = (workspace.name ?? "workspace").replace(/[^a-z0-9-_]+/gi, "_");
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `rrlabs-onboarding-${safeName}-${stamp}.pdf`,
      mimeType: "application/pdf",
      base64,
    };
  });

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`;
}

function wrap(s: string, maxChars: number): string[] {
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
