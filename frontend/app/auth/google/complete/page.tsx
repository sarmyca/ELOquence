'use client';
import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';

// `useSearchParams()` opts the page out of static prerendering, and
// Next 14's App Router requires that hook to live inside a Suspense
// boundary or the prod build fails the CSR-bailout check. We split the
// inner logic into a child component so the outer page can wrap it.

function GoogleCompleteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const token = searchParams.get('token');

    if (token) {
      localStorage.setItem('token', token);
      refreshUser().then((u) => router.push(u?.is_admin ? '/admin' : '/play'));
    } else {
      router.push('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <SigningInSpinner />;
}

function SigningInSpinner() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80dvh] gap-4">
      <div
        className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }}
        aria-hidden="true"
      />
      <p className="font-sans text-sm text-text-secondary">Signing you in…</p>
    </div>
  );
}

export default function GoogleCompletePage() {
  return (
    <Suspense fallback={<SigningInSpinner />}>
      <GoogleCompleteInner />
    </Suspense>
  );
}
