import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from "zod";

import {
  getPreferencesByTokenFn,
  unsubscribeAllByTokenFn,
  updatePreferencesByTokenFn,
} from "@/lib/email/preferences.functions";
import {
  EMAIL_CATEGORIES,
  EMAIL_CATEGORY_LABELS,
  type EmailCategory,
  type PreferenceMap,
} from "@/lib/email/preferences";

const search = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Email preferences — RRLabs" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const qc = useQueryClient();

  const getPrefs = useServerFn(getPreferencesByTokenFn);
  const setPrefs = useServerFn(updatePreferencesByTokenFn);
  const unsubAll = useServerFn(unsubscribeAllByTokenFn);

  const enabled = Boolean(token);
  const query = useQuery({
    queryKey: ["unsubscribe", token],
    queryFn: () => getPrefs({ data: { token: token! } }),
    enabled,
    staleTime: 60_000,
  });

  const update = useMutation({
    mutationFn: (preferences: Partial<PreferenceMap>) =>
      setPrefs({ data: { token: token!, preferences } }),
    onSuccess: (res) => {
      if (res.ok) qc.setQueryData(["unsubscribe", token], res);
    },
  });

  const unsubscribeEverything = useMutation({
    mutationFn: () => unsubAll({ data: { token: token! } }),
    onSuccess: (res) => {
      if (res.ok) qc.setQueryData(["unsubscribe", token], res);
    },
  });

  const state = useMemo(() => {
    if (!enabled) return { kind: "no-token" as const };
    if (query.isLoading) return { kind: "loading" as const };
    if (!query.data) return { kind: "loading" as const };
    if (!query.data.ok) return { kind: "invalid" as const };
    return {
      kind: "ready" as const,
      email: query.data.email,
      preferences: query.data.preferences,
    };
  }, [enabled, query.data, query.isLoading]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-4 py-16">
        <header className="mb-8">
          <div className="text-sm font-semibold text-primary">RRLabs</div>
          <h1 className="mt-1 text-2xl font-bold">Email preferences</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose which emails you'd like to keep receiving from RRLabs.
          </p>
        </header>

        {state.kind === "no-token" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            This link is missing its unsubscribe token. Open the "Unsubscribe or manage preferences"
            link at the bottom of any RRLabs email you've received.
          </div>
        )}

        {state.kind === "loading" && (
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">
            Loading your preferences…
          </div>
        )}

        {state.kind === "invalid" && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            This unsubscribe link is invalid or has expired. Please use the link in a recent email,
            or contact{" "}
            <a className="underline" href="mailto:support@rrlabs.online">
              support@rrlabs.online
            </a>
            .
          </div>
        )}

        {state.kind === "ready" && (
          <div className="space-y-6">
            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              Managing preferences for <span className="font-mono">{state.email}</span>
            </div>

            <ul className="divide-y rounded-lg border">
              {EMAIL_CATEGORIES.map((c) => (
                <PreferenceRow
                  key={c}
                  category={c}
                  checked={state.preferences[c] !== false}
                  disabled={update.isPending || unsubscribeEverything.isPending}
                  onChange={(next) => update.mutate({ [c]: next } as Partial<PreferenceMap>)}
                />
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                className="text-sm text-destructive underline underline-offset-4 hover:no-underline disabled:opacity-50"
                disabled={
                  unsubscribeEverything.isPending ||
                  EMAIL_CATEGORIES.every((c) => state.preferences[c] === false)
                }
                onClick={() => unsubscribeEverything.mutate()}
              >
                Unsubscribe from all non-essential emails
              </button>
              <div className="text-xs text-muted-foreground">
                {update.isPending || unsubscribeEverything.isPending
                  ? "Saving…"
                  : "Changes save automatically."}
              </div>
            </div>

            <p className="pt-4 text-xs text-muted-foreground">
              You'll still receive essential emails such as security alerts, payment failures,
              workspace invitations, and password resets. These cannot be turned off.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PreferenceRow({
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
  const id = `pref-${category}`;
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
