import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowRight, CheckCircle2, Mail, Phone, ShieldCheck } from "lucide-react";

import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitContactLead } from "@/lib/contact.functions";
import { CONTACT, SITE_URL } from "@/lib/brand";

const searchSchema = z.object({
  plan: z.string().optional(),
});

export const Route = createFileRoute("/contact-sales")({
  validateSearch: (raw) => searchSchema.parse(raw),
  head: () => ({
    meta: [
      { title: "Contact Sales — Enterprise revenue recovery | RRLabs" },
      {
        name: "description",
        content:
          "Talk to the RRLabs enterprise team about white-label, dedicated infrastructure, custom AI, and volume pricing.",
      },
      { property: "og:title", content: "Contact RRLabs Sales" },
      {
        property: "og:description",
        content:
          "Enterprise revenue recovery for high-volume SaaS. White-label, dedicated infrastructure, custom SLAs.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/contact-sales` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/contact-sales` }],
  }),
  component: ContactSalesPage,
});

const ARR_RANGES = [
  "Under $1M",
  "$1M – $5M",
  "$5M – $25M",
  "$25M – $100M",
  "$100M+",
];
const SEAT_RANGES = ["1 – 10", "11 – 50", "51 – 200", "200 – 1000", "1000+"];

function ContactSalesPage() {
  const { plan } = useSearch({ from: "/contact-sales" });
  const submit = useServerFn(submitContactLead);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    role: "",
    seats: SEAT_RANGES[1],
    arrRange: ARR_RANGES[1],
    useCase: "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Please add your name and work email.");
      return;
    }
    setSubmitting(true);
    try {
      await submit({
        data: {
          ...form,
          planCode: plan ?? "enterprise",
          source: "contact-sales",
        },
      });
      setDone(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not submit your inquiry.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <MarketingHeader />

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 shadow-sm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Enterprise
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
            Let's talk enterprise revenue recovery.
          </h1>
          <p className="mt-4 max-w-lg text-lg text-neutral-600">
            White-label, dedicated infrastructure, custom AI environments, and enterprise SLAs —
            purpose-built for high-volume SaaS and marketplaces.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-neutral-700">
            {[
              "Starting at $999/month + from 2% success fee",
              "Dedicated engineer & customer success manager",
              "Custom integrations, unlimited stores, SSO",
              "SOC 2-ready · GDPR · role-based access + audit logs",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-2xl border border-neutral-200 bg-neutral-50/50 p-5 text-sm text-neutral-700">
            <p className="font-medium text-neutral-900">Prefer to reach out directly?</p>
            <a
              href={`mailto:${CONTACT.supportEmail}?subject=Enterprise%20inquiry`}
              className="mt-2 flex items-center gap-2 text-neutral-800 hover:text-emerald-700"
            >
              <Mail className="h-4 w-4" /> {CONTACT.supportEmail}
            </a>
            {CONTACT.phones.map((p) => (
              <a
                key={p}
                href={`tel:${p}`}
                className="mt-1 flex items-center gap-2 text-neutral-800 hover:text-emerald-700"
              >
                <Phone className="h-4 w-4" /> {p}
              </a>
            ))}
          </div>
        </div>

        <div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-8">
            {done ? (
              <div className="py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-6 w-6 text-emerald-700" />
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-neutral-950">
                  Thanks — we'll be in touch.
                </h2>
                <p className="mt-2 text-sm text-neutral-600">
                  A member of our enterprise team will reach out within one business day.
                </p>
                <Link to="/" className="mt-6 inline-block">
                  <Button className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700">
                    Back to home
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="name">
                    <Input
                      id="name"
                      required
                      autoComplete="name"
                      maxLength={120}
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </Field>
                  <Field label="Work email" htmlFor="email">
                    <Input
                      id="email"
                      required
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company" htmlFor="company">
                    <Input
                      id="company"
                      autoComplete="organization"
                      maxLength={160}
                      value={form.company}
                      onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    />
                  </Field>
                  <Field label="Your role" htmlFor="role">
                    <Input
                      id="role"
                      maxLength={80}
                      placeholder="Head of Payments"
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Team size" htmlFor="seats">
                    <select
                      id="seats"
                      value={form.seats}
                      onChange={(e) => setForm((f) => ({ ...f, seats: e.target.value }))}
                      className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
                    >
                      {SEAT_RANGES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Annual revenue" htmlFor="arr">
                    <select
                      id="arr"
                      value={form.arrRange}
                      onChange={(e) => setForm((f) => ({ ...f, arrRange: e.target.value }))}
                      className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
                    >
                      {ARR_RANGES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="What are you trying to solve?" htmlFor="useCase">
                  <Textarea
                    id="useCase"
                    rows={4}
                    maxLength={4000}
                    placeholder="Volume of failed payments, current stack, timeline…"
                    value={form.useCase}
                    onChange={(e) => setForm((f) => ({ ...f, useCase: e.target.value }))}
                  />
                </Field>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                  size="lg"
                >
                  {submitting ? "Sending…" : "Talk to Sales"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>

                <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  We'll never share your information. Read our{" "}
                  <Link to="/privacy" className="underline hover:text-neutral-800">
                    privacy policy
                  </Link>
                  .
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="text-sm text-neutral-800">
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
