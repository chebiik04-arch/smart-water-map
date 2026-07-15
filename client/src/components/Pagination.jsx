import { useEffect, useMemo, useState } from "react";

export function usePagination(rows, pageSize = 8) {
  const [page, setPage] = useState(1);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [total, pageSize]);

  const safePage = Math.min(page, totalPages);
  const start = total ? (safePage - 1) * pageSize + 1 : 0;
  const end = Math.min(total, safePage * pageSize);
  const pageRows = useMemo(() => rows.slice((safePage - 1) * pageSize, safePage * pageSize), [rows, pageSize, safePage]);

  return {
    page: safePage,
    pageRows,
    pageSize,
    setPage,
    start,
    end,
    total,
    totalPages
  };
}

export function Pagination({ pagination }) {
  const { page, setPage, start, end, total, totalPages } = pagination;
  if (total <= pagination.pageSize) return null;

  const pages = buildPages(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 bg-white px-4 py-3 text-sm">
      <p className="text-xs font-medium text-black/50">Showing {start}-{end} of {total}</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded-md border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-black/65 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        {pages.map((item, index) => item === "..." ? (
          <span key={`${item}-${index}`} className="px-2 text-xs text-black/35">...</span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => setPage(item)}
            className={`min-w-8 rounded-md px-2.5 py-1.5 text-xs font-bold ${page === item ? "bg-emerald-600 text-white" : "border border-black/10 text-black/65 hover:bg-black/[0.03]"}`}
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="rounded-md border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-black/65 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function buildPages(page, totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push("...");
  for (let item = start; item <= end; item += 1) pages.push(item);
  if (end < totalPages - 1) pages.push("...");
  pages.push(totalPages);
  return pages;
}
