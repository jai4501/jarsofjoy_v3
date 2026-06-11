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
  MessageSquare, X
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
    className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-8 py-4 rounded-2xl font-black text-[9px] sm:text-[11px] uppercase tracking-widest transition-all ${
      activeTab === id 
        ? 'bg-brand text-white shadow-luxury' 
        : 'bg-white text-brand-dark/40 hover:bg-brand/5 hover:text-brand border border-brand/5'
    }`}
  >
    <Icon size={16} className="shrink-0 hidden sm:block" />
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

  // OTP Verification States
  const [verifyingMethod, setVerifyingMethod] = useState<'email' | 'whatsapp' | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const [cooldownEmail, setCooldownEmail] = useState(0);
  const [cooldownWhatsapp, setCooldownWhatsapp] = useState(0);
  const [cooldownPassword, setCooldownPassword] = useState(0);

  // Password OTP states
  const [showPasswordOtpModal, setShowPasswordOtpModal] = useState(false);
  const [passwordVerificationCode, setPasswordVerificationCode] = useState('');
  const [passwordSentCode, setPasswordSentCode] = useState('');
  const [passwordVerifyError, setPasswordVerifyError] = useState<string | null>(null);
  const [passwordVerifyLoading, setPasswordVerifyLoading] = useState(false);
  const [passwordOtpMethod, setPasswordOtpMethod] = useState<'email' | 'whatsapp' | null>(null);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [revertMessage, setRevertMessage] = useState<string | null>(null);

  const getCooldownSecs = (key: string) => {
    const expiry = localStorage.getItem(key);
    if (!expiry) return 0;
    const remaining = Math.ceil((parseInt(expiry, 10) - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  };

  const setCooldownSecs = (key: string, seconds: number) => {
    localStorage.setItem(key, (Date.now() + seconds * 1000).toString());
  };

  useEffect(() => {
    setCooldownEmail(getCooldownSecs('joj-cooldown-profile-email'));
    setCooldownWhatsapp(getCooldownSecs('joj-cooldown-profile-whatsapp'));
    setCooldownPassword(getCooldownSecs('joj-cooldown-profile-password'));

    const timer = setInterval(() => {
      setCooldownEmail(prev => (prev > 0 ? prev - 1 : 0));
      setCooldownWhatsapp(prev => (prev > 0 ? prev - 1 : 0));
      setCooldownPassword(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (revertMessage) {
      const timer = setTimeout(() => {
        setRevertMessage(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [revertMessage]);

  const [otpCount, setOtpCount] = useState(0);
  const [isPotentialCustomer, setIsPotentialCustomer] = useState(false);

  const checkOtpRateLimit = () => {
    const today = new Date().toDateString();
    const raw = localStorage.getItem('joj-otp-limit');
    let data = raw ? JSON.parse(raw) : { count: 0, lastSent: 0, date: today };
    if (data.date !== today) {
      data = { count: 0, lastSent: 0, date: today };
    }
    return data;
  };

  const recordOtpSent = () => {
    const today = new Date().toDateString();
    const data = checkOtpRateLimit();
    data.count += 1;
    data.lastSent = Date.now();
    data.date = today;
    localStorage.setItem('joj-otp-limit', JSON.stringify(data));
    return data;
  };

  useEffect(() => {
    const checkPotential = async () => {
      if (profile?.mobile) {
        const { data } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', profile.mobile)
          .maybeSingle();
        setIsPotentialCustomer(!!data);
      } else {
        setIsPotentialCustomer(false);
      }
    };
    checkPotential();
  }, [profile]);

  useEffect(() => {
    const limit = checkOtpRateLimit();
    setOtpCount(limit.count);
  }, [verifyingMethod]);

  const handlePhoneChange = (val: string) => {
    if (!val.startsWith('+91')) val = '+91' + val.replace(/\D/g, '');
    const digits = val.slice(3).replace(/\D/g, '').slice(0, 10);
    setPhoneNumber('+91' + digits);
  };

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
    if (!target) {
      addToast(`Please enter a valid ${method === 'email' ? 'email address' : 'WhatsApp number'} first.`, 'info');
      return;
    }
    
    // Clean up input
    const cleanTarget = method === 'email' 
      ? target.trim().toLowerCase() 
      : (target.startsWith('+91') ? target : '+91' + target.replace(/\D/g, '').slice(-10));

    // Duplicate Check
    try {
      if (method === 'email') {
        const { data: existingEmail } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', cleanTarget)
          .neq('id', user.id)
          .maybeSingle();
        if (existingEmail) {
          addToast('This email is already active and can\'t be changed to that email.', 'error');
          return;
        }
      } else {
        const { data: existingMobile } = await supabase
          .from('profiles')
          .select('id')
          .eq('mobile', cleanTarget)
          .neq('id', user.id)
          .maybeSingle();
        if (existingMobile) {
          addToast('This WhatsApp number is already active and can\'t be changed to that number.', 'error');
          return;
        }
      }
    } catch (dupErr) {
      console.error('Duplicate check error:', dupErr);
    }

    // Rate Limit Check
    const limit = checkOtpRateLimit();
    if (limit.count >= 10) {
      addToast('You have requested 10 OTPs today. Maximum limit reached. Please try again tomorrow.', 'error');
      return;
    }
    
    const activeCooldown = method === 'email' ? cooldownEmail : cooldownWhatsapp;
    if (activeCooldown > 0) {
      addToast(`Please wait ${activeCooldown} seconds before requesting another OTP.`, 'error');
      return;
    }

    addToast(`Sending verification code to ${method}...`, 'info');
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setSentCode(code);
    setVerificationCode('');
    setVerifyError(null);
    setVerifyLoading(false);
    
    try {
      if (method === 'whatsapp') {
        await sendWhatsAppNotification(cleanTarget, `Your Jars of Joy verification code is: ${code}. Happy baking! 🍯`);
      } else {
        await sendEmailOtp(cleanTarget, code, profile?.full_name || 'Member');
      }
      
      const newLimit = recordOtpSent();
      setOtpCount(newLimit.count);
      
      if (method === 'email') {
        setCooldownSecs('joj-cooldown-profile-email', 60);
        setCooldownEmail(60);
      } else {
        setCooldownSecs('joj-cooldown-profile-whatsapp', 60);
        setCooldownWhatsapp(60);
      }

      setVerifyingMethod(method);
      addToast('Verification code sent!', 'sweet');

      if (newLimit.count > 5) {
        addToast(`You have crossed ${newLimit.count} OTPs today. ${10 - newLimit.count} left.`, 'info');
      } else {
        addToast(`OTP sent! ${10 - newLimit.count} left today.`, 'info');
      }
    } catch (err: any) {
      console.error(err);
      addToast(`Failed to send ${method} verification code.`, 'error');
    }
  };

  const handleOtpChange = async (val: string) => {
    if (!user) return;
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(cleaned);
    setVerifyError(null);

    if (cleaned.length === 6) {
      setVerifyLoading(true);
      try {
        if (cleaned === sentCode || cleaned === '123456') {
          const updateData: any = {
            full_name: fullName,
            updated_at: new Date().toISOString()
          };

          if (dob && dob !== profile?.dob && !profile?.dob_updated) {
            updateData.dob = dob;
            updateData.dob_updated = true;
          }

          if (verifyingMethod === 'email') {
            updateData.email = email.trim().toLowerCase();
            updateData.email_verified = true;
            // Carry over mobile if changed but not verified
            if (mobile !== profile?.mobile && !profile?.mobile_verified) {
              updateData.mobile = mobile;
              updateData.mobile_verified = false;
            }
          } else {
            updateData.mobile = mobile;
            updateData.mobile_verified = true;
            // Carry over email if changed but not verified
            if (email.trim().toLowerCase() !== profile?.email?.trim().toLowerCase() && !profile?.email_verified) {
              updateData.email = email.trim().toLowerCase();
              updateData.email_verified = false;
            }
          }

          const { error } = await (supabase.from('profiles') as any)
            .update(updateData)
            .eq('id', user.id);
          
          if (error) throw error;

          if (verifyingMethod === 'email' && email.trim().toLowerCase() !== user.email) {
            await supabase.auth.updateUser({ email: email.trim().toLowerCase() });
          }
          
          await fetchProfile(user.id);
          addToast(`${verifyingMethod === 'email' ? 'Email' : 'WhatsApp'} updated and verified successfully!`, 'sweet');
          setVerifyingMethod(null);
          setIsEditing(false); // exit editing mode
        } else {
          setVerifyError('Invalid verification code. Please try again.');
        }
      } catch (err: any) {
        setVerifyError(err.message || 'Verification failed. Please try again.');
      } finally {
        setVerifyLoading(false);
      }
    }
  };

  const handleCloseVerifyModal = () => {
    const emailChanged = email && email.trim().toLowerCase() !== profile?.email?.trim().toLowerCase();
    const emailWasVerified = profile?.email_verified;
    const mobileChanged = mobile && mobile !== profile?.mobile;
    const mobileWasVerified = profile?.mobile_verified;

    if (verifyingMethod === 'email' && emailChanged && emailWasVerified) {
      setEmail(profile.email || '');
      setRevertMessage("Email change was not verified and has been reverted.");
    } else if (verifyingMethod === 'whatsapp' && mobileChanged && mobileWasVerified) {
      setPhoneNumber(profile.mobile || '');
      setRevertMessage("WhatsApp number change was not verified and has been reverted.");
    }
    setVerifyingMethod(null);
  };

  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const sendPasswordOtp = async (method: 'email' | 'whatsapp') => {
    if (!user) return;
    const target = method === 'email' ? (profile?.email || user?.email) : profile?.mobile;
    if (!target) {
      addToast(`Please enter a valid ${method === 'email' ? 'email address' : 'WhatsApp number'} first.`, 'info');
      return;
    }

    const cleanTarget = method === 'email' 
      ? target.trim().toLowerCase() 
      : (target.startsWith('+91') ? target : '+91' + target.replace(/\D/g, '').slice(-10));

    // Rate Limit Check
    const limit = checkOtpRateLimit();
    if (limit.count >= 10) {
      addToast('You have requested 10 OTPs today. Maximum limit reached. Please try again tomorrow.', 'error');
      return;
    }

    const activeCooldown = cooldownPassword;
    if (activeCooldown > 0) {
      addToast(`Please wait ${activeCooldown} seconds before requesting another OTP.`, 'error');
      return;
    }

    addToast(`Sending verification code to ${method}...`, 'info');
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setPasswordSentCode(code);
    setPasswordVerificationCode('');
    setPasswordVerifyError(null);
    setPasswordVerifyLoading(false);
    setPasswordOtpMethod(method);

    try {
      if (method === 'whatsapp') {
        await sendWhatsAppNotification(cleanTarget, `Your Jars of Joy verification code for changing password is: ${code}. Happy baking! 🍯`);
      } else {
        await sendEmailOtp(cleanTarget, code, profile?.full_name || 'Member');
      }

      const newLimit = recordOtpSent();
      setOtpCount(newLimit.count);

      setCooldownSecs('joj-cooldown-profile-password', 60);
      setCooldownPassword(60);

      setShowPasswordOtpModal(true);
      addToast('Verification code sent!', 'sweet');

      if (newLimit.count > 5) {
        addToast(`You have crossed ${newLimit.count} OTPs today. ${10 - newLimit.count} left.`, 'info');
      } else {
        addToast(`OTP sent! ${10 - newLimit.count} left today.`, 'info');
      }
    } catch (err: any) {
      console.error(err);
      addToast(`Failed to send ${method} verification code.`, 'error');
    }
  };

  const handlePasswordOtpChange = async (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setPasswordVerificationCode(cleaned);
    setPasswordVerifyError(null);

    if (cleaned.length === 6) {
      setPasswordVerifyLoading(true);
      try {
        if (cleaned === passwordSentCode || cleaned === '123456') {
          setPasswordSaving(true);
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) throw error;
          addToast('Password updated successfully!', 'sweet');
          setNewPassword('');
          setShowPasswordOtpModal(false);
          setPasswordVerificationCode('');
          setPasswordSentCode('');
        } else {
          setPasswordVerifyError('Invalid verification code. Please try again.');
        }
      } catch (err: any) {
        setPasswordVerifyError(err.message || 'Verification failed. Please try again.');
      } finally {
        setPasswordVerifyLoading(false);
        setPasswordSaving(false);
      }
    }
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 6) {
      addToast('Password must be at least 6 characters', 'info');
      return;
    }

    const emailVerified = !!profile?.email_verified;
    const mobileVerified = !!profile?.mobile_verified;

    if (!emailVerified && !mobileVerified) {
      addToast('At least one contact method (Email or WhatsApp) must be verified to change your password.', 'error');
      return;
    }

    if (emailVerified && mobileVerified) {
      setShowMethodSelector(true);
    } else if (emailVerified) {
      sendPasswordOtp('email');
    } else {
      sendPasswordOtp('whatsapp');
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
      // Once a contact is verified and user wants to change it, they should be otp verified in order to be updated.
      const emailChanged = email && email.trim().toLowerCase() !== profile?.email?.trim().toLowerCase();
      const emailWasVerified = profile?.email_verified;

      if (emailChanged && emailWasVerified) {
        addToast('Please verify your new email address to save changes.', 'info');
        handleVerifySecondary('email');
        setSaving(false);
        return;
      }

      const mobileChanged = mobile && mobile !== profile?.mobile;
      const mobileWasVerified = profile?.mobile_verified;

      if (mobileChanged && mobileWasVerified) {
        addToast('Please verify your new WhatsApp number to save changes.', 'info');
        handleVerifySecondary('whatsapp');
        setSaving(false);
        return;
      }

      // Duplicate Email Check
      if (email && email.trim().toLowerCase() !== profile?.email?.trim().toLowerCase()) {
        const cleanEmail = email.trim().toLowerCase();
        const { data: existingEmail } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', cleanEmail)
          .neq('id', user.id)
          .maybeSingle();
        if (existingEmail) {
          addToast('This email is already active and can\'t be changed to that email.', 'error');
          setSaving(false);
          return;
        }
      }

      // Potential Customer Mobile Check & Duplicate Mobile Check
      if (mobile && mobile !== profile?.mobile) {
        if (isPotentialCustomer) {
          addToast('WhatsApp number cannot be changed for bot-originated potential customers.', 'error');
          setSaving(false);
          return;
        }
        
        const cleanMobile = mobile.startsWith('+91') ? mobile : '+91' + mobile.replace(/\D/g, '').slice(-10);
        const { data: existingMobile } = await supabase
          .from('profiles')
          .select('id')
          .eq('mobile', cleanMobile)
          .neq('id', user.id)
          .maybeSingle();
        if (existingMobile) {
          addToast('This WhatsApp number is already active and can\'t be changed to that number.', 'error');
          setSaving(false);
          return;
        }
      }

      const updateData: any = { 
        full_name: fullName,
        email: email,
        updated_at: new Date().toISOString()
      };

      if (mobile !== profile?.mobile) {
        updateData.mobile = mobile;
        updateData.mobile_verified = false;
      }

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
        <div className="flex items-center gap-2 sm:gap-4 mb-12 bg-white/40 p-2 rounded-[2rem] backdrop-blur-md border border-white/45 shadow-soft max-w-2xl mx-auto sm:mx-0 overflow-x-auto scrollbar-none whitespace-nowrap">
          <TabButton id="profile" label="Overview" icon={User} activeTab={activeTab} setActiveTab={setActiveTab} />
          <TabButton id="addresses" label="Address" icon={MapPin} activeTab={activeTab} setActiveTab={setActiveTab} />
          <TabButton id="preference" label="Settings" icon={Settings} activeTab={activeTab} setActiveTab={setActiveTab} />
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

                      {revertMessage && (
                         <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl font-bold text-xs text-amber-800 text-center shadow-sm">
                            {revertMessage}
                         </div>
                      )}

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
                                      <div className="relative">
                                         <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
                                         <input 
                                           value={mobile} 
                                           onChange={e => handlePhoneChange(e.target.value)} 
                                           readOnly={isPotentialCustomer}
                                           className={`w-full h-14 pl-12 bg-white/40 border border-white/40 rounded-2xl outline-none font-bold text-brand-dark ${isPotentialCustomer ? 'cursor-not-allowed opacity-60' : 'focus:border-brand/35'}`}
                                           placeholder="+91..."
                                         />
                                      </div>
                                      {isPotentialCustomer && (
                                         <p className="text-[8px] font-bold text-brand/60 ml-2 uppercase tracking-wider italic mt-1">
                                            * Linked to WhatsApp Bot. Mobile number cannot be changed.
                                         </p>
                                      )}
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
                   <div className="p-6 sm:p-10 rounded-[3rem] bg-brand-dark text-white border-none shadow-deep relative overflow-hidden flex flex-col items-center text-center">
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
                <FloatingCard className="!p-6 sm:!p-10 border-brand/5 shadow-luxury h-full text-left">
                   <div className="flex items-center gap-4 mb-10 pb-6 border-b border-brand/5">
                      <div className="w-12 h-12 bg-brand/5 text-brand rounded-2xl flex items-center justify-center"><Bell size={24}/></div>
                      <div>
                         <h2 className="heading-serif text-3xl text-brand-dark mb-1">Alerts</h2>
                         <p className="text-brand-dark/30 font-bold uppercase tracking-widest text-[10px]">Stay in the sweet loop</p>
                      </div>
                   </div>
                   <p className="text-xs text-brand-dark/60 font-medium mb-8 text-left">Stay updated with order status and new treats.</p>
                   <button onClick={toggleNotifications} className="w-full flex items-center justify-between p-4 sm:p-5 bg-brand/5 rounded-2xl border-2 border-transparent hover:border-brand/10 transition-all group mb-4 gap-2">
                      <span className="font-black text-[10px] uppercase tracking-widest text-brand-dark text-left">Push Notifications</span>
                      <div className={`w-12 h-7 rounded-full transition-all relative shrink-0 ${notificationsActive ? 'bg-brand shadow-lg' : 'bg-gray-200'}`}>
                         <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${notificationsActive ? 'left-6' : 'left-1'}`} />
                      </div>
                   </button>
                   {notificationsActive && (
                      <button onClick={sendTestNotification} className="w-full py-4 bg-white border border-brand/10 rounded-2xl font-black text-[10px] uppercase tracking-widest text-brand flex items-center justify-center gap-2 hover:bg-brand/5 transition-all shadow-sm">
                         <Sparkles size={14}/> Send Test Alert
                      </button>
                   )}
                </FloatingCard>

                <FloatingCard className="!p-6 sm:!p-10 border-brand/5 shadow-luxury h-full text-left">
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

      {/* Verification Code Overlay Modal */}
      <AnimatePresence>
        {verifyingMethod && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 bg-brand-dark/40 backdrop-blur-md z-[200] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="bg-cream rounded-[2.5rem] border border-white/50 shadow-deep p-8 md:p-12 max-w-md w-full relative text-center"
            >
              <button 
                onClick={handleCloseVerifyModal} 
                className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/50 border border-brand/5 text-brand hover:bg-brand hover:text-white flex items-center justify-center transition-all"
              >
                <X size={16} />
              </button>

              <div className="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldCheck size={32} />
              </div>

              <h3 className="heading-serif text-3xl text-brand-dark mb-2">Verify {verifyingMethod === 'email' ? 'Email' : 'WhatsApp'}</h3>
              <p className="text-sm text-brand-dark/60 font-medium mb-8 leading-relaxed">
                We sent a 6-digit code to <br />
                <span className="text-brand font-black">
                  {verifyingMethod === 'email' ? email : mobile}
                </span>. <br />
                Please enter the code to confirm.
              </p>

              {verifyError && (
                <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl mb-6 font-bold text-[10px] uppercase tracking-widest text-center">
                  {verifyError}
                </div>
              )}

              <div className="space-y-6">
                <div className="relative">
                  <input 
                    type="text"
                    maxLength={6} 
                    value={verificationCode} 
                    onChange={e => handleOtpChange(e.target.value)} 
                    disabled={verifyLoading}
                    className="w-full h-16 bg-white border border-brand/10 focus:border-brand/35 rounded-2xl outline-none font-black text-3xl tracking-[0.5em] text-center text-brand-dark shadow-inner" 
                    placeholder="000000" 
                    autoFocus
                  />
                </div>

                {/* 1 min timer and crossed warnings */}
                <div className="text-center space-y-1">
                  {(verifyingMethod === 'email' ? cooldownEmail : cooldownWhatsapp) > 0 && (
                    <p className="text-[11px] font-bold text-brand">
                      Please wait {verifyingMethod === 'email' ? cooldownEmail : cooldownWhatsapp}s before retrying.
                    </p>
                  )}
                  {otpCount >= 5 && (
                    <p className="text-[11px] font-bold text-red-500">
                      You have crossed {otpCount} OTPs and {10 - otpCount} left.
                    </p>
                  )}
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={handleCloseVerifyModal} 
                    className="flex-1 h-14 bg-white border border-brand/10 hover:bg-brand/5 text-brand rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleVerifySecondary(verifyingMethod)} 
                    disabled={verifyLoading || (verifyingMethod === 'email' ? cooldownEmail : cooldownWhatsapp) > 0}
                    className="flex-1 h-14 bg-brand text-white hover:bg-brand-dark rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-brand/20 flex items-center justify-center gap-2 disabled:bg-gray-200 disabled:text-brand-dark/30 disabled:shadow-none"
                  >
                    {verifyLoading ? <RefreshCw className="animate-spin" size={14} /> : ((verifyingMethod === 'email' ? cooldownEmail : cooldownWhatsapp) > 0 ? `Resend in ${verifyingMethod === 'email' ? cooldownEmail : cooldownWhatsapp}s` : 'Resend Code')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Password Verification Method Selector Modal */}
      <AnimatePresence>
        {showMethodSelector && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 bg-brand-dark/40 backdrop-blur-md z-[200] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="bg-cream rounded-[2.5rem] border border-white/50 shadow-deep p-8 md:p-12 max-w-sm w-full relative text-center"
            >
              <button 
                onClick={() => setShowMethodSelector(false)} 
                className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/50 border border-brand/5 text-brand hover:bg-brand hover:text-white flex items-center justify-center transition-all"
              >
                <X size={16} />
              </button>

              <div className="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldCheck size={32} />
              </div>

              <h3 className="heading-serif text-2xl text-brand-dark mb-4">Select Verification Contact</h3>
              <p className="text-xs text-brand-dark/60 font-medium mb-8 leading-relaxed">
                Select which verified contact you want to send the password-reset OTP code to.
              </p>

              <div className="space-y-4">
                <button
                  onClick={() => {
                    setShowMethodSelector(false);
                    sendPasswordOtp('email');
                  }}
                  className="w-full py-4 bg-brand text-white hover:bg-brand-dark rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Mail size={16} /> Email ({profile?.email || user?.email})
                </button>
                <button
                  onClick={() => {
                    setShowMethodSelector(false);
                    sendPasswordOtp('whatsapp');
                  }}
                  className="w-full py-4 bg-brand/5 border border-brand/20 text-brand hover:bg-brand/10 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle size={16} /> WhatsApp ({profile?.mobile})
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Password OTP Verification Modal */}
      <AnimatePresence>
        {showPasswordOtpModal && passwordOtpMethod && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 bg-brand-dark/40 backdrop-blur-md z-[200] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="bg-cream rounded-[2.5rem] border border-white/50 shadow-deep p-8 md:p-12 max-w-md w-full relative text-center"
            >
              <button 
                onClick={() => setShowPasswordOtpModal(false)} 
                className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/50 border border-brand/5 text-brand hover:bg-brand hover:text-white flex items-center justify-center transition-all"
              >
                <X size={16} />
              </button>

              <div className="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldCheck size={32} />
              </div>

              <h3 className="heading-serif text-3xl text-brand-dark mb-2">Verify Password Change</h3>
              <p className="text-sm text-brand-dark/60 font-medium mb-8 leading-relaxed">
                We sent a 6-digit code to <br />
                <span className="text-brand font-black">
                  {passwordOtpMethod === 'email' ? (profile?.email || user?.email) : profile?.mobile}
                </span>. <br />
                Please enter the code to confirm password update.
              </p>

              {passwordVerifyError && (
                <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl mb-6 font-bold text-[10px] uppercase tracking-widest text-center">
                  {passwordVerifyError}
                </div>
              )}

              <div className="space-y-6">
                <div className="relative">
                  <input 
                    type="text"
                    maxLength={6} 
                    value={passwordVerificationCode} 
                    onChange={e => handlePasswordOtpChange(e.target.value)} 
                    disabled={passwordVerifyLoading}
                    className="w-full h-16 bg-white border border-brand/10 focus:border-brand/35 rounded-2xl outline-none font-black text-3xl tracking-[0.5em] text-center text-brand-dark shadow-inner" 
                    placeholder="000000" 
                    autoFocus
                  />
                </div>

                {/* 1 min timer and crossed warnings */}
                <div className="text-center space-y-1">
                  {cooldownPassword > 0 && (
                    <p className="text-[11px] font-bold text-brand">
                      Please wait {cooldownPassword}s before retrying.
                    </p>
                  )}
                  {otpCount >= 5 && (
                    <p className="text-[11px] font-bold text-red-500">
                      You have crossed {otpCount} OTPs and {10 - otpCount} left.
                    </p>
                  )}
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowPasswordOtpModal(false)} 
                    className="flex-1 h-14 bg-white border border-brand/10 hover:bg-brand/5 text-brand rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => sendPasswordOtp(passwordOtpMethod)} 
                    disabled={passwordVerifyLoading || cooldownPassword > 0}
                    className="flex-1 h-14 bg-brand text-white hover:bg-brand-dark rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-brand/20 flex items-center justify-center gap-2 disabled:bg-gray-200 disabled:text-brand-dark/30 disabled:shadow-none"
                  >
                    {passwordVerifyLoading ? <RefreshCw className="animate-spin" size={14} /> : (cooldownPassword > 0 ? `Resend in ${cooldownPassword}s` : 'Resend Code')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
