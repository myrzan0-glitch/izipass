/** "Malika Karimova" → "MK"; "?" for an empty name. */
export function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("")
  return letters || "?"
}
