import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createInvitation,
  createRole,
  createUniqueRoleSlug,
} from "./adminAccessService";

afterEach(() => vi.restoreAllMocks());

describe("createUniqueRoleSlug", () => {
  it("generates a kebab-case slug from the role name", () => {
    expect(createUniqueRoleSlug("Data Reviewer", [])).toBe("data-reviewer");
  });

  it("adds a numeric suffix when the generated slug already exists", () => {
    expect(
      createUniqueRoleSlug("Data Reviewer", [
        "data-reviewer",
        "data-reviewer-2",
      ]),
    ).toBe("data-reviewer-3");
  });

  it("uses a fallback when the name has no ASCII letters or numbers", () => {
    expect(createUniqueRoleSlug("管理者", ["role"])).toBe("role-2");
  });
});

describe("createRole", () => {
  it("keeps the existing backend request shape", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "role-1",
          name: "Data Reviewer",
          slug: "data-reviewer",
          description: "Reviews data",
        }),
        { status: 201 },
      ),
    );

    await createRole({
      name: "Data Reviewer",
      slug: "data-reviewer",
      description: "Reviews data",
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/admin/roles");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      name: "Data Reviewer",
      slug: "data-reviewer",
      description: "Reviews data",
    });
  });

  it("shows a clear message when the backend reports a role conflict", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 409 }),
    );

    await expect(
      createRole({ name: "Data Reviewer", slug: "data-reviewer" }),
    ).rejects.toThrow(
      "A role with this name or identifier already exists. Review the roles and try again.",
    );
  });

  it("distinguishes an invalid session from a denied invitation permission", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));

    await expect(
      createInvitation("researcher@um6p.ma", null),
    ).rejects.toThrow("Your session is no longer valid. Please sign in again.");
    await expect(
      createInvitation("researcher@um6p.ma", null),
    ).rejects.toThrow(
      "Your account is signed in, but is not allowed to perform this action. Ask an administrator to verify your role permissions.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
