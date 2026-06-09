import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/useUserStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { FloatingCard } from '../components/ui/FloatingCard';
import { Button3D } from '../components/ui/Button3D';
import { ShoppingBag, Clock, CheckCircle2, Package, MapPin, ArrowLeft, FileDown, Loader2, Camera, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import { useToastStore } from '../store/useToastStore';
import { LoadingScreen } from '../components/ui/LoadingScreen';

const generatePaymentFileName = (orderId: string, fileExt: string) => {
  return `${orderId}-${Math.random()}.${fileExt}`;
};

export const Orders = () => {
  const { user } = useUserStore();
  const { settings } = useSettingsStore();
  const { addToast } = useToastStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, payments(*)')
      .eq('user_id', user?.id || '')
      .order('created_at', { ascending: false });
    
    if (data) setOrders(data);
    setLoading(false);
  };

  const handleUploadPayment = async (orderId: string, file: File) => {
    setUploading(orderId);
    try {
      const fileExt = file.name.split('.').pop() || '';
      const fileName = generatePaymentFileName(orderId, fileExt);
      const filePath = `payments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-screenshots')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment-screenshots')
        .getPublicUrl(filePath);

      const { error: paymentError } = await (supabase
        .from('payments') as any)
        .insert([{
          order_id: orderId,
          screenshot_url: publicUrl,
          payment_method: 'upi',
          customer_phone: orders.find(o => o.id === orderId)?.customer_phone || '',
          status: 'pending'
        }]);

      if (paymentError) throw paymentError;

      await (supabase
        .from('orders') as any)
        .update({ payment_status: 'pending' })
        .eq('id', orderId);

      fetchOrders();
    } catch (err: any) {
      console.error('Upload failed:', err.message);
    } finally {
      setUploading(null);
    }
  };

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="container mx-auto px-6 py-32 text-center sparkle-bg min-h-screen">
        <FloatingCard className="max-w-md mx-auto">
          <ShoppingBag className="mx-auto text-brand mb-6 opacity-20" size={80} />
          <h2 className="heading-serif text-3xl mb-4 text-brand-dark">Order History</h2>
          <p className="text-brand-dark/60 mb-8 font-medium">Please log in to view your sweet purchase history.</p>
          <Link to="/login">
            <Button3D className="w-full">Login to Account</Button3D>
          </Link>
        </FloatingCard>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen message="Loading your treats..." />;
  }

  return (
    <div className="container mx-auto px-6 pt-24 sm:pt-32 pb-40 min-h-screen bg-cream">
      <div className="max-w-4xl mx-auto mb-16 flex justify-between items-end">
        <div>
          <h1 className="heading-serif text-4xl text-brand-dark mb-2">My Jars</h1>
          <p className="text-brand-dark/40 font-bold uppercase tracking-widest text-xs">A history of happiness</p>
        </div>
        <Link to="/" className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-soft border border-brand/5 text-brand hover:scale-110 transition-all">
          <ArrowLeft size={24} />
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20 opacity-40">
          <Package size={64} className="mx-auto mb-4" />
          <p className="heading-serif text-2xl">No orders yet.</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto grid grid-cols-1 gap-8">
          {orders.map((order) => (
            <FloatingCard key={order.id} className="relative group overflow-hidden border border-brand/5">
              <div className="flex flex-col md:flex-row justify-between gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30">Order</span>
                    <span className="font-bold text-sm tracking-tighter">#{order.id?.slice(0, 8).toUpperCase() || 'N/A'}</span>
                    <span className="w-1 h-1 bg-brand/20 rounded-full" />
                    <span className="text-[10px] font-bold text-brand-dark/40">{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {order.items.map((item: any, idx: number) => (
                      <div key={idx} className="bg-brand/5 px-3 py-1 rounded-full text-[10px] font-bold text-brand">
                        {item.name} x {item.quantity}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 text-brand-dark/50">
                    <MapPin size={16} className="text-brand/60" />
                    <span className="text-xs font-medium truncate max-w-[250px]">{order.address}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand bg-white px-3 py-1.5 rounded-full shadow-sm">
                      {order.status ? order.status.replace(/_/g, ' ') : 'N/A'}
                    </span>
                    
                    {order.status === 'payment_pending' && order.payment_method === 'upi' && (
                      <div className="relative">
                        <input 
                          type="file" 
                          id={`payment-${order.id}`}
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadPayment(order.id, file);
                          }}
                        />
                        <label 
                          htmlFor={`payment-${order.id}`}
                          className={`flex items-center gap-2 px-4 py-1.5 bg-purple-50 text-purple-600 border border-purple-100 rounded-full text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-purple-100 transition-all ${uploading === order.id ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          {uploading === order.id ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                          {order.payments?.[0] ? 'Update Screenshot' : 'Upload Screenshot'}
                        </label>
                      </div>
                    )}
                    
                    {order.payments?.[0] && (
                      <div className="flex items-center gap-2 text-[10px] font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
                        <ImageIcon size={12} />
                        Screenshot {order.payments[0].status === 'verified' ? 'Verified' : 'Uploaded'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right space-y-1">
                    {(order.subtotal > 0 || order.delivery_charge > 0) && (
                      <div className="space-y-0.5 opacity-40">
                         <p className="text-[8px] font-black uppercase tracking-widest">Sub: ₹{order.subtotal}</p>
                         <p className="text-[8px] font-black uppercase tracking-widest">Del: ₹{order.delivery_charge}</p>
                      </div>
                    )}
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30">Total Amount</p>
                    <p className="text-3xl font-black text-brand">₹{order.total || 0}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className={`p-4 rounded-luxury ${order.status === 'completed' ? 'bg-green-50 text-green-500' : 'bg-blush text-brand'} shadow-soft`}>
                      {order.status === 'completed' ? <CheckCircle2 size={28}/> : <Clock size={28}/>}
                    </div>
                    <button 
                      onClick={async () => {
                        addToast('Generating invoice PDF...', 'sweet');
                        await generateInvoicePDF(order, settings);
                      }}
                      className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-tighter text-brand hover:text-brand-dark transition-colors"
                    >
                      <FileDown size={14} />
                      Invoice
                    </button>
                  </div>
                </div>
              </div>
            </FloatingCard>
          ))}
        </div>
      )}
    </div>
  );
};
