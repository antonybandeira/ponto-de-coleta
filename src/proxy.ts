import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = pathname.startsWith('/pin') || pathname.startsWith('/api/auth')
  if (isPublic) return NextResponse.next()

  const token = request.cookies.get('auth_token')?.value
  if (!token) {
    const url = request.nextUrl.clone()
    url.pathname = '/pin'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
