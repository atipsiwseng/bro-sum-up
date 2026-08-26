import { NextResponse, type NextRequest } from "next/server"
import { jwtVerify } from "jose"

const SESSION_COOKIE_NAME = "costtax_session"
const PUBLIC_PATHS = ["/login", "/register"]

function getSessionSecretKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) return null
  return new TextEncoder().encode(secret)
}

async function hasValidSession(token: string | undefined) {
  if (!token) return false
  const key = getSessionSecretKey()
  if (!key) return false
  try {
    await jwtVerify(token, key)
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const authenticated = await hasValidSession(token)

  if (!authenticated && !isPublicPath) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (authenticated && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - api routes (they check auth themselves)
     * - Next.js internals
     * - any file with an extension (e.g. /logo.png, /favicon.ico, /robots.txt)
     *   served from the public/ folder, which must load regardless of auth state
     */
    "/((?!api|_next/static|_next/image|.*\\.[\\w]+$).*)",
  ],
}
