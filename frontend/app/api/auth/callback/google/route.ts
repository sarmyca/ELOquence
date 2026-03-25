import { NextRequest, NextResponse } from 'next/server';

// Server-side route: use Docker service name, not localhost
const BACKEND_URL = process.env.INTERNAL_API_URL || 'http://backend:8000/api';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const backendUrl = `${BACKEND_URL}/auth/google/callback?code=${encodeURIComponent(code)}`;
    const resp = await fetch(backendUrl);

    if (!resp.ok) {
      console.error('Google callback backend error:', resp.status, await resp.text());
      return NextResponse.redirect(new URL('/login?error=google', request.url));
    }

    const data = await resp.json();
    const token = data.access_token;

    if (!token) {
      return NextResponse.redirect(new URL('/login?error=google', request.url));
    }

    // Redirect to the completion page with token in the fragment
    return NextResponse.redirect(
      new URL(`/auth/google/complete?token=${encodeURIComponent(token)}`, request.url)
    );
  } catch (err) {
    console.error('Google callback error:', err);
    return NextResponse.redirect(new URL('/login?error=google', request.url));
  }
}
