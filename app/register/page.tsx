import { redirect } from "next/navigation"
import Image from "next/image"

import { getSession } from "@/lib/auth"
import { RegisterForm } from "@/components/auth/register-form"

export default async function RegisterPage() {
  const session = await getSession()
  if (session) redirect("/")

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg p-1">
            <Image
              src="/logo.png"
              alt="Bro Sum Up"
              width={48}
              height={48}
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Bro Sum Up</h1>
            <p className="text-sm text-muted-foreground">
              สร้างบัญชีใหม่เพื่อเริ่มจัดการต้นทุนและภาษี
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}
