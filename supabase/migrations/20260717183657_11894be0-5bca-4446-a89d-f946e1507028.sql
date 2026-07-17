
-- Enum for statement status
DO $$ BEGIN
  CREATE TYPE public.success_fee_status AS ENUM ('draft','finalized','invoiced','paid','voided');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.success_fee_adjustment_kind AS ENUM ('credit','debit','refund','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Statements table
CREATE TABLE IF NOT EXISTS public.success_fee_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  recovered_amount_cents bigint NOT NULL DEFAULT 0,
  events_count integer NOT NULL DEFAULT 0,
  fee_bps integer NOT NULL DEFAULT 0,
  fee_amount_cents bigint NOT NULL DEFAULT 0,
  adjustments_total_cents bigint NOT NULL DEFAULT 0,
  net_amount_cents bigint NOT NULL DEFAULT 0,
  status public.success_fee_status NOT NULL DEFAULT 'draft',
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  ls_invoice_id text,
  ls_checkout_url text,
  ls_order_id text,
  provider_error text,
  provider_status_code integer,
  finalized_at timestamptz,
  invoiced_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, period_start)
);

CREATE INDEX IF NOT EXISTS success_fee_statements_workspace_idx
  ON public.success_fee_statements (workspace_id, period_start DESC);
CREATE INDEX IF NOT EXISTS success_fee_statements_status_idx
  ON public.success_fee_statements (status);

GRANT SELECT ON public.success_fee_statements TO authenticated;
GRANT ALL ON public.success_fee_statements TO service_role;

ALTER TABLE public.success_fee_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "success_fee_statements_read_members"
  ON public.success_fee_statements
  FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_member(workspace_id, auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE TRIGGER success_fee_statements_updated_at
  BEFORE UPDATE ON public.success_fee_statements
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Adjustments table
CREATE TABLE IF NOT EXISTS public.success_fee_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES public.success_fee_statements(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind public.success_fee_adjustment_kind NOT NULL,
  amount_cents bigint NOT NULL,
  reason text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS success_fee_adjustments_statement_idx
  ON public.success_fee_adjustments (statement_id);

GRANT SELECT ON public.success_fee_adjustments TO authenticated;
GRANT ALL ON public.success_fee_adjustments TO service_role;

ALTER TABLE public.success_fee_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "success_fee_adjustments_read_members"
  ON public.success_fee_adjustments
  FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_member(workspace_id, auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- Helper: recompute totals for a statement
CREATE OR REPLACE FUNCTION public.recompute_success_fee_statement(_statement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _adj bigint;
BEGIN
  SELECT COALESCE(sum(
    CASE
      WHEN kind IN ('credit','refund') THEN -amount_cents
      ELSE amount_cents
    END
  ), 0)
  INTO _adj
  FROM public.success_fee_adjustments
  WHERE statement_id = _statement_id;

  UPDATE public.success_fee_statements
     SET adjustments_total_cents = _adj,
         net_amount_cents = GREATEST(0, fee_amount_cents + _adj),
         updated_at = now()
   WHERE id = _statement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_success_fee_statement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_success_fee_statement(uuid) TO service_role;
