'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EyeIcon, EyeOffIcon } from '../../../lib/constants';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Validate password length
  const validateNewPassword = (val: string) => {
    if (!val) {
      setNewPasswordError('กรุณากรอกรหัสผ่านใหม่');
      return false;
    }
    if (val.length < 8) {
      setNewPasswordError('รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร');
      return false;
    }
    setNewPasswordError('');
    return true;
  };

  // Validate passwords match
  const validateConfirmPassword = (val: string, passwordToCompare = newPassword) => {
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

    const isNewPasswordValid = validateNewPassword(newPassword);
    const isConfirmPasswordValid = validateConfirmPassword(confirmPassword);

    if (!isNewPasswordValid || !isConfirmPasswordValid) {
      setSubmitError('กรุณากรอกรหัสผ่านใหม่ให้ถูกต้องและตรงกัน');
      return;
    }

    setIsLoading(true);

    try {
      // MOCK SERVER DELAY: 1.5 seconds
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Redirect back to login directly after successful password update
      router.push('/login');

    } catch (error: any) {
      setSubmitError(error.message || 'ไม่สามารถรีเซ็ตรหัสผ่านได้ในขณะนี้');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full rounded-2xl bg-gradient-to-tr from-bg-gradient-to-tr from-[#111722] via-[#111722] via-60% to-[#1e40af]/60 p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] backdrop-blur-sm">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white tracking-wide">
          IMPACT TERMINAL
        </h1>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Set a new password</h2>
        <p className="text-xs text-slate-400 mt-1">
          Create a new password. Ensure it differs from previous ones for security
        </p>
      </div>

      {submitError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-md p-3 mb-5 font-medium text-center animate-pulse">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 ml-1">
            New Password
          </label>
          <div className="relative">
            <input
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (newPasswordError) validateNewPassword(e.target.value);
                if (confirmPassword) validateConfirmPassword(confirmPassword, e.target.value);
              }}
              onBlur={() => validateNewPassword(newPassword)}
              disabled={isLoading}
              placeholder="อย่างน้อย 8 ตัวอักษร"
              className={`w-full bg-[#20293a] border ${newPasswordError ? 'border-red-500 focus:ring-red-500' : 'border-[#334155] focus:border-[#3b82f6] focus:ring-[#3b82f6]'
                } rounded-md px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition-colors pr-10`}
              required
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              disabled={isLoading}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white hover:text-slate-200 transition-colors cursor-pointer"
            >
              {showNewPassword ? <EyeOffIcon className="w-[18px] h-[18px]" idSuffix="reset-new" /> : <EyeIcon className="w-[18px] h-[18px]" />}
            </button>
          </div>
          {newPasswordError && (
            <p className="text-xs text-red-500 ml-1 font-medium">{newPasswordError}</p>
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
                validateConfirmPassword(e.target.value, newPassword);
              }}
              onBlur={() => validateConfirmPassword(confirmPassword)}
              placeholder="กรอกรหัสผ่านอีกครั้ง"
              className={`w-full bg-[#20293a] border ${confirmPasswordError ? 'border-red-500 focus:ring-red-500' : 'border-[#334155] focus:border-[#3b82f6] focus:ring-[#3b82f6]'
                } rounded-md px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition-colors pr-10`}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isLoading}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white hover:text-slate-200 transition-colors cursor-pointer"
            >
              {showConfirmPassword ? <EyeOffIcon className="w-[18px] h-[18px]" idSuffix="reset-conf" /> : <EyeIcon className="w-[18px] h-[18px]" />}
            </button>
          </div>
          {confirmPasswordError && (
            <p className="text-xs text-red-500 ml-1 font-medium">{confirmPasswordError}</p>
          )}
        </div>

        {/* Update Password Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-gradient-to-tr from-[#222730] via-[#222730] via-[10%] to-[#0D7FF2]/60 p-8 shadow-[0_0_80px_rgba(0,0,0,0.8)] hover:brightness-125 hover:to-[#254694] disabled:from-slate-700 disabled:to-slate-800 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg transition-all"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>กำลังบันทึกรหัสผ่านใหม่...</span>
              </>
            ) : (
              'Update Password'
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
