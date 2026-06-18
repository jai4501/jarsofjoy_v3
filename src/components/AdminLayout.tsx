import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { AdminPOS } from './AdminPOS';
import { AdminBot } from './AdminBot';
import { AdminChat } from './AdminChat';
import { AdminProducts } from './AdminProducts';
import { AdminCustomers } from './AdminCustomers';
import { AdminOrders } from './AdminOrders';
import { AdminSettings } from './AdminSettings';
import { AdminCoupons } from './AdminCoupons';
import { motion } from 'framer-motion';
import { LayoutDashboard, ShoppingCart, MessageSquare, Utensils, ArrowLeft, TrendingUp, Users, Package, ShieldAlert, CheckCircle2, Settings, Headphones, Ticket } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const AdminLayout = () => {
  const location = useLocation();
  const [stats, setStats] = useState({ totalSales: 0, ordersCount: 0, productsCount: 0, activeAlerts: 0 });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  const fetchStats = async () => {
    const { data: orders } = await supabase.from('orders').select('total');
    const { count: products } = await supabase.from('products').select('*', { count: 'exact', head: true });
    const { count: alerts } = await supabase.from('staff_notifications').select('*', { count: 'exact', head: true }).eq('resolved', false);
    
    if (orders) {
      const typedOrders = orders as { total: number | null }[];
      const total = typedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      setStats({ 
        totalSales: total, 
        ordersCount: orders.length, 
        productsCount: products || 0,
        activeAlerts: alerts || 0
      });
    }
  };

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('staff_notifications')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setNotifications(data);
  };

  const fetchRecentOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setRecentOrders(data);
  };

  useEffect(() => {
    fetchStats();
    fetchNotifications();
    fetchRecentOrders();
  }, []);

  const menuItems = [
    { path: '/admin', icon: <LayoutDashboard size={20}/>, label: 'Overview' },
    { path: '/admin/orders', icon: <Package size={20}/>, label: 'Order Queue' },
    { path: '/admin/pos', icon: <ShoppingCart size={20}/>, label: 'POS Terminal' },
    { path: '/admin/products', icon: <Utensils size={20}/>, label: 'Menu Manager' },
    { path: '/admin/customers', icon: <Users size={20}/>, label: 'Customers' },
    { path: '/admin/chat', icon: <Headphones size={20}/>, label: 'Live Support' },
    { path: '/admin/coupons', icon: <Ticket size={20}/>, label: 'Coupons' },
    { path: '/admin/bot', icon: <MessageSquare size={20}/>, label: 'WhatsApp Web' },
    { path: '/admin/settings', icon: <Settings size={20}/>, label: 'Settings' },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-cream/30 overflow-hidden">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white/80 backdrop-blur-xl border-b border-brand/5 px-6 py-4 sticky top-0 z-50 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center shadow-md">
            <TrendingUp className="text-white" size={16} />
          </div>
          <span className="font-black text-brand tracking-tighter">Admin Suite</span>
        </div>
        <Link to="/" className="text-[10px] font-black uppercase tracking-widest text-brand-dark/65 hover:text-brand transition-colors">Exit</Link>
      </header>

      {/* Mobile Nav - Horizontal Scroll */}
      <nav className="lg:hidden bg-white/60 backdrop-blur-md border-b border-brand/5 p-2 sticky top-[65px] z-40 overflow-x-auto no-scrollbar flex gap-2 shrink-0">
        {menuItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className="shrink-0">
              <div className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isActive ? 'bg-brand text-white shadow-md' : 'bg-white/50 text-brand-dark/65 hover:text-brand'}`}>
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 liquid-mercury m-6 mr-0 rounded-[3rem] p-8 flex-col shadow-layer-2 border-white/60 shrink-0">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center shadow-lg shadow-brand/20">
            <TrendingUp className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-brand tracking-tighter leading-none">Admin Suite</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-dark/65 mt-1">Bakery Ecosystem</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
          {menuItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <motion.div 
                  whileHover={{ x: 5 }}
                  className={`flex items-center gap-4 p-4 rounded-2xl transition-all font-black text-sm ${
                    isActive 
                    ? 'bg-brand text-white shadow-lg shadow-brand/20' 
                    : 'text-brand-dark/65 hover:bg-brand/5 hover:text-brand'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4 pt-6">
          <div className="bg-brand/5 p-6 rounded-[2rem] border border-brand/10">
            <p className="text-xs font-black text-brand/40 uppercase mb-3">Daily Progress</p>
            <div className="h-2 bg-brand/10 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: '70%' }} className="h-full bg-brand" />
            </div>
          </div>
          <Link to="/" className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-white/50 border border-white/80 font-black text-brand-dark/60 text-sm hover:bg-white transition-colors">
            <ArrowLeft size={16} /> Exit to Storefront
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative">
        <div className={`w-full ${location.pathname === '/admin/chat' ? 'p-0 lg:p-8' : 'p-4 lg:p-8'}`}>
          <Routes>
          <Route path="/" element={
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 md:gap-8">
                <div className="fluid-glass p-8 rounded-[3rem] glossy-edge">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-brand/10 rounded-2xl text-brand"><TrendingUp size={24}/></div>
                  </div>
                  <p className="text-xs font-black text-brand-dark/65 uppercase tracking-widest">Total Sales</p>
                  <p className="text-4xl xl:text-5xl font-black text-brand mt-1 truncate">₹{stats.totalSales.toLocaleString()}</p>
                </div>
                <div className="fluid-glass p-8 rounded-[3rem] glossy-edge">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500"><Package size={24}/></div>
                  </div>
                  <p className="text-xs font-black text-brand-dark/65 uppercase tracking-widest">Total Orders</p>
                  <p className="text-4xl xl:text-5xl font-black text-brand-dark mt-1">{stats.ordersCount}</p>
                </div>
                <div className="fluid-glass p-8 rounded-[3rem] glossy-edge">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-pink-500/10 rounded-2xl text-pink-500"><Users size={24}/></div>
                  </div>
                  <p className="text-xs font-black text-brand-dark/65 uppercase tracking-widest">Treats Live</p>
                  <p className="text-4xl xl:text-5xl font-black text-brand-dark mt-1">{stats.productsCount}</p>
                </div>
                <div className="fluid-glass p-8 rounded-[3rem] glossy-edge border-red-100 bg-red-50/5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-red-500/10 rounded-2xl text-red-500"><ShieldAlert size={24}/></div>
                  </div>
                  <p className="text-xs font-black text-red-500/50 uppercase tracking-widest">Active Alerts</p>
                  <p className="text-4xl xl:text-5xl font-black text-red-500 mt-1">{stats.activeAlerts}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="fluid-glass p-10 rounded-[4rem] min-h-[400px] glossy-edge flex flex-col">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 bg-red-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
                      <ShieldAlert size={20} />
                    </div>
                    <h3 className="text-3xl font-black text-brand-dark">System Alerts</h3>
                  </div>
                  <div className="flex-1 space-y-4">
                    {notifications.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center opacity-30 text-center py-20">
                        <CheckCircle2 size={48} className="mb-4" />
                        <p className="font-bold italic">Everything is running smoothly...</p>
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <motion.div 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={notif.id} 
                          className="p-5 bg-white/40 rounded-[2rem] border border-white/80 flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="p-3 bg-red-50 text-red-500 rounded-2xl"><ShieldAlert size={20} /></div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <p className="font-black text-brand-dark leading-tight">{notif.title || 'Attention Needed'}</p>
                              <span className="text-[9px] font-black text-brand/30 uppercase tracking-tighter whitespace-nowrap">{new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-sm font-bold text-brand-dark/75 mt-1 leading-snug">{notif.message}</p>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>

                <div className="fluid-glass p-10 rounded-[4rem] min-h-[400px] glossy-edge bg-brand-light/5 flex flex-col">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 bg-brand text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand/20">
                      <Package size={20} />
                    </div>
                    <h3 className="text-3xl font-black text-brand-dark">Recent Orders</h3>
                  </div>
                  <div className="flex-1 space-y-4">
                    {recentOrders.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center opacity-30 text-center py-20 italic">
                        <Package size={48} className="mb-4" />
                        <p className="font-bold">No recent orders yet...</p>
                      </div>
                    ) : (
                      recentOrders.map(order => (
                        <div key={order.id} className="p-5 bg-white/40 rounded-[2rem] border border-white/80 flex justify-between items-center shadow-sm">
                          <div>
                            <p className="font-black text-brand-dark leading-tight">Order #{order.display_id || order.metadata?.display_id || order.id.slice(0, 8).toUpperCase()}</p>
                            <p className="text-[10px] font-bold text-brand-dark/65 mt-1 uppercase tracking-widest">{order.customer_name || order.customer_phone}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-brand tracking-tighter">₹{order.total}</p>
                            <span className="text-[8px] font-black bg-brand/5 text-brand px-2 py-0.5 rounded-full uppercase">{order.status.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          } />
          <Route path="/pos" element={<AdminPOS />} />
          <Route path="/orders" element={<AdminOrders />} />
          <Route path="/products" element={<AdminProducts />} />
          <Route path="/customers" element={<AdminCustomers />} />
          <Route path="/chat" element={<AdminChat />} />
          <Route path="/coupons" element={<AdminCoupons />} />
          <Route path="/bot" element={<AdminBot />} />
          <Route path="/settings" element={<AdminSettings />} />
        </Routes>
        </div>
      </main>
    </div>
  );
};
