import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Send, X } from 'lucide-react';
import { Button3D } from './ui/Button3D';
import { useSettingsStore } from '../store/useSettingsStore';

interface CongratsModalProps {
  isOpen: boolean;
  onClose: () => void;
  placedOrderId: string;
  orderGrandTotal: number;
}

export const CongratsModal = ({ isOpen, onClose, placedOrderId, orderGrandTotal }: CongratsModalProps) => {
  const { getSetting } = useSettingsStore();
  const whatsappNumber = getSetting('whatsapp_number', '+917695964392');

  const handleWhatsAppRedirect = () => {
    const orderIdShort = placedOrderId.startsWith('JOJ') ? placedOrderId : placedOrderId.slice(0, 8).toUpperCase();
    const message = `🍯 *New Storefront Order placed!*\n\n` +
      `*Order ID:* #INV-${orderIdShort}\n` +
      `*Total Amount:* ₹${orderGrandTotal}\n\n` +
      `Please confirm my order! 💛`;

    const cleanedNumber = whatsappNumber.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanedNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
        {/* Backdrop Blur Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-brand-dark/20 backdrop-blur-sm"
        />

        {/* Modal Panel container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-sm bg-gradient-to-b from-[#FFF5F7] to-white rounded-[2.5rem] border border-brand/10 shadow-luxury overflow-hidden p-8 text-center flex flex-col items-center space-y-6 z-10 animate-fade-in"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/60 hover:bg-brand/5 border border-brand/5 rounded-full text-brand-dark/40 hover:text-brand transition-colors"
          >
            <X size={18} />
          </button>

          <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-100/50">
            <CheckCircle2 size={44} className="stroke-[1.5]" />
          </div>

          <div className="space-y-2">
            <h3 className="heading-serif text-2xl font-black text-brand-dark">
              Congratulations! 🎉
            </h3>
            <p className="text-xs font-semibold text-brand-dark/55 leading-relaxed">
              Your order has been successfully created and your payment is under verification. You will be notified once the payment has been verified. 🧁✨
            </p>
            
            {placedOrderId ? (
              <div className="mt-4 inline-block px-4 py-2 bg-brand/5 border border-brand/10 rounded-2xl">
                <p className="text-[10px] font-black text-brand uppercase tracking-widest leading-none">Order ID</p>
                <p className="text-sm font-bold text-brand-dark font-mono mt-1">#{placedOrderId}</p>
              </div>
            ) : (
              <div className="mt-4 inline-block px-4 py-2 bg-brand/5 border border-brand/10 rounded-2xl animate-pulse">
                <p className="text-[10px] font-black text-brand uppercase tracking-widest leading-none">Saving Order...</p>
                <p className="text-sm font-bold text-brand-dark/40 font-mono mt-1">Please wait</p>
              </div>
            )}
          </div>

          <div className="w-full space-y-3">
            <Button3D
              onClick={handleWhatsAppRedirect}
              disabled={!placedOrderId}
              className="w-full h-14 bg-brand text-white flex items-center justify-center gap-2 text-xs uppercase tracking-widest rounded-full shadow-lg hover:bg-brand-dark disabled:opacity-50"
            >
              <Send size={16} /> {placedOrderId ? 'Send WhatsApp Message' : 'Loading Order Details...'}
            </Button3D>
            <button
              onClick={onClose}
              className="w-full text-[10px] font-black uppercase tracking-widest text-brand-dark/40 hover:text-brand transition-colors"
            >
              Keep Shopping
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
