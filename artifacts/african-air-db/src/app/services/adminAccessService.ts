import { authFetch } from "./authService";

export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface RoleSummary {
  id: string;
  name: string;
  slug: string;
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  roles: RoleSummary[];
  permissions: string[];
  created_at: string;
}

export interface Permission {
  id: string;
  code: string;
  description: string | null;
  is_system: boolean;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  permissions: Permission[];
}

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface Invitation {
  id: string;
  email: string;
  role: RoleSummary | null;
  status: InvitationStatus;
  invited_by_email: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface InvitationCreated extends Invitation {
  invite_link: string;
  email_sent: boolean;
}

export type CollaborationStatus = "Pending" | "Approved" | "Rejected";

export interface CollaborationRequest {
  id: string;
  full_name: string;
  email: string;
  institution: string;
  request_type: string;
  subject: string;
  message: string;
  details: string | null;
  status: CollaborationStatus;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface CollaborationPage extends Page<CollaborationRequest> {
  counts: Record<"All" | CollaborationStatus, number>;
}

export type ActivityCategory =
  | "auth"
  | "invitations"
  | "roles"
  | "requests"
  | "data";

export interface ActivityEntry {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  event: string | null;
  resource_type: string | null;
  resource_name: string | null;
  status: string | null;
  reason: string | null;
  ip_address: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
}

async function failure(
  response: Response,
  conflictMessage?: string,
): Promise<Error> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return new Error(body.detail);
    if (Array.isArray(body.detail)) {
      const first = body.detail[0] as { msg?: string } | undefined;
      if (first?.msg) return new Error(first.msg);
    }
  } catch {
    // Non-JSON error body: use the status fallback below.
  }
  if (response.status === 401) {
    return new Error("Your session is no longer valid. Please sign in again.");
  }
  if (response.status === 403) {
    return new Error(
      "Your account is signed in, but is not allowed to perform this action. Ask an administrator to verify your role permissions.",
    );
  }
  if (response.status === 409 && conflictMessage) {
    return new Error(conflictMessage);
  }
  return new Error(`Request failed with status ${response.status}`);
}

async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  conflictMessage?: string,
): Promise<T> {
  const response = await authFetch(path, {
    method,
    ...(body !== undefined
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (!response.ok) throw await failure(response, conflictMessage);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const listUsers = (offset = 0, limit = 100) =>
  request<Page<AdminUser>>(`/api/admin/users${query({ offset, limit })}`);
export const updateUser = (
  id: string,
  body: { display_name?: string | null; is_active?: boolean },
) => request<AdminUser>(`/api/admin/users/${id}`, "PATCH", body);
export const replaceUserRoles = (id: string, roleIds: string[]) =>
  request<AdminUser>(`/api/admin/users/${id}/roles`, "PUT", {
    role_ids: roleIds,
  });
export const deleteUser = (id: string) =>
  request<void>(`/api/admin/users/${id}`, "DELETE");

export const listRoles = () =>
  request<Page<Role>>(`/api/admin/roles${query({ limit: 100 })}`);
export function createUniqueRoleSlug(
  name: string,
  existingSlugs: readonly string[],
): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "role";
  const existing = new Set(existingSlugs.map((slug) => slug.toLowerCase()));
  let slug = base;
  let suffix = 2;
  while (existing.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}
export const createRole = (body: {
  name: string;
  slug: string;
  description?: string;
}) =>
  request<Role>(
    "/api/admin/roles",
    "POST",
    body,
    "A role with this name or identifier already exists. Review the roles and try again.",
  );
export const deleteRole = (id: string) =>
  request<void>(`/api/admin/roles/${id}`, "DELETE");
export const replaceRolePermissions = (id: string, permissionIds: string[]) =>
  request<Role>(`/api/admin/roles/${id}/permissions`, "PUT", {
    permission_ids: permissionIds,
  });
export const listPermissions = () =>
  request<Page<Permission>>(`/api/admin/permissions${query({ limit: 100 })}`);

export const listInvitations = () =>
  request<Page<Invitation>>(`/api/admin/invitations${query({ limit: 100 })}`);
export const getInviteDomains = () =>
  request<{ domains: string[] }>("/api/admin/invitations/allowed-domains");
export const createInvitation = (email: string, roleId: string | null) =>
  request<InvitationCreated>("/api/admin/invitations", "POST", {
    email,
    role_id: roleId,
  });
export const revokeInvitation = (id: string) =>
  request<void>(`/api/admin/invitations/${id}`, "DELETE");

export const listCollaborationRequests = (
  status: CollaborationStatus | "All",
  q: string,
  offset: number,
  limit = 20,
) =>
  request<CollaborationPage>(
    `/api/admin/collaboration-requests${query({
      status: status === "All" ? undefined : status,
      q: q.trim() || undefined,
      offset,
      limit,
    })}`,
  );
export const setCollaborationStatus = (
  id: string,
  status: CollaborationStatus,
) =>
  request<CollaborationRequest>(
    `/api/admin/collaboration-requests/${id}`,
    "PATCH",
    { status },
  );

export const listActivity = (params: {
  category?: ActivityCategory;
  status?: string;
  q?: string;
  offset: number;
  limit?: number;
}) =>
  request<Page<ActivityEntry>>(
    `/api/audit-logs${query({
      category: params.category,
      status: params.status,
      q: params.q?.trim() || undefined,
      offset: params.offset,
      limit: params.limit ?? 25,
    })}`,
  );
