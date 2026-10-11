/**
 * Pieces of the organizer's free-text payment instructions that attendees
 * want to copy or tap: card numbers and payment links (Click, Payme, ...).
 */
export function paymentDetails(text: string) {
  const cards = [...new Set([...text.matchAll(/(?<![\d])(?:\d{4}[ -]?){3}\d{4}(?![\d])/g)].map((m) => m[0].replace(/[ -]/g, "").replace(/(\d{4})(?=\d)/g, "$1 ")))]
  const links = [...new Set([...text.matchAll(/https?:\/\/[^\s<>"')]+[^\s<>"').,;!?]/g)].map((m) => m[0]))]
  return { cards, links }
}

export type PaymentTo = { kind: "card" | "link" | "text"; display: string; copy: string }

/**
 * The "Where to pay" field as guests see it: a card number grouped in fours,
 * a link to open, or the text as typed (a phone, a Payme tag).
 */
export function describePaymentTo(value: string): PaymentTo | null {
  const text = value.trim()
  if (!text) return null
  const digits = text.replace(/[\s-]/g, "")
  if (/^\d{16,19}$/.test(digits)) return { kind: "card", display: digits.replace(/(\d{4})(?=\d)/g, "$1 "), copy: digits }
  if (/^https?:\/\/\S+$/i.test(text)) return { kind: "link", display: text.replace(/^https?:\/\//i, ""), copy: text }
  if (/^(my\.click\.uz|click\.uz|payme\.uz|pay\.?me|t\.me)\/\S*$/i.test(text)) return { kind: "link", display: text, copy: `https://${text}` }
  return { kind: "text", display: text, copy: text }
}

/** Last 4 digits of a card in "Where to pay", for auto-check to match the receipt's recipient. */
export function cardLast4(value: string) {
  const to = describePaymentTo(value)
  return to?.kind === "card" ? to.copy.slice(-4) : null
}
