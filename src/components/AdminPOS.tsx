import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button3D } from './ui/Button3D';
import { Search, Plus, Minus, Trash2, ShoppingCart, Filter, Check, X } from 'lucide-react';
import { useToastStore } from '../store/useToastStore';
import { motion, AnimatePresence } from 'framer-motion';
import { POSCheckout } from './POSCheckout';

export const AdminPOS = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [cart, setCart] = useState<any[]>(() => {
    const saved = localStorage.getItem('joj-pos-cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [showCheckout, setShowCheckout] = useState(false);
  const subtotal = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);

  useEffect(() => {
    localStorage.setItem('joj-pos-cart', JSON.stringify(cart));
  }, [cart]);

  const [loading, setLoading] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const { addToast } = useToastStore();

  // Variation Selection
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchProducts(), fetchCategories()]);
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('product_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (data) setCategories(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('active', true).order('name');
    if (data) setProducts(data);
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const categoryList = ['All', ...categories.map(c => c.name)].sort((a, b) => {
    if (a === 'All') return -1;
    if (b === 'All') return 1;
    return a.localeCompare(b);
  });

  const handleAddToCart = (product: any, variation?: { name: string; price: number }) => {
    if (product.variations && product.variations.length > 0 && !variation) {
      setSelectedProduct(product);
      return;
    }

    const itemToAdd = variation ? {
      ...product,
      id: `${product.id}-${variation.name}`,
      name: `${product.name} (${variation.name})`,
      price: variation.price
    } : { ...product };

    const existing = cart.find(item => item.id === itemToAdd.id);
    if (existing) {
      setCart(cart.map(item => 
        item.id === itemToAdd.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...itemToAdd, quantity: 1 }]);
    }
    
    setSelectedProduct(null);
    addToast(`${itemToAdd.name} added to cart`, 'sweet');
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        return { ...item, quantity: item.quantity + delta };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  if (showCheckout) {
    return (
      <POSCheckout
        cart={cart}
        onBack={() => setShowCheckout(false)}
        onComplete={async (orderData) => {
          try {
            // Retrieve backend URL
            const { data: urlData } = await supabase
              .from('site_content')
              .select('value')
              .eq('key', 'whatsapp_backend_url')
              .single();
            const backendUrl = (urlData as any)?.value || `http://${window.location.hostname}:3001`;

            // Place order via backend
            const response = await fetch(`${backendUrl}/api/orders/place`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                items: orderData.items.map((item: any) => ({ id: item.id, quantity: item.quantity })),
                coupon_code: orderData.coupon_code,
                delivery_type: orderData.delivery_type,
                delivery_address: orderData.address,
                delivery_distance_km: orderData.delivery_distance_km,
                customer_name: orderData.customer_name,
                customer_phone: orderData.customer_phone,
                user_id: orderData.user_id,
                order_source: 'pos',
                payment_method: orderData.payment_method,
                payment_status: orderData.payment_status,
                status: orderData.status
              })
            });

            const resData = await response.json();
            if (!response.ok) {
              throw new Error(resData.error || 'Failed to place POS order securely.');
            }

            const order = resData.order;

            // 3. Upsert customer in customers CRM
            let cleanPhone = orderData.customer_phone.replace(/\D/g, '');
            if (cleanPhone.length === 10) {
              cleanPhone = '91' + cleanPhone;
            }
            if (!cleanPhone.startsWith('+')) {
              cleanPhone = '+' + cleanPhone;
            }

            const { data: existingCustomer } = await (supabase
              .from('customers') as any)
              .select('*')
              .eq('phone', cleanPhone)
              .maybeSingle();

            const customerObj = existingCustomer as any;

            if (customerObj) {
              const newTotalOrders = (customerObj.total_orders || 0) + 1;
              const newTotalSpent = Number(customerObj.total_spent || 0) + Number(order.total);
              
              await (supabase.from('customers') as any)
                .update({
                  name: orderData.customer_name || customerObj.name,
                  total_orders: newTotalOrders,
                  total_spent: newTotalSpent,
                  last_order_at: new Date().toISOString(),
                  last_order_total: order.total
                })
                .eq('phone', cleanPhone);
            } else {
              await (supabase.from('customers') as any)
                .insert([{
                  phone: cleanPhone,
                  name: orderData.customer_name || 'POS Customer',
                  onboarding_status: 'done',
                  total_orders: 1,
                  total_spent: order.total,
                  last_order_at: new Date().toISOString(),
                  last_order_total: order.total
                }]);
            }

            addToast('POS Order finalized and saved!', 'sweet');
            setCart([]);
            setShowCheckout(false);
            setIsCartOpen(false);
          } catch (err: any) {
            console.error('Error finalizing POS order:', err);
            addToast(err.message || 'Failed to finalize POS order', 'error');
          }
        }}
      />
    );
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex flex-col gap-6 h-full min-h-[calc(100vh-160px)] relative">
      {/* Professional Single-Line Header - FROZEN */}
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-white/80 backdrop-blur-xl p-3 rounded-[2rem] border border-brand/5 shadow-soft">
        {/* Expandable Search */}
        <div className={`relative flex items-center transition-all duration-500 ease-in-out ${isSearchExpanded ? 'flex-[2]' : 'w-12'}`}>
          <button 
            onClick={() => setIsSearchExpanded(!isSearchExpanded)}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${isSearchExpanded ? 'text-brand' : 'bg-brand/5 text-brand hover:bg-brand hover:text-white'}`}
          >
            <Search size={20} />
          </button>
          <input 
            type="text"
            placeholder="Search treats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setIsSearchExpanded(true)}
            className={`absolute left-0 h-12 pl-12 bg-transparent outline-none font-bold text-brand-dark transition-all duration-500 ${isSearchExpanded ? 'w-full opacity-100 pr-4' : 'w-0 opacity-0 pointer-events-none'}`}
          />
        </div>
        
        {/* Compact Filter */}
        <div className="flex-1 min-w-0 relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30 pointer-events-none" size={16} />
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full h-12 pl-10 pr-8 bg-brand-light/5 rounded-full border border-transparent outline-none focus:border-brand/20 appearance-none font-bold text-brand-dark text-[10px] sm:text-xs cursor-pointer truncate"
          >
            {categoryList.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Action Button: Cart (Mobile & Desktop) */}
        <button 
          onClick={() => setIsCartOpen(true)}
          className="h-12 px-4 sm:px-6 bg-brand text-white rounded-full flex items-center justify-center gap-2 shadow-lg shadow-brand/20 active:scale-95 transition-all shrink-0"
        >
          <ShoppingCart size={18} />
          <span className="font-black text-sm">{cartItemCount}</span>
        </button>
      </div>
      
      {/* Products Grid */}
      <div className="flex-1 pr-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5 pb-20">
          {filteredProducts.map(product => (
            <button 
              key={product.id}
              onClick={() => handleAddToCart(product)}
              className="bg-white rounded-2xl sm:rounded-[2rem] text-left hover:shadow-xl hover:shadow-brand/10 transition-all active:scale-95 group overflow-hidden flex flex-col border border-brand/5 h-full min-h-[180px] sm:min-h-[240px]"
            >
              {/* Image Section */}
              <div className="h-24 sm:h-32 bg-brand-light/10 relative overflow-hidden shrink-0">
                {product.images && product.images[0] ? (
                  <img src={product.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={product.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl opacity-20">🍰</div>
                )}
                <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
                  <span className="px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-[6px] sm:text-[7px] font-black uppercase tracking-widest text-brand shadow-sm">
                    {product.category}
                  </span>
                </div>
              </div>

              {/* Content Section */}
              <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between">
                <div>
                  <h4 className="font-black text-brand-dark leading-tight text-xs sm:text-sm line-clamp-2">{product.name}</h4>
                  {product.variations && product.variations.length > 0 && (
                    <span className="text-[6px] sm:text-[7px] font-black bg-brand/10 text-brand px-1.5 py-0.5 rounded-md mt-1.5 sm:mt-2 inline-block uppercase">
                      {product.variations.length} Options
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center mt-2 sm:mt-3">
                  <div className="flex flex-col items-start leading-none mt-1">
                    <span className="text-[9px] font-black text-brand-dark/30 line-through tracking-wider">₹{Math.round(product.price * 1.3)}</span>
                    <p className="text-brand font-black text-base sm:text-lg mt-0.5">₹{product.price}</p>
                  </div>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-brand text-white rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-brand/20 group-hover:scale-110 transition-transform">
                    <Plus size={14} />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* POS Cart Sidebar (Slide-in from right) */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-brand-dark/20 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[70] flex flex-col border-l border-brand/5"
            >
              <div className="p-8 flex items-center justify-between border-b border-brand/5">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-brand text-white rounded-2xl shadow-lg shadow-brand/20"><ShoppingCart size={24}/></div>
                  <h3 className="text-2xl font-black text-brand-dark">Checkout Jar</h3>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="w-10 h-10 rounded-full bg-brand/5 text-brand flex items-center justify-center hover:bg-brand hover:text-white transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 custom-scrollbar">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 text-center py-20 italic">
                    <ShoppingCart size={64} className="mb-4" />
                    <p className="font-bold text-xl uppercase tracking-widest">Jar is Empty</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-brand/5 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-brand/5 group hover:border-brand/20 transition-all gap-3">
                      <div className="flex-1 min-w-0">
                        <h5 className="font-black text-brand-dark leading-tight text-xs sm:text-sm truncate">{item.name}</h5>
                        <p className="text-[10px] font-black text-brand mt-1 uppercase tracking-widest">₹{item.price * item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 bg-white rounded-xl sm:rounded-2xl p-1 sm:p-1.5 shadow-sm border border-brand/5 shrink-0">
                        <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-brand hover:text-white rounded-lg sm:rounded-xl transition-colors text-brand/60"><Minus size={12}/></button>
                        <span className="font-black text-xs sm:text-sm w-4 text-center text-brand-dark">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-brand hover:text-white rounded-lg sm:rounded-xl transition-colors text-brand/60"><Plus size={12}/></button>
                        <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white rounded-lg sm:rounded-xl transition-colors ml-0.5"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-brand-light/5 border-t border-brand/5">
                <div className="flex items-center gap-4 bg-brand text-white p-4 rounded-3xl shadow-xl shadow-brand/20">
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Subtotal</p>
                    <p className="text-2xl font-black tracking-tighter truncate">₹{subtotal}</p>
                  </div>
                  <Button3D 
                    variant="secondary"
                    className={`h-14 px-8 text-xs font-black uppercase tracking-widest ${(loading || cart.length === 0) ? 'opacity-50 pointer-events-none' : ''}`}
                    onClick={() => setShowCheckout(true)}
                  >
                    Checkout
                  </Button3D>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Variation Selector Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md p-8 sm:p-12 rounded-[3.5rem] shadow-layer-3 border border-brand/5">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <p className="text-brand font-black uppercase tracking-widest text-[8px] mb-1">Select Size</p>
                  <h3 className="text-3xl font-black text-brand-dark tracking-tight">{selectedProduct.name}</h3>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="w-10 h-10 rounded-full bg-brand/5 text-brand flex items-center justify-center hover:bg-brand hover:text-white transition-all"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                {selectedProduct.variations?.map((v: any, idx: number) => (
                  <button key={idx} onClick={() => handleAddToCart(selectedProduct, v)} className="w-full p-6 bg-brand/5 border-2 border-transparent hover:border-brand/20 hover:bg-white rounded-[2rem] flex justify-between items-center group transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-brand shadow-soft group-hover:scale-110 transition-transform"><Check size={18} /></div>
                      <span className="text-lg font-black text-brand-dark">{v.name}</span>
                    </div>
                    <div className="flex flex-col items-end leading-none mt-1">
                      <span className="text-[10px] font-black text-brand-dark/30 line-through tracking-wider">₹{Math.round(v.price * 1.3)}</span>
                      <span className="text-xl font-black text-brand tracking-tighter mt-0.5">₹{v.price}</span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop Cart Toggle */}
      <div className="hidden lg:block fixed bottom-10 right-10 z-50">
        <button 
          onClick={() => setIsCartOpen(true)}
          className="w-20 h-20 bg-brand text-white rounded-full flex items-center justify-center shadow-2xl shadow-brand/40 hover:scale-110 active:scale-95 transition-all relative border-4 border-white"
        >
          <ShoppingCart size={32} />
          {cartItemCount > 0 && (
            <span className="absolute -top-1 -right-1 w-8 h-8 bg-brand-dark text-white rounded-full flex items-center justify-center font-black border-4 border-white text-xs">{cartItemCount}</span>
          )}
        </button>
      </div>
    </div>
  );
};
