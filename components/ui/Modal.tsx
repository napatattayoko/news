"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md rounded-2xl bg-[#131D2A] border border-[#222F44] shadow-2xl overflow-hidden p-6 sm:p-8">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-[#808080] hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Body */}
        <div className="relative z-0 mt-2">
          {children}
        </div>
      </div>
    </div>
  );
}
