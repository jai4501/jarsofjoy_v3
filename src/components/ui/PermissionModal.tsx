import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { Button3D } from './Button3D';

export const PermissionModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if we already asked or if permission is already granted
    const hasAsked = localStorage.getItem('joj-permission-asked');
    const notificationPermission = 'Notification' in window ? Notification.permission : 'denied';

    if (!hasAsked && notificationPermission === 'default') {
      const timer = setTimeout(() => setIsOpen(true), 3000); // Show after 3 seconds
      return () => clearTimeout(timer);
    }
  }, []);

  const requestNotifications = async () => {
    setIsOpen(false); // Close immediately for better UX
    localStorage.setItem('joj-permission-asked', 'true');
    
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification('Sweet Success!', {
          body: 'You will now receive updates about your orders and special offers.',
          icon: '/favicon.svg'
        });
      }
    }
  };

  const handleClose = () => {
    localStorage.setItem('joj-permission-asked', 'true');
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-brand-dark/40 backdrop-blur-md"
          />
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white w-full max-w-md rounded-[3.5rem] p-10 shadow-luxury relative z-10 border border-brand/5 text-center"
          >
            <button 
              onClick={handleClose}
              className="absolute top-8 right-8 text-brand-dark/20 hover:text-brand transition-colors"
            >
              <X size={24} />
            </button>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="w-20 h-20 bg-brand/5 text-brand rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-soft">
                <Bell size={40} className="animate-bounce" />
              </div>
              <h3 className="heading-serif text-4xl text-brand-dark mb-4 tracking-tight">Stay Updated!</h3>
              <p className="text-brand-dark/60 font-medium leading-relaxed mb-10">
                Allow notifications to get instant alerts for your <span className="text-brand font-black">order status</span>, delivery updates, and exclusive <span className="text-brand font-black">promotions</span>.
              </p>
              <Button3D onClick={requestNotifications} className="w-full h-16 text-xs uppercase font-black tracking-widest">
                Enable Notifications
              </Button3D>
              <button 
                onClick={handleClose}
                className="mt-6 text-[10px] font-black uppercase tracking-widest text-brand-dark/20 hover:text-brand transition-colors"
              >
                Not Now
              </button>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
