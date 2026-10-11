/**
 * Pieces of the organizer's free-text payment instructions that attendees
 * want to copy or tap: card numbers and payment links (Click, Payme, ...).
 */
export function paymentDetails(text: string) {
  const cards = [...new Set([...text.matchAll(/(?<![\d])(?:\d{4}[ -]?){3}\d{4}(?![\d])/g)].map((m) => m[0].replace(/[ -]/g, "").replace(/(\d{4})(?=\d)/g, "$1 ")))]
  const links = [...new Set([...text.matchAll(/https?:\/\/[^\s<>"')]+[^\s<>"').,;!?]/g)].map((m) => m[0]))]
  return { cards, links }
}
