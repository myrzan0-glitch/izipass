const en = {
  meta: {
    title: "izipass — paid events with Wallet tickets",
    description:
      "Create an event, take registrations, confirm payments and give attendees a ticket in Apple Wallet or Google Wallet. Check-in with one scan.",
  },
  language: "Language",
  theme: { toggle: "Toggle theme", light: "Light", dark: "Dark", system: "System" },
  nav: { signIn: "Sign in", dashboard: "Dashboard", signOut: "Sign out" },
  hero: {
    title: "Events with real tickets, not screenshots",
    subtitle:
      "Set a price and a capacity, let people register and pay you directly, confirm in one tap, and they get a ticket in Apple Wallet or Google Wallet. At the door, scan.",
    cta: "Create an event",
  },
  features: {
    register: { title: "Registration with a limit", body: "Spots are held while people pay. A waitlist fills cancellations." },
    confirm: { title: "Payment confirmation", body: "Attendees upload the receipt. You approve in one tap — or let auto-check do it." },
    ticket: { title: "Wallet tickets", body: "Confirmed attendees get a ticket in Apple Wallet or Google Wallet." },
    checkin: { title: "Door check-in", body: "Scan the ticket with your phone. Green means in, red says why not." },
  },
  login: {
    title: "Sign in",
    subtitle: "Organizers and attendees sign in the same way.",
    telegram: "Continue with Telegram",
    telegramUnavailable: "Telegram sign-in is not configured yet.",
    or: "or",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    sendLink: "Send sign-in link",
    sending: "Sending…",
    sentTitle: "Check your email",
    sentBody: "We sent a sign-in link to {email}. It works for 15 minutes.",
    errors: {
      email: "Enter a valid email address.",
      telegram: "Telegram sign-in failed. Try again.",
      expired: "This sign-in link has expired or was already used. Request a new one.",
      generic: "Something went wrong. Try again.",
    },
  },
  dashboard: {
    title: "Dashboard",
    welcome: "Signed in as {name}",
    noOrganizer: "You don't have an organizer page yet. Events and registrations come in the next step.",
    account: "Account",
    email: "Email",
    telegram: "Telegram",
    notLinked: "not linked",
  },
  footer: "izipass is a tool for organizers. Payments go directly to the organizer; izipass never holds your money.",
}

export type Dictionary = typeof en
export default en
