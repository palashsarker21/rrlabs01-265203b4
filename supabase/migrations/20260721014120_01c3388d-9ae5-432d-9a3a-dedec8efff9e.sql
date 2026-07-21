
-- Storage RLS for support-attachments bucket
-- Path convention: {conversation_id}/{uuid}-{filename}
CREATE POLICY "support_att_read_visible" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (
      public.is_support_staff(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.support_conversations c
        WHERE c.id::text = split_part(name, '/', 1)
          AND c.customer_id = auth.uid()
      )
    )
  );

CREATE POLICY "support_att_insert_visible" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND (
      public.is_support_staff(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.support_conversations c
        WHERE c.id::text = split_part(name, '/', 1)
          AND c.customer_id = auth.uid()
      )
    )
  );

CREATE POLICY "support_att_delete_owner_or_staff" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (
      owner = auth.uid()
      OR public.is_support_staff(auth.uid())
    )
  );
