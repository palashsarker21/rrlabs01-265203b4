import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";

export interface ConsentState {
  terms: boolean;
  dataProcessing: boolean;
  serviceComms: boolean;
}

export const initialConsent: ConsentState = {
  terms: false,
  dataProcessing: false,
  serviceComms: false,
};

export function allRequiredConsentsAccepted(c: ConsentState) {
  return c.terms && c.dataProcessing && c.serviceComms;
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
  children,
  disabled,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(Boolean(v))}
        aria-required
        disabled={disabled}
        className="mt-0.5"
      />
      <span className="text-foreground/90">{children}</span>
    </label>
  );
}

const linkClass = "underline underline-offset-4 hover:text-foreground";

export function ConsentCheckboxes({ value, onChange, disabled }: Props) {
  const set = (patch: Partial<ConsentState>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3">
      <Row
        id="consent-terms"
        checked={value.terms}
        onCheckedChange={(v) => set({ terms: v })}
        disabled={disabled}
      >
        I agree to the{" "}
        <Link to="/terms" className={linkClass} target="_blank" rel="noopener noreferrer">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link to="/privacy" className={linkClass} target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </Link>
        .
      </Row>
      <Row
        id="consent-data"
        checked={value.dataProcessing}
        onCheckedChange={(v) => set({ dataProcessing: v })}
        disabled={disabled}
      >
        I consent to the processing of my personal data as described in the{" "}
        <Link to="/privacy" className={linkClass} target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </Link>
        .
      </Row>
      <Row
        id="consent-service"
        checked={value.serviceComms}
        onCheckedChange={(v) => set({ serviceComms: v })}
        disabled={disabled}
      >
        I acknowledge and agree to receive{" "}
        <Link
          to="/communications-policy"
          className={linkClass}
          target="_blank"
          rel="noopener noreferrer"
        >
          essential service communications
        </Link>{" "}
        required to operate my account.
      </Row>
      <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
        Marketing emails, newsletters, WhatsApp, SMS, and product updates can be managed anytime
        from Account Settings → Notifications.
      </p>
    </div>
  );
}
