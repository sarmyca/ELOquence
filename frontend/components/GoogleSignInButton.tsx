'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, config: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function GoogleSignInButton({ onError }: { onError?: (msg: string) => void }) {
  const { googleLogin } = useAuth();
  const router = useRouter();
  const hiddenRef = useRef<HTMLDivElement>(null);

  const handleCredentialResponse = useCallback(
    async (response: { credential: string }) => {
      try {
        await googleLogin(response.credential);
        router.push('/play');
      } catch {
        onError?.('Google sign-in failed. Please try again.');
      }
    },
    [googleLogin, router, onError]
  );

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && hiddenRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
        });
        // Render the real Google button hidden, we'll click it programmatically
        window.google.accounts.id.renderButton(hiddenRef.current, {
          theme: 'filled_black',
          size: 'large',
          width: 400,
          text: 'continue_with',
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [handleCredentialResponse]);

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;

  const handleClick = () => {
    // Click the hidden real Google button
    const googleBtn = hiddenRef.current?.querySelector('div[role="button"]') as HTMLElement;
    if (googleBtn) {
      googleBtn.click();
    }
  };

  return (
    <>
      {/* Hidden real Google button */}
      <div ref={hiddenRef} className="absolute opacity-0 pointer-events-none h-0 overflow-hidden" />

      {/* Custom styled button */}
      <button
        type="button"
        onClick={handleClick}
        className="w-full py-2.5 rounded-xl bg-bg-tertiary hover:bg-bg-elevated border border-white/[0.12] hover:border-white/[0.2] text-text-primary font-medium text-sm transition-all flex items-center justify-center gap-3"
      >
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.001 24.001 0 000 21.56l7.98-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Continue with Google
      </button>
    </>
  );
}
