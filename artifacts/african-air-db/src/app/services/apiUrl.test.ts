import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("apiUrl", () => {
  it("uses the configured API base URL in production builds", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");

    const { apiUrl } = await import("./apiUrl");

    expect(apiUrl("/auth/login")).toBe(
      "https://api.example.test/auth/login",
    );
  });

  it("keeps relative URLs when no API base URL is configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");

    const { apiUrl } = await import("./apiUrl");

    expect(apiUrl("/auth/login")).toBe("/auth/login");
  });
});
