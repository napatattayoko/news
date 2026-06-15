"use client";

import { useState } from "react";
import { CheckCircle2, ArrowRightLeft, QrCode, Copy, Upload, Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

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
  "ติดตามความเคลื่อนไหวหุ้น บมจ. ต่างๆ",
  "อ่านบทความพรีเมียมและบทวิเคราะห์เชิงลึก",
  "ไม่มีโฆษณาคั่นระหว่างการอ่าน"
];

export function SubscriptionCheckout() {
  const [plan, setPlan] = useState<PlanType>("monthly");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedPlan = PLAN_DETAILS[plan];

  const handleCompletePurchase = () => {
    if (!paymentMethod) {
      alert("กรุณาเลือกวิธีการชำระเงิน");
      return;
    }
    setIsModalOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Subscription & Checkout</h1>
        <p className="text-gray-400">เลือกแพ็กเกจและวิธีการชำระเงินเพื่อเข้าถึงฟีเจอร์พรีเมียม</p>
      </div>

      {/* Plan Selection Card */}
      <div className="bg-[#1e293b] rounded-2xl p-6 md:p-8 border border-white/5 shadow-lg">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left Column: Plan Details */}
          <div className="flex-1 space-y-6">
            <div className="flex items-center gap-4 bg-[#0f172a] p-1 rounded-xl w-fit">
              <button
                onClick={() => setPlan("monthly")}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                  plan === "monthly" ? "bg-cyan-500 text-white shadow-md" : "text-gray-400 hover:text-white"
                }`}
              >
                รายเดือน
              </button>
              <button
                onClick={() => setPlan("yearly")}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                  plan === "yearly" ? "bg-cyan-500 text-white shadow-md" : "text-gray-400 hover:text-white"
                }`}
              >
                รายปี
              </button>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white mb-2">{selectedPlan.name} Premium</h2>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-5xl font-bold text-cyan-400">{selectedPlan.price.toLocaleString()}฿</span>
                <span className="text-gray-400">/ {plan === "monthly" ? "เดือน" : "ปี"}</span>
              </div>
              <p className="text-gray-400 leading-relaxed">
                {selectedPlan.description}
              </p>
            </div>
          </div>

          {/* Right Column: Features */}
          <div className="flex-1 bg-[#0f172a] rounded-xl p-6 border border-white/5">
            <h3 className="text-lg font-medium text-white mb-4">สิ่งที่คุณจะได้รับ (What&apos;s included)</h3>
            <ul className="space-y-4">
              {FEATURES.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <span className="text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Payment Method */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-white">Payment Method</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setPaymentMethod("bank")}
              className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${
                paymentMethod === "bank"
                  ? "border-cyan-500 bg-cyan-500/10"
                  : "border-white/5 bg-[#1e293b] hover:border-white/20"
              }`}
            >
              <ArrowRightLeft className={`w-8 h-8 mb-3 ${paymentMethod === "bank" ? "text-cyan-400" : "text-gray-400"}`} />
              <span className={`font-medium ${paymentMethod === "bank" ? "text-cyan-400" : "text-gray-400"}`}>Bank Transfer</span>
            </button>
            
            <button
              onClick={() => setPaymentMethod("promptpay")}
              className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${
                paymentMethod === "promptpay"
                  ? "border-cyan-500 bg-cyan-500/10"
                  : "border-white/5 bg-[#1e293b] hover:border-white/20"
              }`}
            >
              <QrCode className={`w-8 h-8 mb-3 ${paymentMethod === "promptpay" ? "text-cyan-400" : "text-gray-400"}`} />
              <span className={`font-medium ${paymentMethod === "promptpay" ? "text-cyan-400" : "text-gray-400"}`}>PromptPay</span>
            </button>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-[#1e293b] rounded-xl p-6 border border-white/5 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-medium text-white mb-6">Order Summary</h3>
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-white font-medium">Premium Subscription</p>
                <p className="text-sm text-gray-400">{plan === "monthly" ? "รายเดือน" : "รายปี"}</p>
              </div>
              <p className="text-white font-medium">{selectedPlan.price.toLocaleString()} ฿</p>
            </div>
            
            <div className="h-px bg-white/10 my-4" />
            
            <div className="flex justify-between items-end mb-8">
              <div>
                <p className="text-sm text-gray-400 mb-1">TOTAL AMOUNT</p>
                <p className="text-3xl font-bold text-cyan-400">{selectedPlan.price.toLocaleString()}฿</p>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>Charged {plan === "monthly" ? "monthly" : "annually"}</p>
                <p>Cancel anytime</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleCompletePurchase}
            className="w-full py-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-lg transition-colors"
          >
            Complete Purchase
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={paymentMethod === "bank" ? "Bank Account Detail" : "Scan QR Code"}
      >
        {paymentMethod === "bank" && (
          <div className="space-y-6">
            <div className="bg-[#0f172a] rounded-xl p-6 border border-white/5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                {/* Placeholder for KBank logo */}
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xs">
                  KB
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-white font-medium truncate">Kbank (Kasikorn Bank)</p>
                <p className="text-sm text-gray-400 truncate">Newsweb Media Co., Ltd.</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-cyan-400 font-mono">047-2-27169-7</p>
                  <button 
                    onClick={() => copyToClipboard("0472271697")}
                    className="text-gray-400 hover:text-white transition-colors"
                    title="Copy Account Number"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button className="w-full py-3 rounded-xl bg-white text-slate-900 hover:bg-gray-200 font-semibold flex items-center justify-center gap-2 transition-colors">
              <Upload className="w-5 h-5" />
              Upload Slip
            </button>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-[#0f172a] text-white hover:bg-[#1e293b] font-medium transition-colors border border-white/10"
              >
                Cancel
              </button>
              <button className="flex-1 py-3 rounded-xl bg-gray-600 text-white hover:bg-gray-500 font-medium transition-colors">
                Confirm
              </button>
            </div>
          </div>
        )}

        {paymentMethod === "promptpay" && (
          <div className="space-y-6 flex flex-col items-center">
            <div className="bg-white p-4 rounded-2xl">
              {/* Fallback QR Code visualization */}
              <div className="w-48 h-48 bg-gray-100 flex items-center justify-center border-4 border-gray-200 rounded-lg">
                <QrCode className="w-32 h-32 text-slate-900" />
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-white font-medium">PromptPay QR</p>
              <p className="text-sm text-gray-400">Newsweb Media Co., Ltd.</p>
              <p className="text-cyan-400 font-mono mt-1">099-x-x7169-x</p>
              <p className="text-xl font-bold text-white mt-2">{selectedPlan.price.toLocaleString()} ฿</p>
            </div>

            <div className="flex w-full gap-4 pt-2">
              <button 
                onClick={() => {
                  alert("จำลองการจ่ายเงินสำเร็จ!");
                  setIsModalOpen(false);
                }}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
              >
                Simulate Success
              </button>
              <button 
                onClick={() => {
                  alert("จำลองการจ่ายเงินล้มเหลว!");
                  setIsModalOpen(false);
                }}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
              >
                Simulate Failed
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
