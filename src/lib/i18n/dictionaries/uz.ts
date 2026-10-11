import type { Dictionary } from "./en"

const uz: Dictionary = {
  meta: {
    title: "izipass — Wallet chiptali pullik tadbirlar",
    description:
      "Tadbir yarating, ro‘yxatdan o‘tishlarni qabul qiling, to‘lovni tasdiqlang va ishtirokchilarga Apple Wallet yoki Google Wallet’da chipta bering. Kirish — bir skanerlash.",
  },
  language: "Til",
  theme: { toggle: "Mavzuni almashtirish", light: "Yorug‘", dark: "Qorong‘i", system: "Tizim" },
  nav: { signIn: "Kirish", dashboard: "Kabinet", signOut: "Chiqish" },
  hero: {
    title: "Skrinshot emas, haqiqiy chiptali tadbirlar",
    subtitle:
      "Narx va o‘rinlar sonini belgilang, ishtirokchilar ro‘yxatdan o‘tib to‘g‘ridan-to‘g‘ri sizga to‘laydi, siz bir bosishda tasdiqlaysiz — ular Apple Wallet yoki Google Wallet’da chipta oladi. Kirishda — skanerlaysiz.",
    cta: "Tadbir yaratish",
  },
  features: {
    register: { title: "Cheklangan ro‘yxat", body: "Ishtirokchi to‘lagunicha o‘rin band turadi. Kutish ro‘yxati bo‘sh o‘rinlarni to‘ldiradi." },
    confirm: { title: "To‘lovni tasdiqlash", body: "Ishtirokchi chekni yuklaydi. Siz bir bosishda tasdiqlaysiz — yoki avtotekshiruv qiladi." },
    ticket: { title: "Wallet chiptalari", body: "Tasdiqlangan ishtirokchilar Apple Wallet yoki Google Wallet’da chipta oladi." },
    checkin: { title: "Chipta bilan kirish", body: "Chiptani telefon bilan skanerlang. Yashil — o‘tadi, qizil — sababi ko‘rsatiladi." },
  },
  login: {
    title: "Kirish",
    subtitle: "Tashkilotchilar ham, ishtirokchilar ham bir xil kiradi.",
    telegram: "Telegram orqali kirish",
    telegramUnavailable: "Telegram orqali kirish hali sozlanmagan.",
    or: "yoki",
    emailLabel: "Email",
    emailPlaceholder: "siz@example.com",
    sendLink: "Kirish havolasini yuborish",
    sending: "Yuborilmoqda…",
    sentTitle: "Pochtangizni tekshiring",
    sentBody: "{email} manziliga kirish havolasini yubordik. U 15 daqiqa amal qiladi.",
    errors: {
      email: "To‘g‘ri email kiriting.",
      telegram: "Telegram orqali kirish amalga oshmadi. Qayta urinib ko‘ring.",
      expired: "Havola eskirgan yoki allaqachon ishlatilgan. Yangisini so‘rang.",
      generic: "Xatolik yuz berdi. Qayta urinib ko‘ring.",
    },
  },
  dashboard: {
    title: "Kabinet",
    welcome: "Siz {name} sifatida kirdingiz",
    noOrganizer: "Sizda hali tashkilotchi sahifasi yo‘q. Tadbirlar va ro‘yxatlar keyingi bosqichda qo‘shiladi.",
    account: "Hisob",
    email: "Email",
    telegram: "Telegram",
    notLinked: "bog‘lanmagan",
  },
  footer: "izipass — tashkilotchilar uchun vosita. To‘lov to‘g‘ridan-to‘g‘ri tashkilotchiga boradi; izipass pulingizni saqlamaydi.",
}

export default uz
