import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  listWebhookDeliveries,
  getWebhookDelivery,
} from "@/lib/email-webhook-logs.functions";

export const Route = createFileRoute("/_authenticated/admin/email/webhooks")({
  head: () => ({
    meta: [{ title: "Email webhooks — Admin — RRLabs" }],
  }),
  component: WebhookLogsPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6">
      <h1 className="text-lg font-semibold">Couldn't load webhook logs</h1>
      <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
      <button className="mt-3 rounded-md border px-3 py-1.5 text-sm" onClick={() => reset()}>
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

type Outcome = "all" | "accepted" | "invalid_signature" | "unconfigured" | "bad_json" | "error";
type SigFilter = "any" | "valid" | "invalid";

const OUTCOME_LABEL: Record<Exclude<Outcome, "all">, string> = {
  accepted: "Accepted",
  invalid_signature: "Invalid signature",
  unconfigured: "Unconfigured",
  bad_json: "Bad JSON",
  error: "Error",
};

function OutcomeBadge({ outcome }: { outcome: string }) {
  const styles: Record<string, string> = {
    accepted: "bg-emerald-100 text-emerald-800",
    invalid_signature: "bg-rose-100 text-rose-800",
    unconfigured: "bg-amber-100 text-amber-800",
    bad_json: "bg-amber-100 text-amber-800",
    error: "bg-rose-100 text-rose-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[outcome] ?? "bg-muted text-foreground"
      }`}
    >
      {OUTCOME_LABEL[outcome as Exclude<Outcome, "all">] ?? outcome}
    </span>
  );
}

function WebhookLogsPage() {
  const listFn = useServerFn(listWebhookDeliveries);
  const getFn = useServerFn(getWebhookDelivery);

  const [outcome, setOutcome] = useState<Outcome>("all");
  const [eventType, setEventType] = useState("");
  const [messageId, setMessageId] = useState("");
  const [svixId, setSvixId] = useState("");
  const [signatureValid, setSignatureValid] = useState<SigFilter>("any");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const limit = 50;
  const filters = useMemo(
    () => ({ outcome, eventType, messageId, svixId, signatureValid, limit, offset: page * limit }),
    [outcome, eventType, messageId, svixId, signatureValid, page],
  );

  const list = useQuery({
    queryKey: ["email-webhook-logs", filters],
    queryFn: () => listFn({ data: filters }),
    refetchInterval: 15_000,
  });

  const detail = useQuery({
    enabled: !!selectedId,
    queryKey: ["email-webhook-log", selectedId],
    queryFn: () => getFn({ data: { id: selectedId! } }),
  });

  const counts = list.data?.counts ?? {};
  const total = list.data?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Email webhook deliveries</h1>
          <p className="text-sm text-muted-foreground">
            Inbound Resend (Svix) webhook attempts, signature verification, and processing
            outcomes. Auto-refreshes every 15 seconds.
          </p>
        </div>
        <a href="/admin/email" className="text-xs font-medium text-primary hover:underline">
          ← Back to Email admin
        </a>
      </header>

      <section className="flex flex-wrap gap-2">
        {(["all", "accepted", "invalid_signature", "unconfigured", "bad_json", "error"] as Outcome[]).map(
          (o) => (
            <button
              key={o}
              onClick={() => {
                setOutcome(o);
                setPage(0);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                outcome === o
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {o === "all" ? "All" : OUTCOME_LABEL[o as Exclude<Outcome, "all">]}{" "}
              <span className="opacity-70">({counts[o] ?? 0})</span>
            </button>
          ),
        )}
      </section>

      <section className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-4">
        <input
          className="rounded-md border px-3 py-2 text-sm"
          placeholder="Event type (e.g. email.bounced)"
          value={eventType}
          onChange={(e) => {
            setEventType(e.target.value);
            setPage(0);
          }}
        />
        <input
          className="rounded-md border px-3 py-2 text-sm"
          placeholder="Provider message id"
          value={messageId}
          onChange={(e) => {
            setMessageId(e.target.value);
            setPage(0);
          }}
        />
        <input
          className="rounded-md border px-3 py-2 text-sm"
          placeholder="Svix delivery id"
          value={svixId}
          onChange={(e) => {
            setSvixId(e.target.value);
            setPage(0);
          }}
        />
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={signatureValid}
          onChange={(e) => {
            setSignatureValid(e.target.value as SigFilter);
            setPage(0);
          }}
        >
          <option value="any">Signature: any</option>
          <option value="valid">Signature: valid</option>
          <option value="invalid">Signature: invalid</option>
        </select>
      </section>

      <section className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="py-2 px-3">Received</th>
              <th className="py-2 px-3">Outcome</th>
              <th className="py-2 px-3">HTTP</th>
              <th className="py-2 px-3">Sig</th>
              <th className="py-2 px-3">Event</th>
              <th className="py-2 px-3">Message id</th>
              <th className="py-2 px-3">Matched</th>
              <th className="py-2 px-3">Latency</th>
              <th className="py-2 px-3" />
            </tr>
          </thead>
          <tbody>
            {list.isLoading ? (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={9}>
                  Loading…
                </td>
              </tr>
            ) : list.data?.rows.length ? (
              list.data.rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="py-2 px-3 whitespace-nowrap">
                    {new Date(r.received_at).toLocaleString()}
                  </td>
                  <td className="py-2 px-3">
                    <OutcomeBadge outcome={r.outcome} />
                  </td>
                  <td className="py-2 px-3">{r.status_code}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.signature_valid
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {r.signature_valid ? "valid" : "invalid"}
                    </span>
                  </td>
                  <td className="py-2 px-3">{r.event_type ?? "—"}</td>
                  <td className="py-2 px-3 font-mono text-xs">
                    {r.provider_message_id ?? "—"}
                  </td>
                  <td className="py-2 px-3 font-mono text-xs">
                    {r.matched_log_id ? r.matched_log_id.slice(0, 8) : "—"}
                  </td>
                  <td className="py-2 px-3">{r.processing_ms != null ? `${r.processing_ms} ms` : "—"}</td>
                  <td className="py-2 px-3 text-right">
                    <button
                      className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                      onClick={() => setSelectedId(r.id)}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={9}>
                  No webhook deliveries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {list.data?.rows.length ?? 0} of {total}
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-md border px-2 py-1 disabled:opacity-50"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ← Prev
          </button>
          <button
            className="rounded-md border px-2 py-1 disabled:opacity-50"
            disabled={(page + 1) * limit >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      </div>

      {selectedId ? (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/30"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="h-full w-full max-w-2xl overflow-y-auto bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Webhook delivery</h2>
              <button
                className="rounded-md border px-2 py-1 text-xs"
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
            </div>
            {detail.isLoading ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
            ) : detail.data ? (
              <div className="mt-4 space-y-4 text-sm">
                <dl className="grid grid-cols-3 gap-2">
                  <dt className="text-muted-foreground">Received</dt>
                  <dd className="col-span-2">
                    {new Date(detail.data.received_at).toLocaleString()}
                  </dd>
                  <dt className="text-muted-foreground">Outcome</dt>
                  <dd className="col-span-2">
                    <OutcomeBadge outcome={detail.data.outcome} /> · HTTP {detail.data.status_code}
                  </dd>
                  <dt className="text-muted-foreground">Signature</dt>
                  <dd className="col-span-2">
                    {detail.data.signature_valid ? "valid" : "invalid"}
                  </dd>
                  <dt className="text-muted-foreground">Event</dt>
                  <dd className="col-span-2">{detail.data.event_type ?? "—"}</dd>
                  <dt className="text-muted-foreground">Svix id</dt>
                  <dd className="col-span-2 font-mono text-xs break-all">
                    {detail.data.svix_id ?? "—"}
                  </dd>
                  <dt className="text-muted-foreground">Svix ts</dt>
                  <dd className="col-span-2 font-mono text-xs">
                    {detail.data.svix_timestamp ?? "—"}
                  </dd>
                  <dt className="text-muted-foreground">Message id</dt>
                  <dd className="col-span-2 font-mono text-xs break-all">
                    {detail.data.provider_message_id ?? "—"}
                  </dd>
                  <dt className="text-muted-foreground">Matched log</dt>
                  <dd className="col-span-2 font-mono text-xs break-all">
                    {detail.data.matched_log_id ?? "—"}
                  </dd>
                  <dt className="text-muted-foreground">Processing</dt>
                  <dd className="col-span-2">
                    {detail.data.processing_ms != null ? `${detail.data.processing_ms} ms` : "—"}
                  </dd>
                </dl>

                {detail.data.error ? (
                  <div>
                    <h3 className="font-semibold text-rose-700">Error</h3>
                    <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-rose-50 p-2 text-xs text-rose-900">
                      {detail.data.error}
                    </pre>
                  </div>
                ) : null}

                <div>
                  <h3 className="font-semibold">Headers (redacted)</h3>
                  <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">
                    {JSON.stringify(detail.data.headers, null, 2)}
                  </pre>
                </div>

                <div>
                  <h3 className="font-semibold">Payload</h3>
                  <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">
                    {detail.data.payload
                      ? JSON.stringify(detail.data.payload, null, 2)
                      : detail.data.body_snippet ?? "—"}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
