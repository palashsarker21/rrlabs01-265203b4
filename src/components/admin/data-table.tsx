import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Column definition for AdminDataTable.
 * `cell` renders the value; `value` returns the CSV-exportable primitive.
 */
export type Column<T> = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  className?: string;
  value?: (row: T) => string | number | null | undefined;
  cell?: (row: T) => ReactNode;
};

export type Filter = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
};

type Props<T> = {
  title?: string;
  description?: string;
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  searchKeys?: (keyof T | string)[];
  filters?: Filter[];
  pageSize?: number;
  toolbarExtra?: ReactNode;
  rowActions?: (row: T) => ReactNode;
  exportFilename?: string;
  emptyMessage?: string;
};

export function AdminDataTable<T extends Record<string, unknown>>({
  title,
  description,
  rows,
  columns,
  getRowId,
  searchKeys,
  filters,
  pageSize = 25,
  toolbarExtra,
  rowActions,
  exportFilename = "export.csv",
  emptyMessage = "No records.",
}: Props<T>) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = rows;
    const ql = q.trim().toLowerCase();
    if (ql && searchKeys?.length) {
      list = list.filter((r) =>
        searchKeys.some((k) => {
          const v = (r as Record<string, unknown>)[k as string];
          return v != null && String(v).toLowerCase().includes(ql);
        }),
      );
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      list = [...list].sort((a, b) => {
        const av = col?.value ? col.value(a) : (a as Record<string, unknown>)[sortKey];
        const bv = col?.value ? col.value(b) : (b as Record<string, unknown>)[sortKey];
        if (av == null && bv == null) return 0;
        if (av == null) return sortDir === "asc" ? -1 : 1;
        if (bv == null) return sortDir === "asc" ? 1 : -1;
        if (typeof av === "number" && typeof bv === "number")
          return sortDir === "asc" ? av - bv : bv - av;
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }
    return list;
  }, [rows, q, searchKeys, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const paged = useMemo(
    () => filtered.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize),
    [filtered, clampedPage, pageSize],
  );

  function toggleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
    }
  }

  function exportCsv() {
    const header = columns.map((c) => escapeCsv(c.label)).join(",");
    const body = filtered
      .map((row) =>
        columns
          .map((c) => {
            const v = c.value ? c.value(row) : (row as Record<string, unknown>)[c.key];
            return escapeCsv(v == null ? "" : String(v));
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-card/50">
      {(title || description || searchKeys || filters || toolbarExtra) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 p-4">
          {(title || description) && (
            <div className="mr-auto">
              {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
              {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
          )}
          {searchKeys && searchKeys.length > 0 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                placeholder="Search…"
                className="h-8 w-56 pl-7 text-xs"
              />
            </div>
          )}
          {filters?.map((f) => (
            <select
              key={f.key}
              value={f.value}
              onChange={(e) => {
                f.onChange(e.target.value);
                setPage(0);
              }}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              aria-label={f.label}
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
          {toolbarExtra}
          <Button size="sm" variant="outline" onClick={exportCsv} className="h-8">
            <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3 text-${c.align ?? "left"} ${c.className ?? ""}`}
                >
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {c.label}
                      {sortKey === c.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
              {rowActions && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr key={getRowId(row)} className="border-t border-border/60 align-top">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 text-${c.align ?? "left"} ${c.className ?? ""}`}
                  >
                    {c.cell
                      ? c.cell(row)
                      : String((row as Record<string, unknown>)[c.key] ?? "—")}
                  </td>
                ))}
                {rowActions && <td className="px-4 py-3 text-right">{rowActions(row)}</td>}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (rowActions ? 1 : 0)}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > pageSize && (
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
          <span>
            {clampedPage * pageSize + 1}–{Math.min((clampedPage + 1) * pageSize, filtered.length)}{" "}
            of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={clampedPage === 0}
            >
              Previous
            </Button>
            <span>
              Page {clampedPage + 1} / {pageCount}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={clampedPage >= pageCount - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function escapeCsv(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
