import { useState } from "react";
import { useAsync } from "../hooks/useData";
import {
  listCollaborationRequests,
  setCollaborationStatus,
  type CollaborationStatus,
} from "../services/adminAccessService";
import { Banner, Pager, Pill, errMsg, inputCls } from "./ui";

type Filter = "All" | CollaborationStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "All", label: "All" },
  { id: "Pending", label: "Pending" },
  { id: "Approved", label: "Approved" },
  { id: "Rejected", label: "Rejected" },
];

const tone = (s: CollaborationStatus) =>
  s === "Approved" ? "green" : s === "Rejected" ? "red" : "amber";

export default function CollaborationRequestsTab() {
  const [filter, setFilter] = useState<Filter>("Pending");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const limit = 20;

  const { data, loading, error: loadError } = useAsync(
    () => listCollaborationRequests(filter, search, offset, limit),
    [filter, search, offset, reload],
  );

  const decide = async (id: string, status: CollaborationStatus) => {
    setBusyId(id);
    setError(null);
    try {
      await setCollaborationStatus(id, status);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusyId(null);
      setReload((n) => n + 1);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-slate-800">
            Collaboration Requests
          </h3>
          <p className="mt-1 text-[12px] text-slate-500">
            Review external collaboration and data-submission requests.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex gap-1 rounded-xl bg-slate-50 border border-slate-100 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setFilter(f.id);
                  setOffset(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  filter === f.id
                    ? "bg-blue-600 text-white font-medium"
                    : "text-slate-500 hover:bg-white"
                }`}
              >
                {f.label}
                <span className="ml-1.5 text-[11px] opacity-80">
                  {data?.counts[f.id] ?? "–"}
                </span>
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            placeholder="Search name, email, subject…"
            className={`${inputCls} w-64`}
          />
        </div>
      </div>

      {(error || loadError) && (
        <Banner tone="error">{error ?? loadError?.message}</Banner>
      )}
      {loading && !data && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 text-sm text-slate-500">
          Loading requests…
        </div>
      )}
      {data && data.items.length === 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 text-sm text-slate-500">
          No {filter === "All" ? "" : filter.toLowerCase() + " "}requests.
        </div>
      )}

      {data?.items.map((r) => (
        <div
          key={r.id}
          className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex flex-col gap-4 lg:flex-row lg:justify-between"
        >
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-semibold text-slate-800">
                {r.subject}
              </h4>
              <Pill tone={tone(r.status)}>{r.status}</Pill>
              <Pill tone="slate">{r.request_type}</Pill>
            </div>
            <div className="grid gap-1 text-[12px] text-slate-600 md:grid-cols-2">
              <div>
                <span className="font-medium text-slate-800">Name:</span>{" "}
                {r.full_name}
              </div>
              <div>
                <span className="font-medium text-slate-800">Email:</span>{" "}
                {r.email}
              </div>
              <div>
                <span className="font-medium text-slate-800">Institution:</span>{" "}
                {r.institution}
              </div>
              <div>
                <span className="font-medium text-slate-800">Submitted:</span>{" "}
                {new Date(r.created_at).toLocaleString()}
              </div>
              {r.reviewed_at && (
                <div className="md:col-span-2">
                  <span className="font-medium text-slate-800">Reviewed:</span>{" "}
                  {new Date(r.reviewed_at).toLocaleString()}
                  {r.reviewed_by_email ? ` by ${r.reviewed_by_email}` : ""}
                </div>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-[12px] text-slate-700">
              <p className="whitespace-pre-wrap">{r.message}</p>
            </div>
            {r.details && (
              <div className="rounded-xl bg-slate-50 p-3 text-[12px] text-slate-700">
                <div className="font-medium text-slate-800 mb-1">
                  Additional details
                </div>
                <p className="whitespace-pre-wrap">{r.details}</p>
              </div>
            )}
          </div>
          <div className="flex flex-row gap-2 lg:flex-col lg:min-w-40">
            {r.status !== "Approved" && (
              <button
                disabled={busyId === r.id}
                onClick={() => decide(r.id, "Approved")}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                Approve
              </button>
            )}
            {r.status !== "Rejected" && (
              <button
                disabled={busyId === r.id}
                onClick={() => decide(r.id, "Rejected")}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
              >
                Reject
              </button>
            )}
            {r.status !== "Pending" && (
              <button
                disabled={busyId === r.id}
                onClick={() => decide(r.id, "Pending")}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition"
              >
                Set Pending
              </button>
            )}
          </div>
        </div>
      ))}

      {data && (
        <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden">
          <Pager
            offset={offset}
            limit={limit}
            total={data.total}
            onChange={setOffset}
          />
        </div>
      )}
    </div>
  );
}
