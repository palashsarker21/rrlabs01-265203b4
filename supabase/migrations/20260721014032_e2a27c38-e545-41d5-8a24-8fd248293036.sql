
-- Enums
DO $$ BEGIN CREATE TYPE public.support_status AS ENUM ('open','pending','waiting','resolved','closed','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.support_priority AS ENUM ('low','normal','high','urgent','critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.support_category AS ENUM ('general','billing','technical','integration','recovery_engine','bug_report','feature_request','security','account','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.support_presence_status AS ENUM ('online','available','busy','away','offline'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.support_message_kind AS ENUM ('text','system','note'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.support_delivery_status AS ENUM ('sending','sent','delivered','seen','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.support_feedback_rating AS ENUM ('very_unsatisfied','unsatisfied','neutral','satisfied','very_satisfied'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Staff-check helper (uses now-committed enum values)
CREATE OR REPLACE FUNCTION public.is_support_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('support_agent'::public.app_role,'moderator'::public.app_role,'admin'::public.app_role,'super_admin'::public.app_role)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_support_staff(uuid) FROM anon;

-- support_conversations
CREATE TABLE IF NOT EXISTS public.support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  subject text,
  status public.support_status NOT NULL DEFAULT 'open',
  priority public.support_priority NOT NULL DEFAULT 'normal',
  category public.support_category NOT NULL DEFAULT 'general',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pinned boolean NOT NULL DEFAULT false,
  important boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  last_message_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  unread_customer int NOT NULL DEFAULT 0,
  unread_staff int NOT NULL DEFAULT 0,
  ai_summary jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_conversations TO authenticated;
GRANT ALL ON public.support_conversations TO service_role;
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_reads_own_conversation" ON public.support_conversations
  FOR SELECT TO authenticated USING (customer_id = auth.uid() OR public.is_support_staff(auth.uid()));
CREATE POLICY "customer_creates_own_conversation" ON public.support_conversations
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "staff_or_customer_updates_conversation" ON public.support_conversations
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid() OR public.is_support_staff(auth.uid()))
  WITH CHECK (customer_id = auth.uid() OR public.is_support_staff(auth.uid()));
CREATE POLICY "staff_deletes_conversation" ON public.support_conversations
  FOR DELETE TO authenticated USING (public.is_support_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_support_conv_customer ON public.support_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_conv_assigned ON public.support_conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_conv_status ON public.support_conversations(status);
CREATE INDEX IF NOT EXISTS idx_support_conv_updated ON public.support_conversations(updated_at DESC);
CREATE TRIGGER trg_support_conv_updated BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Visibility helper
CREATE OR REPLACE FUNCTION public.can_view_support_conversation(_conv_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_conversations
    WHERE id = _conv_id
      AND (customer_id = _user_id OR public.is_support_staff(_user_id))
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_support_conversation(uuid, uuid) FROM anon;

-- support_messages
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind public.support_message_kind NOT NULL DEFAULT 'text',
  body text NOT NULL DEFAULT '',
  delivery_status public.support_delivery_status NOT NULL DEFAULT 'sent',
  is_staff boolean NOT NULL DEFAULT false,
  seen_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_messages_in_visible_conversation" ON public.support_messages
  FOR SELECT TO authenticated USING (public.can_view_support_conversation(conversation_id, auth.uid()));
CREATE POLICY "insert_messages_in_visible_conversation" ON public.support_messages
  FOR INSERT TO authenticated WITH CHECK (
    public.can_view_support_conversation(conversation_id, auth.uid())
    AND (sender_id = auth.uid() OR sender_id IS NULL)
  );
CREATE POLICY "edit_own_message_or_staff" ON public.support_messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR public.is_support_staff(auth.uid()))
  WITH CHECK (sender_id = auth.uid() OR public.is_support_staff(auth.uid()));
CREATE POLICY "staff_deletes_message" ON public.support_messages
  FOR DELETE TO authenticated USING (public.is_support_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_support_msg_conv ON public.support_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_msg_sender ON public.support_messages(sender_id);
CREATE TRIGGER trg_support_msg_updated BEFORE UPDATE ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- support_participants
CREATE TABLE IF NOT EXISTS public.support_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'customer',
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  UNIQUE (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_participants TO authenticated;
GRANT ALL ON public.support_participants TO service_role;
ALTER TABLE public.support_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_participants_of_visible_conv" ON public.support_participants
  FOR SELECT TO authenticated USING (public.can_view_support_conversation(conversation_id, auth.uid()));
CREATE POLICY "staff_or_self_modifies_participants" ON public.support_participants
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_support_staff(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_support_staff(auth.uid()));

-- support_presence
CREATE TABLE IF NOT EXISTS public.support_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.support_presence_status NOT NULL DEFAULT 'offline',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_staff boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_presence TO authenticated;
GRANT ALL ON public.support_presence TO service_role;
ALTER TABLE public.support_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presence_read_all_authenticated" ON public.support_presence
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "presence_upsert_self" ON public.support_presence
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "presence_update_self" ON public.support_presence
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_support_presence_updated BEFORE UPDATE ON public.support_presence
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- support_assignments
CREATE TABLE IF NOT EXISTS public.support_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_assignments TO authenticated;
GRANT ALL ON public.support_assignments TO service_role;
ALTER TABLE public.support_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_assignments_of_visible_conv" ON public.support_assignments
  FOR SELECT TO authenticated USING (public.can_view_support_conversation(conversation_id, auth.uid()));
CREATE POLICY "staff_manages_assignments" ON public.support_assignments
  FOR ALL TO authenticated
  USING (public.is_support_staff(auth.uid()))
  WITH CHECK (public.is_support_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_support_assign_conv ON public.support_assignments(conversation_id);

-- support_tags + join
CREATE TABLE IF NOT EXISTS public.support_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  label text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_tags TO authenticated;
GRANT ALL ON public.support_tags TO service_role;
ALTER TABLE public.support_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_read_all" ON public.support_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "tags_staff_writes" ON public.support_tags FOR ALL TO authenticated
  USING (public.is_support_staff(auth.uid())) WITH CHECK (public.is_support_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.support_conversation_tags (
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.support_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, tag_id)
);
GRANT SELECT, INSERT, DELETE ON public.support_conversation_tags TO authenticated;
GRANT ALL ON public.support_conversation_tags TO service_role;
ALTER TABLE public.support_conversation_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ctags_read_visible" ON public.support_conversation_tags
  FOR SELECT TO authenticated USING (public.can_view_support_conversation(conversation_id, auth.uid()));
CREATE POLICY "ctags_staff_writes" ON public.support_conversation_tags
  FOR ALL TO authenticated
  USING (public.is_support_staff(auth.uid()))
  WITH CHECK (public.is_support_staff(auth.uid()));

-- support_internal_notes (staff only)
CREATE TABLE IF NOT EXISTS public.support_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_internal_notes TO authenticated;
GRANT ALL ON public.support_internal_notes TO service_role;
ALTER TABLE public.support_internal_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_staff_only_read" ON public.support_internal_notes
  FOR SELECT TO authenticated USING (public.is_support_staff(auth.uid()));
CREATE POLICY "notes_staff_only_write" ON public.support_internal_notes
  FOR ALL TO authenticated
  USING (public.is_support_staff(auth.uid()))
  WITH CHECK (public.is_support_staff(auth.uid()));
CREATE TRIGGER trg_support_notes_updated BEFORE UPDATE ON public.support_internal_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- support_attachments
CREATE TABLE IF NOT EXISTS public.support_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.support_messages(id) ON DELETE CASCADE,
  uploader_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL,
  scan_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.support_attachments TO authenticated;
GRANT ALL ON public.support_attachments TO service_role;
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attachments_read_visible" ON public.support_attachments
  FOR SELECT TO authenticated USING (public.can_view_support_conversation(conversation_id, auth.uid()));
CREATE POLICY "attachments_insert_visible" ON public.support_attachments
  FOR INSERT TO authenticated WITH CHECK (
    public.can_view_support_conversation(conversation_id, auth.uid())
    AND uploader_id = auth.uid()
  );
CREATE POLICY "attachments_owner_or_staff_delete" ON public.support_attachments
  FOR DELETE TO authenticated USING (uploader_id = auth.uid() OR public.is_support_staff(auth.uid()));

-- support_feedback
CREATE TABLE IF NOT EXISTS public.support_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  rating public.support_feedback_rating,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, customer_id)
);
GRANT SELECT, INSERT ON public.support_feedback TO authenticated;
GRANT ALL ON public.support_feedback TO service_role;
ALTER TABLE public.support_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_read_visible" ON public.support_feedback
  FOR SELECT TO authenticated USING (customer_id = auth.uid() OR public.is_support_staff(auth.uid()));
CREATE POLICY "feedback_customer_inserts_own" ON public.support_feedback
  FOR INSERT TO authenticated WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = conversation_id AND c.customer_id = auth.uid()
    )
  );

-- support_activity_logs
CREATE TABLE IF NOT EXISTS public.support_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_activity_logs TO authenticated;
GRANT ALL ON public.support_activity_logs TO service_role;
ALTER TABLE public.support_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_staff_reads" ON public.support_activity_logs
  FOR SELECT TO authenticated USING (public.is_support_staff(auth.uid()));
CREATE POLICY "activity_actor_or_staff_inserts" ON public.support_activity_logs
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() OR public.is_support_staff(auth.uid()));

-- Realtime publication
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='support_conversations')
    THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='support_messages')
    THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='support_presence')
    THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.support_presence; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='support_assignments')
    THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.support_assignments; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='support_participants')
    THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.support_participants; END IF;
END $$;

-- Assignment ladder helper: agent -> admin -> moderator -> super_admin, filtered by online presence
CREATE OR REPLACE FUNCTION public.next_support_assignee()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH candidates AS (
    SELECT ur.user_id, ur.role::text AS role,
      CASE ur.role::text
        WHEN 'support_agent' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'moderator' THEN 3
        WHEN 'super_admin' THEN 4
        ELSE 99
      END AS rank
    FROM public.user_roles ur
    WHERE ur.role::text IN ('support_agent','admin','moderator','super_admin')
  ),
  online AS (
    SELECT c.user_id, c.rank,
      (SELECT count(*) FROM public.support_conversations
        WHERE assigned_to = c.user_id AND status IN ('open','pending','waiting')) AS load
    FROM candidates c
    LEFT JOIN public.support_presence p ON p.user_id = c.user_id
    WHERE COALESCE(p.status::text, 'offline') IN ('online','available')
  )
  SELECT user_id FROM online
  ORDER BY rank ASC, load ASC, user_id ASC
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.next_support_assignee() FROM anon;

-- Seed common tags
INSERT INTO public.support_tags(slug, label, color) VALUES
  ('stripe','Stripe','#635BFF'),
  ('shopify','Shopify','#95BF47'),
  ('webhook','Webhook','#0EA5E9'),
  ('whatsapp','WhatsApp','#25D366'),
  ('billing','Billing','#F59E0B'),
  ('subscription','Subscription','#8B5CF6'),
  ('payment-failed','Payment Failed','#EF4444'),
  ('api','API','#14B8A6'),
  ('authentication','Authentication','#6366F1'),
  ('recovery-engine','Recovery Engine','#10B981')
ON CONFLICT (slug) DO NOTHING;
