import { useState, useEffect, useMemo, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, Plus, Minus, Trash2, ArrowLeft, Send, CheckCircle2, Check, RefreshCw, Edit, Ticket, Clock, MapPin } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useUserStore } from '../store/useUserStore';
import { useToastStore } from '../store/useToastStore';
import { useProductStore } from '../store/useProductStore';
import { Button3D } from './ui/Button3D';
import { supabase } from '../lib/supabase';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

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

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer = ({ isOpen, onClose }: CartDrawerProps) => {
  const { items, removeItem, clearCart, updateQuantity } = useCartStore();
  const { getSetting } = useSettingsStore();
  const { user, profile } = useUserStore();
  const { addToast } = useToastStore();

  const [step, setStep] = useState<'cart' | 'checkout' | 'upi_payment' | 'success'>('cart');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType] = useState<'pickup' | 'delivery'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi'>('upi');
  const [deliveryTimeRange, setDeliveryTimeRange] = useState<'standard' | 'evening' | 'weekend'>('standard');
  
  // Delivery distance zone selection state: 'local' (<= 8km) or 'domestic' (> 8km)
  const [distanceMode, setDistanceMode] = useState<'local' | 'domestic'>('local');
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);

  // Address search auto-complete states
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [mapPosition, setMapPosition] = useState<[number, number] | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Helper to compute straight-line distance if ORS is down
  const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

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

  const calculateRouteDistance = async (userLat: number, userLng: number) => {
    setCalculatingDistance(true);
    try {
      const studioLat = parseFloat(getSetting('latitude', '11.0168'));
      const studioLng = parseFloat(getSetting('longitude', '76.9558'));
      
      const straightLineKm = getHaversineDistance(studioLat, studioLng, userLat, userLng);
      
      // If the straight-line distance is extremely close (e.g. less than 150 meters),
      // we consider it at the store / 0km distance to avoid routing snap loops.
      if (straightLineKm < 0.15) {
        setCalculatedDistance(0);
        setDistanceMode('local');
        return;
      }
      
      const apiKey = getSetting('openrouteservice_api_key', '5b3ce3597851110001cf6248d28dbd6d97c34b17bc582496a79893d1'); 
      const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${studioLng},${studioLat}&end=${userLng},${userLat}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const distanceKm = data.features[0].properties.summary.distance / 1000;
        setCalculatedDistance(distanceKm);
        setDistanceMode(distanceKm <= 8 ? 'local' : 'domestic');
      } else {
        throw new Error('ORS API request failed');
      }
    } catch (e) {
      console.warn('Failed to get ORS route distance, falling back to Haversine:', e);
      const studioLat = parseFloat(getSetting('latitude', '11.0168'));
      const studioLng = parseFloat(getSetting('longitude', '76.9558'));
      const straightLineKm = getHaversineDistance(studioLat, studioLng, userLat, userLng);
      const routeKm = straightLineKm * 1.3;
      setCalculatedDistance(routeKm);
      setDistanceMode(routeKm <= 8 ? 'local' : 'domestic');
    } finally {
      setCalculatingDistance(false);
    }
  };

  const selectAddress = async (addr: any) => {
    setSelectedAddressId(addr.id);
    const cleanedLandmark = cleanLandmark(addr.landmark);
    const addressStr = `${addr.door_no}, ${addr.street}, ${addr.area}, ${addr.district} - ${addr.pincode}${cleanedLandmark ? ` (Landmark: ${cleanedLandmark})` : ''}`;
    setDeliveryAddress(addressStr);
    
    setCalculatingDistance(true);
    try {
      const coords = extractCoords(addr.landmark);
      if (coords) {
        await calculateRouteDistance(coords.lat, coords.lng);
      } else {
        let lat: number | null = null;
        let lon: number | null = null;
        
        const city = addr.district || getSetting('address_city', 'Coimbatore');
        
        // Try Option A: Street, Area, City, Pincode
        const queryStr = `${addr.street}, ${addr.area}, ${city}, ${addr.pincode}`;
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}&limit=1`
        );
        const data = await response.json();
        if (data && data[0]) {
          lat = parseFloat(data[0].lat);
          lon = parseFloat(data[0].lon);
        } else {
          // Try Option B: Area, City
          const fallbackQuery1 = `${addr.area}, ${city}`;
          const fallbackResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackQuery1)}&limit=1`
          );
          const fallbackData = await fallbackResponse.json();
          if (fallbackData && fallbackData[0]) {
            lat = parseFloat(fallbackData[0].lat);
            lon = parseFloat(fallbackData[0].lon);
          } else {
            // Try Option C: Pincode, India (Extremely reliable fallback)
            const fallbackQuery2 = `${addr.pincode}, India`;
            const fallbackResponse = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackQuery2)}&limit=1`
            );
            const fallbackData = await fallbackResponse.json();
            if (fallbackData && fallbackData[0]) {
              lat = parseFloat(fallbackData[0].lat);
              lon = parseFloat(fallbackData[0].lon);
            }
          }
        }
        
        if (lat !== null && lon !== null) {
          await calculateRouteDistance(lat, lon);
        } else {
          throw new Error('All geocoding fallbacks failed');
        }
      }
    } catch (e) {
      console.warn('Geocoding saved address failed, using default fallback based on pincode:', e);
      const isCoimbatorePin = addr.pincode && addr.pincode.startsWith('641');
      if (isCoimbatorePin) {
        setCalculatedDistance(5);
        setDistanceMode('local');
      } else {
        setCalculatedDistance(200); // 200 km default for out-of-city to trigger domestic Shipping
        setDistanceMode('domestic');
      }
    } finally {
      setCalculatingDistance(false);
    }
  };

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
    
    calculateRouteDistance(lat, lon);
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
    calculateRouteDistance(lat, lng);
    
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

  // Local calculation of total amount to fix calculation errors
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const mrpTotal = items.reduce((sum, item) => sum + Math.round(item.price * 1.3) * item.quantity, 0);
  const mrpDiscount = mrpTotal - total;

  // Parse total weight of items in cart
  const totalWeightGrams = items.reduce((sum, item) => {
    const qty = item.quantity || 1;
    const name = item.name || '';
    const weight = (() => {
      if (name.toLowerCase().includes('kg')) {
        const parsed = parseFloat(name.split('(').pop() || '');
        return isNaN(parsed) ? 1000 : parsed * 1000;
      } else if (name.toLowerCase().includes('g')) {
        const match = name.match(/\((\d+(?:\.\d+)?)\s*g\)/i);
        if (match) return parseFloat(match[1]);
        const simpleMatch = name.match(/(\d+(?:\.\d+)?)\s*g/i);
        if (simpleMatch) return parseFloat(simpleMatch[1]);
        return 250;
      }
      return 250; // default to 250g if not specified
    })();
    return sum + weight * qty;
  }, 0);

  // Calculate dynamic delivery fee
  const getDeliveryFee = () => {
    if (deliveryType !== 'delivery') return 0;
    const isAbove399 = total > 399;
    
    if (distanceMode === 'local') {
      const isEligibleForFree = isAbove399 && (deliveryTimeRange === 'evening' || deliveryTimeRange === 'weekend');
      return isEligibleForFree ? 0 : 100;
    } else {
      // 60rs for 500gm, 120rs for 1kg and so on
      return Math.ceil(totalWeightGrams / 500) * 60;
    }
  };
  const deliveryFee = getDeliveryFee();

  // Coupons / Promo state
  const [coupons, setCoupons] = useState<any[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [showCouponModal, setShowCouponModal] = useState(false);

  // Load products list to calculate category-specific discounts
  const { products } = useProductStore();

  // Reactive discount calculator
  const discount = appliedCoupon ? (() => {
    if (appliedCoupon.min_order_amount && total < appliedCoupon.min_order_amount) return 0;
    
    let discountableSubtotal = total;
    if (appliedCoupon.applicable_category) {
      discountableSubtotal = items.reduce((sum, item) => {
        const prod = products.find(p => p.id === item.id);
        if (prod && prod.category === appliedCoupon.applicable_category) {
          return sum + item.price * item.quantity;
        }
        return sum;
      }, 0);
    }
    
    if (appliedCoupon.excluded_categories && appliedCoupon.excluded_categories.length > 0) {
      const eligibleSubtotal = items.reduce((sum, item) => {
        const prod = products.find(p => p.id === item.id);
        if (prod && !appliedCoupon.excluded_categories.includes(prod.category)) {
          return sum + item.price * item.quantity;
        }
        return sum;
      }, 0);
      discountableSubtotal = Math.min(discountableSubtotal, eligibleSubtotal);
    }

    if (discountableSubtotal <= 0) return 0;

    let calcDiscount;
    if (appliedCoupon.type === 'percent') {
      calcDiscount = discountableSubtotal * (appliedCoupon.value / 100);
      if (appliedCoupon.max_discount_cap) {
        calcDiscount = Math.min(calcDiscount, appliedCoupon.max_discount_cap);
      }
    } else {
      calcDiscount = appliedCoupon.value;
    }
    
    return Math.min(Math.round(calcDiscount), total);
  })() : 0;

  // User addresses state
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

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
  const whatsappNumber = getSetting('whatsapp_number', '+917695964392');

  const fetchUserAddresses = async (userId: string, selectId?: string) => {
    const { data } = await (supabase
      .from('addresses') as any)
      .select('*')
      .eq('profile_id', userId)
      .order('is_default', { ascending: false });
    if (data) {
      setAddresses(data);
      const targetAddr = selectId 
        ? data.find((a: any) => a.id === selectId) 
        : (data.find((a: any) => a.is_default) || data[0]);
      if (targetAddr) {
        await selectAddress(targetAddr);
      } else {
        setSelectedAddressId('');
        setDeliveryAddress('');
        setCalculatedDistance(null);
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

      // Fetch active coupons
      const fetchCoupons = async () => {
        try {
          const { data } = await supabase
            .from('coupons')
            .select('*')
            .eq('active', true);
          if (data) {
            setCoupons(data);
          }
        } catch (err) {
          console.error('Error fetching active coupons:', err);
        }
      };
      fetchCoupons();
    }
  }, [isOpen, user, profile]);

  // Freeze background body scrolling when the drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Re-evaluate applied coupon if cart items or total changes
  useEffect(() => {
    if (appliedCoupon) {
      const minAmount = appliedCoupon.min_order_amount || 0;
      const hasEligibleItems = !appliedCoupon.applicable_category || items.some(item => {
        const prod = products.find(p => p.id === item.id);
        return prod?.category === appliedCoupon.applicable_category;
      });

      if (total < minAmount || !hasEligibleItems || items.length === 0) {
        setAppliedCoupon(null);
        addToast('Coupon invalidated due to cart changes.', 'error');
      }
    }
  }, [items, total, appliedCoupon]);

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

  const handleEditClick = async (addr: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddressId(addr.id);
    setAddrLabel(addr.label);
    setDoorNo(addr.door_no);
    setStreet(addr.street);
    setArea(addr.area);
    setPincode(addr.pincode);
    setDistrict(addr.district || 'Coimbatore');
    setShowAddrForm(true);

    const coords = extractCoords(addr.landmark);
    if (coords) {
      setLandmark(cleanLandmark(addr.landmark));
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
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          setMapPosition([lat, lon]);
          setShowMapPicker(true);
        }
      } catch (e) {
        console.warn('Geocoding edit address failed for map initialization:', e);
      }
    }
  };

  const handleCancelAddress = () => {
    setEditingAddressId(null);
    setDoorNo('');
    setStreet('');
    setArea('');
    setPincode('');
    setDistrict('');
    setLandmark('');
    setAddrLabel('Home');
    setPostOffices([]);
    setAddressSearchQuery('');
    setSearchResults([]);
    setShowAddrForm(false);
    setMapPosition(null);
    setShowMapPicker(false);
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
            district: district.trim() || 'Coimbatore',
            landmark: landmarkWithCoords,
          })
          .eq('id', editingAddressId);

        if (error) throw error;
        addToast('Address updated!', 'sweet');

        const savedId = editingAddressId;
        handleCancelAddress();
        await fetchUserAddresses(user.id, savedId);
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
            landmark: landmarkWithCoords,
            is_default: addresses.length === 0
          }])
          .select()
          .single();

        if (error) throw error;

        addToast('New address added!', 'sweet');

        const savedId = data.id;
        handleCancelAddress();
        await fetchUserAddresses(user.id, savedId);
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to save address', 'error');
    } finally {
      setSavingAddress(false);
    }
  };



  const handleQtyChange = (itemId: string, currentQty: number, delta: number) => {
    const nextQty = currentQty + delta;
    if (nextQty <= 0) {
      removeItem(itemId);
    } else {
      updateQuantity(itemId, nextQty);
    }
  };

  const handleApplyPromoCode = (codeToApply?: string): boolean => {
    const code = codeToApply || promoCode;
    if (!code.trim()) {
      addToast('Please enter a promo code.', 'error');
      return false;
    }
    
    const coupon = coupons.find(c => c.code.toUpperCase() === code.trim().toUpperCase());
    
    if (!coupon) {
      addToast('Invalid promo code. Please try another one.', 'error');
      return false;
    }
    
    if (!coupon.active) {
      addToast('This coupon is no longer active.', 'error');
      return false;
    }
    
    const minAmount = coupon.min_order_amount || 0;
    if (total < minAmount) {
      addToast(`This coupon requires a minimum order amount of ₹${minAmount}.`, 'error');
      return false;
    }
    
    if (coupon.applicable_category) {
      const hasEligibleItems = items.some(item => {
        const prod = products.find(p => p.id === item.id);
        return prod?.category === coupon.applicable_category;
      });
      if (!hasEligibleItems) {
        addToast(`This coupon is only applicable to products in the ${coupon.applicable_category} category.`, 'error');
        return false;
      }
    }
    
    if (coupon.excluded_categories && coupon.excluded_categories.length > 0) {
      const allExcluded = items.every(item => {
        const prod = products.find(p => p.id === item.id);
        return prod && coupon.excluded_categories.includes(prod.category);
      });
      if (allExcluded) {
        addToast(`This coupon cannot be applied to items in the excluded categories.`, 'error');
        return false;
      }
    }
    
    setAppliedCoupon(coupon);
    setPromoCode(coupon.code);
    addToast(`Coupon "${coupon.code}" applied!`, 'sweet');
    return true;
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setPromoCode('');
    addToast('Coupon removed.', 'sweet');
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      addToast('Please log in to place an order. Both email and WhatsApp number must be verified.', 'error');
      return;
    }
    if (!profile?.email_verified || !profile?.mobile_verified) {
      addToast('Both your email and WhatsApp number must be verified to place storefront orders. Please check your profile.', 'error');
      return;
    }
    
    if (addresses.length === 0) {
      addToast('Please add at least one address to proceed to checkout.', 'error');
      return;
    }

    if (!customerName.trim()) {
      addToast('Please enter your name', 'error');
      return;
    }
    if (!customerPhone.trim() || customerPhone.length < 10) {
      addToast('Please enter a valid phone number', 'error');
      return;
    }
    if (deliveryType === 'delivery') {
      if (!deliveryAddress.trim()) {
        addToast('Please enter a delivery address', 'error');
        return;
      }
      if (calculatingDistance) {
        addToast('Please wait while we calculate the delivery distance...', 'error');
        return;
      }
      if (calculatedDistance === null) {
        addToast('Could not calculate delivery distance. Please verify your address details.', 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const addressVal = deliveryType === 'pickup' ? 'Store Pickup' : deliveryAddress;

      // Generate custom Order ID client-side
      const todayStr = new Date().toISOString().split('T')[0];
      const prefix = 'SFOID';
      
      const { count } = await (supabase.from('orders') as any)
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${todayStr}T00:00:00Z`)
        .lt('created_at', `${todayStr}T23:59:59Z`);
        
      const seq = String((count || 0) + 1).padStart(4, '0');
      const displayId = `JOJ-${prefix}-${todayStr}-${seq}`;
      const finalTotal = total - discount + deliveryFee;

      // Insert order directly
      const { data: orderData, error: orderError } = await (supabase.from('orders') as any)
        .insert([{
          user_id: user?.id || null,
          customer_name: customerName,
          customer_phone: customerPhone,
          address: addressVal,
          items: items.map(item => ({ id: item.id, quantity: item.quantity })),
          total: finalTotal,
          subtotal: total,
          discount_amount: discount,
          coupon_code: appliedCoupon ? appliedCoupon.code : null,
          delivery_charge: deliveryFee,
          status: 'pending',
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'upi' ? 'verification_pending' : 'pending',
          order_source: 'website',
          delivery_type: deliveryType,
          display_id: displayId,
          metadata: { 
            display_id: displayId,
            ...(deliveryTimeRange ? { delivery_time_range: deliveryTimeRange } : {})
          }
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert order items directly
      const orderItems = items.map((item) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUuid = uuidRegex.test(item.id);
        
        return {
          order_id: (orderData as any).id,
          product_id: isValidUuid ? item.id : null,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity
        };
      });

      const { error: itemsError } = await (supabase.from('order_items') as any).insert(orderItems);
      if (itemsError) throw itemsError;

      // Send Telegram alert if UPI payment
      if (paymentMethod === 'upi') {
        try {
          const { data: botTokenData } = await (supabase
            .from('site_content') as any)
            .select('value')
            .eq('key', 'telegram_bot_token')
            .maybeSingle();
            
          const { data: chatIdData } = await (supabase
            .from('site_content') as any)
            .select('value')
            .eq('key', 'telegram_chat_id')
            .maybeSingle();

          const token = (botTokenData as any)?.value;
          const chatId = (chatIdData as any)?.value;

          if (token && chatId) {
            const msg = `🔔 <b>New UPI Payment Pending</b>\n\n<b>Order ID:</b> ${displayId}\n<b>Name:</b> ${customerName}\n<b>Phone:</b> ${customerPhone}\n<b>Amount:</b> ₹${finalTotal}\n\nPlease confirm this payment in the Admin Orders panel.`;
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: msg,
                parse_mode: 'HTML'
              })
            });
          }
        } catch (tErr) {
          console.error('Failed to send Telegram alert:', tErr);
        }
      }

      setPlacedOrderId((orderData as any).metadata?.display_id || (orderData as any).id);
      if (paymentMethod === 'upi') {
        setStep('upi_payment');
      } else {
        setStep('success');
        clearCart();
        addToast('Order placed successfully!', 'sweet');
      }
      addToast('Order placed successfully!', 'sweet');
    } catch (err: any) {
      addToast(err.message || 'Failed to place order', 'error');
    } finally {
      setSubmitting(false);
    }

  };

  const handleWhatsAppRedirect = () => {
    const orderIdShort = placedOrderId.startsWith('JOJ') ? placedOrderId : placedOrderId.slice(0, 8).toUpperCase();
    const itemsDetails = items
      .map((item) => `• ${item.name} (x${item.quantity}) - ₹${item.price * item.quantity}`)
      .join('\n');

    const addressVal = deliveryType === 'pickup' ? 'Store Pickup' : deliveryAddress;

    let discountDetails = '';
    if (appliedCoupon && discount > 0) {
      discountDetails = `*Subtotal:* ₹${total}\n*Coupon Applied:* ${appliedCoupon.code} (- ₹${discount})\n`;
    }

    let deliveryDetails;
    if (deliveryType === 'delivery') {
      deliveryDetails = `*Delivery Charge:* ${deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`} (${distanceMode === 'local' ? 'Porter/Self <= 8km' : 'Shiprocket > 8km'})\n`;
    } else {
      deliveryDetails = `*Delivery Charge:* Store Pickup (Free)\n`;
    }

    const message = `🍯 *New Storefront Order placed!*\n\n` +
      `*Order ID:* #INV-${orderIdShort}\n` +
      `*Customer Name:* ${customerName}\n` +
      `*Phone:* ${customerPhone}\n` +
      `*Delivery Type:* ${deliveryType === 'pickup' ? 'Pickup 🏪' : 'Home Delivery 🚚'}\n` +
      `*Address:* ${addressVal}\n\n` +
      `*Items Ordered:*\n${itemsDetails}\n\n` +
      discountDetails +
      deliveryDetails +
      `*Total Amount:* ₹${total - discount + deliveryFee}\n\n` +
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
            className="fixed right-0 top-0 h-full w-full max-w-md bg-gradient-to-b from-[#FFF5F7] to-white z-[200] p-6 sm:p-8 flex flex-col shadow-luxury border-l border-brand/5 overflow-hidden"
          >
            {/* Morphing settle background decorations */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(253,232,236,0.5)_0%,transparent_60%)] pointer-events-none" />

            {/* Header section */}
            <div className="flex justify-between items-center pb-4 border-b border-brand/10 relative z-10 shrink-0">
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
                      <>
                        {/* Free Delivery Progress Banner */}
                        {deliveryType === 'delivery' && distanceMode === 'local' && (
                          <div className="bg-gradient-to-r from-brand/10 to-brand/5 p-4 rounded-3xl border border-brand/10 shadow-sm relative overflow-hidden mb-2 animate-fade-in">
                            {total < 399 ? (
                              <div className="relative z-10 space-y-2">
                                <div className="flex justify-between items-end">
                                  <p className="text-[10px] font-black text-brand-dark leading-tight">
                                    Add <span className="text-brand text-xs">₹{399 - total}</span> more &amp; select Evening/Weekend to unlock <span className="text-emerald-600">FREE DELIVERY!</span> 🚚
                                  </p>
                                </div>
                                <div className="h-1.5 w-full bg-brand-dark/5 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, (total / 399) * 100)}%` }}
                                    className="h-full bg-brand rounded-full"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="relative z-10 flex items-center justify-between">
                                <p className="text-[10px] font-black text-emerald-700 leading-tight">
                                  ✨ You've unlocked <span className="text-emerald-600">FREE DELIVERY</span>!<br/>
                                  <span className="text-[8px] text-emerald-600/70 font-bold tracking-widest uppercase mt-0.5 block">Just choose Evening or Weekend slot below.</span>
                                </p>
                                <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0 ml-2">
                                  <CheckCircle2 size={16} />
                                </div>
                              </div>
                            )}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 blur-2xl rounded-full -translate-y-10 translate-x-10 pointer-events-none" />
                          </div>
                        )}
                        {items.map((item) => (
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
                              <div className="flex flex-col items-start leading-none mt-1">
                                <span className="text-[9px] font-black text-brand-dark/30 line-through tracking-wider">₹{Math.round(item.price * 1.3) * item.quantity}</span>
                                <p className="text-brand font-black text-xs sm:text-sm mt-0.5">₹{item.price * item.quantity}</p>
                              </div>
                              
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
                        ))}

                        {/* Coupon / Promo Code Button */}
                        <div className="mt-4 flex justify-between items-center bg-white/60 p-4 rounded-3xl border border-brand/5 shadow-soft relative z-10">
                          <div className="flex items-center gap-2">
                            <Ticket className="text-brand" size={16} />
                            <span className="text-xs font-bold text-brand-dark/80">
                              {appliedCoupon ? (
                                <span>Coupon <strong className="text-brand font-black uppercase tracking-wider">{appliedCoupon.code}</strong> Applied</span>
                              ) : (
                                "Apply Coupons / Promo Code"
                              )}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowCouponModal(true)}
                            className="text-[9px] font-black uppercase tracking-widest bg-brand/5 hover:bg-brand/10 text-brand px-3 py-1.5 rounded-lg border border-brand/10 transition-all font-bold"
                          >
                            {appliedCoupon ? "Manage" : "Apply"}
                          </button>
                        </div>

                        {/* Delivery Time Range Selector */}
                        {deliveryType === 'delivery' && (
                          <div className="mt-4 bg-white/60 p-4 rounded-3xl border border-brand/5 shadow-soft space-y-3 relative z-10">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-dark flex items-center gap-2">
                              <Clock size={14} className="text-brand" />
                              Select Delivery Time Slot
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setDeliveryTimeRange('standard')}
                                className={`p-3 rounded-2xl border text-left transition-all ${
                                  deliveryTimeRange === 'standard'
                                    ? 'border-brand bg-brand/5 ring-1 ring-brand/20'
                                    : 'border-brand/10 bg-white/50 hover:border-brand/30'
                                }`}
                              >
                                <p className="text-xs font-bold text-brand-dark">Standard</p>
                                <p className="text-[9px] text-brand-dark/50 mt-1">9 AM - 6 PM</p>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => setDeliveryTimeRange('evening')}
                                className={`p-3 rounded-2xl border text-left transition-all ${
                                  deliveryTimeRange === 'evening'
                                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/20'
                                    : 'border-brand/10 bg-white/50 hover:border-emerald-500/30'
                                }`}
                              >
                                <p className="text-xs font-bold text-emerald-700">Evening</p>
                                <p className="text-[9px] text-emerald-600/80 mt-1">After 7 PM (Free {'>'} ₹399)</p>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => setDeliveryTimeRange('weekend')}
                                className={`p-3 rounded-2xl border text-left transition-all sm:col-span-2 ${
                                  deliveryTimeRange === 'weekend'
                                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/20'
                                    : 'border-brand/10 bg-white/50 hover:border-emerald-500/30'
                                }`}
                              >
                                <p className="text-xs font-bold text-emerald-700">Weekend (Sat/Sun)</p>
                                <p className="text-[9px] text-emerald-600/80 mt-1">Free Delivery {'>'} ₹399</p>
                              </button>
                            </div>
                          </div>
                        )}
                      </>
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

                      {/* Removed Delivery Type Segmented Toggle to enforce Delivery only */}

                      {/* Address Selection / Creation (conditional) */}
                      {deliveryType === 'delivery' && (
                        <>
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
                                          <div className="flex items-center gap-2">
                                            <button 
                                              type="button"
                                              onClick={(e) => handleEditClick(addr, e)}
                                              className="p-1 text-brand-dark/30 hover:text-brand transition-colors"
                                              title="Edit Address"
                                            >
                                              <Edit size={12} />
                                            </button>
                                            {isSelected && <Check size={14} className="text-brand" />}
                                          </div>
                                        </div>
                                        <p className="text-xs font-semibold text-brand-dark mt-1">
                                          {addr.door_no}, {addr.street}, {addr.area}
                                        </p>
                                        <p className="text-[10px] text-brand-dark/60 font-medium">
                                          {addr.district} - {addr.pincode}
                                        </p>
                                        {cleanLandmark(addr.landmark) && (
                                          <p className="text-[9px] text-brand/60 font-bold mt-1">
                                            📍 {cleanLandmark(addr.landmark)}
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
                                      {editingAddressId ? 'Edit Address Details' : (addresses.length === 0 ? 'No address yet. Add address to proceed:' : 'New Address Details')}
                                    </p>
                                    {addresses.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={handleCancelAddress}
                                        className="text-[10px] font-black uppercase tracking-widest text-brand-dark/45 hover:text-brand"
                                      >
                                        Cancel
                                      </button>
                                    )}
                                  </div>

                                  {/* Location Search Input */}
                                  <div className="space-y-1.5 relative z-30">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40">Search Location / Street Name</label>
                                    <input
                                      type="text"
                                      value={addressSearchQuery}
                                      onChange={(e) => handleLocationSearch(e.target.value)}
                                      placeholder="Start typing your street or area..."
                                      className="w-full h-11 px-3 bg-white border border-brand/10 rounded-xl text-xs font-semibold text-brand-dark focus:outline-none focus:border-brand/40 shadow-sm"
                                    />
                                    
                                    {searchingLocation && (
                                      <div className="absolute right-3 top-7">
                                        <RefreshCw className="animate-spin text-brand/60" size={16} />
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
                                  <div className="space-y-2 relative z-20">
                                    <div className="flex justify-between items-center">
                                      <button
                                        type="button"
                                        onClick={showMapPicker ? () => setShowMapPicker(false) : handleShowMapPickerDirectly}
                                        className="text-[9px] font-black uppercase tracking-widest text-brand hover:underline flex items-center gap-1"
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
                                  <div className="relative flex py-1 items-center z-20">
                                    <div className="flex-grow border-t border-brand/5"></div>
                                    <span className="flex-shrink mx-3 text-[8px] font-black uppercase tracking-widest text-brand-dark/30">Confirm Address Details</span>
                                    <div className="flex-grow border-t border-brand/5"></div>
                                  </div>

                                  {/* Label */}
                                  <div className="space-y-1.5 relative z-10">
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
                                    <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40">Door / Flat No <span className="text-red-500 font-bold">*</span></label>
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
                                    <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40">Street / Colony <span className="text-red-500 font-bold">*</span></label>
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
                                    <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40">Pincode <span className="text-red-500 font-bold">*</span></label>
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
                                    <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40">Area / Post Office <span className="text-red-500 font-bold">*</span></label>
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
                                    {editingAddressId ? 'Update Address' : 'Save Address to Proceed'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                        
                        {/* Delivery Banner (No Distance UI) */}
                        <div className="mt-4 p-3 bg-brand/5 rounded-2xl border border-brand/10 text-center flex items-center justify-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-brand flex items-center gap-1">
                            {distanceMode === 'local' ? (
                              <><MapPin size={12}/> Local Same Day Delivery</>
                            ) : (
                              <><MapPin size={12}/> Domestic Shipping</>
                            )}
                          </span>
                        </div>
                      </>
                    )}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-dark flex items-center gap-2">
                        <Check size={14} className="text-brand" />
                        Payment Method
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('upi')}
                          className={`p-4 rounded-2xl border text-left transition-all ${
                            paymentMethod === 'upi'
                              ? 'border-brand bg-brand/5 shadow-soft ring-1 ring-brand/20'
                              : 'border-brand/10 hover:border-brand/30 bg-white/50'
                          }`}
                        >
                          <p className="text-xs font-bold text-brand-dark mb-1">UPI Online</p>
                          <p className="text-[9px] text-brand-dark/60 leading-relaxed">Pay via GPay, PhonePe, Paytm</p>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
                {/* STEP UPI: PAYMENT VIEW */}
                {step === 'upi_payment' && (
                  <motion.div
                    key="upi-step"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-6 text-center space-y-6"
                  >
                    <div className="bg-white p-4 rounded-3xl shadow-soft inline-block border border-brand/10">
                      <QRCodeCanvas
                        value={`upi://pay?pa=${getSetting('upi_id', '')}&pn=${getSetting('business_name', 'Jars of Joy')}&am=${total}&cu=INR&tr=${placedOrderId}`}
                        size={200}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                    <div className="space-y-4 w-full px-6">
                      <h3 className="font-black text-brand-dark text-lg">Pay ₹{total} via UPI</h3>
                      <p className="text-[10px] text-brand-dark/60 leading-relaxed">
                        Scan the QR code above or tap the button below to pay directly via GPay, PhonePe, or Paytm.
                      </p>
                      
                      {/* Direct UPI Intent Link for Mobile */}
                      <a 
                        href={`upi://pay?pa=${getSetting('upi_id', '')}&pn=${getSetting('business_name', 'Jars of Joy')}&am=${total}&cu=INR&tr=${placedOrderId}`}
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all"
                      >
                        🚀 Open UPI App to Pay
                      </a>
                    </div>
                    
                    <Button3D
                      onClick={() => {
                        setStep('success');
                        clearCart();
                        addToast('Payment marked as pending verification!', 'sweet');
                      }}
                      className="w-full max-w-[200px] h-12 text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={16} /> I Have Paid
                    </Button3D>
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
                      <h3 className="heading-serif text-2xl font-black text-brand-dark">
                        {paymentMethod === 'upi' ? 'Payment Verifying' : 'Sweetness Confirmed!'}
                      </h3>
                      <p className="text-xs font-semibold text-brand-dark/55 leading-relaxed">
                        {paymentMethod === 'upi'
                          ? 'Congrats, your payment is under verification and you will be notified shortly. You can also send the receipt to WhatsApp.'
                          : 'Your order has been recorded. Let\'s redirect to WhatsApp to send your receipt and confirm delivery details.'}
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
              <div className="border-t border-brand/10 pt-4 mt-auto space-y-4 relative z-20 bg-white/90 backdrop-blur-md p-4 sm:p-6 -mx-6 sm:-mx-8 shrink-0 shadow-[0_-8px_30px_rgb(0,0,0,0.03)]">
                
                {/* Professional Receipt/Pricing Summary Box - Only in Cart */}
                {step === 'cart' && (
                  <div className="bg-white/60 p-4 rounded-3xl border border-brand/5 shadow-soft space-y-2 text-xs relative z-10">
                    <div className="flex justify-between font-semibold text-brand-dark/60">
                      <span>Total MRP</span>
                      <span className="font-bold text-brand-dark line-through decoration-brand-dark/30">₹{mrpTotal}</span>
                    </div>
                    
                    {mrpDiscount > 0 && (
                      <div className="flex justify-between font-bold text-green-600">
                        <span className="flex items-center gap-1">✨ Discount on MRP</span>
                        <span>- ₹{mrpDiscount}</span>
                      </div>
                    )}

                    <div className="flex justify-between font-semibold text-brand-dark/60 pt-1 border-t border-brand/5">
                      <span>Items Subtotal</span>
                      <span className="font-bold text-brand-dark">₹{total}</span>
                    </div>
                    
                    {appliedCoupon && discount > 0 && (
                      <div className="flex justify-between font-bold text-green-600">
                        <span className="flex items-center gap-1">🎟️ Coupon ({appliedCoupon.code})</span>
                        <span>- ₹{discount}</span>
                      </div>
                    )}

                    {deliveryType === 'delivery' && (
                      <div className="flex justify-between font-semibold text-brand-dark/60">
                        <span>Delivery Fee ({deliveryTimeRange})</span>
                        <span className="font-bold text-brand-dark">{deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}</span>
                      </div>
                    )}

                    {deliveryType === 'pickup' && (
                      <div className="flex justify-between font-semibold text-brand-dark/60">
                        <span>Delivery Mode</span>
                        <span className="text-brand font-bold uppercase tracking-wider text-[10px]">Store Pickup (Free)</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Total & Checkout Button Row */}
                <div className="flex items-center justify-between gap-4 pt-2 relative z-10 bg-white/40 p-4 rounded-[2rem] border border-brand/5 shadow-soft">
                  <div className="shrink-0">
                    <span className="text-[9px] font-black uppercase tracking-widest text-brand-dark/45 leading-none">
                      {appliedCoupon || deliveryType === 'delivery' ? 'Grand Total' : 'Total Amount'}
                    </span>
                    <h3 className="text-2xl font-black text-brand-dark leading-none mt-1">₹{total - discount + deliveryFee}</h3>
                  </div>
                  
                  <div className="flex-grow">
                    {step === 'cart' ? (
                      <Button3D 
                        onClick={() => {
                          if (!user) {
                            addToast('Please log in to place an order. Both email and WhatsApp number must be verified.', 'error');
                            return;
                          }
                          if (!profile?.email_verified || !profile?.mobile_verified) {
                            addToast('Both your email and WhatsApp number must be verified to place storefront orders. Please verify them in your profile settings.', 'error');
                            return;
                          }
                          setStep('checkout');
                        }}
                        className="w-full h-12 text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-luxury"
                      >
                        Checkout Now
                      </Button3D>
                    ) : (
                      <Button3D 
                        onClick={handlePlaceOrder}
                        disabled={submitting}
                        className="w-full h-12 text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-luxury flex items-center justify-center gap-2"
                      >
                        {submitting ? 'Placing Order...' : 'Confirm Order'}
                      </Button3D>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
      
      {/* Coupon Modal */}
      <AnimatePresence>
        {showCouponModal && (
          <>
            {/* Coupon Modal Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCouponModal(false)}
              className="fixed inset-0 bg-brand-dark/30 backdrop-blur-md z-[250]"
            />
            
            {/* Coupon Modal Box */}
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed inset-x-4 bottom-4 md:inset-x-auto md:right-8 md:bottom-8 max-w-sm md:w-[360px] bg-gradient-to-b from-[#FFF5F7] to-white rounded-[2.5rem] p-6 shadow-deep border border-brand/10 z-[300] flex flex-col max-h-[70vh] md:max-h-[600px] overflow-hidden"
            >
              {/* Decorative background */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(253,232,236,0.3)_0%,transparent_50%)] pointer-events-none" />

              {/* Header */}
              <div className="flex justify-between items-center pb-3 border-b border-brand/10 relative z-10 shrink-0">
                <div className="flex items-center gap-2 text-brand">
                  <Ticket size={18} className="stroke-[2.5]" />
                  <h3 className="font-serif font-black text-brand-dark text-base uppercase tracking-tight">Available Offers</h3>
                </div>
                <button 
                  onClick={() => setShowCouponModal(false)}
                  className="w-8 h-8 bg-white hover:bg-brand/5 border border-brand/10 text-brand-dark rounded-xl flex items-center justify-center transition-all active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Promocode Manual Entry */}
              <div className="py-3 border-b border-brand/5 relative z-10 shrink-0 space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40">Enter Promo Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. FESTIVE50"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    disabled={!!appliedCoupon}
                    className="flex-grow h-10 px-3 bg-white border border-brand/10 rounded-xl text-xs font-bold uppercase tracking-wider text-brand-dark placeholder:normal-case placeholder:font-semibold placeholder:text-brand-dark/40 outline-none focus:border-brand/40 shadow-inner disabled:bg-brand-dark/5 disabled:text-brand-dark/50"
                  />
                  {appliedCoupon ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleRemoveCoupon();
                      }}
                      className="h-10 px-3 bg-red-50 text-red-500 border border-red-100 hover:bg-red-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const success = handleApplyPromoCode();
                        if (success) {
                          setShowCouponModal(false);
                        }
                      }}
                      className="h-10 px-4 bg-brand text-white hover:bg-brand-dark rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm"
                    >
                      Apply
                    </button>
                  )}
                </div>
              </div>

              {/* Coupon List Container */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1 no-scrollbar relative z-10">
                {coupons.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <span className="text-3xl">🧁</span>
                    <p className="text-xs font-bold text-brand-dark/50 italic">No available coupons right now.</p>
                  </div>
                ) : (
                  coupons.map((coupon) => {
                    const minAmount = coupon.min_order_amount || 0;
                    const isMinAmountSatisfied = total >= minAmount;
                    
                    const hasEligibleItems = !coupon.applicable_category || items.some(item => {
                      const prod = products.find(p => p.id === item.id);
                      return prod?.category === coupon.applicable_category;
                    });

                    const isApplicable = isMinAmountSatisfied && hasEligibleItems;
                    const amountNeeded = minAmount - total;

                    return (
                      <div 
                        key={coupon.id} 
                        className={`p-4 rounded-2xl border transition-all ${
                          isApplicable 
                            ? 'bg-white border-brand/10 shadow-sm hover:border-brand/30' 
                            : 'bg-gray-50/70 border-gray-200/60 opacity-60 saturate-50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                              isApplicable 
                                ? 'bg-brand/5 text-brand border border-brand/10' 
                                : 'bg-gray-100 text-gray-400 border border-gray-200'
                            }`}>
                              {coupon.code}
                            </span>
                            <h4 className="font-bold text-xs text-brand-dark">
                              {coupon.type === 'percent' ? `${coupon.value}% Off` : `₹${coupon.value} Off`}
                            </h4>
                            {coupon.description && (
                              <p className="text-[10px] text-brand-dark/50 font-semibold leading-normal">
                                {coupon.description}
                              </p>
                            )}
                          </div>

                          {isApplicable ? (
                            <button
                              type="button"
                              onClick={() => {
                                handleApplyPromoCode(coupon.code);
                                setShowCouponModal(false);
                              }}
                              className="px-3 py-1.5 bg-brand text-white hover:bg-brand-dark rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm"
                            >
                              Apply
                            </button>
                          ) : (
                            <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 bg-gray-100/50 border border-gray-200/50 px-2.5 py-1 rounded-lg">
                              Locked
                            </span>
                          )}
                        </div>

                        {/* Informational Message for Not Applicable */}
                        {!isApplicable && (
                          <div className="mt-2.5 pt-2 border-t border-dashed border-gray-200 text-[8px] font-black uppercase tracking-widest text-brand-dark/40">
                            {!isMinAmountSatisfied && `Add ₹${amountNeeded} more to unlock`}
                            {isMinAmountSatisfied && !hasEligibleItems && `Only applicable on ${coupon.applicable_category}`}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
};
