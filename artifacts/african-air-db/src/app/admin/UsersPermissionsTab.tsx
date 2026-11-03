import { useMemo, useState } from "react";
import { CheckCircle, Copy, Mail, Shield, UserPlus } from "lucide-react";
import { useAsync } from "../hooks/useData";
import {
  createInvitation,
  createRole,
  deleteRole,
  deleteUser,
  getInviteDomains,
  listInvitations,
  listPermissions,
  listRoles,
  listUsers,
  replaceRolePermissions,
  replaceUserRoles,
  revokeInvitation,
  updateUser,
  type AdminUser,
  type InvitationCreated,
  type Role,
} from "../services/adminAccessService";
import {
  Banner,
  Pager,
  Pill,
  errMsg,
  ghostBtn,
  inputCls,
  primaryBtn,
} from "./ui";

type Panel = "users" | "roles" | "invitations";

const PANELS: { id: Panel; label: string }[] = [
  { id: "users", label: "Users" },
  { id: "roles", label: "Roles & Permissions" },
  { id: "invitations", label: "Invitations" },
];

export default function UsersPermissionsTab() {
  const [panel, setPanel] = useState<Panel>("users");
  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl bg-white border border-slate-100 p-1 w-fit shadow-sm">
        {PANELS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPanel(p.id)}
            className={`px-4 py-1.5 rounded-lg text-sm transition ${
              panel === p.id
                ? "bg-blue-600 text-white font-medium"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {panel === "users" && <UsersPanel />}
      {panel === "roles" && <RolesPanel />}
      {panel === "invitations" && <InvitationsPanel />}
    </div>
  );
}

// ─── Users ───────────────────────────────────────────────────────────────────

function UsersPanel() {
  const [reload, setReload] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const { data, loading, error } = useAsync(
    () => listUsers(offset, limit),
    [reload, offset],
  );
  const { data: roles } = useAsync(listRoles, []);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ ok: true, text: success });
      setEditing(null);
    } catch (e) {
      setNotice({ ok: false, text: errMsg(e) });
    } finally {
      setBusy(false);
      setReload((n) => n + 1);
    }
  };

  const startEdit = (user: AdminUser) => {
    setEditing(user);
    setPicked(user.roles.map((r) => r.id));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Team Members</h3>
        <span className="text-[12px] text-slate-400">
          {data ? `${data.total} users` : ""}
        </span>
      </div>
      {notice && (
        <div className="px-5 pt-4">
          <Banner tone={notice.ok ? "success" : "error"}>{notice.text}</Banner>
        </div>
      )}
      {error && (
        <div className="px-5 pt-4">
          <Banner tone="error">{error.message}</Banner>
        </div>
      )}
      <table className="min-w-full text-[12px]">
        <thead className="bg-slate-50">
          <tr>
            {["User", "Roles", "Status", "Joined", ""].map((h) => (
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
                Loading users…
              </td>
            </tr>
          )}
          {data?.items.map((u) => (
            <tr key={u.id} className="border-t border-slate-50 align-top">
              <td className="py-3 px-4">
                <div className="font-medium text-slate-800">
                  {u.display_name || u.email.split("@")[0]}
                </div>
                <div className="text-slate-500">{u.email}</div>
              </td>
              <td className="py-3 px-4">
                {editing?.id === u.id ? (
                  <div className="space-y-1">
                    {(roles?.items ?? []).map((r) => (
                      <label key={r.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={picked.includes(r.id)}
                          onChange={(e) =>
                            setPicked((cur) =>
                              e.target.checked
                                ? [...cur, r.id]
                                : cur.filter((id) => id !== r.id),
                            )
                          }
                        />
                        <span className="text-slate-700">{r.name}</span>
                      </label>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <button
                        disabled={busy || picked.length === 0}
                        onClick={() =>
                          run(
                            () => replaceUserRoles(u.id, picked),
                            `Roles updated for ${u.email}.`,
                          )
                        }
                        className={primaryBtn}
                      >
                        Save roles
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className={ghostBtn}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length === 0 && (
                      <span className="text-slate-400">No role</span>
                    )}
                    {u.roles.map((r) => (
                      <Pill key={r.id} tone="blue">
                        {r.name}
                      </Pill>
                    ))}
                  </div>
                )}
              </td>
              <td className="py-3 px-4">
                <Pill tone={u.is_active ? "green" : "slate"}>
                  {u.is_active ? "Active" : "Inactive"}
                </Pill>
              </td>
              <td className="py-3 px-4 text-slate-400">
                {new Date(u.created_at).toLocaleDateString()}
              </td>
              <td className="py-3 px-4">
                <div className="flex gap-2 justify-end">
                  <button onClick={() => startEdit(u)} className={ghostBtn}>
                    Roles
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => updateUser(u.id, { is_active: !u.is_active }),
                        `${u.email} ${u.is_active ? "deactivated" : "activated"}.`,
                      )
                    }
                    className={ghostBtn}
                  >
                    {u.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Delete user ${u.email}?`)) {
                        void run(
                          () => deleteUser(u.id),
                          `${u.email} deleted.`,
                        );
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg border border-red-200 text-[12px] font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
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
  );
}

// ─── Roles & permissions ─────────────────────────────────────────────────────

function RolesPanel() {
  const [reload, setReload] = useState(0);
  const { data: roles, error } = useAsync(listRoles, [reload]);
  const { data: permissions } = useAsync(listPermissions, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [granted, setGranted] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });

  const selected: Role | undefined = roles?.items.find(
    (r) => r.id === selectedId,
  );

  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof permissions>["items"]>();
    for (const p of permissions?.items ?? []) {
      const group = p.code.split(".")[0];
      map.set(group, [...(map.get(group) ?? []), p]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const select = (role: Role) => {
    setSelectedId(role.id);
    setGranted(role.permissions.map((p) => p.id));
    setNotice(null);
  };

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ ok: true, text: success });
    } catch (e) {
      setNotice({ ok: false, text: errMsg(e) });
    } finally {
      setBusy(false);
      setReload((n) => n + 1);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">
            Roles
          </div>
          {error && (
            <div className="p-4">
              <Banner tone="error">{error.message}</Banner>
            </div>
          )}
          <ul>
            {roles?.items.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => select(r)}
                  className={`w-full text-left px-5 py-3 border-t border-slate-50 hover:bg-slate-50 ${
                    r.id === selectedId ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Shield size={13} className="text-slate-400" />
                    {r.name}
                    {r.is_system && <Pill tone="slate">System</Pill>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {r.permissions.length} permissions
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <form
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await createRole({
                name: form.name.trim(),
                slug: form.slug.trim(),
                description: form.description.trim() || undefined,
              });
              setForm({ name: "", slug: "", description: "" });
            }, "Role created.");
          }}
        >
          <h3 className="font-semibold text-slate-800">New role</h3>
          <input
            className={`${inputCls} w-full`}
            placeholder="Name (e.g. Data Reviewer)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className={`${inputCls} w-full`}
            placeholder="slug (e.g. data-reviewer)"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
          <input
            className={`${inputCls} w-full`}
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <button
            disabled={busy || !form.name.trim() || !form.slug.trim()}
            className={primaryBtn}
          >
            Create role
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        {notice && (
          <div className="mb-4">
            <Banner tone={notice.ok ? "success" : "error"}>{notice.text}</Banner>
          </div>
        )}
        {!selected ? (
          <p className="text-sm text-slate-500">
            Select a role to view and edit its permissions.
          </p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-semibold text-slate-800">
                  {selected.name}
                </h3>
                <p className="text-[12px] text-slate-500">
                  {selected.description || selected.slug}
                </p>
                {selected.is_system && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    System roles are read-only.
                  </p>
                )}
              </div>
              {!selected.is_system && (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Delete role ${selected.name}?`)) {
                      setSelectedId(null);
                      void run(
                        () => deleteRole(selected.id),
                        "Role deleted.",
                      );
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-[12px] font-medium text-red-600 hover:bg-red-50"
                >
                  Delete role
                </button>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {groups.map(([group, items]) => (
                <div key={group}>
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">
                    {group.replace(/_/g, " ")}
                  </div>
                  {items.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 py-0.5 text-[12px] text-slate-700"
                    >
                      <input
                        type="checkbox"
                        disabled={selected.is_system}
                        checked={granted.includes(p.id)}
                        onChange={(e) =>
                          setGranted((cur) =>
                            e.target.checked
                              ? [...cur, p.id]
                              : cur.filter((id) => id !== p.id),
                          )
                        }
                      />
                      {p.code}
                    </label>
                  ))}
                </div>
              ))}
            </div>
            {!selected.is_system && (
              <button
                disabled={busy}
                onClick={() =>
                  run(
                    () => replaceRolePermissions(selected.id, granted),
                    "Permissions saved.",
                  )
                }
                className={`${primaryBtn} mt-5`}
              >
                Save permissions
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Invitations ─────────────────────────────────────────────────────────────

function InvitationsPanel() {
  const [reload, setReload] = useState(0);
  const { data, error } = useAsync(listInvitations, [reload]);
  const { data: roles } = useAsync(listRoles, []);
  const { data: domainData } = useAsync(getInviteDomains, []);
  const domains = domainData?.domains ?? ["um6p.ma"];
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [created, setCreated] = useState<InvitationCreated | null>(null);

  const trimmed = email.trim().toLowerCase();
  const domainOk =
    trimmed.includes("@") &&
    domains.includes(trimmed.slice(trimmed.lastIndexOf("@") + 1));
  const showDomainError = trimmed.includes("@") && !domainOk;

  const send = async () => {
    setBusy(true);
    setMessage(null);
    setCreated(null);
    try {
      const result = await createInvitation(trimmed, roleId || null);
      setCreated(result);
      setEmail("");
    } catch (e) {
      setMessage(errMsg(e));
    } finally {
      setBusy(false);
      setReload((n) => n + 1);
    }
  };

  const statusTone = (s: string) =>
    s === "pending"
      ? "amber"
      : s === "accepted"
        ? "green"
        : s === "revoked"
          ? "red"
          : "slate";

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <UserPlus size={15} /> Invite Team Member
        </h3>
        {message && <Banner tone="error">{message}</Banner>}
        {created && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} /> Invitation created for{" "}
              <strong>{created.email}</strong>.
              {created.email_sent
                ? " An email was sent."
                : " Email delivery is not configured: share the link below."}
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={created.invite_link}
                className={`${inputCls} flex-1 bg-white text-[12px]`}
              />
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard?.writeText(created.invite_link)
                }
                className={ghostBtn}
              >
                <Copy size={12} className="inline mr-1" />
                Copy
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={`researcher@${domains[0]}`}
            className={`${inputCls} flex-1 min-w-60`}
          />
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className={inputCls}
          >
            <option value="">Default role</option>
            {roles?.items.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            onClick={send}
            disabled={busy || !domainOk}
            className={primaryBtn}
          >
            <Mail size={13} className="inline mr-1.5" />
            Send Invite
          </button>
        </div>
        <p
          className={`text-[11px] ${showDomainError ? "text-red-600" : "text-slate-400"}`}
        >
          Invitations are restricted to approved UM6P addresses (
          {domains.map((d) => `@${d}`).join(", ")}).
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">
          Invitations
        </div>
        {error && (
          <div className="p-4">
            <Banner tone="error">{error.message}</Banner>
          </div>
        )}
        <table className="min-w-full text-[12px]">
          <thead className="bg-slate-50">
            <tr>
              {["Email", "Role", "Status", "Invited by", "Sent", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left py-3 px-4 text-[10px] uppercase tracking-widest text-slate-400 font-medium"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 px-4 text-slate-400">
                  No invitations yet.
                </td>
              </tr>
            )}
            {data?.items.map((i) => (
              <tr key={i.id} className="border-t border-slate-50">
                <td className="py-3 px-4 font-medium text-slate-800">
                  {i.email}
                </td>
                <td className="py-3 px-4 text-slate-600">
                  {i.role?.name ?? "Default"}
                </td>
                <td className="py-3 px-4">
                  <Pill tone={statusTone(i.status)}>{i.status}</Pill>
                </td>
                <td className="py-3 px-4 text-slate-500">
                  {i.invited_by_email ?? "—"}
                </td>
                <td className="py-3 px-4 text-slate-400">
                  {new Date(i.created_at).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right">
                  {i.status === "pending" && (
                    <button
                      onClick={async () => {
                        try {
                          await revokeInvitation(i.id);
                        } catch (e) {
                          setMessage(errMsg(e));
                        }
                        setReload((n) => n + 1);
                      }}
                      className={ghostBtn}
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
