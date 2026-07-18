import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { listEmailTemplates } from "@/lib/email.functions";
import {
  previewEmailTemplateFn,
  sendTemplateTestFn,
} from "@/lib/email-preview.functions";
import { TEMPLATE_SAMPLES } from "@/lib/email/template-samples";

export const Route = createFileRoute("/_authenticated/admin/email.preview")({
  head: () => ({
    meta: [{ title: "Email templates — Admin — RRLabs" }],
  }),
  component: EmailPreviewPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6">
      <h1 className="text-lg font-semibold">Couldn't load template preview</h1>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      <button className="mt-3 rounded-md border px-3 py-1.5 text-sm" onClick={() => reset()}>
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

function EmailPreviewPage() {
  const listTpl = useServerFn(listEmailTemplates);
  const previewFn = useServerFn(previewEmailTemplateFn);
  const sendFn = useServerFn(sendTemplateTestFn);

  const templatesQ = useQuery({
    queryKey: ["email", "templates"],
    queryFn: () => listTpl(),
  });

  const templates = templatesQ.data?.templates ?? [];
  const [selected, setSelected] = useState<string>("welcome");
  const [dataText, setDataText] = useState<string>(() =>
    JSON.stringify(TEMPLATE_SAMPLES["welcome"]?.data ?? {}, null, 2),
  );
  const [recipient, setRecipient] = useState<string>("");
  const [sendResult, setSendResult] = useState<string | null>(null);

  // When template changes, load its sample data
  useEffect(() => {
    const sample = TEMPLATE_SAMPLES[selected]?.data ?? {};
    setDataText(JSON.stringify(sample, null, 2));
    setSendResult(null);
  }, [selected]);

  const parsed = useMemo(() => {
    try {
      const value = JSON.parse(dataText || "{}");
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return { ok: false as const, error: "Data must be a JSON object." };
      }
      return { ok: true as const, value: value as Record<string, unknown> };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Invalid JSON.",
      };
    }
  }, [dataText]);

  const preview = useMutation({
    mutationFn: () =>
      previewFn({
        data: { template: selected, data: parsed.ok ? parsed.value : {} },
      }),
  });

  const send = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          template: selected,
          to: recipient,
          data: parsed.ok ? parsed.value : {},
        },
      }),
    onSuccess: (res) => {
      if (res && "ok" in res && res.ok) {
        if ("skipped" in res && res.skipped) {
          setSendResult(`Skipped (${res.reason ?? "skipped"}).`);
        } else {
          setSendResult("Sent. Check the recipient inbox and Admin > Email logs.");
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = (res as any)?.error ?? "Send failed.";
        setSendResult(String(err));
      }
    },
    onError: (err: unknown) => {
      setSendResult(err instanceof Error ? err.message : "Send failed.");
    },
  });

  // Auto-render on mount and whenever inputs change and are valid.
  useEffect(() => {
    if (parsed.ok) preview.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, dataText]);

  const previewData = preview.data;
  const previewHtml =
    previewData && "ok" in previewData && previewData.ok ? previewData.html : "";
  const previewSubject =
    previewData && "ok" in previewData && previewData.ok ? previewData.subject : "";
  const previewText =
    previewData && "ok" in previewData && previewData.ok ? previewData.text : "";
  const previewError =
    previewData && "ok" in previewData && !previewData.ok
      ? "message" in previewData
        ? (previewData as { message?: string }).message ?? previewData.error
        : previewData.error
      : null;

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Email templates</h1>
          <p className="text-sm text-muted-foreground">
            Preview every reusable React Email template with sample data, then send a test to yourself before rolling it out.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Left column — inputs */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Template</label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={templatesQ.isLoading}
            >
              {(templates.length ? templates : Object.values(TEMPLATE_SAMPLES)).map((t) => (
                <option key={t.name} value={t.name}>
                  {t.displayName} — {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Sample data (JSON)
              </label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() =>
                  setDataText(
                    JSON.stringify(TEMPLATE_SAMPLES[selected]?.data ?? {}, null, 2),
                  )
                }
              >
                Reset to sample
              </button>
            </div>
            <textarea
              className="mt-1 h-64 w-full rounded-md border bg-background p-3 font-mono text-xs"
              spellCheck={false}
              value={dataText}
              onChange={(e) => setDataText(e.target.value)}
            />
            {!parsed.ok && (
              <div className="mt-1 text-xs text-destructive">Invalid JSON: {parsed.error}</div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Send test to</label>
            <input
              type="email"
              placeholder="you@example.com"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            <button
              type="button"
              className="mt-2 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={
                !parsed.ok ||
                send.isPending ||
                !recipient ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)
              }
              onClick={() => {
                setSendResult(null);
                send.mutate();
              }}
            >
              {send.isPending ? "Sending…" : "Send test email"}
            </button>
            {sendResult && (
              <div className="mt-2 text-xs text-muted-foreground">{sendResult}</div>
            )}
          </div>
        </div>

        {/* Right column — preview */}
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">Subject</div>
            <div className="mt-0.5 font-medium">{previewSubject || "—"}</div>
          </div>

          {previewError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              Render error: {previewError}
            </div>
          )}

          <div className="overflow-hidden rounded-md border bg-white">
            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span>HTML preview</span>
              {preview.isPending && <span>Rendering…</span>}
            </div>
            <iframe
              title="Email preview"
              className="h-[720px] w-full bg-white"
              sandbox=""
              srcDoc={previewHtml || "<html><body style='font-family:system-ui;padding:24px;color:#64748b'>Preview will render here…</body></html>"}
            />
          </div>

          <details className="rounded-md border bg-muted/40 p-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Plain-text version
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs">{previewText || "—"}</pre>
          </details>
        </div>
      </div>
    </div>
  );
}
