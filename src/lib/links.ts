/** Organizer links shown as "Telegram @club" rather than a bare host name. */
export type LinkKind = "telegram" | "instagram" | "youtube" | "web"

export function describeLink(url: string): { kind: LinkKind; label: string } {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return { kind: "web", label: url }
  }
  const host = u.host.replace(/^www\./, "").toLowerCase()
  const first = u.pathname.split("/").filter(Boolean)[0] ?? ""
  const handle = first ? `@${first.replace(/^@/, "")}` : host
  if (host === "t.me" || host === "telegram.me") return { kind: "telegram", label: handle }
  if (host === "instagram.com") return { kind: "instagram", label: handle }
  if (host === "youtube.com" || host === "youtu.be") return { kind: "youtube", label: first.startsWith("@") ? first : host }
  return { kind: "web", label: host + (u.pathname !== "/" ? u.pathname.replace(/\/$/, "") : "") }
}
