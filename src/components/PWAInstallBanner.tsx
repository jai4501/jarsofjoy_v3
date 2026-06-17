import { useState, useEffect } from 'react';
import { Download, X, Sparkles, Share, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // 1. Detect if the app is already running in standalone mode (installed app)
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      // Mark as installed and ensure prompt is dismissed
      localStorage.setItem('pwa_installed', 'true');
      localStorage.setItem('pwa_prompt_dismissed', 'true');
      return;
    }

    // 2. Check if it was previously installed but now we are back in browser mode (uninstalled)
    const wasInstalled = localStorage.getItem('pwa_installed') === 'true';
    if (wasInstalled) {
      // User must have uninstalled the PWA. Reset flags to ask again.
      localStorage.removeItem('pwa_installed');
      localStorage.removeItem('pwa_prompt_dismissed');
    }

    // 3. Check if the user previously dismissed the prompt
    const isDismissed = localStorage.getItem('pwa_prompt_dismissed') === 'true';
    if (isDismissed) {
      return;
    }

    // 4. Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);
    if (isIOSDevice) {
      // For iOS, show the banner after 2 seconds since beforeinstallprompt won't fire
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);
      return () => clearTimeout(timer);
    }

    // 5. Check if we already have the global deferred prompt
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
      setIsVisible(true);
    }

    // 6. Listen to custom event and standard beforeinstallprompt
    const handlePromptAvailable = () => {
      if ((window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt);
        setIsVisible(true);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('pwa-prompt-available', handlePromptAvailable);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 7. Listen for successful installation
    const handleAppInstalled = () => {
      console.log('Jars of Joy PWA was installed successfully!');
      localStorage.setItem('pwa_installed', 'true');
      localStorage.setItem('pwa_prompt_dismissed', 'true'); // Hide forever
      setIsVisible(false);
      setDeferredPrompt(null);
      (window as any).deferredPrompt = null;
      window.dispatchEvent(new CustomEvent('pwa-installed'));
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('pwa-prompt-available', handlePromptAvailable);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) return;

    // Show the browser install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install prompt outcome: ${outcome}`);

    // Clean up
    setDeferredPrompt(null);
    (window as any).deferredPrompt = null;
    setIsVisible(false);

    if (outcome === 'accepted') {
      localStorage.setItem('pwa_installed', 'true');
      window.dispatchEvent(new CustomEvent('pwa-installed'));
    }
    // If they accept or dismiss, don't spam them again during this session
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  const handleDismissClick = () => {
    // Save to localStorage so they are never asked again
    localStorage.setItem('pwa_prompt_dismissed', 'true');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (deferredPrompt || isIOS) && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="fixed top-20 left-4 right-4 md:top-24 md:left-auto md:right-4 md:max-w-sm z-[110]"
        >
          <div className="bg-white rounded-3xl p-5 shadow-2xl border border-brand/10 backdrop-blur-md bg-white/95 flex flex-col gap-4 relative overflow-hidden">
            {/* Decorative corner light */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-brand/10 rounded-full blur-xl pointer-events-none" />
            
            {showIOSInstructions ? (
              <>
                {/* Header with Circular Logo and Instructions */}
                <div className="flex items-start gap-3.5 pr-6">
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full border-2 border-brand overflow-hidden shadow-md bg-white p-0.5">
                      <img 
                        src="/business_logo_new.webp" 
                        alt="Jars of Joy Logo" 
                        className="w-full h-full object-cover rounded-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-serif font-black text-brand-dark text-xs uppercase tracking-tight">How to Install Jars of Joy</h4>
                    <div className="text-[10px] leading-relaxed text-brand-dark/75 space-y-1.5 font-semibold">
                      <p className="flex items-center gap-1.5">
                        1. Tap the <span className="p-1 px-1.5 bg-brand/5 border border-brand/10 rounded font-black inline-flex items-center gap-0.5 text-brand"><Share size={11} /> Share</span> button in Safari.
                      </p>
                      <p className="flex items-center gap-1.5">
                        2. Select <span className="p-1 px-1.5 bg-brand/5 border border-brand/10 rounded font-black inline-flex items-center gap-0.5 text-brand"><Plus size={11} /> Add to Home Screen</span>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Back Button */}
                <div className="flex gap-2.5">
                  <button
                    onClick={() => setShowIOSInstructions(false)}
                    className="flex-1 h-10 bg-brand text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Go Back
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Header with Circular Logo and Title */}
                <div className="flex items-start gap-3.5 pr-6">
                  <div className="relative flex-shrink-0">
                    {/* Cute circular favicon frame */}
                    <div className="w-12 h-12 rounded-full border-2 border-brand overflow-hidden shadow-md bg-white p-0.5">
                      <img 
                        src="/business_logo_new.webp" 
                        alt="Jars of Joy Logo" 
                        className="w-full h-full object-cover rounded-full"
                      />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center shadow-sm">
                      <Sparkles size={10} className="fill-white" />
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <h4 className="font-serif font-black text-brand-dark text-sm uppercase tracking-tight">Jars of Joy App</h4>
                    <p className="text-[10px] leading-normal font-semibold text-brand-dark/55">
                      Add Jars of Joy to your home screen for instant access to fresh treats! ✨
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2.5">
                  <button
                    onClick={handleInstallClick}
                    className="flex-1 h-10 bg-brand text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download size={13} />
                    Install App
                  </button>
                  
                  <button
                    onClick={handleDismissClick}
                    className="px-4 h-10 border border-brand/10 hover:bg-brand/5 text-brand-dark/45 hover:text-brand rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Not Now
                  </button>
                </div>
              </>
            )}

            {/* Small Close Icon top-right */}
            <button 
              onClick={handleDismissClick}
              className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full bg-brand-dark/5 hover:bg-brand-dark/10 text-brand-dark/50 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={12} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
