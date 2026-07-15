-- Phase 3: Incident Management
CREATE TYPE public.incident_status AS ENUM ('investigating','identified','monitoring','resolved');
CREATE TYPE public.incident_impact AS ENUM ('none','minor','major','critical');

CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text,
  status public.incident_status NOT NULL DEFAULT 'investigating',
  impact public.incident_impact NOT NULL DEFAULT 'minor',
  affected_components text[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.incidents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public incidents visible" ON public.incidents
  FOR SELECT TO anon, authenticated USING (is_public = true);
CREATE POLICY "super admin manage incidents" ON public.incidents
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_incidents_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_incidents_status ON public.incidents(status);
CREATE INDEX idx_incidents_started_at ON public.incidents(started_at DESC);

CREATE TABLE public.incident_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  status public.incident_status NOT NULL,
  message text NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.incident_updates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_updates TO authenticated;
GRANT ALL ON public.incident_updates TO service_role;

ALTER TABLE public.incident_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public incident updates visible" ON public.incident_updates
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = incident_id AND i.is_public = true));
CREATE POLICY "super admin manage incident updates" ON public.incident_updates
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX idx_incident_updates_incident ON public.incident_updates(incident_id, created_at DESC);