import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, Plus, Minus, Trash2, ArrowLeft, Send, CheckCircle2, Copy, MapPin, Truck, HelpCircle, Check, RefreshCw } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useUserStore } from '../store/useUserStore';
import { useToastStore } from '../store/useToastStore';
import { Button3D } from './ui/Button3D';
import { supabase } from '../lib/supabase';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer = ({ isOpen, onClose }: CartDrawerProps) => {
  const { items, removeItem, clearCart, updateQuantity } = useCartStore();
  const { getSetting } = useSettingsStore();
  const { user, profile } = useUserStore();
  const { addToast } = useToastStore();

  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState('');

  // Local calculation of total amount to fix calculation errors
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // User addresses state
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  // Address Form State (Same subdivisions as profile section)
  const [addrLabel, setAddrLabel] = useState('Home');
  const [doorNo, setDoorNo] = useState('');
  const [street, setStreet] = useState('');
  const [area, setArea] = useState('');
  const [pincode, setPincode] = useState('');
  const [district, setDistrict] = useState('');
  const [landmark, setLandmark] = useState('');
  const [postOffices, setPostOffices] = useState<string[]>([]);

  // Fetch settings info
  const upiId = getSetting('upi_id', 'jarsofjoy@okaxis');
  const upiName = getSetting('upi_name', 'Jars of Joy');
  const whatsappNumber = getSetting('whatsapp_number', '+917695964392');

  const fetchUserAddresses = async (userId: string) => {
    const { data } = await (supabase
      .from('addresses') as any)
      .select('*')
      .eq('profile_id', userId)
      .order('is_default', { ascending: false });
    if (data) {
      setAddresses(data);
      const defaultAddr = data.find((a: any) => a.is_default) || data[0];
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
        setDeliveryAddress(`${defaultAddr.door_no}, ${defaultAddr.street}, ${defaultAddr.area}, ${defaultAddr.district} - ${defaultAddr.pincode}${defaultAddr.landmark ? ` (Landmark: ${defaultAddr.landmark})` : ''}`);
      } else {
        setSelectedAddressId('');
        setDeliveryAddress('');
      }
    }
  };

  // Populate logged-in user profile details
  useEffect(() => {
    if (isOpen) {
      setStep('cart');
      if (user) {
        setCustomerName(profile?.full_name || '');
        setCustomerPhone(profile?.mobile || '');
        fetchUserAddresses(user.id);
      } else {
        setCustomerName('');
        setCustomerPhone('');
        setAddresses([]);
        setSelectedAddressId('');
        setDeliveryAddress('');
      }
    }
  }, [isOpen, user, profile]);

  const handlePincodeChange = async (val: string) => {
    const cleanVal = val.replace(/\D/g, '').slice(0, 6);
    setPincode(cleanVal);
    if (cleanVal.length === 6) {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${cleanVal}`);
        const data = await res.json();
        if (data && data[0] && data[0].Status === 'Success') {
          const offices = data[0].PostOffice || [];
          const officeNames = offices.map((po: any) => po.Name);
          setPostOffices(officeNames);
          
          if (offices.length > 0) {
            setDistrict(offices[0].District);
            if (!area) setArea(offices[0].Name);
          }
        } else {
          setPostOffices([]);
        }
      } catch (err) {
        console.error('Pincode API Error:', err);
        setPostOffices([]);
      }
    } else {
      setPostOffices([]);
    }
  };

  const handleSaveAddress = async () => {
    if (!user) return;
    if (!doorNo.trim() || !street.trim() || !area.trim() || !pincode.trim()) {
      addToast('Please fill all required fields', 'error');
      return;
    }

    const pinRegex = /^[0-9]{6}$/;
    if (!pinRegex.test(pincode.trim())) {
      addToast('Please enter a valid 6-digit Pincode', 'error');
      return;
    }

    setSavingAddress(true);
    try {
      // Ensure profile exists first
      const { data: profileCheck } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileCheck) {
        console.log('Profile missing on save address, attempting to create default profile...');
        const defaultProfile = {
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Sweet Customer',
          email: user.email || '',
          mobile: user.user_metadata?.mobile || null,
          role: 'customer',
          is_active: true
        };
        const { error: insertProfileError } = await (supabase.from('profiles') as any).insert([defaultProfile]);
        if (insertProfileError) {
          console.error('Failed to create fallback profile:', insertProfileError);
          throw new Error(`Profile initialization failed: ${insertProfileError.message}`);
        }
      }

      const { data, error } = await (supabase.from('addresses') as any)
        .insert([{
          profile_id: user.id,
          label: addrLabel,
          door_no: doorNo.trim(),
          street: street.trim(),
          area: area.trim(),
          pincode: pincode.trim(),
          district: district.trim() || 'Coimbatore',
          state: 'Tamil Nadu',
          landmark: landmark.trim() || null,
          is_default: addresses.length === 0
        }])
        .select()
        .single();

      if (error) throw error;

      addToast('New address added!', 'sweet');
      
      // Reset form
      setDoorNo('');
      setStreet('');
      setArea('');
      setPincode('');
      setDistrict('');
      setLandmark('');
      setAddrLabel('Home');
      setPostOffices([]);
      setShowAddrForm(false);

      // Re-fetch and select
      await fetchUserAddresses(user.id);
      if (data) {
        setSelectedAddressId(data.id);
        setDeliveryAddress(`${data.door_no}, ${data.street}, ${data.area}, ${data.district} - ${data.pincode}${data.landmark ? ` (Landmark: ${data.landmark})` : ''}`);
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to save address', 'error');
    } finally {
      setSavingAddress(false);
    }
  };

  const selectAddress = (addr: any) => {
    setSelectedAddressId(addr.id);
    setDeliveryAddress(`${addr.door_no}, ${addr.street}, ${addr.area}, ${addr.district} - ${addr.pincode}${addr.landmark ? ` (Landmark: ${addr.landmark})` : ''}`);
  };

  const handleQtyChange = (itemId: string, currentQty: number, delta: number) => {
    const nextQty = currentQty + delta;
    if (nextQty <= 0) {
      removeItem(itemId);
    } else {
      updateQuantity(itemId, nextQty);
    }
  };

  const copyUpi = () => {
    navigator.clipboard.writeText(upiId);
    addToast('UPI ID copied to clipboard!', 'sweet');
  };

  const handlePlaceOrder = async () => {
    if (!customerName.trim()) {
      addToast('Please enter your name', 'error');
      return;
    }
    if (!customerPhone.trim() || customerPhone.length < 10) {
      addToast('Please enter a valid phone number', 'error');
      return;
    }
    if (deliveryType === 'delivery' && !deliveryAddress.trim()) {
      addToast('Please enter a delivery address', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const addressVal = deliveryType === 'pickup' ? 'Store Pickup' : deliveryAddress;

      // 1. Insert order record into database
      const { data: order, error: orderError } = await (supabase
        .from('orders') as any)
        .insert([{
          user_id: user?.id || null,
          customer_name: customerName,
          customer_phone: customerPhone,
          address: addressVal,
          items: items,
          total: total,
          subtotal: total,
          status: 'pending',
          order_source: 'website',
          delivery_type: deliveryType
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Insert order items
      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity
      }));

      const { error: itemsError } = await (supabase.from('order_items') as any).insert(orderItems);
      if (itemsError) throw itemsError;

      setPlacedOrderId(order.id);
      setStep('success');
      clearCart();
      addToast('Order placed successfully!', 'sweet');
    } catch (err: any) {
      addToast(err.message || 'Failed to place order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsAppRedirect = () => {
    const orderIdShort = placedOrderId.slice(0, 8).toUpperCase();
    const itemsDetails = items
      .map((item) => `• ${item.name} (x${item.quantity}) - ₹${item.price * item.quantity}`)
      .join('\n');

    const addressVal = deliveryType === 'pickup' ? 'Store Pickup' : deliveryAddress;

    const message = `🍯 *New Storefront Order placed!*\n\n` +
      `*Order ID:* #INV-${orderIdShort}\n` +
      `*Customer Name:* ${customerName}\n` +
      `*Phone:* ${customerPhone}\n` +
      `*Delivery Type:* ${deliveryType === 'pickup' ? 'Pickup 🏪' : 'Home Delivery 🚚'}\n` +
      `*Address:* ${addressVal}\n\n` +
      `*Items Ordered:*\n${itemsDetails}\n\n` +
      `*Total Amount:* ₹${total}\n\n` +
      `Please confirm my order! 💛`;

    const cleanedNumber = whatsappNumber.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanedNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-brand-dark/20 backdrop-blur-sm z-[150]"
          />

          {/* Drawer Panel Container */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-gradient-to-b from-[#FFF5F7] to-white z-[200] p-6 sm:p-8 flex flex-col shadow-luxury border-l border-brand/5"
          >
            {/* Morphing settle background decorations */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(253,232,236,0.5)_0%,transparent_60%)] pointer-events-none" />

            {/* Header section */}
            <div className="flex justify-between items-center pb-4 border-b border-brand/10 relative z-10">
              {step === 'checkout' ? (
                <button
                  onClick={() => setStep('cart')}
                  className="flex items-center gap-2 text-brand font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all"
                >
                  <ArrowLeft size={16} /> Back to Jar
                </button>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-brand/5 rounded-2xl flex items-center justify-center text-brand">
                    <ShoppingBag size={20} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-brand-dark leading-none">Your Sweet Jar</h2>
                    <p className="text-[9px] font-black uppercase text-brand-dark/30 tracking-widest mt-1">
                      {step === 'success' ? 'Completed' : 'Review items'}
                    </p>
                  </div>
                </div>
              )}
              <button 
                onClick={onClose} 
                className="w-10 h-10 bg-white hover:bg-brand/5 border border-brand/10 text-brand-dark rounded-2xl flex items-center justify-center transition-all active:scale-95"
              >
                <X size={20} />
              </button>
            </div>

            {/* Steps Container */}
            <div className="flex-1 overflow-y-auto py-6 relative z-10 pr-1 no-scrollbar">
              <AnimatePresence mode="wait">
                {/* STEP 1: CART LIST VIEW */}
                {step === 'cart' && (
                  <motion.div
                    key="cart-step"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-4"
                  >
                    {items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                        <span className="text-5xl">🍯</span>
                        <div className="space-y-1">
                          <p className="font-serif font-black text-brand-dark text-lg">Your jar is empty</p>
                          <p className="text-xs font-semibold text-brand-dark/45">Add some freshly baked happiness to get started!</p>
                        </div>
                        <Button3D onClick={onClose} variant="outline" className="h-10 px-6 text-xs uppercase tracking-widest mt-2 rounded-xl">
                          Explore Menu
                        </Button3D>
                      </div>
                    ) : (
                      items.map((item) => (
                        <div 
                          key={item.id} 
                          className="flex gap-4 items-center bg-white/70 backdrop-blur-sm p-4 rounded-3xl border border-brand/5 shadow-soft hover:shadow-md transition-shadow relative overflow-hidden group"
                        >
                          {/* Item Thumbnail */}
                          <div className="w-16 h-16 bg-brand/5 rounded-2xl flex items-center justify-center text-3xl overflow-hidden shrink-0 border border-brand/5">
                            {item.images && item.images[0] ? (
                              <img src={item.images[0]} className="w-full h-full object-cover" alt={item.name} />
                            ) : (
                              '🍰'
                            )}
                          </div>

                          {/* Item details */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-brand-dark text-sm sm:text-base leading-tight truncate">{item.name}</h4>
                            <p className="text-brand font-black text-xs sm:text-sm mt-0.5">₹{item.price * item.quantity}</p>
                            
                            {/* Counter buttons */}
                            <div className="flex items-center gap-3 mt-3">
                              <button 
                                onClick={() => handleQtyChange(item.id, item.quantity, -1)}
                                className="w-7 h-7 flex items-center justify-center bg-white hover:bg-brand/5 rounded-lg border border-brand/10 active:scale-90 transition-all shadow-sm"
                              >
                                <Minus size={12} className="text-brand-dark/60" />
                              </button>
                              <span className="font-bold text-xs text-brand-dark w-5 text-center">{item.quantity}</span>
                              <button 
                                onClick={() => handleQtyChange(item.id, item.quantity, 1)}
                                className="w-7 h-7 flex items-center justify-center bg-white hover:bg-brand/5 rounded-lg border border-brand/10 active:scale-90 transition-all shadow-sm"
                              >
                                <Plus size={12} className="text-brand-dark/60" />
                              </button>
                            </div>
                          </div>

                          {/* Delete option */}
                          <button 
                            onClick={() => removeItem(item.id)}
                            className="text-brand-dark/30 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-colors shrink-0 self-start sm:self-center"
                            title="Remove item"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}

                {/* STEP 2: CHECKOUT VIEW */}
                {step === 'checkout' && (
                  <motion.div
                    key="checkout-step"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <div className="space-y-4">
                      <h3 className="font-serif font-black text-brand-dark text-lg uppercase tracking-tight">Delivery Details</h3>
                      
                      {/* Name & Phone Info (read-only for logged in, input for guest) */}
                      {user ? (
                        <div className="bg-brand/5 p-4 rounded-2xl border border-brand/10 mb-4">
                          <p className="text-[8px] font-black uppercase tracking-widest text-brand/60 leading-none mb-1">Ordering As</p>
                          <p className="font-black text-brand-dark text-sm leading-snug">{customerName || profile?.full_name}</p>
                          <p className="text-[9px] font-bold text-brand-dark/50 mt-0.5">{customerPhone || profile?.mobile}</p>
                        </div>
                      ) : (
                        <>
                          {/* Name input */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/50">Your Name</label>
                            <input
                              type="text"
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                              placeholder="Enter your full name"
                              className="w-full h-12 px-4 bg-white border border-brand/10 rounded-2xl text-xs font-semibold text-brand-dark focus:outline-none focus:border-brand/40 shadow-sm transition-colors"
                            />
                          </div>

                          {/* Phone input */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/50">Phone Number</label>
                            <input
                              type="tel"
                              value={customerPhone}
                              onChange={(e) => setCustomerPhone(e.target.value)}
                              placeholder="e.g. +91 98765 43210"
                              className="w-full h-12 px-4 bg-white border border-brand/10 rounded-2xl text-xs font-semibold text-brand-dark focus:outline-none focus:border-brand/40 shadow-sm transition-colors"
                            />
                          </div>
                        </>
                      )}

                      {/* Delivery Type Segmented Toggle */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/50">Delivery Mode</label>
                        <div className="grid grid-cols-2 p-1 bg-brand-dark/5 rounded-2xl border border-brand/5 relative">
                          <button
                            type="button"
                            onClick={() => setDeliveryType('pickup')}
                            className={`h-10 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${deliveryType === 'pickup' ? 'bg-white text-brand shadow-sm' : 'text-brand-dark/45 hover:text-brand-dark'}`}
                          >
                            <MapPin size={14} /> Pickup
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeliveryType('delivery')}
                            className={`h-10 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${deliveryType === 'delivery' ? 'bg-white text-brand shadow-sm' : 'text-brand-dark/45 hover:text-brand-dark'}`}
                          >
                            <Truck size={14} /> Delivery
                          </button>
                        </div>
                      </div>

                      {/* Address Selection / Creation (conditional) */}
                      {deliveryType === 'delivery' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-3 overflow-hidden"
                        >
                          <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/50">Delivery Address</label>
                          
                          {!user ? (
                            <div className="bg-brand/5 p-5 rounded-2xl border border-brand/10 text-center space-y-3">
                              <p className="text-xs font-bold text-brand-dark/70">Please log in to add a delivery address.</p>
                              <Link to="/login" onClick={onClose} className="inline-block">
                                <Button3D className="h-9 px-4 text-[9px] uppercase tracking-widest">Log In / Sign Up</Button3D>
                              </Link>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* Saved Addresses List */}
                              {addresses.length > 0 && !showAddrForm && (
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 no-scrollbar">
                                  {addresses.map((addr) => {
                                    const isSelected = selectedAddressId === addr.id;
                                    return (
                                      <div
                                        key={addr.id}
                                        onClick={() => selectAddress(addr)}
                                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col gap-1 ${
                                          isSelected
                                            ? 'bg-brand/5 border-brand ring-2 ring-brand/10 shadow-sm'
                                            : 'bg-white border-brand/5 hover:border-brand/15'
                                        }`}
                                      >
                                        <div className="flex justify-between items-center">
                                          <span className="text-[8px] font-black uppercase tracking-widest text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                                            {addr.label}
                                          </span>
                                          {isSelected && <Check size={14} className="text-brand" />}
                                        </div>
                                        <p className="text-xs font-semibold text-brand-dark mt-1">
                                          {addr.door_no}, {addr.street}, {addr.area}
                                        </p>
                                        <p className="text-[10px] text-brand-dark/60 font-medium">
                                          {addr.district} - {addr.pincode}
                                        </p>
                                        {addr.landmark && (
                                          <p className="text-[9px] text-brand/60 font-bold mt-1">
                                            📍 {addr.landmark}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Toggle to show creation form */}
                              {!showAddrForm && addresses.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setShowAddrForm(true)}
                                  className="w-full py-3 border-2 border-dashed border-brand/20 hover:border-brand/40 text-brand rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
                                >
                                  <Plus size={14} /> Add New Address
                                </button>
                              )}

                              {/* Form to create address when form is shown or 0 addresses exist */}
                              {(showAddrForm || addresses.length === 0) && (
                                <div className="bg-white/60 p-5 rounded-3xl border border-brand/5 space-y-4">
                                  <div className="flex justify-between items-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand">
                                      {addresses.length === 0 ? 'No address yet. Add address to proceed:' : 'New Address Details'}
                                    </p>
                                    {addresses.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setShowAddrForm(false)}
                                        className="text-[10px] font-black uppercase tracking-widest text-brand-dark/45 hover:text-brand"
                                      >
                                        Cancel
                                      </button>
                                    )}
                                  </div>

                                  {/* Label */}
                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40">Label (Home, Office...)</label>
                                    <div className="flex gap-2">
                                      {['Home', 'Office', 'Other'].map(l => (
                                        <button
                                          key={l}
                                          type="button"
                                          onClick={() => setAddrLabel(l)}
                                          className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                                            addrLabel === l
                                              ? 'bg-brand text-white border-brand shadow-sm'
                                              : 'bg-white text-brand-dark/40 border-brand/10'
                                          }`}
                                        >
                                          {l}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Door / Flat No */}
                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40">Door / Flat No</label>
                                    <input
                                      type="text"
                                      value={doorNo}
                                      onChange={(e) => setDoorNo(e.target.value)}
                                      placeholder="Ex: 42, Green Villa"
                                      className="w-full h-11 px-3 bg-white border border-brand/10 rounded-xl text-xs font-semibold text-brand-dark focus:outline-none focus:border-brand/40 shadow-sm"
                                    />
                                  </div>

                                  {/* Street / Colony */}
                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40">Street / Colony</label>
                                    <input
                                      type="text"
                                      value={street}
                                      onChange={(e) => setStreet(e.target.value)}
                                      placeholder="Ex: Main Street, Layout Name"
                                      className="w-full h-11 px-3 bg-white border border-brand/10 rounded-xl text-xs font-semibold text-brand-dark focus:outline-none focus:border-brand/40 shadow-sm"
                                    />
                                  </div>

                                  {/* Pincode */}
                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40">Pincode (Auto-fills)</label>
                                    <input
                                      type="text"
                                      value={pincode}
                                      onChange={(e) => handlePincodeChange(e.target.value)}
                                      maxLength={6}
                                      placeholder="641001"
                                      className="w-full h-11 px-3 bg-white border border-brand/10 rounded-xl text-xs font-black text-brand focus:outline-none focus:border-brand/40 shadow-sm"
                                    />
                                  </div>

                                  {/* Area / Post Office */}
                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40">Area / Post Office</label>
                                    <input
                                      list="drawer-areas"
                                      type="text"
                                      value={area}
                                      onChange={(e) => setArea(e.target.value)}
                                      placeholder="R.S. Puram"
                                      className="w-full h-11 px-3 bg-white border border-brand/10 rounded-xl text-xs font-semibold text-brand-dark focus:outline-none focus:border-brand/40 shadow-sm"
                                    />
                                    <datalist id="drawer-areas">
                                      {postOffices.map((po) => (
                                        <option key={po} value={po} />
                                      ))}
                                    </datalist>
                                  </div>

                                  {/* District */}
                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40">District</label>
                                    <input
                                      type="text"
                                      value={district}
                                      readOnly
                                      placeholder="Coimbatore"
                                      className="w-full h-11 px-3 bg-brand/5 border border-brand/10 rounded-xl text-xs font-semibold text-brand-dark/50 outline-none"
                                    />
                                  </div>

                                  {/* Landmark */}
                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40">Landmark (Optional)</label>
                                    <input
                                      type="text"
                                      value={landmark}
                                      onChange={(e) => setLandmark(e.target.value)}
                                      placeholder="Ex: Opp. Baker Street"
                                      className="w-full h-11 px-3 bg-white border border-brand/10 rounded-xl text-xs font-semibold text-brand-dark focus:outline-none focus:border-brand/40 shadow-sm"
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={handleSaveAddress}
                                    disabled={savingAddress}
                                    className="w-full h-12 bg-brand text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1.5 mt-2"
                                  >
                                    {savingAddress ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
                                    Save Address to Proceed
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>

                    {/* Payment card summary */}
                    <div className="bg-white/60 p-5 rounded-3xl border border-brand/5 shadow-soft space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-brand/5 text-brand flex items-center justify-center">
                          <HelpCircle size={16} />
                        </div>
                        <h4 className="font-serif font-black text-brand-dark text-base uppercase tracking-tight">UPI Payment details</h4>
                      </div>
                      <div className="p-3 bg-brand/5 rounded-2xl border border-brand/10 flex justify-between items-center">
                        <div className="min-w-0">
                          <p className="text-[8px] font-black uppercase tracking-widest text-brand-dark/40 leading-none mb-1">Pay to UPI ID</p>
                          <p className="font-mono font-bold text-brand-dark text-xs truncate">{upiId}</p>
                          <p className="text-[9px] font-bold text-brand/70 mt-0.5">{upiName}</p>
                        </div>
                        <button
                          onClick={copyUpi}
                          className="w-8 h-8 bg-white hover:bg-brand/5 text-brand rounded-lg border border-brand/10 flex items-center justify-center transition-all active:scale-90"
                          title="Copy UPI ID"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                      <p className="text-[9px] font-semibold text-brand-dark/50 italic leading-normal">
                        Note: Once you place the order, you will be redirected to WhatsApp to share your payment receipt screenshot. Delivery charges will be finalized based on actual distance.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3: SUCCESS ANIMATION VIEW */}
                {step === 'success' && (
                  <motion.div
                    key="success-step"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-12 text-center space-y-6"
                  >
                    <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-100/50">
                      <CheckCircle2 size={44} className="stroke-[1.5]" />
                    </div>

                    <div className="space-y-2 max-w-sm">
                      <h3 className="heading-serif text-2xl font-black text-brand-dark">Sweetness Confirmed!</h3>
                      <p className="text-xs font-semibold text-brand-dark/55 leading-relaxed">
                        Your order has been recorded. Let's redirect to WhatsApp to send your receipt and confirm delivery details.
                      </p>
                    </div>

                    <div className="pt-6 w-full max-w-xs space-y-3">
                      <Button3D 
                        onClick={handleWhatsAppRedirect} 
                        className="w-full h-14 bg-brand text-white flex items-center justify-center gap-2 text-xs uppercase tracking-widest rounded-full shadow-lg hover:bg-brand-dark"
                      >
                        <Send size={16} /> Send WhatsApp Message
                      </Button3D>
                      <button
                        onClick={() => {
                          onClose();
                          setStep('cart');
                        }}
                        className="w-full text-[10px] font-black uppercase tracking-widest text-brand-dark/40 hover:text-brand transition-colors"
                      >
                        Keep Shopping
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom Actions section */}
            {items.length > 0 && step !== 'success' && (
              <div className="border-t border-brand/10 pt-6 mt-auto space-y-4 relative z-10 bg-transparent">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-dark/45">Total Amount</span>
                    <h3 className="text-3xl font-black text-brand-dark leading-none mt-1">₹{total}</h3>
                  </div>
                  {step === 'cart' && (
                    <button 
                      onClick={clearCart}
                      className="text-[9px] font-black uppercase tracking-widest text-brand-dark/30 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-red-100 transition-all flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Clear
                    </button>
                  )}
                </div>

                {step === 'cart' ? (
                  <Button3D 
                    onClick={() => setStep('checkout')}
                    className="w-full h-14 text-xs font-black uppercase tracking-widest rounded-full shadow-luxury"
                  >
                    Checkout Now
                  </Button3D>
                ) : (
                  <Button3D 
                    onClick={handlePlaceOrder}
                    disabled={submitting}
                    className="w-full h-14 text-xs font-black uppercase tracking-widest rounded-full shadow-luxury flex items-center justify-center gap-2"
                  >
                    {submitting ? 'Placing Order...' : 'Confirm Order & Pay'}
                  </Button3D>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
