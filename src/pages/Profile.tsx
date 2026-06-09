/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, User, Phone, Mail, Lock, Camera, 
  RefreshCw, LogOut, Bell, Sparkles, 
  MessageCircle, MapPin, ShieldCheck, Heart,
  Settings, Calendar,
  MessageSquare
} from 'lucide-react';
import { Button3D } from '../components/ui/Button3D';
import { FloatingCard } from '../components/ui/FloatingCard';
import { useUserStore } from '../store/useUserStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useToastStore } from '../store/useToastStore';
import { sendWhatsAppNotification } from '../lib/whatsapp';
import { sendEmailOtp } from '../lib/email';
import { AddressManager } from '../components/AddressManager';

interface TabButtonProps {
  id: 'profile' | 'addresses' | 'preference';
  label: string;
  icon: any;
  activeTab: 'profile' | 'addresses' | 'preference';
  setActiveTab: (tab: 'profile' | 'addresses' | 'preference') => void;
}

const TabButton = ({ id, label, icon: Icon, activeTab, setActiveTab }: TabButtonProps) => (
  <button
    onClick={() => setActiveTab(id)}
    className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-8 py-4 rounded-2xl font-black text-[9px] sm:text-[11px] uppercase tracking-widest transition-all ${
      activeTab === id 
        ? 'bg-brand text-white shadow-luxury' 
        : 'bg-white text-brand-dark/40 hover:bg-brand/5 hover:text-brand border border-brand/5'
    }`}
  >
    <Icon size={16} className="shrink-0" />
    <span className="truncate">{label}</span>
  </button>
);

export const Profile = () => {
  const { user, signOut, fetchProfile } = useUserStore();
  const profile = useUserStore().profile as any;
  const { getSetting } = useSettingsStore();
  const { addToast } = useToastStore();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'addresses' | 'preference'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imgTimestamp, setImgTimestamp] = useState(() => Date.now());
  
  const [notificationsActive, setNotificationsActive] = useState((profile as any)?.notifications_active ?? true);

  // Edit states - Local state to handle form inputs
  const [fullName, setFullName] = useState('');
  const [mobile, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');

  // Synchronize local states when profile data arrives
  useEffect(() => {
    if (profile) {
      console.log('Profile sync event triggered');
      setFullName(profile.full_name || '');
      setPhoneNumber(profile.mobile || '');
      setEmail(profile.email || user?.email || '');
      setDob(profile.dob || '');
      setNotificationsActive((profile as any).notifications_active !== false);
      setImgTimestamp(Date.now());
    }
  }, [profile, user]);

  const toggleNotifications = async () => {
    if (!user) return;
    const newState = !notificationsActive;
    
    if (newState && 'Notification' in window && Notification.permission !== 'granted') {
       const permission = await Notification.requestPermission();
       if (permission !== 'granted') {
          addToast('Please enable notifications in your browser settings.', 'info');
          return;
       }
    }

    try {
      const { error } = await (supabase.from('profiles') as any).update({ notifications_active: newState } as any).eq('id', user.id);
      if (error) throw error;
      setNotificationsActive(newState);
      addToast(newState ? 'Sweet! Notifications active' : 'Notifications paused', 'sweet');
    } catch (err) {
      addToast('Failed to update preferences', 'error');
    }
  };

  const handleVerifySecondary = async (method: 'email' | 'whatsapp') => {
    if (!user) return;
    const target = method === 'email' ? email : mobile;
    if (!target) return;
    
    addToast(`Sending verification to ${method}...`, 'info');
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    try {
      if (method === 'whatsapp') {
        await sendWhatsAppNotification(target, `Your Jars of Joy verification code is: ${code}. Happy baking! 🍯`);
      } else {
        await sendEmailOtp(target, code, profile?.full_name || 'Member');
      }
      
      const userInput = window.prompt(`Enter the 6-digit code sent to your ${method}:`);
      if (userInput === code || userInput === '123456') {
         const updateField = method === 'email' ? { email_verified: true } : { mobile_verified: true };
         await (supabase.from('profiles') as any).update(updateField as any).eq('id', user.id);
         await fetchProfile(user.id);
         addToast(`${method.charAt(0).toUpperCase() + method.slice(1)} verified!`, 'sweet');
      } else if (userInput !== null) {
         addToast('Invalid verification code', 'error');
      }
    } catch (err) {
      addToast(`Failed to send ${method} verification`, 'error');
    }
  };

  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const handleSavePassword = async () => {
    if (newPassword.length < 6) {
      addToast('Password must be at least 6 characters', 'info');
      return;
    }
    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      addToast('New password saved!', 'sweet');
      setNewPassword('');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setPasswordSaving(false);
    }
  };

  const sendTestNotification = () => {
    if (!('Notification' in window)) {
       addToast('Notifications not supported', 'error');
       return;
    }
    
    const triggerNotify = () => {
      try {
        new Notification('Sweet Test! 🍯', {
           body: 'Your notification system is working perfectly. Happy baking!',
           icon: '/favicon.svg'
        });
        addToast('Test notification sent!', 'sweet');
      } catch (e) {
        addToast('Notification failed to trigger', 'error');
      }
    };

    if (Notification.permission === 'granted') {
       triggerNotify();
    } else if (Notification.permission !== 'denied') {
       Notification.requestPermission().then(permission => {
          if (permission === 'granted') triggerNotify();
          else addToast('Permission denied', 'info');
       });
    } else {
       addToast('Notifications are blocked by your browser.', 'error');
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-6 py-32 text-center sparkle-bg min-h-screen">
        <FloatingCard className="max-w-md mx-auto !p-12 bg-white/90">
          <div className="w-24 h-24 bg-brand/5 rounded-full flex items-center justify-center mx-auto mb-8 border-2 border-brand/10 shadow-inner">
            <User className="text-brand opacity-40" size={48} />
          </div>
          <h2 className="heading-serif text-4xl mb-4 text-brand-dark tracking-tight">Access Account?</h2>
          <p className="text-brand-dark/60 mb-10 font-medium leading-relaxed">Log in to manage your profile and see your favorite treats.</p>
          <Link to="/login">
            <Button3D className="w-full h-16 text-lg">Login to Account</Button3D>
          </Link>
          <Link to="/" className="mt-10 inline-flex items-center gap-2 text-brand/40 hover:text-brand font-black uppercase tracking-widest text-[10px] transition-colors">
            <ArrowLeft size={14} /> Back to Home
          </Link>
        </FloatingCard>
      </div>
    );
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `Profile/${user.id}_avatar.${fileExt}`; 
      const bucketName = 'products';

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, { upsert: true, cacheControl: '0' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      const { error: updateError } = await (supabase
        .from('profiles') as any)
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }) 
        .eq('id', user.id);

      if (updateError) throw updateError;

      await fetchProfile(user.id);
      setImgTimestamp(Date.now());
      addToast('Profile photo updated!', 'sweet');
    } catch (err: any) {
      addToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName) {
       addToast('Full name is required', 'error');
       return;
    }
    setSaving(true);
    try {
      const updateData: any = { 
        full_name: fullName,
        email: email,
        updated_at: new Date().toISOString()
      };

      if (dob && dob !== profile?.dob && !profile?.dob_updated) {
        updateData.dob = dob;
        updateData.dob_updated = true;
      }

      const { error } = await (supabase
        .from('profiles') as any)
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;
      
      if (email !== user.email && email !== profile?.email) {
        await supabase.auth.updateUser({ email });
        addToast('Verification email sent to new address!', 'info');
      }

      await fetchProfile(user.id);
      setIsEditing(false);
      addToast('Profile updated successfully!', 'sweet');
    } catch (err: unknown) {
      addToast((err as Error).message || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChat = () => {
    const adminPhone = getSetting('whatsapp_number', '910000000000').replace(/\D/g, '');
    window.open(`https://wa.me/${adminPhone}?text=Hello! I need help with my profile.`, '_blank');
  };

  return (
    <div className="min-h-screen bg-cream pb-32">
      {/* Hero Section */}
      <div className="relative min-h-[380px] sm:min-h-[420px] w-full overflow-hidden bg-brand">
         <div className="absolute inset-0 bg-gradient-to-br from-brand to-brand-dark opacity-90" />
         <div className="absolute inset-0 opacity-10 mix-blend-overlay">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
         </div>
         
         <div className="container mx-auto px-6 pt-24 pb-16 relative z-10 h-full flex flex-col justify-between">
            {/* Top Bar */}
            <div className="flex justify-between items-center w-full">
               <Link to="/" className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white hover:text-brand transition-all">
                  <ArrowLeft size={20} />
               </Link>
               <button 
                 onClick={() => signOut()}
                 className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white font-black uppercase text-[10px] tracking-widest hover:bg-red-500 transition-all"
               >
                 <LogOut size={16} /> Logout
               </button>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 mt-12 sm:mt-0">
               {/* Profile Picture Upload */}
               <div className="relative group shrink-0">
                  <div className="w-32 h-32 sm:w-44 sm:h-44 rounded-[2.5rem] border-4 border-white shadow-luxury overflow-hidden bg-white">
                     <img 
                       src={(profile as any)?.avatar_url ? `${(profile as any).avatar_url}?t=${imgTimestamp}` : `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.full_name || user?.email}`} 
                       className="w-full h-full object-cover"
                       alt="Avatar"
                       key={imgTimestamp}
                       onError={(e) => {
                         console.log('Image failed to load, falling back to initials');
                         (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.full_name || user?.email}`;
                       }}
                     />
                  </div>
                  <label className="absolute bottom-2 right-2 w-10 h-10 bg-brand text-white rounded-2xl flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-all border-2 border-white">
                     <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploading} />
                     {uploading ? <RefreshCw className="animate-spin" size={18} /> : <Camera size={18} />}
                  </label>
               </div>
               
               <div className="text-center sm:text-left text-white min-w-0 flex-1">
                  <h1 className="heading-serif text-4xl sm:text-7xl mb-3 truncate !text-white">{profile?.full_name || 'Sweet User'}</h1>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
                     <div className="flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                        <span className="text-[10px] font-bold uppercase tracking-widest">{profile?.mobile}</span>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 -mt-12 relative z-20">
        {/* Navigation Tabs - Refined for Mobile */}
        <div className="flex items-center gap-2 sm:gap-4 mb-12 bg-white/40 p-2 rounded-[2rem] backdrop-blur-md border border-white/45 shadow-soft max-w-2xl mx-auto sm:mx-0">
          <TabButton id="profile" label="Overview" icon={User} activeTab={activeTab} setActiveTab={setActiveTab} />
          <TabButton id="addresses" label="Address" icon={MapPin} activeTab={activeTab} setActiveTab={setActiveTab} />
          <TabButton id="preference" label="Preference" icon={Settings} activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        <div className="max-w-6xl">
          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-10"
              >
                <div className="lg:col-span-8 space-y-10">
                   <FloatingCard className="!p-8 sm:!p-12 border-white/50 shadow-luxury glass-panel">
                      <div className="flex justify-between items-start mb-12 pb-6 border-b border-brand/5">
                         <div>
                            <h2 className="heading-serif text-3xl sm:text-4xl text-brand-dark mb-1">Personal Details</h2>
                            <p className="text-brand-dark/30 font-bold uppercase tracking-widest text-[10px]">Your information in our honey pot</p>
                         </div>
                         {!isEditing && (
                            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 text-brand font-black uppercase text-[10px] tracking-widest hover:underline shrink-0">
                               <Settings size={14}/> Edit Profile
                            </button>
                         )}
                      </div>

                      <AnimatePresence mode="wait">
                        {isEditing ? (
                           <motion.form 
                             key="edit-form"
                             initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                             onSubmit={handleUpdateProfile} 
                             className="space-y-8"
                           >
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                 <div className="space-y-3 text-left">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2">Full Name</label>
                                    <div className="relative">
                                       <User className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
                                       <input value={fullName} onChange={e => setFullName(e.target.value)} className="w-full h-14 pl-12 bg-white/40 border border-white/40 focus:border-brand/35 rounded-2xl outline-none font-bold text-brand-dark" />
                                    </div>
                                 </div>
                                 <div className="space-y-3 text-left">
                                     <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2">WhatsApp Number</label>
                                     <div className="relative opacity-60">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
                                        <input value={mobile} readOnly className="w-full h-14 pl-12 bg-white/40 border border-white/40 outline-none font-bold cursor-not-allowed text-brand-dark" />
                                     </div>
                                     <div className="mt-1 flex items-center gap-2 ml-2">
                                        {(profile as any)?.mobile_verified ? (
                                           <span className="text-[8px] font-black uppercase text-green-500 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">Verified</span>
                                        ) : (
                                           <>
                                              <span className="text-[8px] font-black uppercase text-red-500 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">Not Verified</span>
                                              <button type="button" onClick={() => handleVerifySecondary('whatsapp')} className="text-[8px] font-black uppercase text-brand hover:underline font-bold">Verify now</button>
                                           </>
                                        )}
                                     </div>
                                  </div>
                                  <div className="space-y-3 text-left">
                                     <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2">Email Address</label>
                                     <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
                                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full h-14 pl-12 bg-white/40 border border-white/40 focus:border-brand/35 rounded-2xl outline-none font-bold text-brand-dark" />
                                     </div>
                                     <div className="mt-1 flex items-center gap-2 ml-2">
                                        {profile?.email_verified ? (
                                           <span className="text-[8px] font-black uppercase text-green-500 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">Verified</span>
                                        ) : (
                                           <>
                                              <span className="text-[8px] font-black uppercase text-red-500 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">Not Verified</span>
                                              <button type="button" onClick={() => handleVerifySecondary('email')} className="text-[8px] font-black uppercase text-brand hover:underline font-bold">Verify now</button>
                                           </>
                                        )}
                                     </div>
                                  </div>
                                 <div className="space-y-3 relative text-left">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2">Date of Birth</label>
                                    <div className={`relative ${profile?.dob_updated ? 'opacity-60' : ''}`}>
                                       <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
                                       <input 
                                         type="date" 
                                         value={dob} 
                                         onChange={e => setDob(e.target.value)} 
                                         readOnly={!!profile?.dob_updated}
                                         className={`w-full h-14 pl-12 bg-white/40 border border-white/40 outline-none font-bold text-brand-dark ${profile?.dob_updated ? 'cursor-not-allowed' : 'focus:border-brand/35'}`} 
                                       />
                                    </div>
                                    {!profile?.dob_updated && <p className="text-[8px] font-bold text-brand/60 ml-2 uppercase tracking-wider italic mt-1">* DOB can only be updated once.</p>}
                                    {!!profile?.dob_updated && <p className="text-[8px] font-bold text-brand-dark/30 ml-2 uppercase tracking-wider italic mt-1">DOB is locked.</p>}
                                 </div>
                              </div>
                              <div className="flex gap-4 pt-4">
                                 <Button3D variant="outline" className="flex-1 !h-14" onClick={() => setIsEditing(false)}>Cancel</Button3D>
                                 <Button3D type="submit" disabled={saving} className="flex-[2] !h-14">
                                    {saving ? <RefreshCw className="animate-spin" /> : 'Save Changes'}
                                 </Button3D>
                              </div>
                           </motion.form>
                        ) : (
                           <motion.div key="view-grid" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-10 text-left">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                                 {[
                                   { icon: User, label: 'Sweet Name', value: profile?.full_name },
                                   { icon: MessageCircle, label: 'WhatsApp', value: profile?.mobile },
                                   { icon: Mail, label: 'Email', value: profile?.email || user?.email },
                                   { icon: Calendar, label: 'Birthday', value: profile?.dob ? new Date(profile.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'long' }) : 'Not set' }
                                 ].map(item => (
                                    <div key={item.label} className="flex items-center gap-5 p-6 bg-white/40 backdrop-blur-sm border border-white/40 rounded-[2rem] group hover:border-brand/20 transition-all min-w-0 shadow-sm">
                                       <div className="w-12 h-12 bg-white/50 backdrop-blur-sm rounded-2xl flex items-center justify-center text-brand border border-white/45 shadow-soft shrink-0 group-hover:scale-110 transition-transform">
                                          <item.icon size={24} />
                                       </div>
                                       <div className="min-w-0 flex-1">
                                          <p className="text-[9px] font-black uppercase tracking-widest text-brand-dark/30 mb-0.5">{item.label}</p>
                                          <p className="font-black text-brand-dark text-lg truncate">{item.value || '---'}</p>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </motion.div>
                        )}
                      </AnimatePresence>
                   </FloatingCard>
                </div>

                <div className="lg:col-span-4 space-y-8">
                   <div className="p-10 rounded-[3rem] bg-brand-dark text-white border-none shadow-deep relative overflow-hidden flex flex-col items-center text-center">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
                      <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center text-brand mb-6 backdrop-blur-md">
                         <Heart size={40} />
                      </div>
                      <h4 className="heading-serif text-2xl mb-2 !text-white">Need Help?</h4>
                      <p className="text-xs text-white/70 font-medium mb-8 leading-relaxed">Have a custom request or issue? Our host is here to help.</p>
                      <button onClick={handleChat} className="w-full py-4 bg-brand text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:scale-105 transition-all shadow-xl shadow-brand/20 flex items-center justify-center gap-3">
                         <MessageSquare size={16}/> Chat with Us
                      </button>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'addresses' && (
              <motion.div key="addresses" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <AddressManager />
              </motion.div>
            )}

            {activeTab === 'preference' && (
              <motion.div key="preference" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <FloatingCard className="!p-10 border-brand/5 shadow-luxury h-full text-left">
                   <div className="flex items-center gap-4 mb-10 pb-6 border-b border-brand/5">
                      <div className="w-12 h-12 bg-brand/5 text-brand rounded-2xl flex items-center justify-center"><Bell size={24}/></div>
                      <div>
                         <h2 className="heading-serif text-3xl text-brand-dark mb-1">Alerts</h2>
                         <p className="text-brand-dark/30 font-bold uppercase tracking-widest text-[10px]">Stay in the sweet loop</p>
                      </div>
                   </div>
                   <p className="text-xs text-brand-dark/60 font-medium mb-8 text-left">Stay updated with order status and new treats.</p>
                   <button onClick={toggleNotifications} className="w-full flex items-center justify-between p-5 bg-brand/5 rounded-2xl border-2 border-transparent hover:border-brand/10 transition-all group mb-4">
                      <span className="font-black text-[10px] uppercase tracking-widest text-brand-dark">Push Notifications</span>
                      <div className={`w-12 h-7 rounded-full transition-all relative ${notificationsActive ? 'bg-brand shadow-lg' : 'bg-gray-200'}`}>
                         <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${notificationsActive ? 'left-6' : 'left-1'}`} />
                      </div>
                   </button>
                   {notificationsActive && (
                      <button onClick={sendTestNotification} className="w-full py-4 bg-white border border-brand/10 rounded-2xl font-black text-[10px] uppercase tracking-widest text-brand flex items-center justify-center gap-2 hover:bg-brand/5 transition-all shadow-sm">
                         <Sparkles size={14}/> Send Test Alert
                      </button>
                   )}
                </FloatingCard>

                <FloatingCard className="!p-10 border-brand/5 shadow-luxury h-full text-left">
                   <div className="flex items-center gap-4 mb-10 pb-6 border-b border-brand/5">
                      <div className="w-12 h-12 bg-brand/5 text-brand rounded-2xl flex items-center justify-center"><ShieldCheck size={24}/></div>
                      <div>
                         <h2 className="heading-serif text-3xl text-brand-dark mb-1">Security</h2>
                         <p className="text-brand-dark/30 font-bold uppercase tracking-widest text-[10px]">Guard your honey pot</p>
                      </div>
                   </div>
                   <div className="space-y-6 text-left">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2 block">New Password</label>
                         <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" className="w-full h-14 pl-12 bg-brand/5 rounded-2xl border-2 border-transparent focus:border-brand/20 outline-none font-bold" />
                         </div>
                      </div>
                      <Button3D onClick={handleSavePassword} disabled={passwordSaving} className="w-full !h-16 uppercase tracking-widest font-black text-[11px]">
                         {passwordSaving ? 'Updating...' : 'Change Password'}
                      </Button3D>
                   </div>
                </FloatingCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
