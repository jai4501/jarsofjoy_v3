import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, ChevronRight, Heart, Camera, Phone, MapPin, 
  MessageSquare, MessageCircle, Cookie, Star, 
  RefreshCw, X, Minus, Plus, Send, Map, Truck, Cake
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button3D } from '../components/ui/Button3D';
import { WhatsAppButton } from '../components/ui/WhatsAppButton';
import { useCartStore } from '../store/useCartStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useToastStore } from '../store/useToastStore';
import { useProductStore } from '../store/useProductStore';
import { useFavoritesStore } from '../store/useFavoritesStore';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Internal component to handle map re-centering properly
function RecenterMap({ lat, lng }: { lat: number, lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], map.getZoom());
      setTimeout(() => map.invalidateSize(), 100);
    }
  }, [lat, lng, map]);
  return null;
}

function MapGestureHandler() {
  const map = useMap();
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    const isMobile = L.Browser.mobile;
    if (!isMobile) return;

    const mapContainer = map.getContainer();
    
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        map.dragging.disable();
      } else {
        map.dragging.enable();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        setShowOverlay(true);
      } else {
        setShowOverlay(false);
      }
    };

    const handleTouchEnd = () => {
      setShowOverlay(false);
      map.dragging.enable();
    };

    mapContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
    mapContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    mapContainer.addEventListener('touchend', handleTouchEnd);

    return () => {
      mapContainer.removeEventListener('touchstart', handleTouchStart);
      mapContainer.removeEventListener('touchmove', handleTouchMove);
      mapContainer.removeEventListener('touchend', handleTouchEnd);
    };
  }, [map]);

  return (
    <AnimatePresence>
      {showOverlay && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-brand-dark/60 backdrop-blur-[2px] z-[3000] flex items-center justify-center pointer-events-none p-6"
        >
          <div className="bg-white/10 border border-white/20 rounded-3xl p-8 flex flex-col items-center gap-4 text-center">
            <div className="flex gap-4">
               <span className="text-4xl animate-bounce">☝️</span>
               <span className="text-4xl animate-bounce" style={{ animationDelay: '100ms' }}>☝️</span>
            </div>
            <p className="text-white font-black uppercase tracking-widest text-xs">Use two fingers to move the map</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MapControls({ storeLat, storeLng, googleMapsUrl }: { storeLat: number, storeLng: number, googleMapsUrl: string }) {
  const map = useMap();
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);

  const locateUser = () => {
    setLoading(true);
    map.locate({ setView: true, maxZoom: 16 });
  };

  const locateStore = () => {
    setLoading(true);
    map.setView([storeLat, storeLng], 15);
  };

  const getDirections = () => {
    if (userLoc) {
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${userLoc[0]},${userLoc[1]}&destination=${storeLat},${storeLng}&travelmode=driving`, '_blank');
    } else {
      window.open(googleMapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${storeLat},${storeLng}`, '_blank');
    }
  };

  useEffect(() => {
    const onLocationFound = (e: any) => {
      setUserLoc([e.latlng.lat, e.latlng.lng]);
      setLoading(false);
    };

    const onLocationError = () => {
      setLoading(false);
    };

    const onMoveEnd = () => {
      setLoading(false);
    };

    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);
    map.on('moveend', onMoveEnd);

    return () => {
      map.off('locationfound', onLocationFound);
      map.off('locationerror', onLocationError);
      map.off('moveend', onMoveEnd);
    };
  }, [map]);

  return (
    <>
      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-3">
        <button 
          onClick={locateStore}
          className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all border-2 border-white group"
          title="Locate Store"
        >
          <MapPin size={20} className="group-hover:scale-110 transition-transform" />
        </button>
        <button 
          onClick={locateUser}
          className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all border-2 border-white group"
          title="Locate Me"
          disabled={loading}
        >
          {loading ? <RefreshCw className="animate-spin" size={20} /> : <Map size={20} className="group-hover:scale-110 transition-transform" />}
        </button>
      </div>

      <div className="absolute bottom-4 left-4 z-[1000]">
        <button 
          onClick={getDirections}
          className="h-12 px-6 bg-brand text-white rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-brand-dark transition-colors border-2 border-white"
        >
          <Send size={12} /> Get Directions
        </button>
      </div>
    </>
  );
}

// Default marker pin fixes
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export const Home = () => {
  const { addItem, updateQuantity, items } = useCartStore();
  const { getSetting } = useSettingsStore();
  const { addToast } = useToastStore();
  
  // Dynamic Settings
  const businessLogo = getSetting('business_logo', '/business_logo_new.webp');
  const businessName = getSetting('business_name', 'Jars of Joy');
  const businessAddress = getSetting('address_full', 'Coimbatore, Tamil Nadu');
  const businessCity = getSetting('address_city', 'Coimbatore');
  const fssai = getSetting('fssai_number', '22426552000456');
  const whatsappNumber = getSetting('whatsapp_number', '+910000000000');
  const whatsappUrl = `https://wa.me/${(whatsappNumber || '').replace(/[^0-9]/g, '')}`;
  const phoneNumber = getSetting('contact_phone', '+91 00000 00000');
  const locationUrl = getSetting('google_maps_url', 'https://maps.google.com');
  const instagramUrl = getSetting('instagram_url', 'https://instagram.com');
  const facebookUrl = getSetting('facebook_url', 'https://facebook.com');

  // Map Coordinates
  const lat = parseFloat(getSetting('latitude', '11.0168'));
  const lng = parseFloat(getSetting('longitude', '76.9558'));
  const mapKey = `map-${lat}-${lng}`;

  const { products, categories, fetchCatalog } = useProductStore();
  const { favorites, toggleFavorite } = useFavoritesStore();

  const bestSellers = (() => {
    const bestSellerNames = ["Brownie", "Cookie", "Tres Leches", "Cake"];
    const found = products.filter(p => 
      bestSellerNames.some(name => (p.name || '').toLowerCase().includes(name.toLowerCase()))
    );
    return found.length > 0 ? found.slice(0, 4) : products.slice(0, 4);
  })();

  // Modal State
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [showProductModal, setShowProductModal] = useState(false);

  // Lock background scroll when modal open
  useEffect(() => {
    if (showProductModal) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [showProductModal]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const handleAddToCart = (product: any, variation?: { name: string; price: number }) => {
    if (product.stock_status === 'Out of Stock') {
      addToast('Sorry, this treat is sold out!', 'error');
      return;
    }
    const itemToAdd = variation ? {
      ...product,
      id: `${product.id}-${variation.name}`,
      name: `${product.name} (${variation.name})`,
      price: variation.price
    } : product;

    addItem(itemToAdd);
    addToast(`${itemToAdd.name} added to jar!`, 'sweet');
  };

  const openQuickView = (product: any) => {
    setSelectedProduct(product);
    setActiveImageIdx(0);
    setShowProductModal(true);
  };

  // Custom Map Pin using Logo
  const CustomIcon = businessLogo ? L.divIcon({
    html: `
      <div class="relative" style="width: 50px; height: 60px;">
        <div class="w-[50px] h-[50px] rounded-full border-4 border-white shadow-deep overflow-hidden bg-white relative z-10">
          <img src="${businessLogo}" class="w-full h-full object-cover" />
        </div>
        <div class="absolute bottom-[2px] left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-r-4 border-b-4 border-white shadow-deep"></div>
      </div>
    `,
    className: '',
    iconSize: [50, 60],
    iconAnchor: [25, 58],
    popupAnchor: [0, -60]
  }) : undefined;

  // Render Product Card inside grids (White, 20px corners, Pink Shadow)
  const renderProductCard = (product: any) => {
    const productItems = items.filter(i => i.id === product.id || i.id.startsWith(`${product.id}-`));
    const totalQty = productItems.reduce((sum, i) => sum + i.quantity, 0);
    const hasVariations = product.variations && (product.variations as any).length > 0;

    return (
      <div 
        key={product.id} 
        onClick={() => openQuickView(product)} 
        className="cursor-pointer bg-white rounded-[24px] p-4 border border-blush/20 shadow-[0_8px_30px_rgba(61,26,26,0.06)] hover:shadow-[0_12px_40px_rgba(61,26,26,0.12)] hover:-translate-y-1 transition-all duration-500 group flex flex-col justify-between"
      >
        <div className="relative aspect-square bg-blush/10 rounded-[20px] overflow-hidden mb-4">
          {product.images && product.images[0] ? (
            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl opacity-10">🍰</div>
          )}
          
          {product.stock_status === 'Out of Stock' && (
            <div className="absolute inset-0 bg-brand-dark/50 backdrop-blur-[2px] flex items-center justify-center">
              <span className="bg-white text-brand font-black text-[10px] px-3 py-1.5 rounded-lg uppercase tracking-widest">Sold Out</span>
            </div>
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(product.id);
            }}
            className={`absolute top-2 right-2 h-8 w-8 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-sm z-20 transition-all duration-300 hover:scale-110 ${favorites.includes(product.id) ? 'opacity-100 text-red-500' : 'text-brand opacity-100 sm:opacity-0 group-hover:opacity-100'}`}
            title={favorites.includes(product.id) ? "Remove from Favorites" : "Add to Favorites"}
          >
             <Heart size={16} className={`transition-all ${favorites.includes(product.id) ? 'fill-red-500' : 'group-hover:fill-brand'}`} />
          </button>
        </div>

        <div className="flex-grow flex flex-col justify-between">
          <div className="space-y-1 mb-3 text-center">
            <h4 className="font-serif text-lg font-black text-brand-dark group-hover:text-brand transition-colors leading-tight">{product.name}</h4>
            <p className="text-brand font-black text-base">₹{product.price}</p>
          </div>

          <div className="w-full">
            {totalQty > 0 && !hasVariations ? (
              <div className="flex items-center justify-between bg-brand/5 rounded-full p-1 border border-brand/10 w-full h-10 shadow-inner">
                <button 
                  onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, totalQty - 1); }}
                  className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all shadow-sm"
                >
                  <Minus size={14} />
                </button>
                <span className="font-black text-brand text-sm">{totalQty}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, totalQty + 1); }}
                  className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all shadow-sm"
                >
                  <Plus size={14} />
                </button>
              </div>
            ) : (
              <Button3D 
                variant="flat"
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasVariations) openQuickView(product);
                  else handleAddToCart(product);
                }}
                className="w-full h-10 sm:h-12 text-[9px] sm:text-xs uppercase tracking-widest font-black rounded-full"
                disabled={product.stock_status === 'Out of Stock'}
              >
                {product.stock_status === 'Out of Stock' ? 'Sold Out' : (hasVariations ? 'Options' : 'Add to jar')}
              </Button3D>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Dynamic categories metadata built from database categories
  const categoryMeta: Record<string, { subtitle: string; description: string }> = {
    'brownies': {
      subtitle: 'Rich, fudgy and handcrafted.',
      description: 'Indulge in our signature chocolate brownies, baked with the finest cacao for a perfect fudgy center and a delicate paper-thin crinkle top.'
    },
    'tea cakes': {
      subtitle: 'Perfect with your evening coffee.',
      description: 'Soft, butter-rich, and comforting. Our artisanal tea cakes are the perfect companion for your quiet coffee moments or cozy gatherings.'
    },
    'cookies': {
      subtitle: 'Freshly baked and packed with flavor.',
      description: 'Crisp on the edges, chewy in the center, and packed with gourmet chocolate chunks. A pure, handcrafted bite of happiness.'
    },
    'celebration cakes': {
      subtitle: 'Custom-made for every special moment.',
      description: 'Artisanal cakes made fresh to order. Styled with premium buttercream and elegant finishes to make your milestones truly unforgettable.'
    }
  };

  const activeCategories = categories.filter(c => (c as any).is_active !== false && !c.parent_id);





  return (
    <div className="pb-20 bg-cream text-brand-dark min-h-screen overflow-x-hidden relative">
      <WhatsAppButton />

      {/* Floating Dessert Illustrations (Animated keyframes floating around background) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 select-none">
         <motion.div animate={{ y: [0, -15, 0] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} className="absolute top-28 left-[8%] text-3xl opacity-20 hidden md:block">🍰</motion.div>
         <motion.div animate={{ y: [0, 20, 0] }} transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }} className="absolute top-96 right-[10%] text-4xl opacity-20 hidden md:block">🍪</motion.div>
         <motion.div animate={{ y: [0, -25, 0] }} transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }} className="absolute bottom-[1000px] left-[5%] text-3xl opacity-15">🧁</motion.div>
         <motion.div animate={{ y: [0, 15, 0] }} transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }} className="absolute bottom-[1400px] right-[7%] text-4xl opacity-20">🍫</motion.div>
         <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 9, ease: "easeInOut" }} className="absolute top-[600px] left-[15%] text-2xl opacity-15">🍩</motion.div>
      </div>

      {/* 2. Hero Section */}
      <section className="relative pt-24 sm:pt-36 pb-16 px-6">
        <div className="container mx-auto max-w-[1200px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 sm:gap-16 items-center">
            
            {/* Left: Text Content */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.8 }}
              className="space-y-6 sm:space-y-8 flex flex-col items-center md:items-start text-center md:text-left"
            >
              <h1 className="heading-serif text-5xl sm:text-7xl lg:text-8xl font-black text-brand-dark leading-[1.1] tracking-tight">
                Happiness in <br />
                <span className="heading-cursive text-brand text-6xl sm:text-8xl lg:text-9xl font-normal block mt-2">every bite</span>
              </h1>
              
              <p className="text-brand-dark/75 text-base sm:text-xl font-semibold leading-relaxed max-w-lg">
                {getSetting('hero_subheading', 'Baked fresh in our home studio and delivered straight to your door.')}
              </p>

              {/* Badges line on mobile/desktop */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2 text-[9px] sm:text-xs font-black uppercase tracking-[0.2em] text-brand-dark/55 py-2">
                <span className="flex items-center gap-1.5"><MapPin size={14} className="text-brand" /> Freshly Baked</span>
                <span className="h-1.5 w-1.5 rounded-full bg-brand/30 hidden xs:block" />
                <span className="flex items-center gap-1.5"><Truck size={14} className="text-brand" /> Same Day Delivery Available in Coimbatore</span>
              </div>

              {/* Desktop Only Primary Button */}
              <div className="hidden md:flex gap-4 w-full pt-4">
                <Link to="/menu" className="w-auto">
                  <Button3D variant="flat" className="h-14 sm:h-16 px-12 sm:px-14 text-xs sm:text-sm font-black uppercase tracking-[0.2em] rounded-full flex items-center gap-2 shadow-luxury bg-brand hover:bg-brand-dark text-white">
                     ORDER NOW <ShoppingCart size={16} />
                  </Button3D>
                </Link>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-auto">
                  <Button3D variant="outline" className="h-14 sm:h-16 px-10 sm:px-12 text-xs sm:text-sm font-black uppercase tracking-[0.2em] rounded-full bg-white/50 backdrop-blur-sm border-white/50 text-brand">
                    Chat on WhatsApp
                  </Button3D>
                </a>
              </div>
            </motion.div>

            {/* Right: Sneha's Hero Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="w-full max-w-lg mx-auto"
            >
              <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-white/60 p-8 sm:p-10 flex flex-col items-center shadow-deep text-center relative overflow-hidden">
                {/* Gold Glitter/Accent subtle overlays */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand/5 rounded-full blur-2xl pointer-events-none" />

                {/* Profile Image Squircle with Warm Gold Frame and Heart Overlay */}
                <div className="relative mb-6">
                  {/* Gold Frame border */}
                  <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full p-1.5 bg-gradient-to-tr from-gold via-white to-gold shadow-md">
                    <div className="w-full h-full rounded-full overflow-hidden bg-white border-4 border-white">
                      {businessLogo ? (
                        <img src={businessLogo} className="w-full h-full object-cover" alt="Sneha - Jars of Joy" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl bg-brand/10">👩‍🍳</div>
                      )}
                    </div>
                  </div>
                  {/* Heart badge badge */}
                  <div className="absolute bottom-1 right-1 h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-md border border-brand/5 text-brand">
                     <Heart size={20} className="fill-brand" />
                  </div>
                </div>

                <h3 className="heading-serif text-2xl sm:text-3xl font-black text-brand-dark mb-3">Hi, I'm Sneha 👋</h3>
                
                <p className="text-brand-dark/70 text-sm sm:text-base font-semibold leading-relaxed max-w-xs mb-8 italic">
                  "Baking started as a whisper in my kitchen, and now it's the joy I share with all of you."
                </p>

                {/* Separator line */}
                <div className="w-full h-px bg-brand/10 mb-6" />

                {/* Handmade & Preservatives stats layout */}
                <div className="flex w-full items-center justify-around">
                  <div className="space-y-1">
                    <p className="heading-serif text-2xl sm:text-3xl font-black text-brand leading-none">100%</p>
                    <p className="text-[8px] sm:text-[10px] font-black uppercase text-brand-dark/45 tracking-widest">Handmade</p>
                  </div>
                  <div className="h-10 w-px bg-brand/15" />
                  <div className="space-y-1">
                    <p className="heading-serif text-2xl sm:text-3xl font-black text-brand leading-none">Zero</p>
                    <p className="text-[8px] sm:text-[10px] font-black uppercase text-brand-dark/45 tracking-widest">Preservatives</p>
                  </div>
                </div>
              </div>

              {/* Mobile Only Primary Action Button (Centered capsule button) */}
              <div className="flex md:hidden justify-center pt-8 w-full">
                <Link to="/menu" className="w-full max-w-sm">
                  <Button3D variant="flat" className="h-14 w-full text-xs font-black uppercase tracking-[0.25em] rounded-full flex items-center justify-center gap-2 shadow-luxury bg-brand hover:bg-brand-dark text-white">
                     ORDER NOW <ShoppingCart size={16} />
                  </Button3D>
                </Link>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* 3. Why Choose Us */}
      <section className="container mx-auto px-6 py-12">
        <div className="max-w-5xl mx-auto space-y-12">
           <div className="text-center space-y-2">
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.4em] text-brand/50">The Secret Behind Our Jars</p>
              <h2 className="heading-serif text-3xl sm:text-5xl text-brand-dark font-black">Why Choose Jars of Joy</h2>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
             {[
               { icon: <Cookie size={28} className="text-brand" />, label: "FRESHLY BAKED" },
               { icon: <Truck size={28} className="text-brand" />, label: "LOCAL DELIVERY" },
               { icon: <Cake size={28} className="text-brand" />, label: "MADE TO ORDER" },
               { icon: <Star size={28} className="text-brand" />, label: "PREMIUM INGREDIENTS" }
             ].map((feat, idx) => (
                <div key={idx} className="bg-white/60 backdrop-blur-sm rounded-[2rem] border border-white/50 p-6 sm:p-8 flex flex-col items-center text-center gap-5 hover:scale-[1.03] transition-all duration-300 shadow-soft">
                   <div className="w-16 h-16 rounded-full bg-brand/5 flex items-center justify-center border border-brand/10 shadow-inner">
                      {feat.icon}
                   </div>
                   <h4 className="text-[10px] sm:text-xs font-black uppercase text-brand-dark tracking-widest">{feat.label}</h4>
                </div>
             ))}
           </div>
        </div>
      </section>

      {/* 4. Best Sellers Section */}
      {bestSellers.length > 0 && (
        <section className="container mx-auto px-6 py-12 bg-white/30 backdrop-blur-sm rounded-[2.5rem]">
          <div className="max-w-[1200px] mx-auto space-y-10 flex flex-col items-center">
            
            {/* Fan Favorites Header with Top Star Icon */}
            <div className="text-center space-y-3 flex flex-col items-center">
              <div className="w-14 h-14 bg-brand rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand/20">
                <Star size={24} className="fill-white text-white" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.4em] text-brand/40">FAN FAVOURITES</p>
                <h2 className="heading-serif text-3xl sm:text-5xl text-brand-dark font-black">Best Sellers</h2>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-10 w-full pt-6">
              {bestSellers.map(renderProductCard)}
            </div>

            {/* View Full Menu Capsule Button */}
            <div className="pt-10">
              <Link to="/menu">
                <Button3D 
                  variant="outline" 
                  className="h-14 sm:h-16 px-12 sm:px-14 bg-white/60 backdrop-blur-sm border-brand/10 hover:border-brand/30 text-brand text-xs sm:text-sm font-black uppercase tracking-[0.25em] rounded-full shadow-soft"
                >
                  VIEW FULL MENU <ChevronRight size={16} className="ml-1" />
                </Button3D>
              </Link>
            </div>

          </div>
        </section>
      )}

      {/* 5. Category Showcase */}
      <section id="menu-categories" className="container mx-auto px-6 py-16 scroll-mt-20">
        <div className="max-w-[1200px] mx-auto space-y-16">
          <div className="text-center space-y-2">
             <h2 className="heading-serif text-3xl sm:text-5xl text-brand-dark font-black">Our Confectioneries</h2>
             <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.4em] text-brand/40">Artisanal collections baked to perfection</p>
          </div>

          <div className="space-y-16">
            {activeCategories.map((cat) => {
              const normalizedName = cat.name.toLowerCase();
              
              // Map database category names to custom metadata keys
              let metaKey = normalizedName;
              if (normalizedName.includes('cookie')) metaKey = 'cookies';
              if (normalizedName.includes('brownie')) metaKey = 'brownies';
              if (normalizedName.includes('tea cake')) metaKey = 'tea cakes';
              if (normalizedName.includes('celebration cake')) metaKey = 'celebration cakes';

              const meta = categoryMeta[metaKey] || {
                subtitle: 'Handcrafted and freshly baked.',
                description: `Explore our premium selection of fresh ${cat.name.toLowerCase()}, baked with care and the finest ingredients.`
              };
              const catImage = (cat as any).image_url;

              return (
                <motion.div 
                  key={cat.id}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className="max-w-4xl mx-auto flex flex-col items-center text-center space-y-8"
                >
                  {/* Category Name & Subtitle */}
                  <div className="space-y-3">
                    <h3 className="heading-serif text-3xl sm:text-5xl font-black text-brand-dark leading-tight">{cat.name}</h3>
                    <p className="text-brand font-black text-xs sm:text-sm tracking-[0.2em] uppercase">{meta.subtitle}</p>
                  </div>

                  {/* Category Image */}
                  {catImage && (
                    <div className="w-full aspect-[16/9] sm:aspect-[21/9] rounded-[2.5rem] overflow-hidden shadow-medium border border-white/50 relative group">
                      <img 
                        src={catImage} 
                        alt={cat.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Category Description & Button */}
                  <div className="max-w-2xl space-y-6 flex flex-col items-center">
                    <p className="text-brand-dark/70 text-sm sm:text-base leading-relaxed font-medium">
                      {meta.description}
                    </p>
                    <div className="pt-2">
                      <Link to={`/menu/${encodeURIComponent(cat.name)}`}>
                        <Button3D 
                          variant="outline" 
                          className="h-12 sm:h-14 px-8 sm:px-10 text-xs sm:text-sm font-black uppercase tracking-widest rounded-full bg-white border-brand/20 hover:border-brand shadow-sm flex items-center gap-2"
                        >
                          Explore Collection <ChevronRight size={14} />
                        </Button3D>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>


      {/* 9. Location Section (Google Maps Embed) */}
      <section className="container mx-auto px-6 py-8">
         <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center">
               <h2 className="heading-serif text-3xl sm:text-5xl text-brand-dark font-black">Our Home Studio</h2>
               <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.4em] text-brand/40 mt-1">Baked with passion in {businessCity}</p>
            </div>

            <div className="bg-white rounded-[24px] p-4 border border-blush/20 shadow-[0_8px_30px_rgba(61,26,26,0.06)]">
               <div className="h-[350px] w-full rounded-[18px] overflow-hidden border border-blush/20 relative z-10">
                  <MapContainer key={mapKey} center={[lat, lng]} zoom={15} scrollWheelZoom={false} className="h-full w-full">
                     <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                     />
                     <RecenterMap lat={lat} lng={lng} />
                     <MapGestureHandler />
                     <MapControls storeLat={lat} storeLng={lng} googleMapsUrl={locationUrl} />
                     <Marker position={[lat, lng]} {...(CustomIcon ? { icon: CustomIcon } : {})}>
                        <Popup>
                           <div className="text-center p-2 space-y-1">
                              <h4 className="font-serif font-black text-brand text-sm">{businessName}</h4>
                              <p className="text-[10px] font-semibold text-brand-dark/70">{businessAddress}</p>
                              <p className="text-[9px] font-black text-gold uppercase tracking-widest mt-1">Service Area: Coimbatore</p>
                           </div>
                        </Popup>
                     </Marker>
                  </MapContainer>
               </div>
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="pt-10 pb-28 sm:pb-12 px-6 text-center bg-brand-dark text-white rounded-t-[32px] mt-10 relative z-10">
        <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-[24px] flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-deep overflow-hidden">
           {businessLogo ? <img src={businessLogo} className="w-full h-full object-cover opacity-80" alt="Footer Logo" loading="lazy" /> : <div className="text-2xl">🍯</div>}
        </div>
        <h2 className="heading-cursive text-4xl sm:text-5xl text-blush mb-4">{businessName}</h2>
        <p className="text-white/80 font-black tracking-widest text-[8px] sm:text-[10px] uppercase mb-10">Handmade with love in <span className="text-white font-extrabold">{businessCity}</span></p>

        <div className="flex justify-center flex-wrap gap-4 mb-12">
          <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-brand hover:scale-110 transition-all border border-white/5" title="Instagram">
            <Camera size={18} />
          </a>
          <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-brand hover:scale-110 transition-all border border-white/5" title="Facebook">
            <MessageSquare size={18} />
          </a>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-brand hover:scale-110 transition-all border border-white/5" title="WhatsApp">
            <MessageCircle size={18} />
          </a>
          <a href={`tel:${phoneNumber}`} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-brand hover:scale-110 transition-all border border-white/5" title="Call Us">
            <Phone size={18} />
          </a>
          <a href={locationUrl} target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-brand hover:scale-110 transition-all border border-white/5" title="Google Maps">
            <MapPin size={18} />
          </a>
        </div>

        <div className="max-w-4xl mx-auto pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6 px-4 text-center md:text-left">
           <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white/60">© 2026 {businessName} | FSSAI: {fssai}</p>
           <div className="flex gap-6 justify-center">
              <Link to="/policies?type=privacy" className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors">Privacy</Link>
              <Link to="/policies?type=shipping" className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors">Shipping</Link>
              <Link to="/policies?type=refund" className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors">Refund</Link>
           </div>
        </div>
      </footer>

      {/* Product Quick View Modal (Zepto Style) */}
      <AnimatePresence>
        {showProductModal && selectedProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-brand-dark/45 backdrop-blur-md z-[250] flex items-end md:items-center justify-center p-0 md:p-4"
            onClick={() => setShowProductModal(false)}
          >
            <motion.div 
              initial={{ y: "100%", opacity: 1, scale: 1 }} 
              animate={{ y: 0, opacity: 1, scale: 1 }} 
              exit={{ y: "100%", opacity: 1, scale: 1 }}
              transition={{ type: "tween", ease: [0.215, 0.61, 0.355, 1], duration: 0.3 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 300 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 300) setShowProductModal(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/90 backdrop-blur-2xl w-full max-w-4xl rounded-t-[2.5rem] md:rounded-[3rem] shadow-deep border border-white/60 overflow-hidden flex flex-col md:flex-row relative h-[85vh] md:h-[560px] max-h-[92vh] md:max-h-[85vh]"
            >
              {/* Elegant Glowing Overlay behind the modal content */}
              <div className="bg-gradient-to-tr from-brand/5 via-gold/5 to-brand/10 w-96 h-96 rounded-full blur-3xl absolute -bottom-20 -left-20 pointer-events-none -z-10" />

              {/* Drag Handle (Mobile Only) */}
              <div className="w-12 h-1.5 bg-brand/10 rounded-full mx-auto mt-4 mb-2 md:hidden" />

              {/* Frosted Close Button - Floating on top-left of image area on desktop, top-right on mobile */}
              <button 
                onClick={() => setShowProductModal(false)} 
                className="absolute top-4 right-4 md:top-6 md:left-6 md:right-auto w-10 h-10 rounded-full luxury-glass text-brand hover:scale-110 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-medium z-[120]"
                title="Close"
              >
                <X size={20} />
              </button>

              {/* Frosted Favorite Button - Floating on top-right of image area */}
              <button
                onClick={() => toggleFavorite(selectedProduct.id)}
                className="absolute top-4 left-4 md:top-6 md:right-6 md:left-auto w-10 h-10 rounded-full luxury-glass flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-medium cursor-pointer z-[120]"
                title={favorites.includes(selectedProduct.id) ? "Remove from Favorites" : "Add to Favorites"}
              >
                <Heart 
                  size={18} 
                  className={favorites.includes(selectedProduct.id) ? 'fill-red-500 stroke-red-500 text-red-500 animate-heartbeat' : 'text-brand'} 
                />
              </button>

              {/* Image Section / Gallery */}
              <div className="w-full md:w-1/2 h-72 md:h-full bg-brand/5 relative overflow-hidden flex-shrink-0 flex items-center justify-center">
                 {/* Main Image View */}
                 <div className="w-full h-full relative">
                   <AnimatePresence mode="wait">
                     <motion.img 
                       key={activeImageIdx}
                       initial={{ opacity: 0, scale: 1.05 }}
                       animate={{ opacity: 1, scale: 1 }}
                       exit={{ opacity: 0, scale: 0.95 }}
                       transition={{ duration: 0.3 }}
                       src={selectedProduct.images?.[activeImageIdx]} 
                       className="w-full h-full object-cover" 
                       alt={selectedProduct.name} 
                     />
                   </AnimatePresence>

                   {/* Transparent white gradient shadow overlay at the bottom */}
                   <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

                   {/* Multiple Images Thumbnail Indicator */}
                   {selectedProduct.images && selectedProduct.images.length > 1 && (
                     <div className="absolute bottom-4 inset-x-0 flex justify-center gap-2 z-[110]">
                       {selectedProduct.images.map((imgUrl: string, imgIdx: number) => (
                         <button
                           key={imgIdx}
                           onClick={() => setActiveImageIdx(imgIdx)}
                           className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all shadow-md hover:scale-110 ${activeImageIdx === imgIdx ? 'border-brand bg-white scale-105' : 'border-white/50 bg-white/30 backdrop-blur-sm'}`}
                         >
                           <img src={imgUrl} className="w-full h-full object-cover" alt="" />
                         </button>
                       ))}
                     </div>
                   )}
                 </div>

                 {/* Custom Float Badges */}
                 <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 z-20">
                   <span className="glass-pill !px-3 !py-1 text-[8px] font-black uppercase tracking-widest text-brand-dark shadow-sm bg-white/70 backdrop-blur-sm border border-white/50">
                     {selectedProduct.category}
                   </span>
                 </div>
              </div>

              {/* Info Section */}
              <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col bg-white/95 backdrop-blur-md flex-1 min-h-0 md:h-full justify-between overflow-y-auto no-scrollbar">
                <div className="space-y-6">
                  {/* Category, Rating, Stock Status */}
                  <div className="flex items-center justify-between">
                     <span className="text-brand font-black uppercase tracking-[0.3em] text-[8px] sm:text-[9px] opacity-75">
                       {selectedProduct.stock_status === 'Out of Stock' ? '🍰 Limited Availability' : '🍰 Freshly Baked Today'}
                     </span>
                     {selectedProduct.stock_status === 'Out of Stock' && (
                       <span className="bg-red-50 text-red-500 border border-red-100 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                         Sold Out
                       </span>
                     )}
                  </div>
                  
                  {/* Title & Price */}
                  <div className="space-y-2.5">
                    <h2 className="text-2xl md:text-3.5xl font-black text-brand-dark tracking-tight leading-tight heading-serif">
                       {selectedProduct.name}
                    </h2>
                    <div className="flex items-center gap-3">
                      <div className="bg-brand/5 border border-brand/10 rounded-2xl px-4 py-1 flex items-center justify-center">
                        <span className="text-xl md:text-2xl font-black text-brand tracking-tighter">₹{selectedProduct.price}</span>
                      </div>
                      <span className="text-[9px] font-black text-brand-dark/30 uppercase tracking-[0.2em]">Inclusive of all taxes</span>
                    </div>
                  </div>

                  {/* Description Premium Block */}
                  <div className="fluid-glass !rounded-2xl p-4 border-l-4 border-brand shadow-sm bg-brand/5">
                    <p className="text-brand-dark/80 font-semibold leading-relaxed text-xs sm:text-sm italic">
                      "{selectedProduct.description || "Indulge in this handcrafted masterpiece made with passion and the finest ingredients."}"
                    </p>
                  </div>
                </div>

                {/* Variations & Options */}
                <div className="py-4 shrink-0">
                  {selectedProduct.variations && (selectedProduct.variations as any).length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-brand/5 pb-2">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-dark/50">Select Size & Portion</p>
                        <p className="text-[9px] font-bold text-brand italic">Swipe for options ➔</p>
                      </div>
                      
                      <div className="flex overflow-x-auto no-scrollbar gap-3.5 pb-2 -mx-2 px-2 snap-x">
                        {(selectedProduct.variations as any).map((v: any, idx: number) => {
                          const variationId = `${selectedProduct.id}-${v.name}`;
                          const cartItem = items.find(i => i.id === variationId);
                          const qty = cartItem?.quantity || 0;

                          return (
                            <motion.div 
                              key={idx}
                              whileTap={{ scale: 0.95 }}
                              animate={qty > 0 ? { scale: [1, 1.02, 1], transition: { duration: 0.2 } } : {}}
                              className={`shrink-0 w-36 p-5 rounded-[2rem] border-2 transition-all snap-start flex flex-col justify-between items-center text-center gap-4 ${qty > 0 ? 'bg-brand/10 border-brand shadow-luxury' : 'bg-brand/5 border-transparent hover:border-brand/20 hover:bg-white shadow-soft'}`}
                            >
                              <div className="space-y-1 mt-1">
                                <p className="font-black text-brand-dark text-xs tracking-tight uppercase">{v.name}</p>
                                <p className="font-black text-brand text-sm tracking-tighter">₹{v.price}</p>
                              </div>
                              
                              {qty > 0 ? (
                                <motion.div 
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="flex items-center gap-2 bg-white rounded-xl p-1 border border-brand/10 h-9 w-full justify-between shadow-sm"
                                >
                                  <button 
                                    onClick={() => updateQuantity(variationId, qty - 1)}
                                    className="w-7 h-7 bg-brand/5 rounded-lg flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all cursor-pointer"
                                  >
                                    <Minus size={10} />
                                  </button>
                                  <span className="font-black text-brand text-xs w-4 text-center">{qty}</span>
                                  <button 
                                    onClick={() => updateQuantity(variationId, qty + 1)}
                                    className="w-7 h-7 bg-brand/5 rounded-lg flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all cursor-pointer"
                                  >
                                    <Plus size={10} />
                                  </button>
                                </motion.div>
                              ) : (
                                <button
                                  onClick={() => handleAddToCart(selectedProduct, v)}
                                  disabled={selectedProduct.stock_status === 'Out of Stock'}
                                  className="w-full h-9 bg-brand text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-brand-dark hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:bg-gray-200 disabled:text-brand-dark/30 disabled:scale-100"
                                >
                                  Select
                                </button>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Add To Jar (Non-variations) */}
                {(!selectedProduct.variations || (selectedProduct.variations as any).length === 0) && (
                  <div className="pt-4 border-t border-brand/5 mt-auto flex-shrink-0">
                    {(() => {
                      const qty = items.find(i => i.id === selectedProduct.id)?.quantity || 0;
                      if (qty > 0) {
                        return (
                          <div className="flex items-center justify-between bg-brand/5 border border-brand/10 rounded-[1.5rem] p-1.5 h-14 shadow-inner">
                            <span className="text-[10px] font-black text-brand-dark/40 uppercase tracking-[0.2em] pl-3">Added to Jar</span>
                            <div className="flex items-center gap-3 bg-white rounded-xl p-1 shadow-sm border border-brand/5">
                              <button 
                                onClick={() => updateQuantity(selectedProduct.id, qty - 1)}
                                className="w-8 h-8 bg-brand/5 rounded-lg flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all cursor-pointer"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="font-black text-brand text-sm w-4 text-center">{qty}</span>
                              <button 
                                onClick={() => updateQuantity(selectedProduct.id, qty + 1)}
                                className="w-8 h-8 bg-brand/5 rounded-lg flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all cursor-pointer"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <Button3D 
                          onClick={() => handleAddToCart(selectedProduct)} 
                          disabled={selectedProduct.stock_status === 'Out of Stock'}
                          className="w-full h-12 sm:h-14 text-xs sm:text-sm uppercase tracking-widest font-black rounded-xl"
                        >
                          Add to Jar <ShoppingCart className="ml-2" size={14} />
                        </Button3D>
                      );
                    })()}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
