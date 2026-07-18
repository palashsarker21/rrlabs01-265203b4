import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getMyEmailPreferencesFn,
  updateMyEmailPreferencesFn,
} from "@/lib/email/preferences.functions";
import {
  EMAIL_CATEGORIES,
  EMAIL_CATEGORY_LABELS,
  type EmailCategory,
  type PreferenceMap,
} from "@/lib/email/preferences";

export const Route = createFileRoute("/_authenticated/settings/email-preferences")({
  head: () => ({
    meta: [{ title: "Email preferences — RRLabs" }],
  }),
  component: EmailPreferencesPage,
});

function EmailPreferencesPage() {
  const qc = useQueryClient();
  const load = useServerFn(getMyEmailPreferencesFn);
  const save = useServerFn(updateMyEmailPreferencesFn);

  const query = useQuery({
    queryKey: ["email-preferences", "me"],
    queryFn: () => load(),
    staleTime: 30_000,
  });

  const mutate = useMutation({
    mutationFn: (preferences: Partial<PreferenceMap>) => save({ data: { preferences } }),
    onSuccess: (res) => {
      if (res.ok) qc.setQueryData(["email-preferences", "me"], res);
    },
  });

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Email preferences</h1>
        <p className="text-sm text-muted-foreground">
          Choose which non-essential emails you'd like to keep receiving from
          RRLabs. Security-critical emails (payment failures, invitations,
          password resets, system alerts) always send.
        </p>
      </header>

      {query.isLoading && (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading…</div>
      )}
      {query.data && !query.data.ok && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {query.data.error === "no_email_on_account"
            ? "No email address is associated with your account."
            : "Could not load preferences."}
        </div>
      )}
      {query.data && query.data.ok && (() => {
        const { email, preferences } = query.data;
        return (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Managing preferences for <span className="font-mono">{email}</span>
            </div>
            <ul className="divide-y rounded-lg border">
              {EMAIL_CATEGORIES.map((c) => (
                <Row
                  key={c}
                  category={c}
                  checked={preferences[c] !== false}
                  disabled={mutate.isPending}
                  onChange={(next) => mutate.mutate({ [c]: next } as Partial<PreferenceMap>)}
                />
              ))}
            </ul>
            <div className="text-xs text-muted-foreground">
              {mutate.isPending ? "Saving…" : "Changes save automatically."}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Row({
  category,
  checked,
  disabled,
  onChange,
}: {
  category: EmailCategory;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  const meta = EMAIL_CATEGORY_LABELS[category];
  const id = `me-pref-${category}`;
  return (
    <li className="flex items-start gap-3 p-4">
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-input accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id} className="flex-1 cursor-pointer select-none">
        <div className="text-sm font-medium">{meta.label}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{meta.description}</div>
      </label>
    </li>
  );
}
