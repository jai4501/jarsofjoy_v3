import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';

export const WhatsAppButton = () => {
  const { getSetting } = useSettingsStore();
  const phoneNumber = getSetting('whatsapp_number', '910000000000').replace(/\+/g, '');
  const message = getSetting('whatsapp_default_message', "Hi! I'd like to place an order.");
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  return (
    <motion.a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-28 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-deep flex items-center justify-center group"
    >
      <MessageCircle size={28} fill="currentColor" />
      <span className="absolute right-full mr-4 bg-white text-brand-dark px-4 py-2 rounded-xl shadow-soft text-sm font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-brand/5">
        Chat with Us
      </span>
    </motion.a>
  );
};
