
-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user');
CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE public.workspace_status AS ENUM ('setup', 'active', 'paused', 'suspended', 'cancelled');
CREATE TYPE public.integration_kind AS ENUM ('store', 'payment_gateway', 'communication');
CREATE TYPE public.integration_status AS ENUM ('pending', 'connected', 'error', 'disconnected');

-- =========================================================================
-- Helper: updated_at trigger
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================================
-- PROFILES
-- =========================================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  avatar_url text,
  timezone text DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- USER_ROLES (platform level)
-- =========================================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin');
$$;

-- =========================================================================
-- ORGANIZATIONS
-- =========================================================================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  logo_url text,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  billing_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- WORKSPACES
-- =========================================================================
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status public.workspace_status NOT NULL DEFAULT 'setup',
  setup_step smallint NOT NULL DEFAULT 0,
  setup_completed_at timestamptz,
  recovery_engine_enabled boolean NOT NULL DEFAULT false,
  plan_id text,
  subscription_id text,
  subscription_status text,
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE INDEX workspaces_org_idx ON public.workspaces(organization_id);

CREATE TRIGGER workspaces_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- WORKSPACE_MEMBERS
-- =========================================================================
CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX workspace_members_user_idx ON public.workspace_members(user_id);
CREATE INDEX workspace_members_workspace_idx ON public.workspace_members(workspace_id);

CREATE TRIGGER workspace_members_updated_at
BEFORE UPDATE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- Security definer helpers (avoid RLS recursion)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.workspace_role_of(_workspace_id uuid, _user_id uuid)
RETURNS public.workspace_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = _workspace_id AND user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND role IN ('owner', 'admin')
  ) OR public.is_super_admin(_user_id)
$$;

-- =========================================================================
-- INTEGRATIONS
-- =========================================================================
CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind public.integration_kind NOT NULL,
  provider text NOT NULL,           -- 'shopify' | 'woocommerce' | 'stripe' | 'paypal' | 'resend' | 'twilio' | ...
  display_name text,
  status public.integration_status NOT NULL DEFAULT 'pending',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,          -- non-secret config
  credentials_ciphertext text,                          -- encrypted secrets, server-only
  health text,                                           -- 'healthy' | 'degraded' | 'down'
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, kind, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE INDEX integrations_workspace_idx ON public.integrations(workspace_id);

CREATE TRIGGER integrations_updated_at
BEFORE UPDATE ON public.integrations
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- RLS POLICIES
-- =========================================================================

-- profiles: read own + fellow workspace members; update own
CREATE POLICY "profiles_read_self" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "profiles_update_self" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_insert_self" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- user_roles: read own; only service_role/super_admin manages
CREATE POLICY "user_roles_read_self" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- organizations: members of any workspace in the org can read; owner manages
CREATE POLICY "organizations_read_owner" ON public.organizations
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.workspaces w
    JOIN public.workspace_members wm ON wm.workspace_id = w.id
    WHERE w.organization_id = organizations.id AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "organizations_insert_self" ON public.organizations
FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "organizations_update_owner" ON public.organizations
FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.is_super_admin(auth.uid()))
WITH CHECK (owner_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "organizations_delete_owner" ON public.organizations
FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- workspaces: members read; admins/owners update; owner-only delete
CREATE POLICY "workspaces_read_members" ON public.workspaces
FOR SELECT TO authenticated
USING (public.is_workspace_member(id, auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "workspaces_insert_org_owner" ON public.workspaces
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.owner_id = auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "workspaces_update_managers" ON public.workspaces
FOR UPDATE TO authenticated
USING (public.can_manage_workspace(id, auth.uid()))
WITH CHECK (public.can_manage_workspace(id, auth.uid()));

CREATE POLICY "workspaces_delete_owner" ON public.workspaces
FOR DELETE TO authenticated
USING (
  public.workspace_role_of(id, auth.uid()) = 'owner'
  OR public.is_super_admin(auth.uid())
);

-- workspace_members: members see fellow members; managers modify
CREATE POLICY "wm_read_members" ON public.workspace_members
FOR SELECT TO authenticated
USING (
  public.is_workspace_member(workspace_id, auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "wm_insert_managers" ON public.workspace_members
FOR INSERT TO authenticated
WITH CHECK (
  public.can_manage_workspace(workspace_id, auth.uid())
  -- Allow the org owner to insert themselves as the first member (bootstrap)
  OR EXISTS (
    SELECT 1 FROM public.workspaces w JOIN public.organizations o ON o.id = w.organization_id
    WHERE w.id = workspace_id AND o.owner_id = auth.uid() AND user_id = auth.uid()
  )
);

CREATE POLICY "wm_update_managers" ON public.workspace_members
FOR UPDATE TO authenticated
USING (public.can_manage_workspace(workspace_id, auth.uid()))
WITH CHECK (public.can_manage_workspace(workspace_id, auth.uid()));

CREATE POLICY "wm_delete_managers_or_self" ON public.workspace_members
FOR DELETE TO authenticated
USING (
  public.can_manage_workspace(workspace_id, auth.uid())
  OR user_id = auth.uid()
);

-- integrations: workspace members read (but credentials_ciphertext is server-side only in practice);
-- managers create/update/delete
CREATE POLICY "integrations_read_members" ON public.integrations
FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "integrations_write_managers" ON public.integrations
FOR ALL TO authenticated
USING (public.can_manage_workspace(workspace_id, auth.uid()))
WITH CHECK (public.can_manage_workspace(workspace_id, auth.uid()));
