import { useSearchParams, Link } from 'react-router-dom';
import { useSettingsStore } from '../store/useSettingsStore';
import { Shield, Truck, RotateCcw, Sparkles } from 'lucide-react';
import { Button3D } from '../components/ui/Button3D';
import { motion } from 'framer-motion';

export const Policies = () => {
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'privacy';
  const { getSetting } = useSettingsStore();

  const getPolicyContent = () => {
    switch (type) {
      case 'privacy':
        return {
          title: 'Privacy Policy',
          icon: <Shield size={32} className="text-brand" />,
          content: getSetting('policy_privacy_content', 'Your privacy is important to us. We only collect information necessary to process your orders and provide a sweet experience.')
        };
      case 'shipping':
        return {
          title: 'Shipping Policy',
          icon: <Truck size={32} className="text-brand" />,
          content: getSetting('policy_shipping_content', 'We deliver handcrafted happiness across your city. Delivery times may vary based on your location and the treats ordered.')
        };
      case 'refund':
        return {
          title: 'Refund Policy',
          icon: <RotateCcw size={32} className="text-brand" />,
          content: getSetting('policy_refund_content', 'Since our treats are freshly baked to order, we generally do not offer refunds. However, if there is a quality issue, please contact us immediately.')
        };
      default:
        return { title: 'Policy', icon: <Shield size={32} />, content: 'Please select a policy.' };
    }
  };

  const { title, icon, content } = getPolicyContent();

  return (
    <div className="min-h-screen bg-cream pb-40 pt-24 sm:pt-32">
      <div className="container mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto p-8 sm:p-16 rounded-[3.5rem] shadow-layer-2 border border-white/50 glass-panel"
        >
          <div className="flex flex-col items-center text-center mb-12">
             <div className="w-20 h-20 bg-white/50 backdrop-blur-sm rounded-[2rem] flex items-center justify-center mb-6 shadow-inner border border-white/40">
                {icon}
             </div>
             <h1 className="heading-serif text-4xl sm:text-6xl text-brand-dark mb-4">{title}</h1>
             <div className="flex items-center gap-2 text-brand/30">
                <Sparkles size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Official Store Policy</span>
                <Sparkles size={16} />
             </div>
          </div>

          <div className="prose prose-brand max-w-none">
             <p className="text-brand-dark/70 text-lg leading-relaxed font-medium whitespace-pre-wrap">
                {content}
             </p>
          </div>

          <div className="mt-16 pt-12 border-t border-brand/10 text-center">
             <p className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 mb-8">Need more clarification?</p>
             <Link to="/#contact">
                <Button3D variant="outline" className="px-10 !h-14 text-xs font-black uppercase tracking-widest">Contact {getSetting('owner_name', 'Support')}</Button3D>
             </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
