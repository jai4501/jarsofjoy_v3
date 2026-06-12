import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FloatingCard } from './ui/FloatingCard';
import { Users, Phone, ShoppingBag, IndianRupee, Search, UserCheck } from 'lucide-react';
import type { Database } from '../types/supabase';

type Customer = Database['public']['Tables']['customers']['Row'];

export const AdminCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCustomers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('total_spent', { ascending: false });
    
    if (data) setCustomers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter(c => 
    c.phone.includes(searchTerm) || 
    (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black text-brand-dark tracking-tight">Customer CRM</h2>
          <p className="text-brand-dark/40 font-bold">Manage your community and loyal sweet lovers</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/40" size={20} />
          <input 
            type="text"
            placeholder="Search name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-14 pl-12 pr-6 bg-white rounded-2xl border-2 border-brand/5 shadow-soft outline-none focus:border-brand/30 transition-all font-bold text-brand-dark text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-32 gap-4">
          <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center animate-bounce">
            <Users className="text-brand" size={32} />
          </div>
          <p className="font-black text-brand uppercase tracking-widest text-xs">Fetching community...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-32 opacity-30">
              <Search size={48} className="mx-auto mb-4" />
              <p className="font-bold italic text-xl">No customers found matching "{searchTerm}"</p>
            </div>
          ) : (
            filteredCustomers.map(customer => (
              <FloatingCard key={customer.id} className="group !p-6 sm:!p-8">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
                  <div className="flex items-center gap-6 w-full xl:w-auto">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-brand/10 rounded-[2rem] flex items-center justify-center text-brand shadow-inner shrink-0 animate-morph">
                      <Users size={32} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h4 className="text-2xl sm:text-3xl font-black text-brand-dark truncate max-w-[200px] sm:max-w-md">{customer.name || 'Anonymous Lover'}</h4>
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] ${
                          customer.onboarding_status === 'done' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                        }`}>
                          {customer.onboarding_status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-brand-dark/40 font-bold text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-brand-light/20 rounded-lg flex items-center justify-center"><Phone size={12} className="text-brand"/></div>
                          {customer.phone}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-brand-light/20 rounded-lg flex items-center justify-center"><UserCheck size={12} className="text-brand"/></div>
                          <span className="capitalize">{customer.support_status} Support</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap gap-4 sm:gap-8 items-center bg-brand-light/5 p-6 rounded-[2.5rem] border border-brand-light/10 w-full xl:w-auto shadow-inner">
                    <div className="flex-1 sm:flex-none text-center sm:px-4">
                      <p className="text-[10px] font-black text-brand-dark/30 uppercase tracking-[0.2em] mb-2">Treats Ordered</p>
                      <div className="flex items-center justify-center gap-2 text-brand-dark font-black text-xl">
                        <ShoppingBag size={18} className="opacity-30" />
                        {customer.total_orders}
                      </div>
                    </div>
                    <div className="hidden sm:block w-px h-10 bg-brand-light/20" />
                    <div className="flex-1 sm:flex-none text-center sm:px-4">
                      <p className="text-[10px] font-black text-brand-dark/30 uppercase tracking-[0.2em] mb-2">Total Value</p>
                      <div className="flex items-center justify-center gap-1 text-brand font-black text-xl">
                        <IndianRupee size={16} className="opacity-30" />
                        {customer.total_spent.toLocaleString()}
                      </div>
                    </div>
                    <div className="hidden sm:block w-px h-10 bg-brand-light/20" />
                    <div className="flex-1 sm:flex-none text-center sm:px-4">
                      <p className="text-[10px] font-black text-brand-dark/30 uppercase tracking-[0.2em] mb-2">Last Visit</p>
                      <p className="text-sm font-black text-brand-dark/60">
                        {customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>
              </FloatingCard>
            ))
          )}
        </div>
      )}
    </div>
  );
};
