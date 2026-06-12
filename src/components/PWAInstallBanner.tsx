import { useState, useEffect } from 'react';
import { Download, X, Sparkles } from 'lucide-react';

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

  useEffect(() => {
    // 1. Detect if the app is already running in standalone mode (installed app)
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      return;
    }

    // 2. Check if the user previously dismissed the prompt
    const isDismissed = localStorage.getItem('pwa_prompt_dismissed') === 'true';
    if (isDismissed) {
      return;
    }

    // 3. Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // Store the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Listen for successful installation
    const handleAppInstalled = () => {
      console.log('Jars of Joy PWA was installed successfully!');
      localStorage.setItem('pwa_prompt_dismissed', 'true'); // Hide forever
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the browser install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install prompt outcome: ${outcome}`);

    // Clean up
    setDeferredPrompt(null);
    setIsVisible(false);

    // If they accept or dismiss, don't spam them again during this session
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  const handleDismissClick = () => {
    // Save to localStorage so they are never asked again
    localStorage.setItem('pwa_prompt_dismissed', 'true');
    setIsVisible(false);
  };

  if (!isVisible || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-fade-in">
      <div className="bg-white rounded-3xl p-5 shadow-2xl border border-brand/10 backdrop-blur-md bg-white/95 flex flex-col gap-4 relative overflow-hidden">
        {/* Decorative corner light */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-brand/10 rounded-full blur-xl pointer-events-none" />
        
        {/* Header with Circular Logo and Title */}
        <div className="flex items-start gap-3.5 pr-6">
          <div className="relative flex-shrink-0">
            {/* Cute circular favicon frame */}
            <div className="w-12 h-12 rounded-full border-2 border-brand overflow-hidden shadow-md bg-white p-0.5">
              <img 
                src="/business_logo_new.jpg" 
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

        {/* Small Close Icon top-right */}
        <button 
          onClick={handleDismissClick}
          className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full bg-brand-dark/5 hover:bg-brand-dark/10 text-brand-dark/50 flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
