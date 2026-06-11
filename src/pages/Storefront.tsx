/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef } from 'react';
import { useCartStore } from '../store/useCartStore';
import { useToastStore } from '../store/useToastStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useProductStore } from '../store/useProductStore';
import type { Database } from '../types/supabase';
import { Button3D } from '../components/ui/Button3D';
import { ShoppingCart, Sparkles, FileDown, Heart, ChevronRight, X, ArrowLeft, Utensils, Minus, Plus } from 'lucide-react';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { generateMenuPDF } from '../lib/pdfGenerator';

type Product = Database['public']['Tables']['products']['Row'] & { variations?: { name: string; price: number }[] };

export const Storefront = () => {
  const { getSetting } = useSettingsStore();
  const { addItem, updateQuantity, items } = useCartStore();
  const { addToast } = useToastStore();
  const [searchParams] = useSearchParams();
  const { categoryName } = useParams();
  
  const { products, categories, isLoaded, fetchCatalog } = useProductStore();
  const [searchQuery, setSearchBar] = useState(searchParams.get('search') || '');
  const [activeSubFilter, setActiveSubFilter] = useState<string>('All');

  useEffect(() => {
    setActiveSubFilter('All');
  }, [categoryName]);

  const categoryCounts = (() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      const catName = p.category || 'Uncategorized';
      counts[catName] = (counts[catName] || 0) + 1;
      
      const catRec = categories.find(c => c.name === catName);
      if (catRec && catRec.parent_id) {
        const parentRec = categories.find(c => c.id === catRec.parent_id);
        if (parentRec) {
          counts[parentRec.name] = (counts[parentRec.name] || 0) + 1;
        }
      }
    });
    return counts;
  })();

  const loading = !isLoaded;

  // Dynamic Settings
  const businessLogo = getSetting('business_logo', '/business_logo_new.jpg');
  const businessName = getSetting('business_name', 'Your Business Name');

  // Product Selection Modal (Quick View)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const scrollPosition = useRef(0);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (showProductModal) {
      scrollPosition.current = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPosition.current}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollPosition.current > 0) {
        window.scrollTo(0, scrollPosition.current);
        scrollPosition.current = 0;
      }
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [showProductModal]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const displayedCategories = categories.filter(c => (c as any).is_active !== false && !c.parent_id);

  const handleAddToCart = (product: Product, variation?: { name: string; price: number }) => {
    if (product.stock_status === 'Out of Stock') {
      addToast('Sorry, this treat is currently sold out!', 'error');
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

  const openQuickView = (product: Product) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  const parentCategory = categories.find(c => c.name === categoryName);
  const subCategories = parentCategory
    ? categories.filter(c => c.parent_id === parentCategory.id && (c as any).is_active !== false)
    : [];

  const filteredProducts = products.filter(p => {
    let matchesCategory: boolean;
    if (!categoryName) {
      matchesCategory = true;
    } else {
      if (parentCategory) {
        const subNames = subCategories.map(s => s.name);
        if (activeSubFilter === 'All') {
          matchesCategory = p.category === categoryName || subNames.includes(p.category || '');
        } else {
          matchesCategory = p.category === activeSubFilter;
        }
      } else {
        matchesCategory = p.category === categoryName;
      }
    }

    const query = searchQuery.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(query) || 
                          p.description?.toLowerCase().includes(query) ||
                          p.keywords?.some(k => k.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });

  const getCategoryIcon = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes('cake')) return '🎂';
    if (c.includes('brownie')) return '🍫';
    if (c.includes('leche')) return '🥛';
    if (c.includes('cookie')) return '🍪';
    return '🧁';
  };

  return (
    <div className="min-h-screen pb-40 bg-cream">
      
      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-24 sm:pt-32 pb-16 text-center relative">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="heading-serif text-5xl md:text-7xl text-brand-dark mb-6 tracking-tight mx-auto max-w-4xl text-center">
            {categoryName ? categoryName : 'Our Studio'}
          </h1>
          <div className="inline-block mb-12 max-w-2xl mx-auto">
            <div className="glass-pill text-sm sm:text-lg text-brand-dark/75 font-semibold px-8 py-3.5 border border-white/45 shadow-sm">
              {categoryName ? `Handcrafted treats from our ${categoryName} range.` : '"Baking happiness, one jar at a time."'}
            </div>
          </div>
          
          <div className="flex justify-center gap-4">
            {categoryName ? (
              <Link to="/menu">
                <Button3D 
                  variant="secondary" 
                  className="h-14 px-8 text-xs font-black uppercase tracking-widest"
                >
                  <ArrowLeft size={18} className="mr-2" /> All Categories
                </Button3D>
              </Link>
            ) : (
              <Button3D 
                variant="outline" 
                onClick={async () => {
                  addToast('Preparing your visual menu...', 'sweet');
                  await generateMenuPDF(products as any, { business_logo: businessLogo, business_name: businessName });
                }}
                className="h-14 px-10 bg-white/50 backdrop-blur-sm text-xs font-black uppercase tracking-widest border border-white/40"
              >
                <FileDown size={18} className="mr-2" /> Full Menu PDF
              </Button3D>
            )}
          </div>
        </motion.div>
      </section>

      {/* Main Content Area */}
      <section className="container mx-auto px-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-6">
            <div className="w-20 h-20 bg-blush rounded-3xl flex items-center justify-center animate-bounce shadow-medium border border-white">
              <Sparkles className="text-brand" size={40} />
            </div>
            <p className="heading-cursive text-brand text-4xl">Mixing the batter...</p>
          </div>
        ) : !categoryName ? (
          /* CATEGORY NAVIGATION MODE (Professional Desktop) */
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
            {displayedCategories.map((cat, idx) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link to={`/menu/${encodeURIComponent(cat.name)}`}>
                  <div className="premium-card p-10 sm:p-16 flex items-center justify-between group relative overflow-hidden h-full min-h-[300px]">
                    <div className="absolute top-[-40px] right-[-40px] w-64 h-64 bg-brand/5 rounded-full group-hover:scale-150 transition-transform duration-1000 group-hover:bg-brand/10 pointer-events-none" />
                    
                    <div className="flex flex-col sm:flex-row items-center gap-8 sm:gap-12 relative z-10 text-center sm:text-left">
                      <div className="w-24 h-24 sm:w-32 sm:h-32 bg-blush rounded-[2.5rem] sm:rounded-[3.5rem] flex items-center justify-center overflow-hidden shadow-inner border-4 border-white group-hover:scale-110 transition-transform group-hover:rotate-3 animate-in fade-in duration-500">
                        {(cat as any).image_url ? (
                          <img src={(cat as any).image_url} className="w-full h-full object-cover" alt={cat.name} />
                        ) : (
                          <span className="text-6xl sm:text-7xl">{cat.emoji || getCategoryIcon(cat.name)}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-[12px] font-black uppercase tracking-[0.3em] text-brand mb-2">
                           Curated Selection <span className="mx-2 text-brand/20">•</span> {categoryCounts[cat.name] || 0} items
                        </p>
                        <h3 className="heading-serif text-4xl sm:text-6xl text-brand-dark group-hover:text-brand transition-colors leading-none">{cat.name}</h3>
                        <p className="text-brand-dark/65 text-xs sm:text-sm font-medium mt-4 group-hover:text-brand-dark/85 transition-colors">Explore our premium handcrafted {cat.name.toLowerCase()} range.</p>
                      </div>
                    </div>
                    
                    <div className="hidden sm:flex w-16 h-16 bg-brand text-white rounded-full items-center justify-center shadow-luxury opacity-0 group-hover:opacity-100 translate-x-8 group-hover:translate-x-0 transition-all duration-500 relative z-10">
                      <ChevronRight size={32} />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          /* PRODUCT LIST MODE (Professional Desktop) */
          <div className="space-y-20 max-w-7xl mx-auto">
            <div className="max-w-3xl mx-auto relative group mb-12">
              <div className="absolute inset-y-0 left-8 flex items-center pointer-events-none text-brand/30 group-focus-within:text-brand transition-colors">
                <Sparkles size={24} />
              </div>
              <input 
                type="text" 
                placeholder={`Search in our ${categoryName} collection...`}
                value={searchQuery}
                onChange={(e) => setSearchBar(e.target.value)}
                className="w-full h-20 pl-20 pr-8 bg-white/85 backdrop-blur-sm rounded-[2.5rem] border-2 border-brand/5 shadow-soft outline-none focus:border-brand/40 focus:bg-white transition-all font-bold text-lg text-brand-dark placeholder-brand-dark/55"
              />
            </div>

            {/* Sub-categories horizontal selector tabs */}
            {subCategories.length > 0 && (
              <div className="flex justify-center flex-wrap gap-3 mb-16 animate-in fade-in slide-in-from-top-4 duration-300">
                <button
                  onClick={() => setActiveSubFilter('All')}
                  className={`h-11 px-6 rounded-full font-black text-xs uppercase tracking-wider transition-all border ${
                    activeSubFilter === 'All'
                      ? 'bg-brand text-white border-brand shadow-md shadow-brand/10'
                      : 'bg-white/60 hover:bg-white text-brand-dark/60 border-white/60 hover:border-brand/10 shadow-sm'
                  }`}
                >
                  All {categoryName}
                </button>
                {subCategories.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setActiveSubFilter(sub.name)}
                    className={`h-11 px-6 rounded-full font-black text-xs uppercase tracking-wider transition-all border flex items-center gap-2 ${
                      activeSubFilter === sub.name
                        ? 'bg-brand text-white border-brand shadow-md shadow-brand/10'
                        : 'bg-white/60 hover:bg-white text-brand-dark/60 border-white/60 hover:border-brand/10 shadow-sm'
                    }`}
                  >
                    <span>{sub.emoji || '🧁'}</span>
                    <span>{sub.name}</span>
                  </button>
                ))}
              </div>
            )}

            {filteredProducts.length === 0 ? (
              <div className="text-center py-48 premium-card max-w-2xl mx-auto bg-white/40">
                <div className="text-6xl mb-6 opacity-20">🍰</div>
                <p className="heading-serif text-4xl text-brand-dark/60 mb-8 tracking-tight">No treats found!</p>
                <Button3D variant="outline" onClick={() => setSearchBar('')} className="px-12 h-14 text-xs uppercase font-black tracking-widest">Clear Collection Filter</Button3D>
              </div>
            ) : (
              <motion.div layout className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-10 max-w-[1200px] mx-auto">
                {filteredProducts.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => openQuickView(product)}
                    className="cursor-pointer"
                  >
                    <div className="premium-card h-full p-5 sm:p-10 group flex flex-col relative text-center hover:-translate-y-1 transition-all duration-500">
                      <div className="relative aspect-square sm:aspect-[4/5] bg-brand/5 rounded-[2.5rem] sm:rounded-[4rem] mb-6 sm:mb-12 overflow-hidden shadow-inner">
                        {product.images && product.images[0] ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-5xl sm:text-8xl opacity-10">🍰</div>
                        )}
                        
                        {/* Stock Badge */}
                        {product.stock_status === 'Out of Stock' && (
                          <div className="absolute inset-0 bg-brand-dark/60 backdrop-blur-[4px] flex items-center justify-center z-10">
                            <span className="bg-white text-brand font-black text-[10px] sm:text-xs px-6 py-3 rounded-2xl uppercase tracking-[0.2em] shadow-2xl scale-110">Sold Out</span>
                          </div>
                        )}

                        <div className="absolute top-4 right-4 sm:top-8 sm:right-8 h-10 w-10 sm:h-14 sm:w-14 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center text-brand shadow-luxury opacity-0 group-hover:opacity-100 transition-all duration-500 z-20 hover:scale-110">
                           <Heart size={18} className="sm:size-7 group-hover:fill-brand transition-all" />
                        </div>
                      </div>
                      
                      <div className="px-2 sm:px-6 pb-2 sm:pb-6 flex-grow flex flex-col items-center">
                        <h3 className="text-xl sm:text-5xl font-black mb-3 sm:mb-6 text-brand-dark tracking-tight group-hover:text-brand transition-colors heading-serif leading-tight">{product.name}</h3>
                        
                        <div className="flex flex-wrap justify-center gap-2 mb-6 sm:mb-10 min-h-[20px]">
                          {product.variations && (product.variations as any).length > 0 && (
                            <span className="px-3 py-1.5 bg-brand text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white rounded-xl shadow-sm">
                              {(product.variations as any).length} Sizes Available
                            </span>
                          )}
                          {product.tags?.slice(0, 2).map(tag => (
                            <span key={tag} className="px-3 py-1.5 bg-brand/5 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-brand rounded-xl border border-brand/10 shadow-inner">
                              {tag}
                            </span>
                          ))}
                        </div>

                        <p className="text-brand-dark/75 text-xs sm:text-lg mb-8 sm:mb-12 line-clamp-2 leading-relaxed font-medium hidden sm:block h-14 overflow-hidden italic text-center">
                          {product.description || "Indulge in this handcrafted masterpiece made with passion."}
                        </p>
                        
                        <div className="mt-auto w-full flex flex-col items-center gap-6 sm:gap-8 pt-6 sm:pt-12 border-t border-brand/5">
                          <span className="text-3xl sm:text-6xl font-black text-brand tracking-tighter">₹{product.price}</span>
                          
                          {(() => {
                            const productItems = items.filter(i => i.id === product.id || i.id.startsWith(`${product.id}-`));
                            const totalQty = productItems.reduce((sum, i) => sum + i.quantity, 0);
                            const hasVariations = product.variations && (product.variations as any).length > 0;

                            if (totalQty > 0 && !hasVariations) {
                              return (
                                <div className="flex items-center gap-4 bg-brand/5 rounded-full p-2 border border-brand/10 h-14 sm:h-20 w-full max-w-[240px] justify-between shadow-inner">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, -1); }}
                                    className="w-10 h-10 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all shadow-luxury"
                                  >
                                    <Minus size={24} />
                                  </button>
                                  <span className="font-black text-brand text-xl sm:text-3xl px-2">
                                    {totalQty}
                                  </span>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, 1); }}
                                    className="w-10 h-10 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all shadow-luxury"
                                  >
                                    <Plus size={24} />
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div className="relative w-full">
                                {totalQty > 0 && (
                                  <div className="absolute -top-3 -right-3 bg-brand text-white text-xs font-black w-8 h-8 rounded-full flex items-center justify-center shadow-luxury z-10 animate-in zoom-in duration-500 border-2 border-white">
                                    {totalQty}
                                  </div>
                                )}
                                <Button3D 
                                  variant="flat"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (hasVariations) openQuickView(product);
                                    else handleAddToCart(product);
                                  }}
                                  className={`h-14 sm:h-20 w-full !py-0 px-8 text-xs sm:text-base uppercase tracking-[0.25em] font-black rounded-full ${product.stock_status === 'Out of Stock' ? 'opacity-50 grayscale pointer-events-none' : ''}`}
                                >
                                  {product.stock_status === 'Out of Stock' ? 'Unavailable' : (hasVariations ? 'Explore Sizes' : 'Add to jar')}
                                </Button3D>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        )}
      </section>

      {/* Product Quick View Modal (Zepto Style) */}
      <AnimatePresence>
        {showProductModal && selectedProduct && (
          <div 
            className="fixed inset-0 bg-brand-dark/40 backdrop-blur-md z-[250] flex items-end md:items-center justify-center p-0 md:p-4"
            onClick={() => setShowProductModal(false)}
          >
            <motion.div 
              initial={{ y: "100%", opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) setShowProductModal(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-2xl rounded-t-[2.5rem] md:rounded-[3rem] shadow-layer-3 border border-brand/5 overflow-hidden flex flex-col md:flex-row relative max-h-[92vh] md:max-h-[90vh]"
            >
              {/* Drag Handle (Mobile Only) */}
              <div className="w-12 h-1.5 bg-brand/10 rounded-full mx-auto mt-4 mb-2 md:hidden" />

              <button 
                onClick={() => setShowProductModal(false)} 
                className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 rounded-full bg-white/90 backdrop-blur-md text-brand flex items-center justify-center hover:bg-brand hover:text-white transition-all shadow-soft z-[110] border border-brand/5"
              >
                <X size={20} />
              </button>

              {/* Image Section */}
              <div className="w-full md:w-[55%] h-80 md:h-auto bg-brand/5 relative">
                 {selectedProduct.images && selectedProduct.images[0] ? (
                   <img src={selectedProduct.images[0]} className="w-full h-full object-cover" alt={selectedProduct.name} />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-8xl opacity-10">🍰</div>
                 )}
              </div>

              {/* Info Section */}
              <div className="w-full md:w-[45%] p-8 sm:p-12 flex flex-col bg-white">
                <div className="mb-10">
                  <p className="text-brand font-black uppercase tracking-[0.4em] text-[8px] sm:text-[10px] mb-3 opacity-60">{selectedProduct.category}</p>
                  <h3 className="text-3xl sm:text-5xl font-black text-brand-dark tracking-tight leading-[1.1] mb-4">{selectedProduct.name}</h3>
                  <div className="flex items-center gap-6">
                    <p className="text-3xl font-black text-brand tracking-tighter">₹{selectedProduct.price}</p>
                    <div className="h-6 w-px bg-brand/10" />
                    <p className="text-[10px] font-bold text-brand-dark/60 uppercase tracking-widest">Premium Quality</p>
                  </div>
                  <p className="text-brand-dark/70 font-medium leading-relaxed text-sm sm:text-base mt-8 italic">
                    "{selectedProduct.description || "Indulge in this handcrafted masterpiece made with passion and the finest ingredients."}"
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar pr-2">
                  {selectedProduct.variations && (selectedProduct.variations as any).length > 0 && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-brand/5 pb-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-dark/65">Select your preference</p>
                        <p className="text-[10px] font-bold text-brand italic">Scroll for more →</p>
                      </div>
                      
                      <div className="flex overflow-x-auto no-scrollbar gap-4 pb-4 -mx-2 px-2 snap-x">
                        {(selectedProduct.variations as any).map((v: any, idx: number) => {
                          const variationId = `${selectedProduct.id}-${v.name}`;
                          const cartItem = items.find(i => i.id === variationId);
                          const qty = cartItem?.quantity || 0;

                          return (
                            <motion.div 
                              key={idx}
                              whileTap={{ scale: 0.95 }}
                              animate={qty > 0 ? { scale: [1, 1.05, 1], transition: { duration: 0.2 } } : {}}
                              className={`shrink-0 w-40 p-6 rounded-[2rem] border-2 transition-all snap-start flex flex-col items-center text-center gap-4 ${qty > 0 ? 'bg-brand/10 border-brand shadow-luxury' : 'bg-brand/5 border-transparent hover:border-brand/20 hover:bg-white shadow-soft'}`}
                            >
                              <div className="space-y-1 mt-2">
                                <p className="font-black text-brand-dark text-sm tracking-tight">{v.name}</p>
                                <p className="font-black text-brand text-lg tracking-tighter">₹{v.price}</p>
                              </div>
                              
                              {qty > 0 ? (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="flex items-center gap-3 bg-white rounded-xl p-1.5 border border-brand/10 h-10 w-full justify-between mt-2 shadow-sm"
                                >
                                  <button 
                                    onClick={() => updateQuantity(variationId, -1)}
                                    className="w-7 h-7 bg-brand/5 rounded-lg flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all"
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <span className="font-black text-brand text-sm w-4">{qty}</span>
                                  <button 
                                    onClick={() => updateQuantity(variationId, 1)}
                                    className="w-7 h-7 bg-brand/5 rounded-lg flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </motion.div>
                              ) : (
                                <button 
                                  onClick={() => handleAddToCart(selectedProduct, v)}
                                  className="h-10 w-full bg-brand text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md hover:scale-105 active:scale-95 transition-all mt-2"
                                >
                                  Add to jar
                                </button>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {(!selectedProduct.variations || (selectedProduct.variations as any).length === 0) && (
                  <div className="mt-8 pt-8 border-t border-brand/5">
                    {(() => {
                      const cartItem = items.find(i => i.id === selectedProduct.id);
                      const qty = cartItem?.quantity || 0;

                      if (qty > 0) {
                        return (
                          <div className="flex items-center justify-center gap-6 bg-brand/5 rounded-[2rem] p-3 border border-brand/10">
                            <button 
                              onClick={() => updateQuantity(selectedProduct.id, -1)}
                              className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all shadow-soft"
                            >
                              <Minus size={20} />
                            </button>
                            <span className="font-black text-brand text-2xl w-8 text-center">{qty}</span>
                            <button 
                              onClick={() => updateQuantity(selectedProduct.id, 1)}
                              className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all shadow-soft"
                            >
                              <Plus size={20} />
                            </button>
                          </div>
                        );
                      }

                      return (
                        <Button3D 
                          onClick={() => handleAddToCart(selectedProduct)} 
                          className="w-full h-16 text-sm uppercase tracking-widest font-black"
                        >
                          Add to Jar <ShoppingCart className="ml-2" size={18} />
                        </Button3D>
                      );
                    })()}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-20 mt-20 border-t border-brand/5 text-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-soft border border-brand/5 overflow-hidden">
           {businessLogo ? <img src={businessLogo} className="w-full h-full object-cover opacity-60" alt="Footer Logo" /> : <Utensils className="text-brand opacity-20" size={32} />}
        </div>
        <h2 className="heading-cursive text-4xl text-brand mb-4">{businessName}</h2>
        <p className="font-bold text-brand-dark/65 text-[10px] uppercase tracking-widest">
          Handmade with love in {getSetting('address_city', 'Your City')}
        </p>
        <p className="text-[10px] font-bold text-brand-dark/50 uppercase tracking-widest mt-4">
          © 2026 {businessName} | FSSAI: {getSetting('fssai_number', '22426552000456')}
        </p>
      </footer>
    </div>
  );
};
