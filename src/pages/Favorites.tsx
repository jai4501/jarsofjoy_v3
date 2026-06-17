import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, Plus, Minus, Utensils, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { useProductStore } from '../store/useProductStore';
import { useFavoritesStore } from '../store/useFavoritesStore';
import { Navbar } from '../components/Navbar';
import { ScrollToTopButton } from '../components/ui/ScrollToTopButton';
import { CartDrawer } from '../components/CartDrawer';
import { Button3D } from '../components/ui/Button3D';

type Product = any;

export const Favorites = () => {
  const { products, isLoaded, fetchCatalog } = useProductStore();
  const { favorites, toggleFavorite } = useFavoritesStore();
  const { items, addItem, updateQuantity, isCartOpen, setIsCartOpen } = useCartStore();

  // Load catalog on mount if not loaded
  useEffect(() => {
    if (!isLoaded) {
      fetchCatalog();
    }
  }, [isLoaded, fetchCatalog]);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [showProductModal, setShowProductModal] = useState(false);

  // Lock background scroll when modal is open
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

  const handleAddToCart = (product: Product, variation?: { name: string; price: number }) => {
    if (product.stock_status === 'Out of Stock') {
      return;
    }

    const hasVariations = product.variations && (product.variations as any).length > 0;
    const itemToAdd = (hasVariations && variation) ? {
      ...product,
      id: `${product.id}-${variation.name}`,
      name: `${product.name} (${variation.name})`,
      price: variation.price
    } : product;

    addItem(itemToAdd);
  };

  const openQuickView = (product: Product) => {
    setSelectedProduct(product);
    setActiveImageIdx(0);
    setShowProductModal(true);
  };

  // Filter products by user favorites
  const favoriteProducts = products.filter(p => favorites.includes(p.id) && p.active !== false);

  return (
    <>
      <Navbar />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      <section className="min-h-screen bg-cream/30 pt-24 sm:pt-32 pb-32 px-4 sm:px-8 max-w-7xl mx-auto w-full">
        {/* Page Header */}
        <div className="text-center mb-12 sm:mb-20">
          <p className="text-brand font-black uppercase tracking-[0.4em] text-[10px] sm:text-xs mb-3 opacity-60">Your Curated Sweets</p>
          <h2 className="heading-cursive text-5xl sm:text-7xl text-brand-dark mb-4">My Favorites</h2>
          <div className="w-24 h-1 bg-brand/10 rounded-full mx-auto" />
        </div>

        {/* Favorites List */}
        {!isLoaded ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
          </div>
        ) : favoriteProducts.length === 0 ? (
          /* Empty State */
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto space-y-6"
          >
            <div className="w-24 h-24 rounded-full bg-brand/5 border border-brand/10 flex items-center justify-center text-brand relative shadow-soft">
              <Heart size={44} className="stroke-[1.5] animate-pulse" />
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-[10px] font-black">
                0
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="heading-serif text-2xl font-black text-brand-dark">No favorites yet</h3>
              <p className="text-xs font-semibold text-brand-dark/55 leading-relaxed">
                Start browsing our menu of fresh treats and tap the heart icon to save your favorites here!
              </p>
            </div>

            <Link 
              to="/menu"
              className="inline-flex h-12 px-8 bg-brand text-white rounded-full text-xs font-black uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-95 transition-all items-center gap-2"
            >
              <Utensils size={14} />
              View Menu
            </Link>
          </motion.div>
        ) : (
          /* Product Grid */
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {favoriteProducts.map((product) => {
              const isFav = favorites.includes(product.id);
              return (
                <motion.div 
                  layout
                  key={product.id}
                  onClick={() => openQuickView(product)}
                  className="bg-white rounded-[1.5rem] border border-brand/5 overflow-hidden group shadow-soft hover:shadow-luxury hover:-translate-y-1 transition-all duration-500 cursor-pointer flex flex-col h-full relative"
                >
                  {/* Floating Heart Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(product.id);
                    }}
                    className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-white/80 backdrop-blur-md border border-brand/10 flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-sm group-favorite-button"
                    title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                  >
                    <Heart 
                      size={14} 
                      className={`transition-colors ${isFav ? 'fill-red-500 stroke-red-500 text-red-500' : 'text-brand'}`} 
                    />
                  </button>

                  {/* Product Image */}
                  <div className="h-40 sm:h-56 bg-brand/5 overflow-hidden relative">
                    {product.images && product.images[0] ? (
                      <img 
                        src={product.images[0]} 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl opacity-10">🍰</div>
                    )}
                    {product.stock_status === 'Out of Stock' && (
                      <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-xs flex items-center justify-center">
                        <span className="bg-white text-brand font-black text-[9px] sm:text-xs uppercase tracking-widest px-3 py-1.5 rounded-xl shadow-md">Sold Out</span>
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="p-4 sm:p-5 flex flex-col flex-1 bg-white">
                    <p className="text-brand font-black uppercase tracking-[0.4em] text-[8px] mb-1 opacity-60">{product.category}</p>
                    <h3 className="text-sm sm:text-base font-black mb-2 text-brand-dark tracking-tight group-hover:text-brand transition-colors heading-serif leading-tight">
                      {product.name}
                    </h3>
                    <p className="text-[10px] font-semibold text-brand-dark/50 line-clamp-2 leading-relaxed mb-4">
                      {product.description || "Indulge in this handcrafted masterpiece made with passion."}
                    </p>

                    {/* Bottom row: price and add button */}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-brand/5">
                        <div className="flex flex-col items-center leading-none">
                          <span className="text-[10px] sm:text-xs font-black text-brand-dark/30 line-through tracking-wider">₹{Math.round(product.price * 1.3)}</span>
                          <span className="text-lg sm:text-xl font-black text-brand tracking-tighter mt-0.5">₹{product.price}</span>
                        </div>
                      
                      {/* Add Button */}
                      <div>
                        {(() => {
                          const productItems = items.filter(i => i.id === product.id || i.id.startsWith(`${product.id}-`));
                          const totalQty = productItems.reduce((sum, i) => sum + i.quantity, 0);
                          const hasVariations = product.variations && (product.variations as any).length > 0;
                          
                          if (totalQty > 0 && !hasVariations) {
                            return (
                              <div className="flex items-center gap-2.5 bg-brand/5 border border-brand/10 rounded-full p-1 h-10 shadow-sm" onClick={e => e.stopPropagation()}>
                                <button 
                                  onClick={() => updateQuantity(productItems[0].id, totalQty - 1)}
                                  className="w-8 h-8 bg-white hover:bg-brand/10 text-brand rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-sm cursor-pointer"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="font-black text-brand text-xs min-w-4 text-center">{totalQty}</span>
                                <button 
                                  onClick={() => updateQuantity(productItems[0].id, totalQty + 1)}
                                  className="w-8 h-8 bg-white hover:bg-brand/10 text-brand rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-sm cursor-pointer"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div className="relative">
                              {totalQty > 0 && (
                                <div className="absolute -top-1.5 -right-1.5 bg-brand text-white text-[8px] font-black w-5 h-5 rounded-full flex items-center justify-center z-10 border-2 border-white shadow-sm">
                                  {totalQty}
                                </div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (hasVariations) openQuickView(product);
                                  else handleAddToCart(product);
                                }}
                                disabled={product.stock_status === 'Out of Stock'}
                                className="h-10 sm:h-12 px-5 sm:px-6 bg-brand hover:bg-brand/90 disabled:opacity-50 text-white rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
                              >
                                {product.stock_status === 'Out of Stock' ? 'Sold Out' : (hasVariations ? 'Options' : 'Add to jar')}
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

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
                      <div className="bg-brand/5 border border-brand/10 rounded-2xl px-4 py-1.5 flex items-center justify-center gap-2.5 shadow-inner">
                        <span className="text-xs font-black text-brand-dark/30 line-through tracking-wider mt-0.5">₹{Math.round(selectedProduct.price * 1.3)}</span>
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
                              <div className="flex flex-col items-center mt-1">
                                <p className="font-black text-brand-dark text-xs tracking-tight uppercase mb-1.5">{v.name}</p>
                                <span className="text-[9px] font-black text-brand-dark/30 line-through tracking-wider leading-none">₹{Math.round(v.price * 1.3)}</span>
                                <p className="font-black text-brand text-sm tracking-tighter leading-none mt-0.5">₹{v.price}</p>
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
      <ScrollToTopButton />
    </>
  );
};
