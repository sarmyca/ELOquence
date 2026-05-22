'use client';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
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
      const u = await login(email, password);
      router.push(u.is_admin ? '/admin' : '/play');
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-52px)] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.modal}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link
            href="/"
            className="font-display font-black text-xl text-text-primary tracking-tight transition-opacity duration-150 hover:opacity-70"
            aria-label="ELOquence home"
          >
            ELOquence
          </Link>
        </div>

        {/* Card */}
        <div
          className="bg-bg-base border border-border-default rounded-card-lg p-8"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
        >
          <h1 className="font-display font-black text-3xl tracking-tight text-text-primary mb-8">
            Sign In
          </h1>

          {/* Google */}
          <GoogleSignInButton onError={(msg) => setError(msg)} />

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-border-subtle" />
            <span className="text-xs text-text-secondary">or</span>
            <div className="flex-1 h-px bg-border-subtle" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
              >
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
                className="bg-transparent border-2 border-border-default focus:border-tile-correct focus:outline-none rounded-md px-3.5 py-3 text-base text-text-primary placeholder:text-text-tertiary transition-colors duration-150"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
              >
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
                className="bg-transparent border-2 border-border-default focus:border-tile-correct focus:outline-none rounded-md px-3.5 py-3 text-base text-text-primary placeholder:text-text-tertiary transition-colors duration-150"
              />
            </div>

            {/* Error */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2 text-sm mt-1"
                style={{ color: 'var(--red)' }}
                role="alert"
              >
                <AlertCircle size={14} aria-hidden="true" className="flex-shrink-0" />
                {error}
              </motion.p>
            )}

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full bg-tile-correct text-white font-bold uppercase tracking-wider rounded-md py-3.5 mt-1 text-sm transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </motion.button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            No account?{' '}
            <Link
              href="/register"
              className="text-text-secondary hover:text-text-primary font-medium transition-colors duration-150 underline underline-offset-2"
            >
              Create one free
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
