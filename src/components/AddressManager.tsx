import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { FloatingCard } from './ui/FloatingCard';
import { Button3D } from './ui/Button3D';
import { MapPin, Plus, Trash2, Home, Briefcase, Bookmark, Check, RefreshCw, Edit } from 'lucide-react';
import { useToastStore } from '../store/useToastStore';
import { useUserStore } from '../store/useUserStore';

interface Address {
  id: string;
  label: string;
  door_no: string;
  street: string;
  area: string;
  pincode: string;
  district: string;
  state: string;
  landmark?: string;
  is_default: boolean;
}

interface AddressManagerProps {
  onSelect?: (address: Address) => void;
  selectedId?: string;
}

export const AddressManager = ({ onSelect, selectedId }: AddressManagerProps) => {
  const { user } = useUserStore();
  const { addToast } = useToastStore();
  const [addresses, setAddresses] = useState<Address[]>([]);

  const fetchAddresses = async (userId: string) => {
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('profile_id', userId)
      .order('is_default', { ascending: false });
    if (data) setAddresses(data as Address[]);
  };

  useEffect(() => {
    if (user) {
      fetchAddresses(user.id);
    }
  }, [user]);
  
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  const handleEditClick = (addr: Address, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddressId(addr.id);
    setAddrLabel(addr.label);
    setDoorNo(addr.door_no);
    setStreet(addr.street);
    setArea(addr.area);
    setPincode(addr.pincode);
    setDistrict(addr.district);
    setLandmark(addr.landmark || '');
    setShowAddrForm(true);
  };

  // Form State
  const [addrLabel, setAddrLabel] = useState('Home');
  const [doorNo, setDoorNo] = useState('');
  const [street, setStreet] = useState('');
  const [area, setArea] = useState('');
  const [pincode, setPincode] = useState('');
  const [district, setDistrict] = useState('');
  const [landmark, setLandmark] = useState('');
  const [state] = useState('Tamil Nadu');
  const [postOffices, setPostOffices] = useState<string[]>([]);

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
      addToast('Please fill all required fields', 'info');
      return;
    }

    const pinRegex = /^[0-9]{6}$/;
    if (!pinRegex.test(pincode.trim())) {
      addToast('Please enter a valid 6-digit Pincode', 'error');
      return;
    }

    setLoading(true);
    try {
      if (editingAddressId) {
        const { error } = await (supabase
          .from('addresses') as any)
          .update({
            label: addrLabel,
            door_no: doorNo.trim(),
            street: street.trim(),
            area: area.trim(),
            pincode: pincode.trim(),
            district: district.trim(),
            landmark: landmark.trim() || null,
          })
          .eq('id', editingAddressId);

        if (error) throw error;
        addToast('Address updated successfully!', 'sweet');
      } else {
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

        const { error } = await (supabase.from('addresses') as any).insert({
          profile_id: user.id,
          label: addrLabel,
          door_no: doorNo.trim(),
          street: street.trim(),
          area: area.trim(),
          pincode: pincode.trim(),
          district: district.trim(),
          state,
          landmark: landmark.trim() || null,
          is_default: addresses.length === 0
        });

        if (error) throw error;
        addToast('New address added!', 'sweet');
      }
      
      setShowAddrForm(false);
      resetAddrForm();
      await fetchAddresses(user.id);
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetAddrForm = () => {
    setEditingAddressId(null);
    setAddrLabel('Home');
    setDoorNo('');
    setStreet('');
    setArea('');
    setPincode('');
    setDistrict('');
    setLandmark('');
    setPostOffices([]);
  };

  const deleteAddress = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (!window.confirm('Remove this address?')) return;
    try {
      const { error } = await (supabase.from('addresses') as any).delete().eq('id', id);
      if (error) throw error;
      addToast('Address removed', 'sweet');
      fetchAddresses(user.id);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const setDefaultAddress = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const { error } = await (supabase.from('addresses') as any).update({ is_default: true }).eq('id', id);
      if (error) throw error;
      fetchAddresses(user.id);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="heading-serif text-2xl text-brand-dark px-2">Delivery Addresses</h3>
        {addresses.length < 5 && !showAddrForm && (
          <button 
            onClick={() => setShowAddrForm(true)}
            className="flex items-center gap-2 bg-brand text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md hover:scale-105 transition-all"
          >
            <Plus size={16} /> Add New
          </button>
        )}
      </div>

      <AnimatePresence>
        {showAddrForm && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            <FloatingCard className="!p-8 bg-brand/5 border-2 border-brand/10">
              <div className="flex justify-between items-center mb-6">
                <p className="text-xs font-black uppercase tracking-widest text-brand">{editingAddressId ? 'Edit Delivery Point' : 'New Delivery Point'}</p>
                <button onClick={() => { setShowAddrForm(false); resetAddrForm(); }} className="text-brand-dark/40 hover:text-brand transition-colors"><Trash2 size={20}/></button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2">Label (Home, Office...)</label>
                   <div className="flex gap-2">
                     {['Home', 'Office', 'Other'].map(l => (
                       <button key={l} type="button" onClick={() => setAddrLabel(l)} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border-2 transition-all ${addrLabel === l ? 'bg-brand text-white border-brand' : 'bg-white text-brand-dark/40 border-brand/5'}`}>{l}</button>
                     ))}
                   </div>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2">Door / Flat No</label>
                   <input value={doorNo} onChange={e => setDoorNo(e.target.value)} placeholder="Ex: 42, Green Villa" className="w-full h-12 bg-white rounded-xl px-4 outline-none font-bold text-sm border-2 border-transparent focus:border-brand shadow-sm" />
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                 <div className="space-y-2 md:col-span-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2">Street / Colony</label>
                   <input value={street} onChange={e => setStreet(e.target.value)} placeholder="Main Road, Layout Name" className="w-full h-12 bg-white rounded-xl px-4 outline-none font-bold text-sm border-2 border-transparent focus:border-brand shadow-sm" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2">Pincode (Auto-fills)</label>
                   <input value={pincode} onChange={e => handlePincodeChange(e.target.value)} maxLength={6} placeholder="641001" className="w-full h-12 bg-white rounded-xl px-4 outline-none font-black text-sm border-2 border-transparent focus:border-brand shadow-sm text-brand" />
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2">Area / Post Office</label>
                   <input 
                     list="profile-areas"
                     value={area} 
                     onChange={e => setArea(e.target.value)} 
                     placeholder="R.S. Puram" 
                     className="w-full h-12 bg-white rounded-xl px-4 outline-none font-bold text-sm border-2 border-transparent focus:border-brand shadow-sm" 
                   />
                   <datalist id="profile-areas">
                     {postOffices.map((po) => (
                       <option key={po} value={po} />
                     ))}
                   </datalist>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2">District</label>
                   <input value={district} readOnly className="w-full h-12 bg-brand/5 rounded-xl px-4 outline-none font-bold text-sm text-brand-dark/40" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2">Landmark (Optional)</label>
                   <input value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="Opp. Baker Street" className="w-full h-12 bg-white rounded-xl px-4 outline-none font-bold text-sm border-2 border-transparent focus:border-brand shadow-sm" />
                 </div>
              </div>

              <div className="mt-8 flex gap-4">
                <Button3D variant="outline" className="flex-1 !h-12 text-[10px]" onClick={() => { setShowAddrForm(false); resetAddrForm(); }}>Cancel</Button3D>
                <Button3D className="flex-[2] !h-12 text-[10px]" onClick={handleSaveAddress} disabled={loading}>
                  {loading ? <RefreshCw className="animate-spin" size={16} /> : (editingAddressId ? 'Update Address' : 'Save Address')}
                </Button3D>
              </div>
            </FloatingCard>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {addresses.map(addr => (
          <div 
            key={addr.id} 
            onClick={() => onSelect?.(addr as Address)}
            className={`p-6 rounded-[2.5rem] border transition-all cursor-pointer relative group ${
              selectedId === addr.id 
                ? 'bg-brand/5 border-brand ring-2 ring-brand/20 shadow-deep scale-[1.02]' 
                : 'bg-white border-brand/5 shadow-soft hover:shadow-medium hover:border-brand/10'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl text-brand ${addr.label === 'Home' ? 'bg-blue-50' : addr.label === 'Office' ? 'bg-orange-50' : 'bg-purple-50'}`}>
                {addr.label === 'Home' ? <Home size={20}/> : addr.label === 'Office' ? <Briefcase size={20}/> : <Bookmark size={20}/>}
              </div>
              <div className="flex gap-2">
                 <button onClick={(e) => handleEditClick(addr, e)} className="p-2 text-brand-dark/20 hover:text-brand transition-colors" title="Edit"><Edit size={18}/></button>
                 {!addr.is_default && (
                   <button onClick={(e) => setDefaultAddress(addr.id, e)} className="p-2 text-brand-dark/20 hover:text-green-500 transition-colors" title="Set Default"><Check size={18}/></button>
                 )}
                 <button onClick={(e) => deleteAddress(addr.id, e)} className="p-2 text-brand-dark/20 hover:text-red-500 transition-colors" title="Delete"><Trash2 size={18}/></button>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                 <p className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30">{addr.label}</p>
                 {addr.is_default && <span className="text-[7px] font-black uppercase tracking-widest bg-brand text-white px-1.5 py-0.5 rounded-full">Primary</span>}
              </div>
              <p className="font-bold text-brand-dark leading-relaxed text-sm">
                {addr.door_no}, {addr.street}, {addr.area}<br/>
                {addr.district} - {addr.pincode}
              </p>
              {addr.landmark && <p className="text-[10px] font-bold text-brand/60 mt-2 flex items-center gap-1"><MapPin size={10}/> {addr.landmark}</p>}
            </div>
            
            {selectedId === addr.id && (
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-in zoom-in duration-300">
                 <Check size={18} />
              </div>
            )}
          </div>
        ))}
        {addresses.length === 0 && !showAddrForm && (
          <div className="col-span-full py-20 bg-white/40 rounded-[3rem] border-2 border-dashed border-brand/10 flex flex-col items-center justify-center gap-4 opacity-40 italic">
            <MapPin size={48} />
            <p className="font-bold uppercase tracking-widest">No Addresses Saved Yet</p>
          </div>
        )}
      </div>
    </div>
  );
};
