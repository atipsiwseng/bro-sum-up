import type { Metadata, Viewport } from "next"
import { IBM_Plex_Sans_Thai } from "next/font/google"
import "./globals.css"

import { getCurrentUser } from "@/lib/auth"
import { AuthProvider } from "@/components/auth-provider"
import { StoreProvider } from "@/components/store-provider"
import { getStores } from "@/app/actions/store-actions"

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Bro Sum Up - ระบบจัดการต้นทุนและภาษี SME",
  description:
    "แพลตฟอร์มสำหรับเจ้าของธุรกิจ SME ไทย ในการติดตามต้นทุน วิเคราะห์กำไร และคำนวณภาษีเงินได้นิติบุคคลโดยประมาณ",
}

export const viewport: Viewport = {
  themeColor: "#10B981",
  width: "device-width",
  initialScale: 1,
  // Lets `env(safe-area-inset-*)` resolve to real values on notched devices
  // (e.g. iPhone home indicator), used by the bottom nav and bottom sheets.
  viewportFit: "cover",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  const storesResult = user ? await getStores() : null
  const initialStores = storesResult?.ok ? storesResult.data : []

  return (
    <html lang="th" className={`${plexThai.variable} bg-background`}>
      <body className="min-h-dvh bg-background font-sans antialiased">
        {/*
          Keyed by the authenticated user's id so the whole provider tree
          fully remounts with fresh state whenever the signed-in user
          changes (login, logout, or switching accounts on the same
          browser). `loginAction`/`logoutAction` redirect via Next's router
          (a client-side transition, not a hard page reload), and this root
          layout wraps both the auth pages and the dashboard — without this
          key, `StoreProvider`'s `useState(initialStores)` would keep
          whatever store list was current when it first mounted (e.g. the
          empty list from the `/login` page) instead of picking up the
          newly-authenticated user's real stores, which is what made the
          dashboard appear to have 0 stores/data right after logging in.
        */}
        <AuthProvider key={user?.id ?? "anon"} user={user}>
          <StoreProvider initialStores={initialStores}>{children}</StoreProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
