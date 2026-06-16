"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle2, ArrowRightLeft, QrCode, Copy, Upload, Check, PenLine } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

function BankTransferModalContent({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col">
      <h3 className="text-sm font-medium text-white mb-6">Bank Account Detail</h3>

      <div className="bg-[#222F44] rounded-xl p-4 flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-white p-1">
          <Image
            src="/images/session-subscription/kbank.png"
            alt="KBank Logo"
            width={48}
            height={48}
            className="w-full h-full object-contain"
            unoptimized
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-white font-bold text-base truncate">Kbank <span className="font-normal text-[#808080] text-sm">(Kasikorn Bank)</span></p>
          <p className="text-sm text-[#808080] truncate mt-0.5">Mr.Chalearmpol Neamsri</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[#808080] text-sm font-mono">047-2-27169-7</p>
            <button
              onClick={() => copyToClipboard("0472271697")}
              className="text-[#808080] hover:text-white transition-colors"
              title="Copy Account Number"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <button className="w-full py-3.5 rounded-xl bg-[#F1F5F9] text-[#0f172a] hover:bg-white font-bold text-sm mb-4 transition-colors">
        Upload Slip
      </button>

      <div className="flex gap-4">
        <button
          onClick={onClose}
          className="flex-1 py-3.5 rounded-xl bg-[#23344D] text-white hover:bg-[#2A3F5C] font-medium text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            alert("Confirm Clicked");
            onClose();
          }}
          className="flex-1 py-3.5 rounded-xl bg-[#334155] text-white hover:bg-[#475569] font-medium text-sm transition-colors"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

function PromptPayModalContent({ price, onClose }: { price: number, onClose: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <h3 className="text-xl font-bold text-white mb-6">Scan QR Code</h3>

      <div className="bg-white p-4 rounded-2xl mb-6">
        <div className="w-48 h-48 flex items-center justify-center rounded-lg overflow-hidden">
          <Image
            src="/images/session-subscription/qr.png"
            alt="PromptPay QR Code"
            width={192}
            height={192}
            className="w-full h-full object-contain"
            unoptimized
          />
        </div>
      </div>

      <p className="text-white font-bold text-base">Kbank <span className="font-normal text-[#808080] text-sm">(Kasikorn Bank)</span></p>
      <p className="text-sm text-[#808080] mt-1">Mr.Chalearmpol Neamsri</p>
      <p className="text-[#808080] text-sm font-mono mt-1">xxx-x-x7169-x</p>
      <p className="text-[#808080] text-sm font-mono mt-1 mb-6">0000000000000</p>

      <div className="flex w-full gap-4">
        <button
          onClick={() => {
            alert("Simulate Success!");
            onClose();
          }}
          className="flex-1 py-3.5 rounded-xl bg-[#0D7FF2] hover:bg-[#0B6FD4] text-white font-medium text-sm transition-colors"
        >
          Simulate Success
        </button>
        <button
          onClick={() => {
            alert("Simulate Failed!");
            onClose();
          }}
          className="flex-1 py-3.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white font-medium text-sm transition-colors"
        >
          Simulate Failed
        </button>
      </div>
    </div>
  );
}

type PlanType = "monthly" | "yearly";
type PaymentMethod = "bank" | "promptpay" | null;

const PLAN_DETAILS = {
  monthly: {
    id: "monthly",
    name: "Monthly",
    price: 299,
    description: "แพ็กเกจรายเดือน สำหรับผู้ที่ต้องการติดตามข่าวสารระยะสั้น",
  },
  yearly: {
    id: "yearly",
    name: "Yearly",
    price: 1899,
    description: "แพ็กเกจรายปี สุดคุ้ม ประหยัดกว่าสำหรับนักลงทุนระยะยาว",
  }
};

const FEATURES = [
  "ใช้งานฟีเจอร์ Wishlist เพิ่มหุ้นที่สนใจ",
  "ติดตามความเคลื่อนไหวหุ้นต่างๆ",
  "บทวิเคราะห์เชิงลึก",
];

export function SubscriptionCheckout() {
  const [plan, setPlan] = useState<PlanType>("monthly");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const selectedPlan = PLAN_DETAILS[plan];

  const handleCompletePurchase = () => {
    if (!paymentMethod) {
      alert("กรุณาเลือกวิธีการชำระเงิน");
      return;
    }
    setIsModalOpen(true);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 px-4 md:px-6 pb-12">
      {/* Title */}
      <div>
        <h1 className="text-lg font-extrabold text-white uppercase tracking-wide mb-1">SUBSCRIPTION & CHECKOUT</h1>
        <p className="text-[#808080] text-sm">เลือกแพ็กเกจและวิธีการชำระเงินเพื่อเข้าถึงฟีเจอร์พรีเมียม</p>
      </div>

      {/* Plan Selection Card */}
      <div className="bg-[#0a1017] border border-[#222F44] rounded-xl p-5">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left Column: Plan Details */}
          <div className="flex-1 space-y-6">
            <div className="flex items-center gap-2 bg-[#1A1A1A] border border-[#222F44] p-1 rounded-xl w-fit">
              <button
                onClick={() => setPlan("monthly")}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${plan === "monthly" ? "bg-[#0D7FF2] text-white" : "text-[#808080] hover:text-white"
                  }`}
              >
                รายเดือน
              </button>
              <button
                onClick={() => setPlan("yearly")}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${plan === "yearly" ? "bg-[#0D7FF2] text-white" : "text-[#808080] hover:text-white"
                  }`}
              >
                รายปี
              </button>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white mb-2">{selectedPlan.name} Premium</h2>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold text-[#0D7FF2]">{selectedPlan.price.toLocaleString()}฿</span>
                <span className="text-[#808080]">/ {plan === "monthly" ? "เดือน" : "ปี"}</span>
              </div>
              <p className="text-[#808080] text-sm leading-relaxed">
                {selectedPlan.description}
              </p>
            </div>
          </div>

          {/* Right Column: Features */}
          <div className="flex-1 bg-[#1A1A1A] rounded-xl p-6 border border-[#222F44]">
            <h3 className="text-base font-bold text-white mb-4">สิ่งที่คุณจะได้รับ (What&apos;s included)</h3>
            <ul className="space-y-4">
              {FEATURES.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#0D7FF2] shrink-0 mt-0.5" />
                  <span className="text-[#B3B3B3] text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="bg-[#0a1017] border border-[#222F44] rounded-xl p-5">
        <h3 className="text-base font-bold mb-3 text-white">Payment Method</h3>
        <div className="flex gap-4">
          <button
            onClick={() => { setPaymentMethod('bank'); setIsModalOpen(true); }}
            className={`flex-1 rounded-xl py-4 flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'bank'
              ? 'bg-[#0D7FF2]/10 border border-[#0D7FF2] text-[#0D7FF2]'
              : 'bg-[#1A1A1A] border border-[#222F44] text-[#808080] hover:text-white'
              }`}
          >
            <ArrowRightLeft className="w-6 h-6" />
            <span className="text-sm font-bold">Bank Transfer</span>
          </button>
          <button
            onClick={() => { setPaymentMethod('promptpay'); setIsModalOpen(true); }}
            className={`flex-1 rounded-xl py-4 flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'promptpay'
              ? 'bg-[#0D7FF2]/10 border border-[#0D7FF2] text-[#0D7FF2]'
              : 'bg-[#1A1A1A] border border-[#222F44] text-[#808080] hover:text-white'
              }`}
          >
            <QrCode className="w-6 h-6" />
            <span className="text-sm font-bold">PromptPay</span>
          </button>
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-[#0a1017] border border-[#222F44] rounded-xl p-5 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-white">Order Summary</h3>

        </div>

        <div className="flex justify-between items-center text-sm mb-2">
          <span className="text-[#808080] font-medium">{plan === 'monthly' ? 'Monthly' : 'Yearly'}</span>
          <span className="text-[#B3B3B3] font-medium">1 Tools</span>
        </div>


        <hr className="border-[#222F44] my-4" />

        <div className="flex justify-between items-end mb-4">
          <div>
            <div className="text-xs text-[#808080] font-bold mb-2 uppercase tracking-widest">TOTAL AMOUNT</div>
            <div className="text-4xl font-bold text-[#0D7FF2] tracking-tight">{selectedPlan.price.toLocaleString()}฿</div>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          <button
            onClick={handleCompletePurchase}
            className="w-full bg-[#0D7FF2] hover:bg-[#0B6FD4] text-white font-semibold py-3.5 rounded-xl transition-colors"
          >
            Complete Purchase
          </button>
          <button className="w-full text-[#808080] hover:text-white text-sm py-2 font-medium transition-colors">
            Cancel
          </button>
        </div>
      </div>

      {/* Spacer to prevent bottom-clipping in scrollable flex layouts */}
      <div className="h-16" />

      {/* Payment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      >
        {paymentMethod === "bank" && (
          <BankTransferModalContent onClose={() => setIsModalOpen(false)} />
        )}
        {paymentMethod === "promptpay" && (
          <PromptPayModalContent price={selectedPlan.price} onClose={() => setIsModalOpen(false)} />
        )}
      </Modal>
    </div>
  );
}
