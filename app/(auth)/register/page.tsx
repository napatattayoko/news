'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Validate Username
  const validateUsername = (val: string) => {
    if (!val.trim()) {
      setUsernameError('กรุณากรอกชื่อผู้ใช้');
      return false;
    }
    if (val.trim().length < 3) {
      setUsernameError('ชื่อผู้ใช้ต้องมีความยาวอย่างน้อย 3 ตัวอักษร');
      return false;
    }
    setUsernameError('');
    return true;
  };

  // Validate Email
  const validateEmail = (val: string) => {
    if (!val.trim()) {
      setEmailError('กรุณากรอกอีเมล');
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

  // Validate Password
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

  // Validate Confirm Password
  const validateConfirmPassword = (val: string, passwordToCompare = password) => {
    if (!val) {
      setConfirmPasswordError('กรุณากรอกเพื่อยืนยันรหัสผ่าน');
      return false;
    }
    if (val !== passwordToCompare) {
      setConfirmPasswordError('รหัสผ่านไม่ตรงกัน');
      return false;
    }
    setConfirmPasswordError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    const isUsernameValid = validateUsername(username);
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    const isConfirmPasswordValid = validateConfirmPassword(confirmPassword);

    if (!isUsernameValid || !isEmailValid || !isPasswordValid || !isConfirmPasswordValid) {
      setSubmitError('กรุณากรอกข้อมูลการสมัครสมาชิกให้ถูกต้องและตรงกัน');
      return;
    }

    setIsLoading(true);

    try {
      // MOCK SERVER DELAY: 1.5 seconds
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Redirect to login screen after 1 second upon successful simulated registration
      router.push('/login');

    } catch (error: any) {
      setSubmitError(error.message || 'เกิดข้อผิดพลาดในการลงทะเบียน');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full rounded-2xl bg-gradient-to-tr from-bg-gradient-to-tr from-[#111722] via-[#111722] via-60% to-[#1e40af]/60 p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)]  backdrop-blur-sm">
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
        {/* Username */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 ml-1">
            Username
          </label>
          <input
            type="text"
            value={username}
            disabled={isLoading}
            onChange={(e) => {
              setUsername(e.target.value);
              if (usernameError) validateUsername(e.target.value);
            }}
            onBlur={() => validateUsername(username)}
            placeholder="ชื่อผู้ใช้"
            className={`w-full bg-[#20293a] border ${usernameError ? 'border-red-500 focus:ring-red-500 font-medium' : 'border-[#334155] focus:border-[#3b82f6] focus:ring-[#3b82f6]'
              } rounded-md px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition-colors`}
            required
          />
          {usernameError && (
            <p className="text-xs text-red-500 ml-1 font-medium">{usernameError}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 ml-1">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            disabled={isLoading}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) validateEmail(e.target.value);
            }}
            onBlur={() => validateEmail(email)}
            placeholder="user@example.com"
            className={`w-full bg-[#20293a] border ${emailError ? 'border-red-500 focus:ring-red-500 font-medium' : 'border-[#334155] focus:border-[#3b82f6] focus:ring-[#3b82f6]'
              } rounded-md px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition-colors`}
            required
          />
          {emailError && (
            <p className="text-xs text-red-500 ml-1 font-medium">{emailError}</p>
          )}
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
              disabled={isLoading}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) validatePassword(e.target.value);
                if (confirmPassword) validateConfirmPassword(confirmPassword, e.target.value);
              }}
              onBlur={() => validatePassword(password)}
              placeholder="รหัสผ่านอย่างน้อย 8 ตัวอักษร"
              className={`w-full bg-[#20293a] border ${passwordError ? 'border-red-500 focus:ring-red-500 font-medium' : 'border-[#334155] focus:border-[#3b82f6] focus:ring-[#3b82f6]'
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

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 ml-1">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              disabled={isLoading}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                validateConfirmPassword(e.target.value, password);
              }}
              onBlur={() => validateConfirmPassword(confirmPassword)}
              placeholder="ยืนยันรหัสผ่านของคุณ"
              className={`w-full bg-[#20293a] border ${confirmPasswordError ? 'border-red-500 focus:ring-red-500 font-medium' : 'border-[#334155] focus:border-[#3b82f6] focus:ring-[#3b82f6]'
                } rounded-md px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition-colors pr-10`}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {confirmPasswordError && (
            <p className="text-xs text-red-500 ml-1 font-medium">{confirmPasswordError}</p>
          )}
        </div>

        {/* Create Account Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-gradient-to-tr from-[#222730] via-[#222730] via-[10%] to-[#0D7FF2]/60 hover:brightness-125 hover:to-[#254694] disabled:from-slate-700 disabled:to-slate-800 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg transition-all"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>กำลังสร้างบัญชี...</span>
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </div>
      </form>

      {/* Sign in link */}
      <div className="text-center mt-4">
        <span className="text-[10px] text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="text-white hover:underline font-medium">
            Sign in here
          </Link>
        </span>
      </div>
    </div>
  );
}
