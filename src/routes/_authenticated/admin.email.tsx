import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getEmailConfigStatus,
  sendTestEmail,
  listEmailLogs,
  listEmailTemplates,
} from "@/lib/email.functions";

export const Route = createFileRoute("/_authenticated/admin/email")({
  head: () => ({
    meta: [{ title: "Email — Admin — RRLabs" }],
  }),
  component: AdminEmailPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6">
      <h1 className="text-lg font-semibold">Couldn't load email settings</h1>
      <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
      <button className="mt-3 rounded-md border px-3 py-1.5 text-sm" onClick={() => reset()}>
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {label}
    </span>
  );
}

function AdminEmailPage() {
  const qc = useQueryClient();
  const getStatus = useServerFn(getEmailConfigStatus);
  const listLogs = useServerFn(listEmailLogs);
  const listTpl = useServerFn(listEmailTemplates);
  const testFn = useServerFn(sendTestEmail);

  const status = useQuery({ queryKey: ["email", "status"], queryFn: () => getStatus() });
  const logs = useQuery({
    queryKey: ["email", "logs"],
    queryFn: () => listLogs({ data: { limit: 50 } }),
  });
  const templates = useQuery({
    queryKey: ["email", "templates"],
    queryFn: () => listTpl(),
  });

  const [to, setTo] = useState("");
  const [tpl, setTpl] = useState("welcome");
  const [message, setMessage] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: (input: { to: string; template: string }) =>
      testFn({ data: input }),
    onSuccess: (res) => {
      setMessage(res.ok ? `Sent (id ${res.id}).` : `Failed: ${res.error}`);
      qc.invalidateQueries({ queryKey: ["email", "logs"] });
    },
    onError: (err) => setMessage((err as Error).message),
  });

  const s = status.data;

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Email settings</h1>
        <p className="text-sm text-muted-foreground">
          Transactional email is powered by Resend. Configure DNS at your domain
          registrar and add the API key as an environment secret.
        </p>
      </header>

      <section className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Configuration</h2>
          {s ? (
            <Badge ok={s.configured} label={s.configured ? "Configured" : "Not configured"} />
          ) : null}
        </div>
        {status.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : s?.configured ? (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">From</dt>
            <dd>{s.from}</dd>
            <dt className="text-muted-foreground">Domain</dt>
            <dd>{s.domain}</dd>
            <dt className="text-muted-foreground">Webhook</dt>
            <dd>{s.webhook_configured ? "Configured" : "Not configured"}</dd>
          </dl>
        ) : (
          <p className="text-sm text-amber-800">
            Email service unavailable. Add the required environment secrets to
            enable sending. Details are in server logs.
          </p>
        )}
      </section>

      {s?.configured ? (
        <section className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold">DNS verification (SPF, DKIM, DMARC)</h2>
          <div className="space-y-2">
            {s.dns.map((d) => (
              <div key={d.record} className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{d.record}</span>
                  <Badge ok={d.valid} label={d.valid ? "Valid" : d.found ? "Found, invalid" : "Missing"} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{d.host}</p>
                {d.value ? (
                  <pre className="mt-2 whitespace-pre-wrap break-all text-xs bg-muted rounded p-2">
                    {d.value}
                  </pre>
                ) : null}
                {d.note ? <p className="text-xs text-amber-700 mt-1">{d.note}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Send test email</h2>
          <div className="flex flex-wrap items-center gap-3">
            <a href="/admin/email/deliveries" className="text-xs font-medium text-primary hover:underline">
              Deliveries & replays →
            </a>
            <a href="/admin/email/webhooks" className="text-xs font-medium text-primary hover:underline">
              Webhook deliveries →
            </a>
            <a href="/admin/email/sandbox" className="text-xs font-medium text-primary hover:underline">
              Open test sandbox →
            </a>
            <a
              href="/admin/email/preview"
              className="text-xs font-medium text-primary hover:underline"
            >
              Open template preview →
            </a>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-md border px-3 py-2 text-sm"
            placeholder="you@example.com"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={tpl}
            onChange={(e) => setTpl(e.target.value)}
          >
            <option value="welcome">Welcome</option>
            <option value="system-alert">System Alert</option>
          </select>
          <button
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={!to || send.isPending || !s?.configured}
            onClick={() => send.mutate({ to, template: tpl })}
          >
            {send.isPending ? "Sending…" : "Send test email"}
          </button>
        </div>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="font-semibold">Email history</h2>
        {logs.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : logs.data?.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Template</th>
                  <th className="py-2 pr-3">Recipient</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Attempts</th>
                </tr>
              </thead>
              <tbody>
                {logs.data.rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3">{r.template}</td>
                    <td className="py-2 pr-3">{r.recipient}</td>
                    <td className="py-2 pr-3">
                      <Badge
                        ok={["sent", "delivered"].includes(r.status)}
                        label={r.status}
                      />
                    </td>
                    <td className="py-2 pr-3">{r.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No emails sent yet.</p>
        )}
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold mb-2">Available templates</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
          {templates.data?.templates.map((t) => (
            <li key={t.name} className="flex justify-between border-b py-1">
              <span>{t.displayName}</span>
              <code className="text-xs text-muted-foreground">{t.name}</code>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
