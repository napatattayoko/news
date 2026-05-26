'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Validate email format
  const validateEmail = (val: string) => {
    if (!val) {
      setEmailError('กรุณากรอกอีเมลของคุณ');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      setEmailError('รูปแบบอีเมลไม่ถูกต้อง (เช่น user@example.com)');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    
    // Check validation first
    const isValid = validateEmail(email);
    if (!isValid) {
      setSubmitError('กรุณากรอกอีเมลในรูปแบบที่ถูกต้อง');
      return;
    }

    setIsLoading(true);

    try {
      // MOCK SERVER DELAY: 1.5 seconds
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // Redirect to set-new-password page directly
      router.push('/reset-password');

    } catch (error: any) {
      setSubmitError(error.message || 'ไม่สามารถทำรายการได้ในขณะนี้');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full rounded-2xl bg-gradient-to-tr from-transparent via-transparent via-[60%] to-[#0D7FF2]/60 p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-slate-800/40 backdrop-blur-sm">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white tracking-wide">
          IMPACT TERMINAL
        </h1>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Forgot password</h2>
        <p className="text-xs text-slate-400 mt-1">
          Please enter your email to reset the password
        </p>
      </div>

      {submitError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-md p-3 mb-5 font-medium text-center animate-pulse">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Address */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 ml-1">
            Email Address
          </label>
          <input
            type="text"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) validateEmail(e.target.value);
            }}
            onBlur={() => validateEmail(email)}
            placeholder="name@example.com"
            disabled={isLoading}
            className={`w-full bg-[#20293a] border ${
              emailError ? 'border-red-500 focus:ring-red-500' : 'border-[#334155] focus:border-[#3b82f6] focus:ring-[#3b82f6]'
            } rounded-md px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition-colors`}
            required
          />
          {emailError && (
            <p className="text-xs text-red-500 ml-1 font-medium">{emailError}</p>
          )}
        </div>

        {/* Reset Password Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-gradient-to-r from-[#2c4e9e] to-[#1e3b7c] hover:from-[#345ab5] hover:to-[#254694] disabled:from-slate-700 disabled:to-slate-800 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg transition-all"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>กำลังดำเนินการ...</span>
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </div>
      </form>

      {/* Back to login */}
      <div className="text-center mt-6">
        <Link href="/login" className="text-xs text-slate-400 hover:text-white hover:underline transition-colors">
          Back to Login
        </Link>
      </div>
    </div>
  );
}
