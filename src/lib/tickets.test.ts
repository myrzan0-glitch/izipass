import { beforeAll, describe, expect, it } from "vitest"

import { parseTicketToken, ticketToken, ticketUrl } from "@/lib/tickets"

beforeAll(() => {
  process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef-test"
})

describe("ticket tokens", () => {
  const id = "0f3c2a1e-1111-4222-8333-444455556666"

  it("round-trips and rejects tampering", () => {
    const token = ticketToken(id)
    expect(token.startsWith(`${id}~`)).toBe(true)
    expect(parseTicketToken(token)).toBe(id)
    expect(parseTicketToken(token.slice(0, -1) + "x")).toBeNull()
    expect(parseTicketToken(`other-id~${token.split("~")[1]}`)).toBeNull()
    expect(parseTicketToken("garbage")).toBeNull()
    expect(parseTicketToken("")).toBeNull()
  })

  it("builds the public ticket URL", () => {
    expect(ticketUrl(id)).toMatch(/\/t\/0f3c2a1e-1111-4222-8333-444455556666~[A-Za-z0-9_-]{22}$/)
  })
})
