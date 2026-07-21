/** Attachment upload signed URL + registration for support conversations. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);
const MAX_BYTES = 10 * 1024 * 1024;

export const createAttachmentUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        conversationId: z.string().uuid(),
        fileName: z.string().min(1).max(255),
        contentType: z.string().min(1).max(200),
        sizeBytes: z.number().int().min(1).max(MAX_BYTES),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    if (!ALLOWED_MIME.has(data.contentType)) throw new Error("Unsupported file type");

    const { supabase, userId } = context;
    const canView = await supabase.rpc("can_view_support_conversation", {
      _conv_id: data.conversationId,
      _user_id: userId,
    });
    if (canView.error) throw new Error(canView.error.message);
    if (!canView.data) throw new Error("Forbidden");

    const attachmentId = crypto.randomUUID();
    const safeName = data.fileName.replace(/[^\w.\- ]+/g, "_").slice(0, 200);
    const path = `${data.conversationId}/${attachmentId}-${safeName}`;

    const { data: signed, error: signErr } = await supabase.storage
      .from("support-attachments")
      .createSignedUploadUrl(path);
    if (signErr || !signed) throw new Error(signErr?.message ?? "Failed to create upload URL");

    const { data: att, error: attErr } = await supabase
      .from("support_attachments")
      .insert({
        id: attachmentId,
        conversation_id: data.conversationId,
        uploader_id: userId,
        storage_path: path,
        file_name: safeName,
        content_type: data.contentType,
        size_bytes: data.sizeBytes,
        scan_status: "pending",
      })
      .select("*")
      .single();
    if (attErr) throw new Error(attErr.message);

    return { attachment: att, upload: signed };
  });

export const createAttachmentDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ attachmentId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: att, error } = await supabase
      .from("support_attachments")
      .select("storage_path, file_name")
      .eq("id", data.attachmentId)
      .single();
    if (error || !att) throw new Error(error?.message ?? "Attachment not found");
    const { data: signed, error: signErr } = await supabase.storage
      .from("support-attachments")
      .createSignedUrl(att.storage_path, 300);
    if (signErr || !signed) throw new Error(signErr?.message ?? "Failed to sign URL");
    return { url: signed.signedUrl, fileName: att.file_name };
  });
