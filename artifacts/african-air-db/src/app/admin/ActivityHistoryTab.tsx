import { Fragment, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAsync } from "../hooks/useData";
import {
  listActivity,
  type ActivityCategory,
} from "../services/adminAccessService";
import { Banner, Pager, Pill, ghostBtn, inputCls } from "./ui";

type Category = "all" | ActivityCategory;

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "all", label: "All activity" },
  { id: "invitations", label: "Invitations" },
  { id: "roles", label: "Role & user changes" },
  { id: "requests", label: "Requests" },
  { id: "auth", label: "Logins" },
  { id: "data", label: "Data management" },
];

const EVENT_LABELS: Record<string, string> = {
  "invitation.sent": "Invitation sent",
  "invitation.rejected": "Invitation rejected (unapproved email)",
  "invitation.revoked": "Invitation revoked",
  "invitation.accepted": "Invitation accepted",
  "collaboration_request.submitted": "Request submitted",
  "collaboration_request.approved": "Request approved",
  "collaboration_request.rejected": "Request rejected",
  "collaboration_request.reopened": "Request set to pending",
  "admin.user_created": "User created",
  "admin.user_updated": "User updated",
  "admin.user_deleted": "User deleted",
  "admin.user_roles_replaced": "User roles changed",
  "admin.role_created": "Role created",
  "admin.role_updated": "Role updated",
  "admin.role_deleted": "Role deleted",
  "admin.role_permissions_replaced": "Role permissions changed",
  "login.succeeded": "Login",
  "login.failed": "Failed login",
  "logout.succeeded": "Logout",
  "registration.succeeded": "Account registered",
  "password.changed": "Password changed",
  "password.reset": "Password reset",
  "data.created": "Data created",
  "data.updated": "Data updated",
  "data.deleted": "Data deleted",
};

function label(event: string | null): string {
  if (!event) return "—";
  return (
    EVENT_LABELS[event] ??
    event
      .replace(/[._]/g, " ")
      .replace(/^./, (c) => c.toUpperCase())
  );
}

export default function ActivityHistoryTab() {
  const [category, setCategory] = useState<Category>("all");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const limit = 25;

  const { data, loading, error } = useAsync(
    () =>
      listActivity({
        category: category === "all" ? undefined : category,
        status: status || undefined,
        q: search,
        offset,
        limit,
      }),
    [category, status, search, offset, reload],
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-800">Activity History</h3>
            <p className="mt-1 text-[12px] text-slate-500">
              Administrative and user actions across the platform: invitations,
              role changes, request decisions, logins and data management.
            </p>
          </div>
          <button
            onClick={() => setReload((n) => n + 1)}
            className={ghostBtn}
            title="Refresh"
          >
            <RefreshCw size={12} className="inline mr-1" /> Refresh
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-50 border border-slate-100 p-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCategory(c.id);
                  setOffset(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  category === c.id
                    ? "bg-blue-600 text-white font-medium"
                    : "text-slate-500 hover:bg-white"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setOffset(0);
              }}
              className={inputCls}
            >
              <option value="">Any outcome</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
            </select>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              placeholder="Search activity…"
              className={`${inputCls} w-56`}
            />
          </div>
        </div>
      </div>

      {error && <Banner tone="error">{error.message}</Banner>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="min-w-full text-[12px]">
          <thead className="bg-slate-50">
            <tr>
              {["When", "Who", "Activity", "Target", "Outcome"].map((h) => (
                <th
                  key={h}
                  className="text-left py-3 px-4 text-[10px] uppercase tracking-widest text-slate-400 font-medium"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !data && (
              <tr>
                <td colSpan={5} className="py-6 px-4 text-slate-400">
                  Loading activity…
                </td>
              </tr>
            )}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 px-4 text-slate-400">
                  No activity found.
                </td>
              </tr>
            )}
            {data?.items.map((a) => (
              <Fragment key={a.id}>
                <tr
                  onClick={() => setOpen(open === a.id ? null : a.id)}
                  className="border-t border-slate-50 hover:bg-slate-50/60 cursor-pointer"
                >
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {a.actor_email ?? "Anonymous / system"}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    {label(a.event)}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {a.resource_name ?? a.resource_type ?? "—"}
                  </td>
                  <td className="py-3 px-4">
                    <Pill tone={a.status === "FAILED" ? "red" : "green"}>
                      {a.status ?? "—"}
                    </Pill>
                  </td>
                </tr>
                {open === a.id && (
                  <tr key={`${a.id}-d`} className="bg-slate-50">
                    <td colSpan={5} className="px-4 py-3 text-[11px] text-slate-600">
                      <div>Event: {a.event}</div>
                      {a.reason && <div>Reason: {a.reason}</div>}
                      {a.ip_address && <div>IP: {a.ip_address}</div>}
                      {a.details && Object.keys(a.details).length > 0 && (
                        <pre className="mt-1 whitespace-pre-wrap">
                          {JSON.stringify(a.details, null, 2)}
                        </pre>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {data && (
          <Pager
            offset={offset}
            limit={limit}
            total={data.total}
            onChange={setOffset}
          />
        )}
      </div>
    </div>
  );
}
