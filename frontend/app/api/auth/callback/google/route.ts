import { NextRequest, NextResponse } from 'next/server';

// Server-side route. In Docker Compose we hit the sibling container via its
// service name; on Vercel we hit the public API URL the client already uses.
// INTERNAL_API_URL wins so prod can override if it ever sits behind a private
// network, otherwise we fall back to the public URL and finally to the local
// compose hostname.
const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL;
const BACKEND_URL =
  process.env.INTERNAL_API_URL ||
  (PUBLIC_API ? `${PUBLIC_API.replace(/\/$/, '')}/api` : 'http://backend:8000/api');

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
