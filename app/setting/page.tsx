'use client';

import { useState, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

type Tab = 'General' | 'Security' | 'Billing';

export default function SettingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('General');
  
  // Password visibility states
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [profileImage, setProfileImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setProfileImage(imageUrl);
    }
  };

  const handleSave = () => {
    toast.success('Settings Saved', 'Your changes have been saved successfully.');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a1017] min-h-screen">
      <div className="p-8 max-w-5xl">
        <h1 className="text-2xl font-bold text-white mb-8">Setting</h1>
        
        {/* Tabs */}
        <div className="flex items-center gap-3 mb-6">
          {(['General', 'Security', 'Billing'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-5 py-1.5 rounded-md text-sm font-medium transition-colors border",
                activeTab === tab 
                  ? "bg-[#0D7FF2]/10 border-[#0D7FF2] text-[#0D7FF2]" 
                  : "bg-[#1A2536] border-transparent text-slate-300 hover:text-white hover:bg-[#222F44]"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        
        {/* Divider */}
        <div className="h-px bg-[#222F44] w-full mb-10 -mt-2"></div>

        {/* Tab Content */}
        <div className="max-w-3xl">
          {activeTab === 'General' && (
            <div className="flex flex-col md:flex-row gap-12 md:gap-20">
              {/* Profile Photo */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <span className="text-sm text-slate-300 self-start">Profile Photo</span>
                <div 
                  className="w-36 h-36 bg-[#1A2536] rounded-xl border border-[#222F44] overflow-hidden flex items-center justify-center cursor-pointer relative group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-slate-500 text-sm group-hover:text-slate-300 transition-colors">Select Photo</span>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-1.5 bg-[#1A2536] border border-[#222F44] text-xs text-white rounded hover:bg-[#222F44] transition-colors mt-1"
                >
                  Change Picture
                </button>
              </div>

              {/* Form Fields */}
              <div className="flex-1 space-y-6 pt-1">
                <div className="space-y-2">
                  <label className="text-sm text-slate-300">Username</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#1A2536] border border-[#222F44] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#0D7FF2] transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-300">Email Address</label>
                  <input 
                    type="email" 
                    className="w-full bg-[#1A2536] border border-[#222F44] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#0D7FF2] transition-colors"
                  />
                </div>
                
                <div className="pt-4 flex justify-end">
                  <button 
                    onClick={handleSave}
                    className="px-6 py-2 bg-[#0D7FF2] text-white text-sm font-medium rounded-lg hover:bg-[#0D7FF2]/90 transition-colors"
                  >
                    Save Change
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Security' && (
            <div className="max-w-lg space-y-6">
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Current Password</label>
                <div className="relative">
                  <input 
                    type={showCurrent ? "text" : "password"} 
                    className="w-full bg-[#1A2536] border border-[#222F44] rounded-lg px-4 py-2.5 pr-12 text-white focus:outline-none focus:border-[#0D7FF2] transition-colors"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showCurrent ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300">New Password</label>
                <div className="relative">
                  <input 
                    type={showNew ? "text" : "password"} 
                    className="w-full bg-[#1A2536] border border-[#222F44] rounded-lg px-4 py-2.5 pr-12 text-white focus:outline-none focus:border-[#0D7FF2] transition-colors"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showNew ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Confirm Password</label>
                <div className="relative">
                  <input 
                    type={showConfirm ? "text" : "password"} 
                    className="w-full bg-[#1A2536] border border-[#222F44] rounded-lg px-4 py-2.5 pr-12 text-white focus:outline-none focus:border-[#0D7FF2] transition-colors"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showConfirm ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button 
                  onClick={handleSave}
                  className="px-6 py-2 bg-[#0D7FF2] text-white text-sm font-medium rounded-lg hover:bg-[#0D7FF2]/90 transition-colors"
                >
                  Save Change
                </button>
              </div>
            </div>
          )}

          {activeTab === 'Billing' && (
            <div className="flex items-center justify-center py-40">
              <h2 className="text-3xl font-bold text-white">Coming Soon</h2>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
