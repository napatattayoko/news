'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement login logic
    console.log('Login attempt:', { email, password, rememberMe });
  };

  return (
    <div className="w-full rounded-2xl bg-gradient-to-b from-[#193268] via-[#0d1830] to-[#0b1222] p-8 shadow-[0_0_40px_rgba(37,99,235,0.15)] border border-[#2a437e]/30">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white tracking-wide">
          IMPACT TERMINAL
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-1">
        {/* Username / Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 ml-1">
            Username / Email Address
          </label>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#20293a] border border-[#334155] rounded-md px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-colors"
            required
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 ml-1">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#20293a] border border-[#334155] rounded-md px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-colors pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-3.5 h-3.5 rounded-sm border-slate-500 bg-[#20293a] checked:bg-[#3b82f6] checked:border-[#3b82f6] focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-xs text-slate-300">Remember Me</span>
          </label>
          <Link href="/forgot-password" className="text-xs text-slate-300 hover:text-white transition-colors">
            Forgot password ?
          </Link>
        </div>

        {/* Sign In Button */}
        <div className="pt-2">
          <button
            type="submit"
            className="w-full py-2.5 rounded-md bg-gradient-to-r from-[#2c4e9e] to-[#1e3b7c] hover:from-[#345ab5] hover:to-[#254694] text-white text-sm font-semibold shadow-lg transition-all"
          >
            Sign In
          </button>
        </div>
      </form>

      {/* Sign up link */}
      <div className="text-center mt-4">
        <span className="text-[10px] text-slate-400">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-white hover:underline font-medium">
            Sign up here
          </Link>
        </span>
      </div>

      {/* Divider */}
      <div className="relative flex items-center py-5">
        <div className="flex-grow border-t border-slate-700/50"></div>
        <span className="flex-shrink-0 mx-4 text-xs font-medium text-slate-400">Or</span>
        <div className="flex-grow border-t border-slate-700/50"></div>
      </div>

      {/* Google Login */}
      <button
        type="button"
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-white hover:bg-gray-50 text-slate-800 text-xs font-bold transition-colors"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Sign in with google
      </button>
    </div>
  );
}
