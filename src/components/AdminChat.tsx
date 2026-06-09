import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, User, Bot, ShieldCheck, RefreshCw, Search, Phone, Paperclip, Smile, ShieldAlert, History, Clock, Check, CheckCheck, ShoppingBag, Package, ExternalLink, X, ArrowLeft } from 'lucide-react';
import { useToastStore } from '../store/useToastStore';

interface Customer {
  id: string;
  phone: string;
  name: string | null;
  human_override: boolean;
  support_status: string;
  updated_at: string;
  last_interaction?: string;
  last_message?: string;
  total_spent?: number;
  total_orders?: number;
}

interface Message {
  id: string;
  customer_phone: string;
  content: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'bot' | 'staff' | 'system';
  created_at: string;
  status?: 'sent' | 'delivered' | 'read';
  message_type?: string;
  media_url?: string;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  images?: string[];
}

export const AdminChat = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [sessionData, setSessionData] = useState<any>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [showSessionPanel, setShowSessionPanel] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { addToast } = useToastStore();
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Close sidebar on mobile when customer selected
  useEffect(() => {
    if (selectedCustomer && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [selectedCustomer?.phone]);

  const scrollToBottom = (force = false) => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
    
    if (force || isNearBottom) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const normalizePhone = (p: string) => p.replace(/\D/g, '');

  const fetchSessionData = async (phone: string) => {
    const norm = normalizePhone(phone);
    const { data } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .or(`phone_number.eq.${phone},phone_number.eq.${norm},phone_number.eq.+${norm}`)
      .maybeSingle();
    setSessionData(data);
  };

  const fetchOrderHistory = async (phone: string) => {
    const norm = normalizePhone(phone);
    const { data } = await supabase
      .from('orders')
      .select('*')
      .or(`customer_phone.eq.${phone},customer_phone.eq.${norm},customer_phone.eq.+${norm}`)
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setOrderHistory(data);
  };

  const markAsRead = async (id: string) => {
    await (supabase.from('whatsapp_messages') as any).update({ status: 'read' }).eq('id', id);
  };

  const fetchCustomers = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      // 1. Fetch formal customers
      const { data: customersRaw } = await supabase
        .from('customers')
        .select('*');
      const customersData = customersRaw as any[] | null;
      
      // 2. Fetch active sessions
      const { data: sessionsRaw } = await supabase
        .from('whatsapp_sessions')
        .select('*');
      const sessionsData = sessionsRaw as any[] | null;

      // 3. Fetch recent messages
      const { data: messagesRaw } = await supabase
        .from('whatsapp_messages')
        .select('customer_phone, content, created_at, direction')
        .order('created_at', { ascending: false })
        .limit(1000);
      const messagesData = messagesRaw as any[] | null;

      // 4. Merge using normalized phone as the key
      const threadMap = new Map<string, any>();

      // Process messages first to get latest content for each phone
      messagesData?.forEach(m => {
        const norm = normalizePhone(m.customer_phone);
        if (!threadMap.has(norm)) {
          threadMap.set(norm, {
            phone: m.customer_phone,
            last_message: m.content,
            last_interaction: m.created_at,
            updated_at: m.created_at
          });
        }
      });

      // Overlay formal customer data
      customersData?.forEach(c => {
        const norm = normalizePhone(c.phone);
        const existing = threadMap.get(norm) || {};
        threadMap.set(norm, {
          ...existing,
          ...c,
          phone: c.phone,
          name: c.name || existing.name,
          updated_at: c.updated_at > (existing.updated_at || '') ? c.updated_at : existing.updated_at
        });
      });

      // Overlay session data
      sessionsData?.forEach(s => {
        const norm = normalizePhone(s.phone_number);
        const existing = threadMap.get(norm) || {};
        threadMap.set(norm, {
          ...existing,
          name: existing.name || s.customer_name,
          phone: existing.phone || s.phone_number,
          last_interaction: s.last_interaction > (existing.last_interaction || '') ? s.last_interaction : existing.last_interaction
        });
      });

      const merged = Array.from(threadMap.values()).map(t => ({
        ...t,
        id: t.id || `temp-${t.phone}`,
        name: t.name || null,
        human_override: t.human_override || false,
        support_status: t.support_status || 'bot',
        last_message: t.last_message || 'Artisanal conversation',
        last_interaction: t.last_interaction || t.updated_at || new Date(0).toISOString()
      }));

      // 5. Sort by most recent interaction
      merged.sort((a, b) => new Date(b.last_interaction).getTime() - new Date(a.last_interaction).getTime());
      
      setCustomers(merged as Customer[]);
    } catch (err: any) {
      console.error('Support Hub Sync Error:', err);
      if (!isSilent) addToast(err.message, 'error');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const fetchMessages = async (phone: string, isInitial = false) => {
    if (loadingHistory) return;
    setLoadingHistory(true);
    
    const norm = normalizePhone(phone);
    try {
      let query = supabase
        .from('whatsapp_messages')
        .select('*')
        .or(`customer_phone.eq.${phone},customer_phone.eq.${norm},customer_phone.eq.+${norm}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!isInitial && messages.length > 0) {
        query = query.lt('created_at', messages[0].created_at);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      if (data) {
        const newMsgs = [...data].reverse() as Message[];
        if (data.length < 50) setHasMore(false);
        else setHasMore(true);
        
        setMessages(prev => isInitial ? newMsgs : [...newMsgs, ...prev]);
        
        const unread = newMsgs.filter(m => m.direction === 'inbound' && m.status !== 'read');
        unread.forEach(m => markAsRead(m.id));
      }
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    
    const realtimeChannel = supabase
      .channel('crm-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        const msg = payload.new as Message;
        
        if (selectedCustomer && normalizePhone(msg.customer_phone) === normalizePhone(selectedCustomer.phone)) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          markAsRead(msg.id);
        }
        
        // Refresh sidebar silently
        fetchCustomers(true);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customers' }, (payload) => {
        const updated = payload.new as Customer;
        
        if (selectedCustomer && normalizePhone(updated.phone) === normalizePhone(selectedCustomer.phone)) {
          setSelectedCustomer(prev => prev ? { ...prev, ...updated } : null);
        }
        fetchCustomers(true);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customers' }, () => {
        fetchCustomers(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_sessions' }, (payload) => {
        const session = payload.new as any;
        const phone = session?.phone_number || session?.customer_phone;
        
        if (selectedCustomer && phone && normalizePhone(phone) === normalizePhone(selectedCustomer.phone)) {
          setSessionData(session);
        }
        fetchCustomers(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(realtimeChannel); };
  }, [selectedCustomer?.phone]); // Re-bind if selected phone changes to ensure comparison is fresh

  useEffect(() => {
    if (selectedCustomer) {
      setMessages([]);
      setHasMore(true);
      fetchMessages(selectedCustomer.phone, true);
      fetchSessionData(selectedCustomer.phone);
      fetchOrderHistory(selectedCustomer.phone);
    }
  }, [selectedCustomer?.phone]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleTakeover = async () => {
    if (!selectedCustomer) return;

    try {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', selectedCustomer.phone)
        .maybeSingle();

      if (existing) {
        const { error } = await (supabase
          .from('customers') as any)
          .update({ human_override: true, support_status: 'human' })
          .eq('phone', selectedCustomer.phone);
        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from('customers') as any)
          .insert({ 
            phone: selectedCustomer.phone,
            name: selectedCustomer.name,
            human_override: true, 
            support_status: 'human' 
          });
        if (error) throw error;
      }

      await (supabase.from('whatsapp_messages') as any).insert([{
        customer_phone: selectedCustomer.phone,
        content: "✨ Owner Snahe entered the chat for support. WhatsApp Web is now disabled.",
        direction: 'outbound',
        sender_type: 'system'
      }]);

      setSelectedCustomer(prev => prev ? { ...prev, human_override: true, support_status: 'human' } : null);
      addToast('Human takeover enabled!', 'sweet');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleResumeBot = async () => {
    if (!selectedCustomer) return;

    try {
      const { error } = await (supabase
        .from('customers') as any)
        .update({ human_override: false, support_status: 'bot' })
        .eq('phone', selectedCustomer.phone);

      if (error) throw error;

      await (supabase.from('whatsapp_messages') as any).insert([{
        customer_phone: selectedCustomer.phone,
        content: "🍭 Support session ended. WhatsApp Web is now resumed.",
        direction: 'outbound',
        sender_type: 'system'
      }]);

      setSelectedCustomer(prev => prev ? { ...prev, human_override: false, support_status: 'bot' } : null);
      addToast('WhatsApp Web resumed!', 'sweet');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !newMessage.trim() || sending) return;

    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await (supabase.from('whatsapp_messages') as any).insert([{
        customer_phone: selectedCustomer.phone,
        content,
        direction: 'outbound',
        sender_type: 'staff',
        status: 'sent',
        message_type: 'text'
      }]);

      if (error) throw error;
    } catch (err: any) {
      setNewMessage(content);
      addToast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleCreateDraftOrder = async () => {
    if (!selectedCustomer || !sessionData?.cart || sessionData.cart.length === 0 || creatingOrder) {
      addToast('Cart is empty or operation in progress', 'error');
      return;
    }

    setCreatingOrder(true);
    try {
      const total = sessionData.cart.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      
      const { data: order, error: orderError } = await (supabase.from('orders') as any).insert([{
        customer_phone: selectedCustomer.phone,
        customer_name: selectedCustomer.name || sessionData.customer_name || 'WhatsApp Guest',
        items: sessionData.cart,
        total,
        subtotal: total,
        status: 'pending',
        order_source: 'whatsapp',
        delivery_type: sessionData.delivery_type,
        address: 'WhatsApp Draft'
      }]).select().single();

      if (orderError) throw orderError;

      // Insert into order_items for new schema compatibility
      const orderItems = sessionData.cart.map((item: any) => ({
        order_id: order.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity
      }));

      await supabase.from('order_items').insert(orderItems);

      // Update session and clear cart
      await (supabase.from('whatsapp_sessions') as any)
        .update({ 
          current_order_id: order.id,
          cart: [] 
        })
        .eq('customer_phone', selectedCustomer.phone);

      addToast('Draft order created!', 'sweet');
      fetchSessionData(selectedCustomer.phone);
      fetchOrderHistory(selectedCustomer.phone);
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setCreatingOrder(false);
    }
  };

  const clearSessionCart = async () => {
    if (!selectedCustomer) return;
    try {
      const { error } = await (supabase.from('whatsapp_sessions') as any)
        .update({ cart: [] })
        .eq('customer_phone', selectedCustomer.phone);
      if (error) throw error;
      addToast('Session cart cleared', 'sweet');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.phone.includes(searchTerm) || 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex overflow-hidden lg:fluid-glass rounded-none lg:rounded-[3rem] lg:shadow-layer-3 border-none lg:border lg:border-white/60 bg-white/20 lg:bg-white/20 relative">
      {/* Sidebar - Guest List */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ x: -350 }}
            animate={{ x: 0 }}
            exit={{ x: -350 }}
            className="absolute md:relative z-50 w-full md:w-[320px] lg:w-[380px] h-full border-r border-brand/5 flex flex-col bg-white/95 md:bg-white/40 backdrop-blur-2xl md:backdrop-blur-none shrink-0"
          >
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-brand-dark tracking-tight">Support Hub</h2>
                  <p className="text-[10px] font-black text-brand-dark/30 uppercase tracking-[0.2em] mt-1">Live Support</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden md:flex p-3 bg-brand text-white rounded-2xl shadow-lg shadow-brand/20">
                     <MessageSquare size={18} />
                  </div>
                  <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-3 bg-brand/5 text-brand rounded-2xl hover:bg-brand hover:text-white transition-all">
                     <X size={18} />
                  </button>
                </div>
              </div>
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-brand/30 group-focus-within:text-brand transition-colors" size={16} />
                <input 
                  type="text"
                  placeholder="Search guests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-12 pl-12 pr-6 bg-white/60 rounded-3xl border-2 border-transparent focus:border-brand/20 outline-none font-bold text-xs transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-20">
                  <RefreshCw className="animate-spin text-brand" size={32} />
                </div>
              ) : (
                filteredCustomers.map(customer => (
                  <div 
                    key={customer.id}
                    onClick={() => { setSelectedCustomer(customer); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                    className={`p-6 flex items-center gap-4 cursor-pointer transition-all border-b border-brand/5 relative group/item ${selectedCustomer?.phone === customer.phone ? 'bg-white shadow-md z-10' : 'hover:bg-white/40'}`}
                  >
                    <div className="relative">
                      <div className="w-14 h-14 bg-blush rounded-2xl flex items-center justify-center text-brand shadow-inner border border-white group-hover/item:scale-105 transition-transform duration-500">
                        <User size={24} />
                      </div>
                      {customer.human_override && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-brand text-white rounded-full flex items-center justify-center shadow-lg animate-pulse border-2 border-white">
                          <ShieldAlert size={10} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <p className="font-black text-brand-dark truncate text-sm">{customer.name || 'Artisanal Guest'}</p>
                        <span className="text-[8px] font-black text-brand-dark/20 uppercase">
                           {customer.last_interaction ? new Date(customer.last_interaction).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold text-brand-dark/40 truncate leading-tight">
                          {customer.last_message}
                        </p>
                        <span className="text-[7px] font-black text-brand/30 shrink-0">+{normalizePhone(customer.phone)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Engine */}
      <div className="flex-1 flex flex-col bg-[#FDF2F4]/30 relative backdrop-blur-sm overflow-hidden">
        <AnimatePresence mode="wait">
          {selectedCustomer ? (
            <motion.div 
              key={selectedCustomer.phone}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              {/* Chat Header */}
              <div className="flex p-4 sm:p-6 bg-white/70 backdrop-blur-2xl border-b border-brand/5 justify-between items-center shadow-sm z-30 shrink-0 gap-2">
                <div className="flex items-center gap-2 sm:gap-5 min-w-0">
                   <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 sm:p-3 bg-brand/5 text-brand rounded-xl hover:bg-brand hover:text-white transition-all md:hidden shrink-0"
                   >
                     <ArrowLeft size={18} />
                   </button>
                   <div className="hidden sm:flex w-12 h-12 bg-blush rounded-xl items-center justify-center text-brand border border-white shadow-soft shrink-0">
                      <User size={24} />
                   </div>
                   <div className="min-w-0">
                      <h3 className="font-black text-brand-dark leading-tight truncate text-sm sm:text-base">{selectedCustomer.name || 'Support Guest'}</h3>
                      <div className="flex items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1">
                         <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedCustomer.human_override ? 'bg-brand animate-pulse' : 'bg-green-500'}`} />
                         <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-brand-dark/30 truncate">
                           {selectedCustomer.human_override ? 'Takeover Active' : 'WhatsApp Web'}
                         </p>
                      </div>
                   </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                  <button 
                    onClick={() => setShowSessionPanel(!showSessionPanel)}
                    className={`p-2 sm:p-3 rounded-xl transition-all border ${showSessionPanel ? 'bg-brand text-white border-brand shadow-lg' : 'bg-white text-brand border-brand/10 shadow-soft hover:bg-brand/5'}`}
                    title="Guest Insights"
                  >
                    <ShoppingBag size={18} className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  {selectedCustomer.human_override ? (
                    <button 
                      onClick={handleResumeBot}
                      className="px-2 sm:px-4 lg:px-6 h-9 sm:h-12 bg-green-500 text-white rounded-xl font-black text-[8px] sm:text-[9px] lg:text-[10px] uppercase tracking-widest flex items-center gap-1 sm:gap-2 shadow-lg shadow-green-500/20 hover:scale-105 transition-all whitespace-nowrap"
                    >
                      <Bot size={14} className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" /> <span className="inline">Resume Web</span>
                    </button>
                  ) : (
                    <button 
                      onClick={handleTakeover}
                      className="px-2 sm:px-4 lg:px-6 h-9 sm:h-12 bg-brand text-white rounded-xl font-black text-[8px] sm:text-[9px] lg:text-[10px] uppercase tracking-widest flex items-center gap-1 sm:gap-2 shadow-lg shadow-brand/20 hover:scale-105 transition-all whitespace-nowrap"
                    >
                      <ShieldAlert size={14} className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" /> <span className="inline">Takeover</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 flex overflow-hidden relative">
                 {/* Scrollable Messages */}
                 <div 
                   ref={scrollContainerRef}
                   className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 no-scrollbar bg-pattern-light relative"
                 >
                   {hasMore && (
                     <div className="flex justify-center pb-8">
                        <button 
                          onClick={() => fetchMessages(selectedCustomer.phone)}
                          disabled={loadingHistory}
                          className="px-5 py-2 bg-white/60 hover:bg-white text-brand font-black text-[9px] uppercase tracking-widest rounded-full border border-brand/10 shadow-sm transition-all flex items-center gap-2"
                        >
                          {loadingHistory ? <RefreshCw size={12} className="animate-spin" /> : <History size={12} />}
                          Load History
                        </button>
                     </div>
                   )}

                   {messages.map((msg, idx) => {
                     const dir = msg.direction?.toLowerCase() || 'inbound';
                     const sender = msg.sender_type?.toLowerCase() || 'guest';
                     const isOutbound = dir === 'outbound';
                     const isSystem = sender === 'system';
                     
                     const showDateHeader = idx === 0 || 
                       new Date(msg.created_at).toLocaleDateString() !== new Date(messages[idx-1].created_at).toLocaleDateString();

                     return (
                       <div key={msg.id} className="space-y-6">
                         {showDateHeader && (
                           <div className="flex justify-center my-4">
                              <span className="bg-white/40 backdrop-blur-md px-4 py-1 rounded-full text-[8px] font-black text-brand-dark/30 uppercase tracking-widest border border-brand/5">
                                 {new Date(msg.created_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </span>
                           </div>
                         )}

                         {isSystem ? (
                           <div className="flex justify-center">
                             <div className="bg-brand/5 border border-brand/10 px-5 py-1.5 rounded-full text-[9px] font-black text-brand uppercase tracking-widest shadow-sm flex items-center gap-2">
                                <Clock size={12} className="opacity-40" /> {msg.content}
                             </div>
                           </div>
                         ) : (
                           <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                             <motion.div 
                               initial={{ scale: 0.95, opacity: 0, y: 5 }}
                               animate={{ opacity: 1, y: 0 }}
                               className={`max-w-[85%] lg:max-w-[70%] p-4 lg:p-5 rounded-[2rem] shadow-soft relative border-2 ${
                                 isOutbound 
                                   ? sender === 'bot' 
                                      ? 'bg-brand-dark text-white border-brand/20 rounded-tr-none'
                                      : 'bg-brand text-white border-brand/5 rounded-tr-none' 
                                   : 'bg-white text-brand-dark border-brand/10 rounded-tl-none'
                               }`}
                             >
                               <div className="flex items-center gap-2 mb-1.5 opacity-50">
                                 {isOutbound ? (
                                   sender === 'bot' ? <Bot size={12} /> : <ShieldCheck size={12} />
                                 ) : <User size={12} />}
                                 <span className="text-[9px] font-black uppercase tracking-widest">
                                    {isOutbound ? (sender === 'bot' ? 'WhatsApp Web' : 'Owner Snahe') : 'Guest'}
                                 </span>
                               </div>
                               <p className="font-bold text-xs lg:text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                               {msg.media_url && msg.message_type === 'image' && (
                                 <div className="mt-3 rounded-2xl overflow-hidden border border-white/20 shadow-deep">
                                   <img src={msg.media_url} alt="Shared media" className="max-w-full h-auto object-cover" />
                                 </div>
                               )}
                               <div className={`mt-2 flex items-center justify-end gap-1 text-[8px] font-black uppercase tracking-widest ${isOutbound ? 'text-white/40' : 'text-brand-dark/20'}`}>
                                 {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                 {isOutbound && (
                                   msg.status === 'read' ? <CheckCheck size={12} className="text-white" /> : <Check size={12} />
                                 )}
                               </div>
                             </motion.div>
                           </div>
                         )}
                       </div>
                     );
                   })}
                   <div ref={chatEndRef} className="h-2" />
                 </div>

                 {/* Session Intelligence Panel */}
                 <AnimatePresence>
                   {showSessionPanel && (
                     <motion.div 
                       initial={{ x: 350 }}
                       animate={{ x: 0 }}
                       exit={{ x: 350 }}
                       className="absolute right-0 top-0 bottom-0 z-40 w-full md:w-[320px] lg:w-[350px] border-l border-brand/5 bg-white/95 backdrop-blur-2xl flex flex-col shadow-2xl overflow-hidden"
                     >
                       <div className="p-8 border-b border-brand/5 flex justify-between items-center shrink-0">
                          <h4 className="text-xl font-black text-brand-dark">Session Insights</h4>
                          <button onClick={() => setShowSessionPanel(false)} className="w-10 h-10 rounded-full bg-brand/5 text-brand flex items-center justify-center hover:bg-brand hover:text-white transition-all">
                             <X size={20} />
                          </button>
                       </div>
                       
                       <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar pb-32">
                          {/* Live WhatsApp Cart */}
                          <div className="space-y-4">
                             <div className="flex justify-between items-center px-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30">WhatsApp Cart</p>
                                <button onClick={clearSessionCart} className="text-[9px] font-black text-red-400 uppercase tracking-widest hover:text-red-600">Clear</button>
                             </div>
                             {sessionData?.cart && (sessionData.cart as CartItem[]).length > 0 ? (
                               <div className="space-y-3">
                                 {(sessionData.cart as CartItem[]).map((item, i) => (
                                   <div key={i} className="bg-white/60 p-4 rounded-2xl flex items-center justify-between border border-brand/5 shadow-sm">
                                      <div className="flex items-center gap-3 shrink min-w-0">
                                         <div className="w-10 h-10 bg-blush rounded-xl flex items-center justify-center text-sm shadow-inner shrink-0 overflow-hidden">
                                            {item.images && item.images[0] ? <img src={item.images[0]} className="w-full h-full object-cover" /> : '🧁'}
                                         </div>
                                         <div className="min-w-0">
                                            <p className="font-black text-brand-dark text-xs truncate">{item.name}</p>
                                            <p className="text-[10px] font-bold text-brand-dark/40">₹{item.price} x {item.quantity}</p>
                                         </div>
                                      </div>
                                      <div className="w-8 h-8 bg-brand/5 text-brand rounded-lg flex items-center justify-center font-black text-sm shrink-0">
                                         {item.quantity}
                                      </div>
                                   </div>
                                 ))}
                               </div>
                             ) : (
                               <div className="p-8 border-2 border-dashed border-brand/10 rounded-[2rem] flex flex-col items-center justify-center text-center gap-2 opacity-30">
                                  <ShoppingBag size={24} />
                                  <p className="text-[10px] font-bold">Cart is empty</p>
                               </div>
                             )}
                          </div>

                          {/* Journey Context */}
                          <div className="space-y-4 pt-6 border-t border-brand/5">
                             <p className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 px-1">Journey Context</p>
                             <div className="grid grid-cols-1 gap-3">
                                <div className="bg-brand/5 p-4 rounded-2xl border border-brand/10 flex justify-between items-center">
                                   <div className="min-w-0">
                                      <p className="text-[8px] font-black text-brand/40 uppercase mb-0.5">Exploring</p>
                                      <p className="text-sm font-black text-brand-dark truncate">{sessionData?.selected_category || 'Main Menu'}</p>
                                   </div>
                                   <ExternalLink size={14} className="text-brand/20 shrink-0" />
                                </div>
                                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex justify-between items-center">
                                   <div className="min-w-0">
                                      <p className="text-[8px] font-black text-blue-400 uppercase mb-0.5">Preferred Delivery</p>
                                      <p className="text-sm font-black text-brand-dark capitalize truncate">{sessionData?.delivery_type || 'Undecided'}</p>
                                   </div>
                                   <Phone size={14} className="text-blue-200 shrink-0" />
                                </div>
                                {sessionData?.current_order_id && (
                                   <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100">
                                      <p className="text-[8px] font-black text-green-500 uppercase mb-0.5">Active Draft Order</p>
                                      <p className="text-xs font-black text-brand-dark truncate">#{sessionData.current_order_id?.slice(0, 8).toUpperCase() || 'N/A'}</p>
                                   </div>
                                )}
                             </div>
                          </div>

                          {/* Historical Insights */}
                          <div className="space-y-4 pt-6 border-t border-brand/5">
                             <p className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 px-1">Historical Insights</p>
                             <div className="bg-white/40 p-5 rounded-[2rem] border border-brand/5 space-y-4 shadow-inner shrink-0">
                                <div className="flex justify-between items-center">
                                   <span className="text-[10px] font-bold text-brand-dark/40">Lifetime Value</span>
                                   <span className="text-sm font-black text-brand-dark">₹{selectedCustomer?.total_spent || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                   <span className="text-[10px] font-bold text-brand-dark/40">Orders</span>
                                   <span className="text-sm font-black text-brand-dark">{selectedCustomer?.total_orders || 0}</span>
                                </div>
                             </div>
                             
                             <div className="space-y-3 mt-4">
                                {orderHistory.map(order => (
                                   <div key={order.id} className="bg-white/60 p-4 rounded-2xl border border-brand/5 shadow-sm">
                                      <div className="flex justify-between items-center mb-1">
                                         <p className="font-black text-brand-dark text-[10px]">#{order.id?.slice(0, 8).toUpperCase() || 'N/A'}</p>
                                         <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${
                                            order.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-brand/10 text-brand'
                                         }`}>
                                            {order.status}
                                         </span>
                                      </div>
                                      <p className="font-bold text-brand-dark/60 text-xs">₹{order.total} • {new Date(order.created_at).toLocaleDateString()}</p>
                                   </div>
                                ))}
                                {orderHistory.length === 0 && (
                                   <p className="text-[10px] font-bold text-brand-dark/30 italic text-center py-4">No previous orders</p>
                                )}
                             </div>
                          </div>
                       </div>

                       <div className="absolute bottom-0 left-0 right-0 p-8 border-t border-brand/5 bg-white/95 shrink-0">
                          <button 
                            onClick={handleCreateDraftOrder}
                            disabled={creatingOrder || !sessionData?.cart || sessionData.cart.length === 0}
                            className="w-full h-14 bg-brand text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-brand/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                          >
                             {creatingOrder ? <RefreshCw className="animate-spin" size={16} /> : <Package size={16} />}
                             {creatingOrder ? 'Processing...' : 'Create Draft Order'}
                          </button>
                       </div>
                     </motion.div>
                   )}
                 </AnimatePresence>
              </div>

              {/* Chat Input */}
              <div className="p-2 sm:p-4 lg:p-8 bg-white/80 backdrop-blur-3xl border-t border-brand/5 z-40 shrink-0 w-full pb-[env(safe-area-inset-bottom)]">
                <form onSubmit={handleSendMessage} className="w-full max-w-4xl mx-auto flex items-center gap-1 sm:gap-3 lg:gap-6">
                  <div className="flex items-center shrink-0">
                    <button type="button" className="p-2 sm:p-3 lg:p-4 text-brand-dark/30 hover:text-brand rounded-2xl transition-all"><Paperclip size={18} className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                    <button type="button" className="p-2 sm:p-3 lg:p-4 text-brand-dark/30 hover:text-brand rounded-2xl transition-all"><Smile size={18} className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                  </div>
                  
                  <div className="flex-1 relative">
                    <textarea 
                      placeholder={selectedCustomer.human_override ? "Write response..." : "Enable takeover..."}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                         if (e.key === 'Enter' && !e.shiftKey) {
                           e.preventDefault();
                           handleSendMessage(e as any);
                         }
                      }}
                      disabled={!selectedCustomer.human_override || sending}
                      rows={1}
                      className="w-full min-h-[44px] sm:min-h-[56px] pl-3 sm:pl-6 pr-4 sm:pr-12 bg-white rounded-xl sm:rounded-[1.5rem] border-2 border-brand/10 focus:border-brand/30 outline-none font-bold text-brand-dark shadow-soft transition-all disabled:opacity-50 resize-none py-3 sm:py-4 text-xs sm:text-sm"
                    />
                  </div>
                  
                  <button 
                    disabled={!selectedCustomer.human_override || sending || !newMessage.trim()}
                    className="w-11 h-11 sm:w-14 sm:h-14 bg-brand text-white rounded-xl sm:rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-brand/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100 shrink-0"
                  >
                    {sending ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </form>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 lg:p-20 text-center relative overflow-hidden">
               {/* Mobile sidebar toggle for empty state */}
               {!isSidebarOpen && (
                 <button 
                   onClick={() => setIsSidebarOpen(true)}
                   className="absolute top-6 left-6 p-4 bg-brand text-white rounded-2xl shadow-lg md:hidden z-30"
                 >
                   <MessageSquare size={24} />
                 </button>
               )}
               <div className="w-32 h-32 lg:w-40 lg:h-40 bg-white rounded-[3rem] flex items-center justify-center mb-10 border-4 border-dashed border-brand/20 shadow-inner">
                  <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                    <MessageSquare size={50} className="text-brand lg:size-[64px]" />
                  </motion.div>
               </div>
               <h3 className="heading-serif text-3xl lg:text-5xl text-brand-dark mb-4 lg:mb-6">Live Support Hub</h3>
               <p className="max-w-md mx-auto font-bold text-brand-dark/40 text-sm lg:text-lg leading-relaxed px-4">
                  Select an artisanal guest from the sidebar to view their full chat history and provide personalized support.
               </p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
