import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingScreenProps {
  message?: string;
}

const BAKING_PHRASES = [
  "Preheating the ovens with love...",
  "Gathering the finest chocolate...",
  "Baking happiness in every bite...",
  "Folding in the chocolate chips...",
  "Sealing your jars of joy...",
];

export const LoadingScreen = ({ message }: LoadingScreenProps) => {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Retrieve logo url from local storage cache immediately for instant branding
  useEffect(() => {
    try {
      const cached = localStorage.getItem('site_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.business_logo) {
          setLogoUrl(parsed.business_logo);
        }
      }
    } catch (e) {
      console.warn("Failed to parse cached logo for loader", e);
    }
  }, []);

  // Cycle phrases for a fun, premium waiting experience
  useEffect(() => {
    if (message) return; // Keep custom message static if passed
    const interval = setInterval(() => {
      setPhraseIdx((prev) => (prev + 1) % BAKING_PHRASES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [message]);

  const displayMessage = message || BAKING_PHRASES[phraseIdx];



  return (
    <div className="fixed inset-0 bg-[#fdfbf7] z-[9999] flex flex-col items-center justify-center pointer-events-none">
      <div className="relative w-[120px] h-[120px] mb-[40px] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">
        <div className="absolute -inset-[12px] border-[3px] border-transparent border-t-[#863bff] border-b-[#ff3b86] rounded-full animate-[spin_1.5s_cubic-bezier(0.68,-0.55,0.265,1.55)_infinite]" />
        <img src={logoUrl || '/business_logo_new.webp'} alt="Jars of Joy Logo" className="w-full h-full object-cover rounded-full shadow-[0_20px_40px_-10px_rgba(134,59,255,0.3)]" />
      </div>
      
      <div className="h-6 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={displayMessage}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 0.65, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.3 }}
            className="text-[#863bff] font-black tracking-[0.25em] uppercase text-[11px] animate-[pulse_2s_ease-in-out_infinite]"
          >
            {displayMessage}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
};
