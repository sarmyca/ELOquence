'use client';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/hooks/useAuth';
import { springs } from '@/lib/animations';
import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await register(email, username, password);
      router.push('/play');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string | { msg: string }[] } } })
        ?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail[0]?.msg || 'Registration failed.');
      } else {
        setError(detail || 'Registration failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-56px)] px-4 bg-[#111113]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.modal}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Link href="/" className="flex items-center gap-0.5">
            <span className="font-semibold text-lg text-[#538d4e]">ELO</span>
            <span className="font-semibold text-lg text-[#ededf0]">quence</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-[#171719] border border-white/[0.06] rounded-[12px] p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-[#ededf0] mb-6">Create account</h1>

          {/* Google */}
          <GoogleSignInButton onError={(msg) => setError(msg)} />

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-[#5c5c66]">or</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm text-[#9898a0]">
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
                className="h-11 px-3 rounded-lg bg-[#1d1d21] border border-white/[0.09] text-[#ededf0] placeholder-[#5c5c66] text-sm focus:outline-none focus:border-[#538d4e]/50 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className="text-sm text-[#9898a0]">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="wordmaster99"
                minLength={3}
                maxLength={20}
                className="h-11 px-3 rounded-lg bg-[#1d1d21] border border-white/[0.09] text-[#ededf0] placeholder-[#5c5c66] text-sm focus:outline-none focus:border-[#538d4e]/50 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm text-[#9898a0]">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                className="h-11 px-3 rounded-lg bg-[#1d1d21] border border-white/[0.09] text-[#ededf0] placeholder-[#5c5c66] text-sm focus:outline-none focus:border-[#538d4e]/50 transition-colors"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className="text-xs text-[#e74c3c] bg-[#e74c3c]/10 border border-[#e74c3c]/20 rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.015 }}
              whileTap={{ scale: loading ? 1 : 0.97 }}
              className="mt-1 h-11 rounded-xl bg-[#538d4e] hover:bg-[#6aaa64] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </motion.button>
          </form>

          <p className="mt-6 text-center text-sm text-[#5c5c66]">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-[#6aaa64] hover:text-[#538d4e] font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
