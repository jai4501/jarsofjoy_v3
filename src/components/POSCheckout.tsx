/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Phone, Package, Truck, 
  Check, ArrowLeft, CreditCard, 
  Banknote, X, Ticket, ShoppingCart, RefreshCw,
  Clock, Calendar, AlertCircle
} from 'lucide-react';
import { Button3D } from './ui/Button3D';
import { FloatingCard } from './ui/FloatingCard';
import { useToastStore } from '../store/useToastStore';
import { AddressManager } from './AddressManager';
import { calculateDelivery } from '../lib/deliveryEngine';
import type { DeliveryResult } from '../lib/deliveryEngine';

interface Coupon {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  min_order_amount: number;
  valid_until: string;
}

interface POSCheckoutProps {
  cart: any[];
  onBack: () => void;
  onComplete: (orderData: any) => void;
}

export const POSCheckout = ({ cart, onBack, onComplete }: POSCheckoutProps) => {
  const { addToast } = useToastStore();
  
  // Steps: 'customer' -> 'delivery_method' -> 'review' -> 'payment'
  const [step, setStep] = useState<'customer' | 'delivery_method' | 'review' | 'payment'>('customer');
  
  // Customer State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+91');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  
  // Delivery State
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [deliveryInfo, setDeliveryResult] = useState<DeliveryResult | null>(null);

  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cash'>('upi');
  const [loading, setLoading] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Real-time calculation when dependencies change
  useEffect(() => {
    if (deliveryMethod === 'delivery' && selectedAddress) {
      // Mock distance for POS for now, or use pincode logic
      // In a real app, you'd call a Distance API here. 
      // For now, let's assume < 10km if same city, > 10km otherwise.
      const distance = selectedAddress.district?.toLowerCase().includes('coimbatore') ? 5 : 15;
      const res = calculateDelivery(cart, distance);
      setDeliveryResult(res);
    } else {
      setDeliveryResult(null);
    }
  }, [deliveryMethod, selectedAddress, cart]);

  // Handle search with real-time filtering starting from 1 char
  const handlePhoneChange = (val: string) => {
    if (!val.startsWith('+91')) val = '+91' + val.replace(/\D/g, '');
    const digits = val.slice(3).replace(/\D/g, '').slice(0, 10);
    const finalPhone = '+91' + digits;
    setCustomerPhone(finalPhone);
    
    if (digits.length >= 1 || customerName.length >= 1) {
      searchCustomers(finalPhone, customerName);
    } else {
      setSearchResults([]);
    }
  };

  const handleNameChange = (val: string) => {
    setCustomerName(val);
    if (val.length >= 1 || customerPhone.length > 3) {
      searchCustomers(customerPhone, val);
    } else {
      setSearchResults([]);
    }
  };

  const searchCustomers = async (phone: string, name: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*, addresses(*)')
      .or(`mobile.ilike.%${phone}%,full_name.ilike.%${name}%`)
      .limit(5);
    if (data) setSearchResults(data);
  };

  const selectCustomer = (profile: any) => {
    setSelectedProfile(profile);
    setCustomerName(profile.full_name || '');
    setCustomerPhone(profile.mobile || '');
    setSearchResults([]);
    
    // Auto-select default address if exists
    if (profile.addresses?.length > 0) {
      const def = profile.addresses.find((a: any) => a.is_default) || profile.addresses[0];
      setSelectedAddress(def);
    }

    // Advance to delivery method automatically as customer is identified
    setStep('delivery_method');
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .single();

      if (error || !data) throw new Error('Invalid coupon code');
      const coupon = data as Coupon;
      
      // Validation logic
      if (new Date(coupon.valid_until) < new Date()) throw new Error('Coupon expired');
      if (subtotal < coupon.min_order_amount) throw new Error(`Min order ₹${coupon.min_order_amount} required`);

      const discount = coupon.type === 'percent' 
        ? (subtotal * coupon.value) / 100 
        : coupon.value;

      setAppliedCoupon(coupon);
      setDiscountAmount(discount);
      addToast('Coupon applied!', 'sweet');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const deliveryFee = deliveryInfo?.fee || 0;
  const total = subtotal + deliveryFee - discountAmount;

  const handleFinalize = async () => {
    setLoading(true);
    try {
      const orderData: any = {
        user_id: selectedProfile?.id || null,
        customer_name: customerName || 'Walk-in Customer',
        customer_phone: customerPhone,
        address: deliveryMethod === 'pickup' ? 'Store Pickup' : `${selectedAddress.door_no}, ${selectedAddress.street}, ${selectedAddress.area}`,
        items: cart,
        subtotal,
        delivery_charge: deliveryFee,
        discount_amount: discountAmount,
        coupon_code: appliedCoupon?.code || null,
        total,
        status: 'completed',
        payment_method: paymentMethod,
        payment_status: 'verified',
        order_source: 'pos',
        delivery_type: deliveryMethod,
        weight_grams: deliveryInfo?.weightGrams || 0,
        delivery_distance_km: deliveryInfo?.distanceKm || 0,
        delivery_partner: deliveryInfo?.partner || null,
        is_weekend_order: deliveryInfo?.isWeekend || false,
        is_late_night: deliveryInfo?.isLateNight || false
      };

      onComplete(orderData);
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-cream/30 z-[100] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-brand/5 p-6 flex justify-between items-center shrink-0">
        <button onClick={onBack} className="flex items-center gap-2 text-brand font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all">
          <ArrowLeft size={18} /> Back to Terminal
        </button>
        <div className="text-center">
          <h2 className="heading-serif text-2xl text-brand-dark">POS Checkout</h2>
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-brand-dark/30">Order Review & Payment</p>
        </div>
        <div className="w-24" /> {/* Spacer */}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Flow Area */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Step 1: Customer Details */}
            <FloatingCard className={step === 'customer' ? 'ring-2 ring-brand' : 'opacity-60'}>
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-10 h-10 bg-brand/5 text-brand rounded-xl flex items-center justify-center font-black">1</div>
                 <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">Customer Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2.5 relative">
                   <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2 block">Mobile Number</label>
                   <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
                      <input 
                        type="text" 
                        value={customerPhone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="+91 00000 00000"
                        className="w-full h-14 pl-12 bg-brand/5 border-2 border-transparent focus:border-brand/20 rounded-2xl outline-none font-bold text-lg"
                      />
                   </div>

                   {/* Search Results Dropdown */}
                   <AnimatePresence>
                     {searchResults.length > 0 && (
                       <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-brand/10 overflow-hidden z-[110]">
                         {searchResults.map(p => (
                           <button key={p.id} onClick={() => selectCustomer(p)} className="w-full px-5 py-4 text-left hover:bg-brand/5 flex items-center justify-between group border-b border-brand/5 last:border-0 transition-all">
                             <div>
                               <p className="text-sm font-black text-brand-dark">{p.full_name}</p>
                               <p className="text-[10px] font-bold text-brand-dark/40">{p.mobile}</p>
                             </div>
                             <div className="w-8 h-8 rounded-full bg-brand/5 text-brand flex items-center justify-center opacity-0 group-hover:opacity-100"><Check size={14}/></div>
                           </button>
                         ))}
                       </motion.div>
                     )}
                   </AnimatePresence>
                </div>

                <div className="space-y-2.5">
                   <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2 block">Customer Name</label>
                   <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
                      <input 
                        type="text" 
                        value={customerName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="Ex: John Doe"
                        className="w-full h-14 pl-12 bg-brand/5 border-2 border-transparent focus:border-brand/20 rounded-2xl outline-none font-bold text-lg"
                      />
                   </div>
                </div>
              </div>
              
              {step === 'customer' && (
                <div className="mt-8 flex justify-end">
                   <Button3D onClick={() => setStep('delivery_method')} disabled={customerPhone.length < 13} className="px-12 h-14">CONTINUE</Button3D>
                </div>
              )}
            </FloatingCard>

            {/* Step 2: Delivery Method */}
            <AnimatePresence>
              {step !== 'customer' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                  <FloatingCard className={step === 'delivery_method' ? 'ring-2 ring-brand' : 'opacity-60'}>
                    <div className="flex items-center gap-4 mb-8">
                       <div className="w-10 h-10 bg-brand/5 text-brand rounded-xl flex items-center justify-center font-black">2</div>
                       <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">Delivery Choice</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <button 
                         onClick={() => { setDeliveryMethod('pickup'); setStep('delivery_method'); }}
                         className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${deliveryMethod === 'pickup' ? 'border-brand bg-brand/5' : 'border-brand/5 opacity-40 hover:opacity-100'}`}
                       >
                          <Package size={32} className={deliveryMethod === 'pickup' ? 'text-brand' : ''} />
                          <span className="font-black text-[10px] uppercase tracking-widest">Self Pickup</span>
                       </button>
                       <button 
                         onClick={() => { setDeliveryMethod('delivery'); setStep('delivery_method'); }}
                         className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${deliveryMethod === 'delivery' ? 'border-brand bg-brand/5' : 'border-brand/5 opacity-40 hover:opacity-100'}`}
                       >
                          <Truck size={32} className={deliveryMethod === 'delivery' ? 'text-brand' : ''} />
                          <span className="font-black text-[10px] uppercase tracking-widest">Home Delivery</span>
                       </button>
                    </div>

                    {deliveryMethod === 'delivery' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-8 pt-8 border-t border-brand/5 overflow-hidden">
                        <AddressManager 
                          selectedId={selectedAddress?.id} 
                          onSelect={(addr) => setSelectedAddress(addr)} 
                        />
                      </motion.div>
                    )}

                    {step === 'delivery_method' && (
                      <div className="mt-8 flex justify-end">
                        <Button3D 
                          onClick={() => setStep('review')} 
                          disabled={deliveryMethod === 'delivery' && !selectedAddress} 
                          className="px-12 h-14"
                        >
                          PROCEED TO REVIEW
                        </Button3D>
                      </div>
                    )}
                  </FloatingCard>

                  {/* Step 3: Review & Coupon */}
                  {step !== 'delivery_method' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                       <FloatingCard className={step === 'review' ? 'ring-2 ring-brand' : 'opacity-60'}>
                          <div className="flex items-center gap-4 mb-8">
                             <div className="w-10 h-10 bg-brand/5 text-brand rounded-xl flex items-center justify-center font-black">3</div>
                             <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">Review & Discount</h3>
                          </div>

                          <div className="space-y-6">
                             {/* Coupon Section */}
                             <div className="bg-brand/5 p-6 rounded-3xl space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40 ml-2 block">Apply Coupon</label>
                                <div className="flex gap-3">
                                   <div className="relative flex-1">
                                      <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
                                      <input 
                                        type="text"
                                        placeholder="Enter code..."
                                        value={couponCode}
                                        onChange={(e) => setCouponCode(e.target.value)}
                                        className="w-full h-14 pl-12 bg-white rounded-2xl outline-none font-black text-brand-dark focus:ring-2 ring-brand/20 transition-all uppercase placeholder:normal-case"
                                      />
                                   </div>
                                   <button 
                                     onClick={handleApplyCoupon}
                                     className="h-14 px-8 bg-brand-dark text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                                   >
                                      Apply
                                   </button>
                                </div>
                                {appliedCoupon && (
                                   <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-green-600 font-bold text-xs ml-2">
                                      <Check size={14} /> Applied: {appliedCoupon.code} (-₹{discountAmount})
                                      <button onClick={() => { setAppliedCoupon(null); setDiscountAmount(0); setCouponCode(''); }} className="text-red-400 hover:text-red-500 ml-2"><X size={14} /></button>
                                   </motion.div>
                                )}
                             </div>

                             {/* Delivery Status Info */}
                             {deliveryMethod === 'delivery' && deliveryInfo && (
                               <div className={`p-6 rounded-3xl border-2 ${deliveryInfo.canDeliverAll ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                                  <div className="flex items-start gap-4">
                                     <div className={`p-3 rounded-2xl ${deliveryInfo.canDeliverAll ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                        {deliveryInfo.canDeliverAll ? <Check size={24}/> : <AlertCircle size={24}/>}
                                     </div>
                                     <div className="flex-1">
                                        <p className="font-black text-brand-dark uppercase tracking-tight text-sm">
                                           {deliveryInfo.canDeliverAll ? 'Ready for Delivery' : 'Distance Restriction'}
                                        </p>
                                        <p className="text-xs font-bold text-brand-dark/50 mt-1">
                                           Partner: <span className="text-brand">{deliveryInfo.partner}</span> • Weight: {(deliveryInfo.weightGrams/1000).toFixed(2)}kg
                                        </p>
                                        {!deliveryInfo.canDeliverAll && (
                                          <div className="mt-4 p-3 bg-white rounded-xl space-y-1">
                                             <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Incompatible Items:</p>
                                             {deliveryInfo.unavailableItems.map(name => (
                                                <p key={name} className="text-xs font-bold text-brand-dark">• {name}</p>
                                             ))}
                                          </div>
                                        )}
                                        {deliveryInfo.reasons.length > 0 && (
                                          <div className="mt-2 space-y-1">
                                             {deliveryInfo.reasons.map(r => (
                                                <p key={r} className="text-[10px] font-black text-green-600 uppercase tracking-widest">✨ {r}</p>
                                             ))}
                                          </div>
                                        )}
                                     </div>
                                  </div>
                               </div>
                             )}
                          </div>

                          {step === 'review' && (
                             <div className="mt-8 flex justify-end">
                                <Button3D onClick={() => setStep('payment')} disabled={deliveryMethod === 'delivery' && !deliveryInfo?.canDeliverAll} className="px-12 h-14">GOTO PAYMENT</Button3D>
                             </div>
                          )}
                       </FloatingCard>

                       {/* Step 4: Payment */}
                       {step === 'payment' && (
                          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                             <FloatingCard className="ring-2 ring-brand">
                                <div className="flex items-center gap-4 mb-8">
                                   <div className="w-10 h-10 bg-brand/5 text-brand rounded-xl flex items-center justify-center font-black">4</div>
                                   <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">Payment Method</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                   <button 
                                     onClick={() => setPaymentMethod('upi')}
                                     className={`p-8 rounded-[2.5rem] border-2 flex flex-col items-center gap-4 transition-all ${paymentMethod === 'upi' ? 'border-brand bg-brand/5 shadow-luxury' : 'border-brand/5 opacity-40 hover:opacity-100'}`}
                                   >
                                      <div className={`p-4 rounded-2xl ${paymentMethod === 'upi' ? 'bg-brand text-white' : 'bg-brand/5 text-brand'}`}><CreditCard size={32}/></div>
                                      <div className="text-center">
                                         <p className="font-black text-brand-dark uppercase tracking-widest text-sm">UPI Payment</p>
                                         <p className="text-[9px] font-bold text-brand-dark/30 mt-1 uppercase tracking-[0.2em]">PhonePe, GPay...</p>
                                      </div>
                                   </button>
                                   <button 
                                     onClick={() => setPaymentMethod('cash')}
                                     className={`p-8 rounded-[2.5rem] border-2 flex flex-col items-center gap-4 transition-all ${paymentMethod === 'cash' ? 'border-brand bg-brand/5 shadow-luxury' : 'border-brand/5 opacity-40 hover:opacity-100'}`}
                                   >
                                      <div className={`p-4 rounded-2xl ${paymentMethod === 'cash' ? 'bg-brand text-white' : 'bg-brand/5 text-brand'}`}><Banknote size={32}/></div>
                                      <div className="text-center">
                                         <p className="font-black text-brand-dark uppercase tracking-widest text-sm">Cash on Hand</p>
                                         <p className="text-[9px] font-bold text-brand-dark/30 mt-1 uppercase tracking-[0.2em]">In-store payment</p>
                                      </div>
                                   </button>
                                </div>

                                <div className="mt-12 pt-8 border-t border-brand/5">
                                   <Button3D 
                                     onClick={handleFinalize} 
                                     disabled={loading} 
                                     className="w-full h-20 text-2xl uppercase tracking-tighter"
                                   >
                                      {loading ? <RefreshCw className="animate-spin" /> : `FINALIZE ORDER • ₹${total}`}
                                   </Button3D>
                                   <p className="text-center text-[10px] font-bold text-brand-dark/20 uppercase tracking-widest mt-4">By clicking you confirm payment has been received</p>
                                </div>
                             </FloatingCard>
                          </motion.div>
                       )}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Sidebar: Order Summary */}
          <div className="lg:col-span-4 sticky top-4">
             <FloatingCard className="!p-0 overflow-hidden">
                <div className="p-6 bg-brand-dark text-white">
                   <div className="flex items-center gap-3 mb-2">
                      <ShoppingCart size={20} className="text-brand" />
                      <h4 className="font-black uppercase tracking-widest text-sm">Order Summary</h4>
                   </div>
                   <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">{cart.length} Items in Jar</p>
                </div>
                
                <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                   {cart.map(item => (
                     <div key={item.id} className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                           <p className="font-black text-brand-dark text-sm leading-tight truncate">{item.name}</p>
                           <p className="text-[10px] font-bold text-brand-dark/30 uppercase tracking-widest">Qty: {item.quantity} × ₹{item.price}</p>
                        </div>
                        <span className="font-black text-brand text-sm shrink-0">₹{item.price * item.quantity}</span>
                     </div>
                   ))}
                </div>

                <div className="p-6 bg-brand/5 border-t border-brand/10 space-y-3">
                   <div className="flex justify-between text-xs font-bold text-brand-dark/60">
                      <span>Subtotal</span>
                      <span>₹{subtotal}</span>
                   </div>
                   {deliveryMethod === 'delivery' && (
                     <div className="flex justify-between text-xs font-bold text-brand">
                        <span>Delivery Fee ({deliveryInfo?.partner})</span>
                        <span>{deliveryFee > 0 ? `+₹${deliveryFee}` : 'FREE'}</span>
                     </div>
                   )}
                   {discountAmount > 0 && (
                     <div className="flex justify-between text-xs font-bold text-green-600">
                        <span>Discount</span>
                        <span>-₹{discountAmount}</span>
                     </div>
                   )}
                   <div className="pt-4 mt-4 border-t border-brand/10 flex justify-between items-end">
                      <div>
                         <p className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest mb-1">Payable Amount</p>
                         <p className="text-4xl font-black text-brand-dark tracking-tighter">₹{total}</p>
                      </div>
                   </div>
                </div>

                {/* Customer Snapshot */}
                {customerPhone.length >= 13 && (
                   <div className="p-6 bg-white border-t border-brand/5 flex items-center gap-4">
                      <div className="w-10 h-10 bg-brand/5 text-brand rounded-full flex items-center justify-center shrink-0">
                         <User size={18} />
                      </div>
                      <div className="min-w-0">
                         <p className="text-xs font-black text-brand-dark truncate">{customerName || 'Walk-in'}</p>
                         <p className="text-[10px] font-bold text-brand-dark/30">{customerPhone}</p>
                      </div>
                   </div>
                )}
             </FloatingCard>

             {/* Helper Info */}
             <div className="mt-6 px-4 space-y-4">
                <div className="flex items-center gap-3 text-brand-dark/30">
                   <Clock size={16} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Same Day Delivery: {deliveryInfo?.distanceKm !== undefined && deliveryInfo.distanceKm < 10 ? 'YES' : 'NO'}</span>
                </div>
                <div className="flex items-center gap-3 text-brand-dark/30">
                   <Calendar size={16} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Weekend Order: {new Date().getDay() === 0 || new Date().getDay() === 6 ? 'YES' : 'NO'}</span>
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};
