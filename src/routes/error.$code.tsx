import { createFileRoute } from "@tanstack/react-router";
import { ErrorPage } from "@/components/error-page";
import { BRAND } from "@/lib/brand";

const VALID = new Set(["400", "401", "403", "404", "429", "500", "503", "maintenance"]);

export const Route = createFileRoute("/error/$code")({
  component: ErrorCodePage,
  head: ({ params }) => ({
    meta: [
      { title: `Error ${params.code} — ${BRAND.name}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function ErrorCodePage() {
  const { code } = Route.useParams();
  const key = VALID.has(code) ? code : "500";
  const c =
    key === "maintenance" ? "maintenance" : (Number(key) as 400 | 401 | 403 | 404 | 429 | 500 | 503);
  return <ErrorPage code={c} />;
}
