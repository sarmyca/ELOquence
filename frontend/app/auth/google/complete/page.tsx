'use client';
import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';

export default function GoogleCompletePage() {
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
