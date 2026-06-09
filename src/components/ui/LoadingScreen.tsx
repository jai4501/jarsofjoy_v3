import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Sparkles } from 'lucide-react';

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

  // Floating decoration coordinates
  const floatingItems = [
    { emoji: "🍪", x: "15%", y: "20%", delay: 0, scale: 1 },
    { emoji: "🧁", x: "80%", y: "15%", delay: 1.5, scale: 0.9 },
    { emoji: "🍰", x: "75%", y: "75%", delay: 0.7, scale: 1.1 },
    { emoji: "🍯", x: "20%", y: "70%", delay: 2.2, scale: 0.95 },
    { emoji: "✨", x: "50%", y: "12%", delay: 0.3, scale: 1.2 },
    { emoji: "✨", x: "85%", y: "45%", delay: 1.8, scale: 0.8 },
    { emoji: "💖", x: "12%", y: "45%", delay: 2.5, scale: 1 },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-tr from-[#FFF0F3] via-[#FFF8FA] to-[#FDE8EC] flex flex-col items-center justify-center relative overflow-hidden select-none">
      {/* Background radial soft light overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(253,232,236,0.3)_0%,transparent_70%)] pointer-events-none" />

      {/* Floating Sparkles & Dessert Particles */}
      {floatingItems.map((item, idx) => (
        <motion.div
          key={idx}
          className="absolute text-2xl filter drop-shadow-sm opacity-25"
          style={{ left: item.x, top: item.y }}
          animate={{
            y: [0, -15, 0],
            rotate: [0, 10, -10, 0],
            scale: [item.scale, item.scale * 1.05, item.scale],
          }}
          transition={{
            duration: 5 + (idx % 3),
            repeat: Infinity,
            delay: item.delay,
            ease: "easeInOut",
          }}
        >
          {item.emoji}
        </motion.div>
      ))}

      {/* Main Logo Card */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Pulsing Outer Glow Wrapper */}
        <div className="relative mb-8 flex items-center justify-center">
          <motion.div
            className="absolute h-36 w-36 rounded-full bg-brand/10 blur-xl pointer-events-none"
            animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Logo Frame Container */}
          <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-[2rem] p-1 bg-gradient-to-tr from-gold via-white to-gold shadow-luxury flex items-center justify-center overflow-hidden border border-white/80">
            <div className="w-full h-full rounded-[1.8rem] overflow-hidden bg-white flex items-center justify-center relative">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Jars of Joy Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-4xl text-brand">🍯</div>
              )}
            </div>

            {/* Glowing heartbeat heart badge */}
            <motion.div
              className="absolute -bottom-1 -right-1 h-8 w-8 bg-brand rounded-full flex items-center justify-center border border-white shadow-md text-white"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Heart size={14} className="fill-white" />
            </motion.div>
          </div>
        </div>

        {/* Brand Name */}
        <h2 className="heading-cursive text-3xl sm:text-4xl text-brand mb-2 tracking-wide">
          Jars of Joy
        </h2>

        {/* Loading Progress bar */}
        <div className="w-40 sm:w-48 h-1 bg-brand/10 rounded-full overflow-hidden relative mb-6 shadow-inner">
          <motion.div
            className="h-full bg-brand rounded-full absolute left-0"
            animate={{
              left: ["-100%", "100%"],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ width: "40%" }}
          />
        </div>

        {/* Status Text with AnimatePresence for smooth transitions */}
        <div className="h-6 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={displayMessage}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 0.65, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
              className="text-[10px] sm:text-xs font-bold text-brand-dark uppercase tracking-widest text-center flex items-center justify-center gap-1.5"
            >
              <Sparkles size={12} className="text-gold fill-gold animate-spin-slow" />
              {displayMessage}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
