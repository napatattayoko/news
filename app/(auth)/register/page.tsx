'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement registration logic
    console.log('Register attempt:', { username, email, password });
  };

  return (
    <div className="w-full rounded-2xl bg-gradient-to-tr from-transparent via-transparent via-[60%] to-[#0D7FF2]/60 p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white tracking-wide">
          IMPACT TERMINAL
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Username */}
        <div className="space-y-3">
          <label className="text-xs  text-white ml-1">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-[#20293a] border border-white rounded-md px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-colors"
            required
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs text-white ml-1">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#20293a] border border-white rounded-md px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-colors"
            required
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-xs text-white ml-1">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#20293a] border border-white rounded-md px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-colors pr-10"
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

        {/* Create Account Button */}
        <div className="pt-4">
          <button
            type="submit"
            className="w-full py-2.5 rounded-md bg-gradient-to-r from-[#2c4e9e] to-[#1e3b7c] hover:from-[#345ab5] hover:to-[#254694] text-white text-sm font-semibold shadow-lg transition-all"
          >
            Create Account
          </button>
        </div>
      </form>

      {/* Sign in link */}
      <div className="text-center mt-4">
        <span className="text-[12px] text-white">
          Already have an account?{' '}
          <Link href="/login" className="text-white underline font-medium">
            Sign in here
          </Link>
        </span>
      </div>
    </div>
  );
}
