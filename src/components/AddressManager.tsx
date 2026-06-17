import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { FloatingCard } from './ui/FloatingCard';
import { Button3D } from './ui/Button3D';
import { MapPin, Plus, Trash2, Home, Briefcase, Bookmark, Check, RefreshCw, Edit } from 'lucide-react';
import { useToastStore } from '../store/useToastStore';
import { useUserStore } from '../store/useUserStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const cleanLandmark = (landmark: string | null) => {
  if (!landmark) return '';
  return landmark.replace(/\s*\[coords:\s*[-+]?[0-9]*\.?[0-9]+,\s*[-+]?[0-9]*\.?[0-9]+\]/, '');
};

const extractCoords = (landmark: string | null) => {
  if (!landmark) return null;
  const match = landmark.match(/\[coords:\s*([-+]?[0-9]*\.?[0-9]+),\s*([-+]?[0-9]*\.?[0-9]+)\]/);
  if (match) {
    return {
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2])
    };
  }
  return null;
};

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], map.getZoom());
      setTimeout(() => map.invalidateSize(), 100);
    }
  }, [lat, lng, map]);
  return null;
}

function MapEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function DraggableMarker({ position, onDragEnd }: { position: [number, number]; onDragEnd: (lat: number, lng: number) => void }) {
  const markerRef = useRef<any>(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latLng = marker.getLatLng();
          onDragEnd(latLng.lat, latLng.lng);
        }
      },
    }),
    [onDragEnd]
  );

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={DefaultIcon}
    />
  );
}

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
  const { getSetting } = useSettingsStore();
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

  const handleEditClick = async (addr: Address, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddressId(addr.id);
    setAddrLabel(addr.label);
    setDoorNo(addr.door_no);
    setStreet(addr.street);
    setArea(addr.area);
    setPincode(addr.pincode);
    setDistrict(addr.district);
    setShowAddrForm(true);

    const coords = extractCoords(addr.landmark || null);
    if (coords) {
      setLandmark(cleanLandmark(addr.landmark || null));
      setMapPosition([coords.lat, coords.lng]);
      setShowMapPicker(true);
    } else {
      setLandmark(addr.landmark || '');
      try {
        const city = getSetting('address_city', 'Coimbatore');
        const queryStr = `${addr.street}, ${addr.area}, ${city}, ${addr.pincode}`;
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}&limit=1`
        );
        const data = await response.json();
        if (data && data[0]) {
          setMapPosition([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
          setShowMapPicker(true);
        }
      } catch (e) {
        console.warn('Geocoding edit address failed for map initialization:', e);
      }
    }
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

  // Search & Map Picker states
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [mapPosition, setMapPosition] = useState<[number, number] | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const handleLocationSearch = async (query: string) => {
    setAddressSearchQuery(query);
    if (query.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    setSearchingLocation(true);
    try {
      const city = getSetting('address_city', 'Coimbatore');
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city + ', ' + query)}&limit=5&addressdetails=1`
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (e) {
      console.error('Geocoding search error:', e);
    } finally {
      setSearchingLocation(false);
    }
  };

  const handleSelectLocationResult = (result: any) => {
    const addr = result.address || {};
    const streetName = addr.road || addr.suburb || addr.neighbourhood || '';
    const areaName = addr.suburb || addr.village || addr.city_district || '';
    const postalCode = addr.postcode || '';
    const dist = addr.district || addr.city || 'Coimbatore';
    
    setStreet(streetName);
    setArea(areaName || result.name || '');
    setPincode(postalCode);
    setDistrict(dist);
    
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    setMapPosition([lat, lon]);
    setShowMapPicker(true);
    
    setSearchResults([]);
    setAddressSearchQuery(result.display_name);
  };

  const handleShowMapPickerDirectly = () => {
    const studioLat = parseFloat(getSetting('latitude', '11.0168'));
    const studioLng = parseFloat(getSetting('longitude', '76.9558'));
    setMapPosition([studioLat, studioLng]);
    setShowMapPicker(true);
    handleMapLocationSelect(studioLat, studioLng);
  };

  const handleMapLocationSelect = async (lat: number, lng: number) => {
    setMapPosition([lat, lng]);
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      if (response.ok) {
        const result = await response.json();
        const addr = result.address || {};
        const streetName = addr.road || addr.suburb || addr.neighbourhood || '';
        const areaName = addr.suburb || addr.village || addr.city_district || '';
        const postalCode = addr.postcode || '';
        const dist = addr.district || addr.city || 'Coimbatore';
        
        setStreet(streetName);
        setArea(areaName || result.name || '');
        setPincode(postalCode);
        setDistrict(dist);
        setAddressSearchQuery(result.display_name || 'Selected Pin Location');
      }
    } catch (e) {
      console.error('Reverse geocoding error:', e);
    }
  };

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
      const landmarkWithCoords = mapPosition 
        ? `${landmark.trim() ? landmark.trim() + ' ' : ''}[coords: ${mapPosition[0]}, ${mapPosition[1]}]` 
        : landmark.trim() || null;

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
            landmark: landmarkWithCoords,
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
          landmark: landmarkWithCoords,
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
    setAddressSearchQuery('');
    setSearchResults([]);
    setMapPosition(null);
    setShowMapPicker(false);
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

              {/* Location Search Input */}
              <div className="space-y-2 relative z-30 mb-6">
                <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2">Search Location / Street Name</label>
                <input
                  type="text"
                  value={addressSearchQuery}
                  onChange={(e) => handleLocationSearch(e.target.value)}
                  placeholder="Start typing your street or area..."
                  className="w-full h-12 bg-white rounded-xl px-4 outline-none font-bold text-sm border border-brand/10 focus:border-brand/40 shadow-sm text-brand-dark placeholder:normal-case placeholder:font-semibold placeholder:text-brand-dark/45"
                />
                
                {searchingLocation && (
                  <div className="absolute right-4 top-9">
                    <RefreshCw className="animate-spin text-brand/60" size={18} />
                  </div>
                )}

                {/* Search Results Autocomplete Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-brand/10 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto pr-1 no-scrollbar divide-y divide-brand/5">
                    {searchResults.map((result, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectLocationResult(result)}
                        className="p-3 text-xs font-semibold text-brand-dark/80 hover:bg-brand/5 cursor-pointer transition-colors leading-normal"
                      >
                        {result.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Map Picker Toggle & Container */}
              <div className="space-y-2 relative z-20 mb-6">
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={showMapPicker ? () => setShowMapPicker(false) : handleShowMapPickerDirectly}
                    className="text-[10px] font-black uppercase tracking-widest text-brand hover:underline flex items-center gap-1"
                  >
                    📍 {showMapPicker ? 'Hide Map Picker' : 'Select / Pin on Map'}
                  </button>
                </div>

                {showMapPicker && mapPosition && (
                  <div className="w-full h-48 rounded-2xl overflow-hidden border border-brand/20 shadow-inner relative z-10">
                    <MapContainer
                      center={mapPosition}
                      zoom={15}
                      scrollWheelZoom={false}
                      className="h-full w-full"
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <DraggableMarker
                        position={mapPosition}
                        onDragEnd={handleMapLocationSelect}
                      />
                      <MapEvents onMapClick={handleMapLocationSelect} />
                      <RecenterMap lat={mapPosition[0]} lng={mapPosition[1]} />
                    </MapContainer>
                    <div className="absolute bottom-2 left-2 right-2 bg-white/95 px-2 py-1 rounded-lg text-[8px] font-bold text-brand-dark/70 border border-brand/10 shadow-sm pointer-events-none text-center">
                      💡 Click map or drag pin to select your exact location
                    </div>
                  </div>
                )}
              </div>

              {/* Separator */}
              <div className="relative flex py-2 items-center z-10 mb-6">
                <div className="flex-grow border-t border-brand/10"></div>
                <span className="flex-shrink mx-3 text-[9px] font-black uppercase tracking-widest text-brand-dark/30">Confirm Address Details</span>
                <div className="flex-grow border-t border-brand/10"></div>
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
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2">Door / Flat No <span className="text-red-500 font-bold">*</span></label>
                    <input value={doorNo} onChange={e => setDoorNo(e.target.value)} placeholder="Ex: 42, Green Villa" className="w-full h-12 bg-white rounded-xl px-4 outline-none font-bold text-sm border-2 border-transparent focus:border-brand shadow-sm" />
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                 <div className="space-y-2 md:col-span-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2">Street / Colony <span className="text-red-500 font-bold">*</span></label>
                   <input value={street} onChange={e => setStreet(e.target.value)} placeholder="Main Road, Layout Name" className="w-full h-12 bg-white rounded-xl px-4 outline-none font-bold text-sm border-2 border-transparent focus:border-brand shadow-sm" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2">Pincode <span className="text-red-500 font-bold">*</span></label>
                   <input value={pincode} onChange={e => handlePincodeChange(e.target.value)} maxLength={6} placeholder="641001" className="w-full h-12 bg-white rounded-xl px-4 outline-none font-black text-sm border-2 border-transparent focus:border-brand shadow-sm text-brand" />
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2">Area / Post Office <span className="text-red-500 font-bold">*</span></label>
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
              {cleanLandmark(addr.landmark || null) && <p className="text-[10px] font-bold text-brand/60 mt-2 flex items-center gap-1"><MapPin size={10}/> {cleanLandmark(addr.landmark || null)}</p>}
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
