import { toast } from "sonner";
import { normalizeError } from "./normalize";

/**
 * Centralized toast helpers. Every user-visible feedback in the app should
 * go through these so success / warning / error / info are consistent.
 */
export const notify = {
  success: (title: string, description?: string) => toast.success(title, { description }),
  warning: (title: string, description?: string) => toast.warning(title, { description }),
  info: (title: string, description?: string) => toast.info(title, { description }),
  error: (title: string, description?: string) => toast.error(title, { description }),
  /**
   * Render any thrown value as an error toast. Never leaks stack traces.
   */
  fromError: (err: unknown, fallbackTitle = "Something went wrong") => {
    const n = normalizeError(err);
    toast.error(n.title || fallbackTitle, { description: n.message });
    return n;
  },
  loading: (title: string) => toast.loading(title),
  dismiss: (id?: string | number) => toast.dismiss(id),
};
