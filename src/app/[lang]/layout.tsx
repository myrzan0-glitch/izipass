import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter } from "next/font/google"
import { notFound } from "next/navigation"

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { LOCALES, isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { shareImage } from "@/lib/share-image"
import { SITE_NAME, SITE_URL } from "@/lib/site"
import "../globals.css"

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "cyrillic", "cyrillic-ext"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "cyrillic", "cyrillic-ext"] })

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }))
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: dict.meta.title, template: "%s · izipass" },
    description: dict.meta.description,
    alternates: { canonical: `/${lang}`, languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) },
    // og:site_name is the name link previews show above the title; without it Telegram guesses from the domain.
    openGraph: { siteName: SITE_NAME, title: dict.meta.title, description: dict.meta.description, type: "website", images: [shareImage(lang, dict.meta.title)] },
    twitter: { card: "summary_large_image" },
  }
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()

  return (
    <html lang={lang} suppressHydrationWarning className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>
          {children}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}
