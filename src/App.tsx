import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { ToastContainer } from './components/ToastContainer';
import { ScrollToTop } from './components/ScrollToTop';
import { ScrollToTopButton } from './components/ui/ScrollToTopButton';
import { PermissionModal } from './components/ui/PermissionModal';
import PWAInstallBanner from './components/PWAInstallBanner';
import { useUserStore } from './store/useUserStore';
import { useSettingsStore } from './store/useSettingsStore';
import { useCartStore } from './store/useCartStore';
import { useProductStore } from './store/useProductStore';
import { CartDrawer } from './components/CartDrawer';
import { CongratsModal } from './components/CongratsModal';
import { supabase } from './lib/supabase';

// Static page imports for instantaneous navigation
import { Home } from './pages/Home';
import { Storefront as Menu } from './pages/Storefront';
import { Orders } from './pages/Orders';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';
import { Policies } from './pages/Policies';
import { Favorites } from './pages/Favorites';
import { AdminLayout } from './components/AdminLayout';
import { LoadingScreen } from './components/ui/LoadingScreen';

function App() {
  const { setUser, setInitialized, isAdmin, isInitialized: userInitialized } = useUserStore();
  const { fetchSettings, isInitialized: settingsInitialized } = useSettingsStore();
  const { isCartOpen, setIsCartOpen } = useCartStore();
  const { fetchCatalog } = useProductStore();

  const [showCongrats, setShowCongrats] = useState(false);
  const [congratsOrderId, setCongratsOrderId] = useState('');
  const [congratsOrderTotal, setCongratsOrderTotal] = useState(0);

  const handleCloseCongrats = () => {
    setShowCongrats(false);
    // Clear all checkout keys from localStorage
    localStorage.removeItem('joj_show_congrats');
    localStorage.removeItem('joj_checkout_step');
    localStorage.removeItem('joj_placed_order_id');
    localStorage.removeItem('joj_placed_order_uuid');
    localStorage.removeItem('joj_upi_txn_ref');
    localStorage.removeItem('joj_order_grand_total');
    localStorage.removeItem('joj_congrats_shown');
  };

  useEffect(() => {
    const checkCongratsState = () => {
      const showCongratsFlag = localStorage.getItem('joj_show_congrats') === 'true';
      const orderId = localStorage.getItem('joj_placed_order_id') || '';
      const orderTotalVal = localStorage.getItem('joj_order_grand_total');

      if (showCongratsFlag) {
        setCongratsOrderId(orderId);
        setCongratsOrderTotal(orderTotalVal ? parseFloat(orderTotalVal) : 0);
        setShowCongrats(true);
      } else {
        setShowCongrats(false);
      }
    };

    // Check on mount
    checkCongratsState();

    // Listen for custom events or focus changes
    window.addEventListener('joj_order_success', checkCongratsState);
    window.addEventListener('focus', checkCongratsState);
    
    // Periodically sync in case backend background write resolves order details
    const interval = setInterval(checkCongratsState, 1000);

    return () => {
      window.removeEventListener('joj_order_success', checkCongratsState);
      window.removeEventListener('focus', checkCongratsState);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
      window.dispatchEvent(new CustomEvent('pwa-prompt-available'));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    // Fetch site configuration
    fetchSettings();

    // Pre-fetch catalog for instant transitions
    fetchCatalog();

    // Check current session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        if (session?.user) {
          setUser(session.user);
        }
        setInitialized(true);
      }
    }).catch(() => {
      if (mounted) setInitialized(true);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setInitialized(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchSettings, fetchCatalog, setInitialized, setUser]);

  console.log('App loading state:', { userInitialized, settingsInitialized });

  const isAdminRoute = window.location.pathname.startsWith('/admin');

  if (!settingsInitialized || (isAdminRoute && !userInitialized)) {
    return <LoadingScreen />;
  }

  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen">
        <ToastContainer />
        <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
        <CongratsModal
          isOpen={showCongrats}
          onClose={handleCloseCongrats}
          placedOrderId={congratsOrderId}
          orderGrandTotal={congratsOrderTotal}
        />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/menu/:categoryName" element={<Menu />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/favorites" element={<Favorites />} />
          
          {/* Protected Admin Routes */}
          <Route 
            path="/admin/*" 
            element={isAdmin ? <AdminLayout /> : <Navigate to="/login" replace />} 
          />
        </Routes>
        <Navbar />
        <ScrollToTopButton />
        <PermissionModal />
        <PWAInstallBanner />
      </div>
    </Router>
  );
}

export default App;
