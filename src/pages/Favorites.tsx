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

  // Selected product state for Quick View
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);

  // Disable page scroll when modal is active
  useEffect(() => {
    if (showProductModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
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
                      <span className="text-lg sm:text-xl font-black text-brand tracking-tighter">₹{product.price}</span>
                      
                      {/* Add Button */}
                      <div>
                        {(() => {
                          const productItems = items.filter(i => i.id === product.id || i.id.startsWith(`${product.id}-`));
                          const totalQty = productItems.reduce((sum, i) => sum + i.quantity, 0);
                          const hasVariations = product.variations && (product.variations as any).length > 0;

                          if (totalQty > 0) {
                            return (
                              <div className="flex items-center gap-2.5 bg-brand/5 border border-brand/10 rounded-full p-1 h-10 shadow-sm" onClick={e => e.stopPropagation()}>
                                <button 
                                  onClick={() => updateQuantity(productItems[0].id, -1)}
                                  className="w-8 h-8 bg-white hover:bg-brand/10 text-brand rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-sm cursor-pointer"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="font-black text-brand text-xs min-w-4 text-center">{totalQty}</span>
                                <button 
                                  onClick={() => updateQuantity(productItems[0].id, 1)}
                                  className="w-8 h-8 bg-white hover:bg-brand/10 text-brand rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-sm cursor-pointer"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            );
                          }

                          return (
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
              className="bg-white w-full max-w-4xl rounded-t-[2.5rem] md:rounded-[3rem] shadow-layer-3 border border-brand/5 overflow-hidden flex flex-col md:flex-row relative max-h-[92vh] md:max-h-[85vh] md:h-[540px]"
            >
              {/* Drag Handle (Mobile Only) */}
              <div className="w-12 h-1.5 bg-brand/10 rounded-full mx-auto mt-4 mb-2 md:hidden" />

              <button 
                onClick={() => setShowProductModal(false)} 
                className="absolute top-4 right-4 md:top-6 md:right-6 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md text-brand flex items-center justify-center hover:bg-brand hover:text-white transition-all shadow-soft z-[110] border border-brand/5 cursor-pointer"
              >
                <X size={18} />
              </button>

              {/* Image Section */}
              <div className="w-full md:w-1/2 h-72 md:h-full bg-brand/5 relative overflow-hidden flex-shrink-0">
                 {selectedProduct.images && selectedProduct.images[0] ? (
                   <img src={selectedProduct.images[0]} className="w-full h-full object-cover" alt={selectedProduct.name} />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-7xl opacity-10">🍰</div>
                 )}
              </div>

              {/* Info Section */}
              <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col bg-white h-full justify-between overflow-y-auto no-scrollbar">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-brand font-black uppercase tracking-[0.4em] text-[8px] sm:text-[9px] opacity-60">{selectedProduct.category}</p>
                    <button
                      onClick={() => toggleFavorite(selectedProduct.id)}
                      className="w-8 h-8 rounded-full border border-brand/10 flex items-center justify-center hover:scale-105 transition-all shadow-sm cursor-pointer"
                      title={favorites.includes(selectedProduct.id) ? "Remove from Favorites" : "Add to Favorites"}
                    >
                      <Heart 
                        size={14} 
                        className={favorites.includes(selectedProduct.id) ? 'fill-red-500 stroke-red-500 text-red-500' : 'text-brand'} 
                      />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-2xl md:text-3xl font-black text-brand-dark tracking-tight leading-tight heading-serif">{selectedProduct.name}</h3>
                    <div className="flex items-center gap-4">
                      <p className="text-xl md:text-2xl font-black text-brand tracking-tighter">₹{selectedProduct.price}</p>
                      <div className="h-4 w-px bg-brand/10" />
                      <p className="text-[9px] font-bold text-brand-dark/40 uppercase tracking-widest">Premium Quality</p>
                    </div>
                  </div>

                  <p className="text-brand-dark/70 font-medium leading-relaxed text-xs sm:text-sm italic border-l-2 border-brand/15 pl-3 py-1">
                    "{selectedProduct.description || "Indulge in this handcrafted masterpiece made with passion and the finest ingredients."}"
                  </p>
                </div>

                {/* Variations & Options */}
                <div className="flex-1 overflow-y-auto no-scrollbar py-6">
                  {selectedProduct.variations && (selectedProduct.variations as any).length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-brand/5 pb-2">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-dark/65">Select your preference</p>
                        <p className="text-[9px] font-bold text-brand italic">Scroll for sizes →</p>
                      </div>
                      
                      <div className="flex overflow-x-auto no-scrollbar gap-3 pb-2 -mx-2 px-2 snap-x">
                        {(selectedProduct.variations as any).map((v: any, idx: number) => {
                          const variationId = `${selectedProduct.id}-${v.name}`;
                          const cartItem = items.find(i => i.id === variationId);
                          const qty = cartItem?.quantity || 0;

                          return (
                            <motion.div 
                              key={idx}
                              whileTap={{ scale: 0.95 }}
                              animate={qty > 0 ? { scale: [1, 1.02, 1], transition: { duration: 0.2 } } : {}}
                              className={`shrink-0 w-32 p-4 rounded-[1.5rem] border-2 transition-all snap-start flex flex-col items-center text-center gap-3 ${qty > 0 ? 'bg-brand/10 border-brand shadow-luxury' : 'bg-brand/5 border-transparent hover:border-brand/20 hover:bg-white shadow-soft'}`}
                            >
                              <div className="space-y-0.5 mt-1">
                                <p className="font-black text-brand-dark text-xs tracking-tight">{v.name}</p>
                                <p className="font-black text-brand text-sm tracking-tighter">₹{v.price}</p>
                              </div>
                              
                              {qty > 0 ? (
                                <motion.div 
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="flex items-center gap-2 bg-white rounded-lg p-1 border border-brand/10 h-8 w-full justify-between mt-1 shadow-sm"
                                >
                                  <button 
                                    onClick={() => updateQuantity(variationId, -1)}
                                    className="w-6 h-6 bg-brand/5 rounded-md flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all cursor-pointer"
                                  >
                                    <Minus size={10} />
                                  </button>
                                  <span className="font-black text-brand text-xs w-4">{qty}</span>
                                  <button 
                                    onClick={() => updateQuantity(variationId, 1)}
                                    className="w-6 h-6 bg-brand/5 rounded-md flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all cursor-pointer"
                                  >
                                    <Plus size={10} />
                                  </button>
                                </motion.div>
                              ) : (
                                <button
                                  onClick={() => handleAddToCart(selectedProduct, v)}
                                  disabled={selectedProduct.stock_status === 'Out of Stock'}
                                  className="w-full h-8 bg-brand text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm hover:scale-105 active:scale-95 transition-all mt-1 cursor-pointer"
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
                          <div className="flex items-center justify-between bg-brand/5 border border-brand/10 rounded-2xl p-1.5 h-14 shadow-inner">
                            <span className="text-[10px] font-black text-brand-dark/40 uppercase tracking-[0.2em] pl-3">Added to Jar</span>
                            <div className="flex items-center gap-3 bg-white rounded-xl p-1 shadow-sm border border-brand/5">
                              <button 
                                onClick={() => updateQuantity(selectedProduct.id, -1)}
                                className="w-7 h-7 bg-brand/5 rounded-lg flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all cursor-pointer"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="font-black text-brand text-sm w-4 text-center">{qty}</span>
                              <button 
                                onClick={() => updateQuantity(selectedProduct.id, 1)}
                                className="w-7 h-7 bg-brand/5 rounded-lg flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all cursor-pointer"
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
                          className="w-full h-12 sm:h-14 text-xs sm:text-sm uppercase tracking-widest font-black"
                        >
                          Add to Jar <ShoppingCart className="ml-2" size={14} />
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
      <ScrollToTopButton />
    </>
  );
};
