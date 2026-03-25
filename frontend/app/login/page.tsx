'use client';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/hooks/useAuth';
import { springs } from '@/lib/animations';
import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/play');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Invalid email or password.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-56px)] px-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={springs.modal}
        className="w-full max-w-sm"
      >
        <div className="bg-bg-secondary border border-white/[0.1] rounded-2xl p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-text-primary mb-1">Sign In</h1>
            <p className="text-sm text-text-secondary">
              Let&apos;s compete!
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="px-3 py-2.5 rounded-lg bg-bg-tertiary border border-white/[0.1] text-text-primary placeholder-text-ghost text-sm focus:outline-none focus:border-white/[0.25] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="px-3 py-2.5 rounded-lg bg-bg-tertiary border border-white/[0.1] text-text-primary placeholder-text-ghost text-sm focus:outline-none focus:border-white/[0.25] transition-colors"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-[#e74c3c] bg-[#e74c3c]/10 border border-[#e74c3c]/20 rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.97 }}
              className="mt-2 py-3 rounded-xl bg-[#538d4e] hover:bg-[#6aaa64] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </motion.button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.1]" />
            <span className="text-xs text-text-ghost uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-white/[0.1]" />
          </div>

          <div className="mt-4">
            <GoogleSignInButton onError={(msg) => setError(msg)} />
          </div>

          <p className="mt-6 text-center text-sm text-text-secondary">
            No account?{' '}
            <Link
              href="/register"
              className="text-[#6aaa64] hover:text-[#538d4e] font-medium transition-colors"
            >
              Create one free
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
