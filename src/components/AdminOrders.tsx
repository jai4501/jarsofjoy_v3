import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Search, Filter, Clock, MapPin, Phone, Package, RefreshCw, XCircle, Trash2, FileDown, CheckCircle2, ShieldCheck, Eye, ExternalLink } from 'lucide-react';
import { FloatingCard } from './ui/FloatingCard';
import { useToastStore } from '../store/useToastStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import { useUserStore } from '../store/useUserStore';

export const AdminOrders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [utrInputs, setUtrInputs] = useState<{ [key: string]: string }>({});
  
  const { addToast } = useToastStore();
  const { settings } = useSettingsStore();
  const { user } = useUserStore();

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Joined fetch for payments screenshot
      const { data, error } = await supabase
        .from('orders')
        .select('*, payments(*)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) setOrders(data);
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    
    const channel = supabase
      .channel('admin-orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateOrderStatus = async (id: string, status: string) => {
    try {
      const { data: urlData } = await supabase
        .from('site_content')
        .select('value')
        .eq('key', 'whatsapp_backend_url')
        .single();
      const backendUrl = (urlData as any)?.value || `http://${window.location.hostname}:3001`;

      const response = await fetch(`${backendUrl}/api/orders/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: id,
          status: status,
          userId: user?.id
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to update order status securely.');
      }
      
      addToast(`Order marked as ${(status || 'pending').replace('_', ' ')}`, 'sweet');
      fetchOrders();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const verifyPayment = async (orderId: string, paymentId: string | undefined, utr: string) => {
    if (!utr || utr.trim().length < 6) {
      addToast('Please enter a valid UTR number to confirm payment.', 'error');
      return;
    }
    try {
      const { data: urlData } = await supabase
        .from('site_content')
        .select('value')
        .eq('key', 'whatsapp_backend_url')
        .single();
      const backendUrl = (urlData as any)?.value || `http://${window.location.hostname}:3001`;

      if (paymentId) {
        const { error } = await (supabase.from('payments') as any)
          .update({ 
            status: 'verified',
            verified_by: user?.id,
            verified_at: new Date().toISOString(),
            admin_notes: 'Verified via Admin Panel'
          })
          .eq('id', paymentId);
        if (error) throw error;
      }

      // Also update order payment_status directly
      const { error: orderError } = await (supabase.from('orders') as any)
        .update({ payment_status: 'verified', payment_reference: utr })
        .eq('id', orderId);
      if (orderError) throw orderError;
      
      // Also update order status via backend
      const responseStatus = await fetch(`${backendUrl}/api/orders/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId,
          status: 'preparing',
          userId: user?.id
        })
      });

      const resStatusData = await responseStatus.json();
      if (!responseStatus.ok) {
        throw new Error(resStatusData.error || 'Failed to update order status securely.');
      }
        
      addToast('Payment verified & order confirmed!', 'sweet');
      fetchOrders();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const deleteOrder = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently remove this order?')) return;
    
    try {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
      addToast('Order deleted successfully', 'sweet');
      fetchOrders();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const filteredOrders = orders.filter(o => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      (o.id || '').toLowerCase().includes(searchLower) || 
      (o.metadata?.display_id || '').toLowerCase().includes(searchLower) ||
      (o.customer_phone || '').includes(searchLower) || 
      ((o.customer_name || '').toLowerCase().includes(searchLower))
    );
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    if (!status) return 'bg-gray-100 text-gray-600 border-gray-200';
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-600 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-600 border-red-200';
      case 'pending': return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'payment_pending': return 'bg-purple-100 text-purple-600 border-purple-200';
      case 'preparing': return 'bg-blue-100 text-blue-600 border-blue-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
        <div>
          <h2 className="heading-serif text-5xl text-brand-dark mb-2 tracking-tight transition-all">Order Command Center</h2>
          <p className="text-brand-dark/40 font-black uppercase tracking-[0.2em] text-xs">Manage your production queue and deliveries</p>
        </div>
        
        <div className="flex flex-wrap gap-4 w-full xl:w-auto">
          <div className="relative flex-1 xl:flex-none xl:w-80 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-brand/30 group-focus-within:text-brand transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Search ID, phone, or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-14 pl-14 pr-6 bg-white rounded-2xl border-2 border-brand/5 shadow-soft outline-none focus:border-brand/30 transition-all font-bold text-brand-dark text-sm"
            />
          </div>
          
          <div className="relative flex-1 xl:flex-none group">
            <Filter className="absolute left-5 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-14 pl-14 pr-10 bg-white rounded-2xl border-2 border-brand/5 shadow-soft outline-none focus:border-brand/30 appearance-none font-bold text-brand-dark text-sm cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="payment_pending">Awaiting Payment</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready for Pickup</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <button 
            onClick={fetchOrders}
            className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center border-2 border-brand/5 shadow-soft text-brand hover:bg-brand hover:text-white transition-all"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="grid grid-cols-1 gap-8">
        {loading && orders.length === 0 ? (
          <div className="py-40 text-center space-y-4 opacity-20">
            <RefreshCw className="animate-spin mx-auto text-brand" size={48} />
            <p className="heading-cursive text-3xl font-black">Scanning the kitchen...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-40 text-center premium-card max-w-2xl mx-auto border-dashed">
            <Package size={64} className="mx-auto text-brand/20 mb-6" />
            <p className="heading-serif text-3xl text-brand-dark/40 mb-2">No orders match your filter</p>
            <p className="text-brand-dark/20 font-bold uppercase tracking-widest text-xs">Try clearing search or changing filters</p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredOrders.map(order => {
              const payment = order.payments?.[0];
              const orderSource = order.order_source || 'website';
              
              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={order.id}
                >
                  <FloatingCard className="!p-0 overflow-hidden border border-brand/5 group">
                    {/* Top Bar: Basic Info */}
                    <div className="p-8 sm:p-10 flex flex-col xl:flex-row justify-between gap-10">
                      <div className="flex gap-8 items-start">
                        <div className="w-16 h-16 bg-brand/5 rounded-3xl flex items-center justify-center text-brand shrink-0 shadow-inner relative">
                          <ShoppingBag size={30} />
                          <div className={`absolute -bottom-1 -right-1 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest text-white shadow-sm ${orderSource === 'whatsapp' ? 'bg-green-500' : 'bg-brand'}`}>
                            {orderSource}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-brand/40">Order Reference</span>
                            <span className="bg-brand text-white px-3 py-1 rounded-full text-[10px] font-black tracking-tighter shadow-md group-hover:rotate-2 transition-transform">{order.metadata?.display_id || '#' + (order.id?.slice(0, 8).toUpperCase() || 'N/A')}</span>
                          </div>
                          <h3 className="heading-serif text-3xl text-brand-dark">{order.customer_name || 'Walk-in Customer'}</h3>
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2">
                            <div className="flex items-center gap-2 text-brand-dark/60 font-bold text-sm">
                              <Phone size={14} className="text-brand/40" /> {order.customer_phone}
                            </div>
                            <div className="flex items-center gap-2 text-brand-dark/60 font-bold text-sm">
                              <Clock size={14} className="text-brand/40" /> {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="flex items-center gap-2 text-brand-dark/60 font-bold text-sm">
                              <MapPin size={14} className="text-brand/40" /> {order.address}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row xl:flex-col items-center sm:items-end justify-center gap-6 xl:min-w-[200px]">
                        <div className="text-center sm:text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-brand-dark/20 mb-1">Total Amount</p>
                          <p className="text-4xl font-black text-brand tracking-tighter">₹{order.total || 0}</p>
                        </div>
                        <div className={`px-4 py-2 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest shadow-sm ${getStatusColor(order.status)}`}>
                          {order.status ? order.status.replace(/_/g, ' ') : 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* SQL Enhancement: Payment Verification Section */}
                    {(payment || order.payment_method === 'upi') && (
                      <div className="bg-purple-50/50 border-y border-purple-100 p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                         <div className="flex items-center gap-6">
                            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center shadow-inner">
                               <ShieldCheck size={24} />
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] mb-0.5">UPI Verification</p>
                               <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${order.payment_status === 'verified' || payment?.status === 'verified' ? 'bg-green-500' : 'bg-purple-500 animate-pulse'}`} />
                                  <p className="font-black text-brand-dark text-sm uppercase">Payment {order.payment_status || payment?.status || 'Pending'}</p>
                               </div>
                            </div>
                         </div>

                         <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                            <div className="flex items-center gap-4">
                              {payment?.screenshot_url ? (
                                <button 
                                  onClick={() => setSelectedScreenshot(payment.screenshot_url)}
                                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white text-purple-600 rounded-xl border border-purple-100 font-black text-[10px] uppercase tracking-widest hover:bg-purple-50 transition-all shadow-sm"
                                >
                                  <Eye size={16} /> View Screenshot
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold text-purple-400/50 uppercase tracking-widest">No screenshot</span>
                              )}
                              {(order.payment_status !== 'verified' && payment?.status !== 'verified') && (
                                <div className="flex flex-col gap-2">
                                  <input 
                                    type="text"
                                    placeholder="Enter UTR Number"
                                    value={utrInputs[order.id] || ''}
                                    onChange={(e) => setUtrInputs(prev => ({...prev, [order.id]: e.target.value}))}
                                    className="px-4 py-2 border-2 border-purple-100 rounded-xl text-xs font-bold text-brand-dark outline-none focus:border-purple-300 transition-all"
                                  />
                                  <button 
                                    onClick={() => verifyPayment(order.id, payment?.id, utrInputs[order.id])}
                                    className="flex items-center justify-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-purple-200 hover:scale-105 active:scale-95 transition-all"
                                  >
                                    <CheckCircle2 size={16} /> Confirm Receipt
                                  </button>
                                </div>
                              )}
                            </div>
                         </div>
                      </div>
                    )}

                    {/* Items Table */}
                    <div className="bg-brand-light/5 p-8 sm:p-10">
                      <p className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 mb-6 ml-1">Kitchen Ticket</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {order.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between bg-white/60 p-4 rounded-[1.5rem] border border-white shadow-soft group-hover:border-brand/10 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-blush rounded-xl flex items-center justify-center text-xl shadow-inner shrink-0 overflow-hidden">
                                 {item.images && item.images[0] ? <img src={item.images[0]} className="w-full h-full object-cover" /> : '🧁'}
                              </div>
                              <div>
                                <p className="font-black text-brand-dark text-sm leading-tight uppercase tracking-tight">{item.name || 'Treat'}</p>
                                <p className="text-xs font-bold text-brand-dark/40 mt-1">₹{item.price} x {item.quantity}</p>
                              </div>
                            </div>
                            <div className="w-10 h-10 bg-brand text-white rounded-xl flex items-center justify-center font-black text-lg">
                              {item.quantity}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Bar: Quick Actions */}
                    <div className="p-6 sm:px-10 flex flex-wrap justify-between items-center gap-6 bg-white/40">
                      <div className="flex flex-wrap gap-2">
                        <p className="w-full xl:w-auto text-[9px] font-black uppercase tracking-widest text-brand-dark/30 flex items-center mr-2">Update Status:</p>
                        {['pending', 'preparing', 'ready', 'out_for_delivery', 'completed'].map(s => (
                          <button 
                            key={s}
                            onClick={() => updateOrderStatus(order.id, s)}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-2 ${
                              order.status === s 
                              ? 'bg-brand text-white border-brand shadow-md scale-105' 
                              : 'bg-white text-brand-dark/40 border-brand/5 hover:border-brand/20'
                            }`}
                          >
                            {s.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-3">
                        <button 
                          onClick={async () => {
                            addToast('Generating invoice PDF...', 'sweet');
                            await generateInvoicePDF(order, settings);
                          }}
                          className="flex items-center gap-2 px-6 py-3 bg-white text-brand-dark/60 rounded-xl border border-brand/10 font-black text-[10px] uppercase tracking-widest hover:bg-brand hover:text-white transition-all shadow-sm"
                        >
                          <FileDown size={16} /> Invoice
                        </button>
                        <button 
                          onClick={() => updateOrderStatus(order.id, 'cancelled')}
                          className="p-3 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-transparent hover:border-red-600"
                          title="Cancel Order"
                        >
                          <XCircle size={20} />
                        </button>
                        <button 
                          onClick={() => deleteOrder(order.id)}
                          className="p-3 text-brand-dark/20 hover:bg-red-600 hover:text-white rounded-xl transition-all border border-transparent"
                          title="Delete Record"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </FloatingCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Screenshot Modal */}
      <AnimatePresence>
        {selectedScreenshot && (
          <div className="fixed inset-0 bg-brand-dark/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4 sm:p-20" onClick={() => setSelectedScreenshot(null)}>
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="relative max-w-4xl w-full h-full flex flex-col"
               onClick={e => e.stopPropagation()}
             >
                <div className="flex justify-between items-center mb-6 text-white">
                   <div>
                      <h3 className="text-2xl font-black uppercase tracking-tighter">Payment Screenshot</h3>
                      <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Verify the UPI transaction details below</p>
                   </div>
                   <button onClick={() => setSelectedScreenshot(null)} className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                      <XCircle size={24} />
                   </button>
                </div>
                <div className="flex-1 bg-black/40 rounded-[3rem] border border-white/10 overflow-hidden relative group">
                   <img src={selectedScreenshot} className="w-full h-full object-contain" alt="Payment Proof" />
                   <a 
                     href={selectedScreenshot} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="absolute bottom-10 right-10 p-5 bg-brand text-white rounded-full shadow-2xl scale-0 group-hover:scale-100 transition-all hover:rotate-12"
                   >
                     <ExternalLink size={24} />
                   </a>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
