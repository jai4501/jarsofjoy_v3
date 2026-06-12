import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Home, Utensils, ShoppingBag, ShieldCheck, ShoppingCart, User, Heart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { useUserStore } from '../store/useUserStore';
import { useSettingsStore } from '../store/useSettingsStore';

export const Navbar = () => {
  const location = useLocation();
  const { items, setIsCartOpen } = useCartStore();
  const { user, profile, isAdmin } = useUserStore();
  const { getSetting } = useSettingsStore();
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const businessName = getSetting('business_name', 'Jars of Joy');
  const businessLogo = getSetting('business_logo', '/business_logo_new.jpg');

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  const navItems = [
    { path: '/', icon: <Home size={20} />, label: 'Home' },
    { path: '/menu', icon: <Utensils size={20} />, label: 'Menu' },
    { path: '/favorites', icon: <Heart size={20} />, label: 'Favorites' },
    { path: '/orders', icon: <ShoppingBag size={20} />, label: 'Orders' },
  ];

  return (
    <>
      {/* Universal Bottom Navigation for Mobile Quick Access */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-3rem)] max-w-lg">
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="luxury-glass !rounded-[2.5rem] px-6 py-3 flex items-center justify-around border-white/40 shadow-luxury"
        >
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/menu' && location.pathname.startsWith('/menu'));
            return (
              <Link key={item.path} to={item.path} className="relative flex flex-col items-center gap-1 group">
                <div className={`p-2 rounded-full transition-all duration-300 ${isActive ? 'bg-brand text-white shadow-soft scale-110' : 'text-brand-dark/45 group-hover:text-brand'}`}>
                  {item.icon}
                </div>
                <span className={`text-[8px] font-black uppercase tracking-widest transition-colors ${isActive ? 'text-brand' : 'text-brand-dark/30 group-hover:text-brand-dark/60'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          
          {isAdmin && (
            <Link to="/admin" className="relative flex flex-col items-center gap-1 group border-l border-brand/10 pl-2">
              <div className="p-2.5 rounded-full text-brand-dark/45 group-hover:bg-brand group-hover:text-white transition-all">
                <ShieldCheck size={18} />
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-brand-dark/30">Admin</span>
            </Link>
          )}
        </motion.div>
      </nav>

      {/* Sticky Header Panel */}
      <nav className={`fixed top-0 left-0 right-0 z-[120] transition-all duration-300 ${
        isScrolled 
          ? 'bg-cream/90 backdrop-blur-md border-b border-white/40 shadow-soft' 
          : 'bg-transparent border-b border-transparent shadow-none'
      }`}>
        <div className="container mx-auto px-4 sm:px-8 h-16 sm:h-20 flex items-center justify-between relative">
          
          {/* Left: Logo Squircle */}
          <Link to="/" className="flex items-center gap-3 group z-10" title="Home">
            <div className="w-10 h-10 bg-white/50 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-sm border border-white/50 overflow-hidden group-hover:scale-110 transition-all">
               {businessLogo ? (
                 <img src={businessLogo} className="w-full h-full object-cover" alt="Logo" />
               ) : (
                 <span className="text-xl">🍯</span>
               )}
            </div>
            <span className="heading-cursive text-xl sm:text-2xl text-brand leading-none">{businessName}</span>
          </Link>

          {/* Right: Actions (Cart & Profile) */}
          <div className="flex items-center gap-3">
            {/* Cart Button */}
            <button 
              onClick={() => setIsCartOpen(true)}
              className="h-10 px-4 bg-white/40 backdrop-blur-sm rounded-full flex items-center gap-2 border border-brand/10 hover:bg-brand hover:text-white transition-all group active:scale-95 shadow-sm"
            >
              <ShoppingCart className="text-brand group-hover:text-white" size={16} />
              <span className="font-black text-brand group-hover:text-white text-xs">{cartCount}</span>
            </button>

            {/* Profile Avatar / Icon Link */}
            <Link to="/profile" className="z-10" title="Profile">
              {user ? (
                (profile as any)?.avatar_url ? (
                  <div className="w-10 h-10 rounded-full border-2 border-white shadow-soft overflow-hidden bg-white hover:scale-105 active:scale-95 transition-all flex items-center justify-center">
                    <img src={(profile as any).avatar_url} className="w-full h-full object-cover" alt="Profile" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full border-2 border-white shadow-soft overflow-hidden bg-brand/10 text-brand flex items-center justify-center font-black text-xs hover:scale-105 active:scale-95 transition-all">
                    {profile?.full_name?.slice(0, 2).toUpperCase() || 'JO'}
                  </div>
                )
              ) : (
                <div className="w-10 h-10 bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center border border-brand/10 text-brand hover:scale-105 active:scale-95 transition-all shadow-sm">
                  <User size={18} />
                </div>
              )}
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
};
