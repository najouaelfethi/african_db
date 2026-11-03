// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCurrentUser,
  hasSession,
  login,
  logout,
  register,
} from "./authService";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

afterEach(() => vi.restoreAllMocks());

describe("authService", () => {
  it("logs in, sends the Bearer token, and clears the session on logout", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ access_token: "a1", refresh_token: "r1" }))
      .mockResolvedValueOnce(json({ email: "me@example.com" }))
      .mockResolvedValueOnce(json({}));

    const user = await login("me@example.com", "secret");
    expect(user.email).toBe("me@example.com");
    expect(hasSession()).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toContain("/auth/login");
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
      email: "me@example.com",
      password: "secret",
    });
    expect(
      (fetchMock.mock.calls[1][1]!.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer a1");

    await logout();
    expect(hasSession()).toBe(false);
  });

  it("refreshes once on 401 and retries", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ access_token: "a1", refresh_token: "r1" }))
      .mockResolvedValueOnce(json({ email: "me@example.com" }))
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ access_token: "a2" }))
      .mockResolvedValueOnce(json({ email: "me@example.com" }))
      .mockResolvedValueOnce(json({}));

    await login("me@example.com", "secret");
    await getCurrentUser();

    expect(fetchMock.mock.calls[3][0]).toContain("/auth/refresh");
    expect(
      (fetchMock.mock.calls[4][1]!.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer a2");
    await logout();
  });

  it("registers with the backend's display_name field", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({}, 201));

    await register("me@example.com", "secret", "Me Example");

    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
      email: "me@example.com",
      password: "secret",
      display_name: "Me Example",
    });
  });

  it("surfaces the API error message on a failed login", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      json({ detail: "Email not verified" }, 403),
    );
    await expect(login("x@y.z", "bad")).rejects.toThrow("Email not verified");
    expect(hasSession()).toBe(false);
  });
});
