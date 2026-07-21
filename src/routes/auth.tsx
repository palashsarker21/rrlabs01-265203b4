import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AlertCircle, Copy, KeyRound, Loader2, ShieldCheck, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandMark } from "@/components/brand-mark";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrength, useCapsLock } from "@/components/auth/password-strength";
import {
  ConsentCheckboxes,
  allRequiredConsentsAccepted,
  initialConsent,
  type ConsentState,
} from "@/components/auth/consent-checkboxes";
import { AuthFooter } from "@/components/auth/auth-footer";
import {
  CONSENT_VERSION,
  evaluatePassword,
  generateStrongPassword,
  safeRedirectPath,
} from "@/lib/auth/password-policy";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["signin", "signup"]).optional(),
  reason: z.enum(["session_expired", "signed_out", "invalid_link"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — RRLabs" },
      { name: "description", content: "Sign in to your RRLabs workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const REMEMBER_KEY = "rrlabs.auth.remember-email";
const LAST_LOGIN_KEY = "rrlabs.auth.last-login";

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");

  // Shared
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [lastLogin, setLastLogin] = useState<string | null>(null);

  // Sign up specific
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState<ConsentState>(initialConsent);

  const emailRef = useRef<HTMLInputElement>(null);
  const capsOn = useCapsLock();

  const pwEval = useMemo(() => evaluatePassword(password), [password]);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSignUp =
    pwEval.strong &&
    passwordsMatch &&
    fullName.trim().length >= 2 &&
    email.trim().length > 3 &&
    allRequiredConsentsAccepted(consent) &&
    !loading;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: safeRedirectPath(search.redirect), replace: true });
      }
    });
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) setEmail(saved);
      const last = localStorage.getItem(LAST_LOGIN_KEY);
      if (last) setLastLogin(last);
    } catch {
      /* ignore */
    }
    setTimeout(() => emailRef.current?.focus(), 50);
  }, [navigate, search.redirect]);

  useEffect(() => {
    if (search.reason === "session_expired") {
      setBanner("Your session has expired. Please sign in again.");
    } else if (search.reason === "signed_out") {
      setBanner("You have been signed out.");
    } else if (search.reason === "invalid_link") {
      setBanner("That authentication link is invalid or has expired.");
    }
  }, [search.reason]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setFormError(null);

    if (mode === "signup") {
      if (!pwEval.strong) {
        setFormError("Please choose a password that meets all requirements.");
        return;
      }
      if (!passwordsMatch) {
        setFormError("Passwords do not match.");
        return;
      }
      if (!allRequiredConsentsAccepted(consent)) {
        setFormError("Please accept all required consents to create your account.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/verify-email`,
            data: {
              full_name: fullName.trim(),
              display_name: fullName.trim() || email.split("@")[0],
              accepted_terms: consent.terms,
              accepted_privacy: consent.terms,
              accepted_data_processing: consent.dataProcessing,
              accepted_service_comms: consent.serviceComms,
              marketing_email_opt_in: false,
              whatsapp_notifications_opt_in: false,
              sms_notifications_opt_in: false,
              product_updates_opt_in: false,
              consent_version: CONSENT_VERSION,
              consent_user_agent:
                typeof navigator !== "undefined" ? navigator.userAgent : undefined,
            },
          },
        });
        if (error) throw error;
        toast.success("Account created. Check your inbox to verify your email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
        try {
          localStorage.setItem(LAST_LOGIN_KEY, new Date().toISOString());
        } catch {
          /* ignore */
        }
      }

      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* ignore */
      }

      navigate({ to: safeRedirectPath(search.redirect), replace: true });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Authentication failed";
      const safe =
        mode === "signin" && /invalid|credentials|password/i.test(raw)
          ? "Invalid email or password."
          : raw;
      setFormError(safe);
      toast.error(safe);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (googleLoading) return;
    setGoogleLoading(true);
    setFormError(null);
    try {
      const redirectTo = `${window.location.origin}${safeRedirectPath(search.redirect)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      setFormError(message);
      toast.error(message);
    } finally {
      setGoogleLoading(false);
    }
  }

  function handleGeneratePassword() {
    const pw = generateStrongPassword(16);
    setPassword(pw);
    setConfirmPassword(pw);
    toast.success("Strong password generated.");
  }

  async function handleCopyPassword() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Password copied to clipboard.");
    } catch {
      toast.error("Unable to copy — please copy manually.");
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 20% 10%, hsl(var(--primary) / 0.18), transparent 40%), radial-gradient(circle at 85% 90%, hsl(var(--chart-3) / 0.15), transparent 45%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark size={44} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Revenue Recovery Labs
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Recover failed subscription payments automatically.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/60 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            {banner && (
              <div
                role="status"
                aria-live="polite"
                className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{banner}</span>
              </div>
            )}

            {formError && (
              <div
                role="alert"
                aria-live="assertive"
                className="mt-4 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{formError}</span>
              </div>
            )}

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
                <EmailField email={email} setEmail={setEmail} inputRef={emailRef} />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <PasswordInput
                    id="password"
                    autoComplete="current-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  {capsOn && (
                    <p className="text-xs text-amber-600 dark:text-amber-400" aria-live="polite">
                      Caps Lock is on.
                    </p>
                  )}
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={remember}
                    onCheckedChange={(v) => setRemember(Boolean(v))}
                    aria-label="Remember my email on this device"
                  />
                  Remember me on this device
                </label>
                {lastLogin && (
                  <p className="text-xs text-muted-foreground">
                    Last sign-in on this device:{" "}
                    <time dateTime={lastLogin}>
                      {new Date(lastLogin).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Signing in…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="full-name">Full name</Label>
                  <Input
                    id="full-name"
                    autoComplete="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    aria-required
                  />
                </div>
                <EmailField email={email} setEmail={setEmail} />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="new-password">Password</Label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Sparkles className="h-3 w-3" aria-hidden />
                        Generate
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyPassword}
                        disabled={!password}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Copy password to clipboard"
                      >
                        <Copy className="h-3 w-3" aria-hidden />
                        Copy
                      </button>
                    </div>
                  </div>
                  <PasswordInput
                    id="new-password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    aria-describedby="password-strength"
                    aria-invalid={password.length > 0 && !pwEval.strong}
                  />
                  {capsOn && (
                    <p className="text-xs text-amber-600 dark:text-amber-400" aria-live="polite">
                      Caps Lock is on.
                    </p>
                  )}
                  <div id="password-strength">
                    <PasswordStrength password={password} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <PasswordInput
                    id="confirm-password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat the password"
                    aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                  />
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-destructive" aria-live="polite">
                      Passwords do not match.
                    </p>
                  )}
                </div>

                <ConsentCheckboxes value={consent} onChange={setConsent} disabled={loading} />

                <Button type="submit" className="w-full" disabled={!canSignUp}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Creating account…
                    </>
                  ) : (
                    <>
                      <KeyRound className="mr-2 h-4 w-4" aria-hidden />
                      Create account
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <GoogleIcon className="mr-2 h-4 w-4" />
                Continue with Google
              </>
            )}
          </Button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Encrypted end-to-end · SOC 2-ready foundation
        </div>

        <AuthFooter />
      </div>
    </div>
  );
}

function EmailField({
  email,
  setEmail,
  inputRef,
}: {
  email: string;
  setEmail: (v: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="email">Work email</Label>
      <Input
        id="email"
        ref={inputRef}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        inputMode="email"
        spellCheck={false}
        autoCapitalize="off"
      />
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.2-5.5 4.2-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.9 3.6 14.6 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}
