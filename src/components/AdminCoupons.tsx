import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FloatingCard } from './ui/FloatingCard';
import { Ticket, Search, Plus, Trash2, Edit3, X, IndianRupee, Tag, Layers, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button3D } from './ui/Button3D';

interface Coupon {
  id: string;
  code: string;
  description: string;
  type: 'percent' | 'flat';
  value: number;
  min_order_amount: number | null;
  max_discount_cap: number | null;
  max_uses: number | null;
  used_count: number;
  applicable_category: string | null;
  excluded_categories: string[] | null;
  valid_from: string | null;
  valid_until: string | null;
  active: boolean;
}

export const AdminCoupons = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsCartOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon> | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [couponRes, catRes] = await Promise.all([
      supabase.from('coupons').select('*').order('created_at', { ascending: false }),
      supabase.from('product_categories').select('name')
    ]);
    
    if (couponRes.data) setCoupons(couponRes.data as Coupon[]);
    if (catRes.data) setCategories(catRes.data);
    setLoading(false);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon?.code || !editingCoupon?.value) return;
    setActionLoading(true);

    try {
      if (editingCoupon.id) {
        const { error } = await (supabase.from('coupons') as any)
          .update(editingCoupon as any)
          .eq('id', editingCoupon.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from('coupons') as any)
          .insert([editingCoupon as any]);
        if (error) throw error;
      }
      await fetchData();
      setIsCartOpen(false);
      setEditingCoupon(null);
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save coupon.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;
    try {
      await supabase.from('coupons').delete().eq('id', id);
      await fetchData();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const openModal = (coupon: Partial<Coupon> | null = null) => {
    setEditingCoupon(coupon || {
      code: '',
      description: '',
      type: 'percent',
      value: 0,
      min_order_amount: null,
      max_discount_cap: null,
      max_uses: null,
      applicable_category: null,
      excluded_categories: [],
      active: true
    });
    setIsCartOpen(true);
  };

  const filteredCoupons = coupons.filter(c => 
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-brand-dark tracking-tight">Coupon Management</h2>
          <p className="text-brand-dark/40 font-bold">Create and manage your promotional offers</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/40" size={20} />
            <input 
              type="text"
              placeholder="Search coupons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-14 pl-12 pr-6 bg-white rounded-2xl border-2 border-brand/5 shadow-soft outline-none focus:border-brand/30 transition-all font-bold text-brand-dark text-sm"
            />
          </div>
          <Button3D onClick={() => openModal()} className="h-14 px-6 shrink-0">
             <Plus size={20} className="mr-2" /> New Coupon
          </Button3D>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-32 gap-4">
          <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center animate-bounce">
            <Ticket className="text-brand" size={32} />
          </div>
          <p className="font-black text-brand uppercase tracking-widest text-xs">Loading offers...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredCoupons.length === 0 ? (
            <div className="col-span-full text-center py-32 opacity-30">
              <Ticket size={48} className="mx-auto mb-4" />
              <p className="font-bold italic text-xl">No coupons found matching "{searchTerm}"</p>
            </div>
          ) : (
            filteredCoupons.map(coupon => (
              <FloatingCard key={coupon.id} className={`group relative !p-0 overflow-hidden border-2 transition-all ${coupon.active ? 'border-brand/5' : 'border-gray-100 opacity-60'}`}>
                <div className="flex h-full min-h-[220px]">
                  {/* Left "Ticket" Side */}
                  <div className={`w-1/3 flex flex-col items-center justify-center border-r-2 border-dashed border-brand/10 p-6 ${coupon.active ? 'bg-brand/5' : 'bg-gray-50'}`}>
                     <div className="text-4xl mb-2">{coupon.type === 'percent' ? '%' : '₹'}</div>
                     <p className="text-3xl font-black text-brand-dark tracking-tighter">
                       {coupon.type === 'percent' ? `${coupon.value}%` : `₹${coupon.value}`}
                     </p>
                     <p className="text-[8px] font-black uppercase tracking-widest text-brand/40 mt-1">Discount</p>
                  </div>

                  {/* Info Side */}
                  <div className="flex-1 p-8 flex flex-col justify-between relative">
                    <div className="absolute top-6 right-6 flex items-center gap-2">
                       <button onClick={() => openModal(coupon)} className="p-2.5 bg-brand/5 text-brand rounded-xl hover:bg-brand hover:text-white transition-all">
                          <Edit3 size={16} />
                       </button>
                       <button onClick={() => handleDelete(coupon.id)} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all">
                          <Trash2 size={16} />
                       </button>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                         <h4 className="text-2xl font-black text-brand-dark tracking-tight">{coupon.code}</h4>
                         {!coupon.active && <span className="bg-gray-100 text-gray-400 text-[8px] px-2 py-1 rounded-md font-black uppercase">Inactive</span>}
                      </div>
                      <p className="text-xs text-brand-dark/50 font-bold leading-relaxed pr-16">{coupon.description || 'No description provided.'}</p>
                      
                      <div className="grid grid-cols-2 gap-y-3 gap-x-6 pt-2">
                         <div className="flex items-center gap-2 text-[10px] font-bold text-brand-dark/40">
                            <Layers size={12} className="text-brand" />
                            <span>Min: ₹{coupon.min_order_amount || 0}</span>
                         </div>
                         <div className="flex items-center gap-2 text-[10px] font-bold text-brand-dark/40">
                            <Clock size={12} className="text-brand" />
                            <span>Limit: {coupon.max_uses || '∞'} ({coupon.used_count || 0} used)</span>
                         </div>
                         {coupon.max_discount_cap && (
                           <div className="flex items-center gap-2 text-[10px] font-bold text-brand-dark/40">
                              <IndianRupee size={12} className="text-brand" />
                              <span>Max Cap: ₹{coupon.max_discount_cap}</span>
                           </div>
                         )}
                         {coupon.applicable_category && (
                           <div className="flex items-center gap-2 text-[10px] font-bold text-brand-dark/40">
                              <Tag size={12} className="text-brand" />
                              <span>Only: {coupon.applicable_category}</span>
                           </div>
                         )}
                      </div>
                    </div>

                    {coupon.excluded_categories && coupon.excluded_categories.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-brand/5">
                        <p className="text-[8px] font-black uppercase text-red-400 mb-1">Excluded Categories:</p>
                        <div className="flex flex-wrap gap-1">
                           {coupon.excluded_categories.map(cat => (
                             <span key={cat} className="text-[8px] font-bold bg-red-50 text-red-500 px-2 py-0.5 rounded border border-red-100">{cat}</span>
                           ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </FloatingCard>
            ))
          )}
        </div>
      )}

      {/* Coupon Modal */}
      <AnimatePresence>
        {isModalOpen && editingCoupon && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !actionLoading && setIsCartOpen(false)}
              className="absolute inset-0 bg-brand-dark/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3rem] p-10 shadow-luxury relative z-10 border border-brand/5 my-auto"
            >
              <button 
                onClick={() => setIsCartOpen(false)}
                className="absolute top-8 right-8 text-brand-dark/20 hover:text-brand transition-colors"
              >
                <X size={24} />
              </button>

              <h3 className="heading-serif text-4xl text-brand-dark mb-2">{editingCoupon.id ? 'Edit Coupon' : 'New Offer'}</h3>
              <p className="text-brand-dark/40 font-bold mb-8">Define your promotional rules</p>

              <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40 ml-2">Coupon Code</label>
                  <input 
                    required
                    value={editingCoupon.code}
                    onChange={(e) => setEditingCoupon({...editingCoupon, code: e.target.value.toUpperCase()})}
                    placeholder="e.g. JOY10"
                    className="w-full p-4 bg-brand/5 rounded-2xl border-2 border-transparent focus:border-brand/20 outline-none font-bold text-brand-dark"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40 ml-2">Discount Type</label>
                  <div className="grid grid-cols-2 gap-2 bg-brand/5 p-1 rounded-2xl border-2 border-transparent">
                     <button 
                       type="button"
                       onClick={() => setEditingCoupon({...editingCoupon, type: 'percent'})}
                       className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${editingCoupon.type === 'percent' ? 'bg-white text-brand shadow-sm' : 'text-brand-dark/40'}`}
                     >
                       Percentage (%)
                     </button>
                     <button 
                       type="button"
                       onClick={() => setEditingCoupon({...editingCoupon, type: 'flat'})}
                       className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${editingCoupon.type === 'flat' ? 'bg-white text-brand shadow-sm' : 'text-brand-dark/40'}`}
                     >
                       Flat Amount (₹)
                     </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40 ml-2">Value</label>
                  <input 
                    required
                    type="number"
                    value={editingCoupon.value}
                    onChange={(e) => setEditingCoupon({...editingCoupon, value: parseFloat(e.target.value)})}
                    className="w-full p-4 bg-brand/5 rounded-2xl border-2 border-transparent focus:border-brand/20 outline-none font-bold text-brand-dark"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40 ml-2">Min Purchase Amount (Optional)</label>
                  <input 
                    type="number"
                    value={editingCoupon.min_order_amount || ''}
                    onChange={(e) => setEditingCoupon({...editingCoupon, min_order_amount: e.target.value ? parseFloat(e.target.value) : null})}
                    placeholder="₹ 0"
                    className="w-full p-4 bg-brand/5 rounded-2xl border-2 border-transparent focus:border-brand/20 outline-none font-bold text-brand-dark"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40 ml-2">Max Discount Cap (Optional)</label>
                  <input 
                    type="number"
                    value={editingCoupon.max_discount_cap || ''}
                    onChange={(e) => setEditingCoupon({...editingCoupon, max_discount_cap: e.target.value ? parseFloat(e.target.value) : null})}
                    placeholder="₹ No Limit"
                    className="w-full p-4 bg-brand/5 rounded-2xl border-2 border-transparent focus:border-brand/20 outline-none font-bold text-brand-dark"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40 ml-2">Total Usage Limit (Optional)</label>
                  <input 
                    type="number"
                    value={editingCoupon.max_uses || ''}
                    onChange={(e) => setEditingCoupon({...editingCoupon, max_uses: e.target.value ? parseInt(e.target.value) : null})}
                    placeholder="∞"
                    className="w-full p-4 bg-brand/5 rounded-2xl border-2 border-transparent focus:border-brand/20 outline-none font-bold text-brand-dark"
                  />
                </div>

                <div className="col-span-full space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40 ml-2">Description</label>
                  <textarea 
                    value={editingCoupon.description || ''}
                    onChange={(e) => setEditingCoupon({...editingCoupon, description: e.target.value})}
                    placeholder="Describe this offer..."
                    className="w-full p-4 bg-brand/5 rounded-2xl border-2 border-transparent focus:border-brand/20 outline-none font-bold text-brand-dark h-24 resize-none"
                  />
                </div>

                <div className="col-span-full space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40 ml-2">Excluded Categories</label>
                  <div className="flex flex-wrap gap-2 p-4 bg-brand/5 rounded-2xl min-h-[60px]">
                    {categories.map(cat => (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => {
                          const current = editingCoupon.excluded_categories || [];
                          const updated = current.includes(cat.name) 
                            ? current.filter(c => c !== cat.name)
                            : [...current, cat.name];
                          setEditingCoupon({...editingCoupon, excluded_categories: updated});
                        }}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${
                          (editingCoupon.excluded_categories || []).includes(cat.name)
                          ? 'bg-red-500 text-white border-red-600'
                          : 'bg-white text-brand-dark/40 border-brand/5 hover:border-brand/20'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-span-full flex items-center justify-between pt-6 border-t border-brand/5">
                  <div className="flex items-center gap-3">
                    <button 
                      type="button"
                      onClick={() => setEditingCoupon({...editingCoupon, active: !editingCoupon.active})}
                      className={`w-14 h-8 rounded-full transition-all relative ${editingCoupon.active ? 'bg-brand shadow-lg' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${editingCoupon.active ? 'left-7' : 'left-1'}`} />
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40">Status: {editingCoupon.active ? 'Active' : 'Inactive'}</span>
                  </div>

                  <Button3D type="submit" disabled={actionLoading} className="px-12 h-14 uppercase tracking-widest font-black">
                    {actionLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Coupon'}
                  </Button3D>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
