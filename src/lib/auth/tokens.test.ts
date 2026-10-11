import { describe, expect, it } from "vitest"

import { createLoginToken, hashToken, normalizeEmail, safeNext } from "@/lib/auth/tokens"

describe("login tokens", () => {
  it("creates random tokens whose hash matches", () => {
    const a = createLoginToken()
    const b = createLoginToken()
    expect(a.token).not.toBe(b.token)
    expect(hashToken(a.token)).toBe(a.hash)
    expect(a.hash).toHaveLength(64)
  })

  it("only allows same-site paths as next", () => {
    expect(safeNext("/ru/dashboard", "/x")).toBe("/ru/dashboard")
    expect(safeNext("//evil.com", "/x")).toBe("/x")
    expect(safeNext("https://evil.com", "/x")).toBe("/x")
    expect(safeNext("/a\\evil", "/x")).toBe("/x")
    expect(safeNext(null, "/x")).toBe("/x")
  })

  it("normalizes emails", () => {
    expect(normalizeEmail("  Aziza@Example.COM ")).toBe("aziza@example.com")
  })
})
