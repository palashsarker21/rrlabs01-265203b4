import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";

export interface ConsentState {
  terms: boolean;
  privacy: boolean;
  dataProcessing: boolean;
  serviceComms: boolean;
  marketing: boolean;
  whatsapp: boolean;
  sms: boolean;
  productUpdates: boolean;
}

export const initialConsent: ConsentState = {
  terms: false,
  privacy: false,
  dataProcessing: false,
  serviceComms: false,
  marketing: false,
  whatsapp: false,
  sms: false,
  productUpdates: false,
};

export function allRequiredConsentsAccepted(c: ConsentState) {
  return c.terms && c.privacy && c.dataProcessing && c.serviceComms;
}

interface Props {
  value: ConsentState;
  onChange: (next: ConsentState) => void;
  disabled?: boolean;
}

function Row({
  id,
  checked,
  onCheckedChange,
  required,
  children,
  disabled,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  required?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-muted-foreground"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(Boolean(v))}
        aria-required={required || undefined}
        disabled={disabled}
        className="mt-0.5"
      />
      <span className="text-foreground/90">{children}</span>
    </label>
  );
}

export function ConsentCheckboxes({ value, onChange, disabled }: Props) {
  const set = (patch: Partial<ConsentState>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Required
        </p>
        <Row
          id="consent-terms"
          checked={value.terms}
          onCheckedChange={(v) => set({ terms: v })}
          required
          disabled={disabled}
        >
          I agree to the{" "}
          <Link to="/terms" className="underline underline-offset-4 hover:text-foreground">
            Terms of Service
          </Link>
          .
        </Row>
        <Row
          id="consent-privacy"
          checked={value.privacy}
          onCheckedChange={(v) => set({ privacy: v })}
          required
          disabled={disabled}
        >
          I agree to the{" "}
          <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </Row>
        <Row
          id="consent-data"
          checked={value.dataProcessing}
          onCheckedChange={(v) => set({ dataProcessing: v })}
          required
          disabled={disabled}
        >
          I consent to the processing of my personal data in accordance with the{" "}
          <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </Row>
        <Row
          id="consent-service"
          checked={value.serviceComms}
          onCheckedChange={(v) => set({ serviceComms: v })}
          required
          disabled={disabled}
        >
          I understand that Revenue Recovery Labs may send essential service communications required
          to operate my account — including password resets, login verification, security and
          account-activity alerts, failed payment notifications, subscription renewal reminders,
          invoice notifications, recovery status updates, billing notifications, product changes
          affecting my account, and compliance notifications. These are operational communications
          and cannot be disabled while the account remains active.
        </Row>
      </div>

      <div className="space-y-2.5 border-t border-border/60 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Optional communication preferences
        </p>
        <Row
          id="consent-marketing"
          checked={value.marketing}
          onCheckedChange={(v) => set({ marketing: v })}
          disabled={disabled}
        >
          Send me product updates, feature announcements, educational content, newsletters,
          promotions, and marketing emails.
        </Row>
        <Row
          id="consent-whatsapp"
          checked={value.whatsapp}
          onCheckedChange={(v) => set({ whatsapp: v })}
          disabled={disabled}
        >
          Send me WhatsApp notifications related to my account, payment recovery, billing, and
          important account activity.
          <span className="mt-1 block text-[11px] text-muted-foreground">
            WhatsApp notifications are only used after a valid WhatsApp Business connection exists.
          </span>
        </Row>
        <Row
          id="consent-sms"
          checked={value.sms}
          onCheckedChange={(v) => set({ sms: v })}
          disabled={disabled}
        >
          Send me SMS notifications related to important account activity.
        </Row>
        <Row
          id="consent-product"
          checked={value.productUpdates}
          onCheckedChange={(v) => set({ productUpdates: v })}
          disabled={disabled}
        >
          Notify me when new AI recovery features, integrations, and platform improvements become
          available.
        </Row>
      </div>

      <p className="text-[11px] text-muted-foreground">
        You can update your communication preferences at any time from Account Settings.
      </p>
    </div>
  );
}
