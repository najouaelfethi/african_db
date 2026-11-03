import * as React from "react";

export function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "amber" | "red" | "slate" | "blue";
}) {
  const tones = {
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-500",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Banner({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return (
    <div className={`rounded-xl border px-4 py-2.5 text-sm ${cls}`}>
      {children}
    </div>
  );
}

export function Pager({
  offset,
  limit,
  total,
  onChange,
}: {
  offset: number;
  limit: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  if (total <= limit) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-[12px] text-slate-500">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        <button
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
          className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
        >
          Previous
        </button>
        <button
          disabled={offset + limit >= total}
          onClick={() => onChange(offset + limit)}
          className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export const inputCls =
  "rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition";

export const primaryBtn =
  "px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition";

export const ghostBtn =
  "px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition";

export function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
