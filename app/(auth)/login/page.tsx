'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Validate email or username format
  const validateEmail = (val: string) => {
    if (!val.trim()) {
      setEmailError('กรุณากรอกชื่อผู้ใช้หรืออีเมล');
      return false;
    }
    
    // If it looks like an email, validate standard format
    if (val.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val)) {
        setEmailError('รูปแบบอีเมลไม่ถูกต้อง (เช่น user@example.com)');
        return false;
      }
    } else {
      // Username check
      if (val.trim().length < 3) {
        setEmailError('ชื่อผู้ใช้ต้องมีความยาวอย่างน้อย 3 ตัวอักษร');
        return false;
      }
    }
    
    setEmailError('');
    return true;
  };

  // Validate password length
  const validatePassword = (val: string) => {
    if (!val) {
      setPasswordError('กรุณากรอกรหัสผ่าน');
      return false;
    }
    if (val.length < 8) {
      setPasswordError('รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      setSubmitError('กรุณากรอกข้อมูลเข้าสู่ระบบให้ถูกต้อง');
      return;
    }

    setIsLoading(true);

    try {
      // MOCK SERVER DELAY: 1.5 seconds
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // SIMULATION OF SUCCESS VS WRONG PASSWORD
      // ถ้ากรอกคำว่า "password" จะจำลองว่ารหัสผ่านผิด เพื่อให้ทดสอบ error flow ได้
      if (password.toLowerCase() === 'password') {
        throw new Error('รหัสผ่านผิด');
      }

      // Redirect to main Dashboard immediately upon successful simulated login
      router.push('/');

    } catch (error: any) {
      setSubmitError(error.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
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

      {submitError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-md p-3 mb-5 font-medium text-center animate-pulse">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username / Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 ml-1">
            Username / Email Address
          </label>
          <input
            type="text"
            value={email}
            disabled={isLoading}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) validateEmail(e.target.value);
            }}
            onBlur={() => validateEmail(email)}
            placeholder="ชื่อผู้ใช้ หรือ user@example.com"
            className={`w-full bg-[#20293a] border ${
              emailError ? 'border-red-500 focus:ring-red-500 font-medium' : 'border-[#334155] focus:border-[#3b82f6] focus:ring-[#3b82f6]'
            } rounded-md px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition-colors`}
            required
          />
          {emailError && (
            <p className="text-xs text-red-500 ml-1 font-medium">{emailError}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center ml-1">
            <label className="text-xs font-medium text-slate-300">
              Password
            </label>
            <span className="text-[10px] text-slate-500 italic">พิมพ์ "password" เพื่อจำลองรหัสผ่านผิด</span>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              disabled={isLoading}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) validatePassword(e.target.value);
              }}
              onBlur={() => validatePassword(password)}
              placeholder="รหัสผ่านอย่างน้อย 8 ตัวอักษร"
              className={`w-full bg-[#20293a] border ${
                passwordError ? 'border-red-500 focus:ring-red-500 font-medium' : 'border-[#334155] focus:border-[#3b82f6] focus:ring-[#3b82f6]'
              } rounded-md px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition-colors pr-10`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {passwordError && (
            <p className="text-xs text-red-500 ml-1 font-medium">{passwordError}</p>
          )}
        </div>

        {/* Options */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              disabled={isLoading}
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
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-gradient-to-r from-[#2c4e9e] to-[#1e3b7c] hover:from-[#345ab5] hover:to-[#254694] disabled:from-slate-700 disabled:to-slate-800 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg transition-all"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>กำลังเข้าสู่ระบบ...</span>
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </div>
      </form>

      {/* Sign up link */}
      <div className="text-center mt-4">
        <span className="text-[10px] text-slate-400">
          Don't have an account?{' '}
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
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-white hover:bg-gray-50 disabled:bg-slate-300 disabled:cursor-not-allowed text-slate-800 text-xs font-bold transition-colors cursor-pointer"
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
