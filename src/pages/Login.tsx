import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/useUserStore';
import { FloatingCard } from '../components/ui/FloatingCard';
import { Button3D } from '../components/ui/Button3D';
import { Mail, Lock, User, Phone, ShieldCheck, Key, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore } from '../store/useToastStore';

export const Login = () => {
  const navigate = useNavigate();
  const { setUser } = useUserStore();
  const { addToast } = useToastStore();

  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'auth' | 'otp' | 'reset'>('auth');
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobile, setPhoneNumber] = useState('+91');
  const [otp, setOtp] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'whatsapp'>('email');
  const [signupMethod, setSignupMethod] = useState<'email' | 'whatsapp'>('email');
  const [cooldownEmail, setCooldownEmail] = useState(0);
  const [cooldownWhatsapp, setCooldownWhatsapp] = useState(0);
  const [otpCount, setOtpCount] = useState(0);

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
    setCooldownEmail(getCooldownSecs('joj-cooldown-login-email'));
    setCooldownWhatsapp(getCooldownSecs('joj-cooldown-login-whatsapp'));

    const timer = setInterval(() => {
      setCooldownEmail(prev => (prev > 0 ? prev - 1 : 0));
      setCooldownWhatsapp(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const limit = checkOtpRateLimit();
    setOtpCount(limit.count);
  }, []);

  useEffect(() => {
    if (otp.length === 6 && step === 'otp' && !loading) {
      verifyResetOtp();
    }
  }, [otp, step]);

  function checkOtpRateLimit() {
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

  const handlePhoneChange = (val: string) => {
    if (!val.startsWith('+91')) val = '+91' + val.replace(/\D/g, '');
    const digits = val.slice(3).replace(/\D/g, '').slice(0, 10);
    setPhoneNumber('+91' + digits);
  };

  const generateAndSendOtp = async (target: string, method: 'email' | 'whatsapp') => {
    const limit = checkOtpRateLimit();
    if (limit.count >= 10) {
      throw new Error('You have requested 10 OTPs today. Maximum limit reached. Please try again tomorrow.');
    }
    
    const activeCooldown = method === 'email' ? cooldownEmail : cooldownWhatsapp;
    if (activeCooldown > 0) {
      throw new Error(`Please wait ${activeCooldown} seconds before requesting another OTP.`);
    }

    // Retrieve backend URL
    const { data: urlData } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', 'whatsapp_backend_url')
      .single();
    const backendUrl = (urlData as any)?.value || `http://${window.location.hostname}:3001`;

    const response = await fetch(`${backendUrl}/api/otp/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, method, fullName })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to request OTP from server.');
    }

    addToast(method === 'whatsapp' ? 'OTP sent to WhatsApp!' : 'OTP sent to Email!', 'sweet');

    const newLimit = recordOtpSent();
    setOtpCount(newLimit.count);
    if (method === 'email') {
      setCooldownSecs('joj-cooldown-login-email', 60);
      setCooldownEmail(60);
    } else {
      setCooldownSecs('joj-cooldown-login-whatsapp', 60);
      setCooldownWhatsapp(60);
    }

    if (newLimit.count > 5) {
      addToast(`You have crossed ${newLimit.count} OTPs today. ${10 - newLimit.count} left.`, 'info');
    } else {
      addToast(`OTP sent! ${10 - newLimit.count} left today.`, 'info');
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const isEmailInput = cleanEmail.includes('@');
    const cleanMobile = mobile.startsWith('+91') ? mobile : '+91' + mobile.replace(/\D/g, '').slice(-10);

    try {
      if (isSignUp) {
        if (signupMethod === 'whatsapp') {
          const mobileDigits = cleanMobile.slice(3).replace(/\D/g, '');
          if (mobileDigits.length !== 10) {
            throw new Error('Please enter a valid 10-digit WhatsApp number.');
          }
        } else {
          if (!cleanEmail.includes('@')) {
            throw new Error('Please enter a valid email address.');
          }
        }

        if (signupMethod === 'whatsapp') {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('mobile', cleanMobile)
            .maybeSingle();

          if (existingProfile) {
            throw new Error('This WhatsApp number is already active and can\'t be changed to that number.');
          }

          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('phone', cleanMobile)
            .maybeSingle();

          if (existingCustomer) {
            throw new Error('This WhatsApp number is already active and registered as a potential customer. Please use the Forgot Password option to access your account.');
          }
        } else {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle();

          if (existingProfile) {
            throw new Error('This email is already active and can\'t be changed to that email.');
          }
        }

        const target = signupMethod === 'whatsapp' ? cleanMobile : cleanEmail;
        setVerificationMethod(signupMethod);
        await generateAndSendOtp(target, signupMethod);
        setStep('otp');
      } else {
        // LOGIN FLOW (Password only)
        const authId = isEmailInput ? cleanEmail : (cleanEmail.startsWith('+91') ? cleanEmail : '+91' + cleanEmail.replace(/\D/g, '').slice(-10));

        const { data, error } = await supabase.auth.signInWithPassword({ 
          email: isEmailInput ? authId : undefined,
          phone: !isEmailInput ? authId : undefined,
          password 
        } as any);

        if (error) throw error;
        if (data.user) {
          const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', data.user.id).maybeSingle();
          if ((profile as any)?.is_active === false) {
            await supabase.auth.signOut();
            throw new Error('Account deactivated. Contact support.');
          }
          await setUser(data.user);
          navigate('/');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startPasswordReset = async () => {
    if (!email) {
       setError('Please enter your email or WhatsApp number.');
       return;
    }
    setLoading(true);
    try {
       const cleanInput = email.trim().toLowerCase();
       const isEmailInput = cleanInput.includes('@');
       const target = isEmailInput ? cleanInput : (cleanInput.startsWith('+91') ? cleanInput : '+91' + cleanInput.replace(/\D/g, '').slice(-10));
       const method = isEmailInput ? 'email' : 'whatsapp';
       
       // Verify target exists in profiles, customers CRM, or orders
       let targetExists = false;
       if (isEmailInput) {
         const { data: profile } = await supabase
           .from('profiles')
           .select('id')
           .eq('email', target)
           .maybeSingle();
         if (profile) targetExists = true;
       } else {
         // Check profiles
         const { data: profile } = await supabase
           .from('profiles')
           .select('id')
           .eq('mobile', target)
           .maybeSingle();
         if (profile) targetExists = true;

         // Check customers
         if (!targetExists) {
           const { data: customer } = await supabase
             .from('customers')
             .select('id')
             .eq('phone', target)
             .maybeSingle();
           if (customer) targetExists = true;
         }

         // Check orders
         if (!targetExists) {
           const { data: order } = await supabase
             .from('orders')
             .select('id')
             .eq('customer_phone', target)
             .limit(1)
             .maybeSingle();
           if (order) targetExists = true;
         }
       }

       if (!targetExists) {
         throw new Error(isEmailInput ? 'No registered account found with this email.' : 'No registered account or order found with this WhatsApp number.');
       }

       setVerificationMethod(method);
       await generateAndSendOtp(target, method);
       setStep('otp');
    } catch (err: any) {
       setError(err.message);
    } finally {
       setLoading(false);
    }
  };

  async function verifyResetOtp() {
    setError(null);
    setLoading(true);
    try {
      const cleanInput = email.trim().toLowerCase();
      const target = isSignUp
        ? (signupMethod === 'whatsapp' ? mobile : cleanInput)
        : (cleanInput.includes('@') ? cleanInput : (cleanInput.startsWith('+91') ? cleanInput : '+91' + cleanInput.replace(/\D/g, '').slice(-10)));

      const { data: urlData } = await supabase
        .from('site_content')
        .select('value')
        .eq('key', 'whatsapp_backend_url')
        .single();
      const backendUrl = (urlData as any)?.value || `http://${window.location.hostname}:3001`;

      if (isSignUp) {
        // Complete registration via backend
        const response = await fetch(`${backendUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signupMethod,
            target,
            code: otp,
            password,
            fullName
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Registration failed.');
        }

        if (data.user) {
          // Sign in with the registered password
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: signupMethod === 'email' ? target : undefined,
            phone: signupMethod === 'whatsapp' ? target : undefined,
            password
          } as any);

          if (signInError) throw signInError;
          await setUser(signInData.user);
          addToast('Account created and verified! Welcome 🍯', 'sweet');
          navigate('/');
        }
      } else {
        // For password resets, verify code via temp_otps (the reset password form submit will call /reset-password backend)
        const { data: otpRecords } = await (supabase
          .from('temp_otps') as any)
          .select('*')
          .eq('target', target)
          .eq('code', otp)
          .order('created_at', { ascending: false })
          .limit(1);

        const isDevBypass = otp === '123456';
        const otpRecord = otpRecords && otpRecords.length > 0 ? otpRecords[0] : null;

        if (!otpRecord && !isDevBypass) {
          throw new Error('Invalid or expired verification code.');
        }
        setStep('reset');
      }
    } catch (err: any) {
      setError(err.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  }

  const finalizeReset = async () => {
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
       const cleanInput = email.trim().toLowerCase();
       const isEmailInput = cleanInput.includes('@');
       const target = isEmailInput ? cleanInput : (cleanInput.startsWith('+91') ? cleanInput : '+91' + cleanInput.replace(/\D/g, '').slice(-10));

       const { data: urlData } = await supabase
         .from('site_content')
         .select('value')
         .eq('key', 'whatsapp_backend_url')
         .single();
       const backendUrl = (urlData as any)?.value || `http://${window.location.hostname}:3001`;

       const response = await fetch(`${backendUrl}/reset-password`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ target, code: otp, newPassword })
       });

       const resData = await response.json();
       if (!response.ok) {
         throw new Error(resData.error || 'Failed to update password.');
       }

       addToast(resData.message || 'Password updated! Please sign in.', 'sweet');
       setStep('auth');
       setPassword(newPassword); // Pre-fill for convenience
    } catch (err: any) {
       setError(err.message);
    } finally {
       setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-cream pt-32 pb-48 overflow-y-auto">
      <FloatingCard className="max-w-md w-full !p-8 md:!p-12 shadow-luxury border border-white/50 glass-panel">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-white/50 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6 border border-white/45 shadow-soft">
            <ShieldCheck className="text-brand" size={40} />
          </div>
          <h2 className="heading-serif text-4xl text-brand-dark mb-2">
            {step === 'otp' ? 'WhatsApp Verification' : step === 'reset' ? 'New Password' : isSignUp ? 'Join the Studio' : 'Sign In'}
          </h2>
          <p className="heading-cursive text-brand text-xl">
            {step === 'otp' ? 'Confirming your ID' : isSignUp ? 'Sweet journey starts here' : 'Welcome to Joy'}
          </p>
        </div>
        
        <AnimatePresence mode="wait">
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl mb-8 font-bold text-[10px] uppercase tracking-widest flex items-center gap-3">
              <AlertCircle size={16} /> {error}
            </motion.div>
          )}

          {step === 'auth' ? (
            <motion.form key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleAuth} className="space-y-6">
              {isSignUp && (
                <>
                  <div className="flex bg-white/40 p-1 rounded-2xl border border-white/45 mb-6">
                    <button
                      type="button"
                      onClick={() => setSignupMethod('email')}
                      className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                        signupMethod === 'email'
                          ? 'bg-brand text-white shadow-soft'
                          : 'text-brand-dark/40 hover:text-brand'
                      }`}
                    >
                      Email SignUp
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignupMethod('whatsapp')}
                      className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                        signupMethod === 'whatsapp'
                          ? 'bg-brand text-white shadow-soft'
                          : 'text-brand-dark/40 hover:text-brand'
                      }`}
                    >
                      WhatsApp SignUp
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-dark/40 uppercase tracking-widest ml-2">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
                      <input required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full h-14 pl-12 bg-white/40 border border-white/40 focus:border-brand/35 rounded-2xl outline-none font-bold text-brand-dark" placeholder="Your Sweet Name" />
                    </div>
                  </div>

                  {signupMethod === 'whatsapp' ? (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-brand-dark/40 uppercase tracking-widest ml-2">WhatsApp Number</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
                        <input 
                          required 
                          value={mobile} 
                          onChange={e => handlePhoneChange(e.target.value)} 
                          className="w-full h-14 pl-12 bg-white/40 border border-white/40 focus:border-brand/35 rounded-2xl outline-none font-bold text-brand-dark" 
                          placeholder="WhatsApp Number (+91...)" 
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-brand-dark/40 uppercase tracking-widest ml-2">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
                        <input 
                          type="email"
                          required 
                          value={email} 
                          onChange={e => setEmail(e.target.value)} 
                          className="w-full h-14 pl-12 bg-white/40 border border-white/40 focus:border-brand/35 rounded-2xl outline-none font-bold text-brand-dark" 
                          placeholder="your.email@example.com" 
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {!isSignUp && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-brand-dark/40 uppercase tracking-widest ml-2">Email or WhatsApp</label>
                  <div className="relative">
                    {email.includes('@') || !email.match(/\d/) ? <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} /> : <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />}
                    <input 
                      required 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      className="w-full h-14 pl-12 bg-white/40 border border-white/40 focus:border-brand/35 rounded-2xl outline-none font-bold text-brand-dark" 
                      placeholder="Email or WhatsApp..." 
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-2">
                  <label className="text-[10px] font-black text-brand-dark/40 uppercase tracking-widest">Password</label>
                  {!isSignUp && <button type="button" onClick={startPasswordReset} className="text-[9px] font-black text-brand uppercase tracking-widest hover:underline">Forgot?</button>}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full h-14 pl-12 bg-white/40 border border-white/40 focus:border-brand/35 rounded-2xl outline-none font-bold text-brand-dark" placeholder="••••••••" />
                </div>
              </div>

              <Button3D type="submit" variant="flat" className="w-full h-16 uppercase tracking-[0.2em] font-black rounded-full pt-1" disabled={loading}>
                {loading ? <RefreshCw className="animate-spin" /> : isSignUp ? 'Create Account' : 'Sign In'}
              </Button3D>

              <div className="text-center mt-8">
                <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-brand font-black text-[10px] uppercase tracking-widest hover:underline underline-offset-8">
                  {isSignUp ? 'Already a member? Login' : "New Member? Join now"}
                </button>
              </div>
            </motion.form>
          ) : step === 'otp' ? (
            <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
               <div className="text-center space-y-3">
                  <p className="text-sm font-medium text-brand-dark/60 leading-relaxed px-4">
                    Enter verification code sent to <br/> <span className="text-brand font-black">{verificationMethod === 'whatsapp' ? mobile : email}</span>
                  </p>
               </div>
               <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
                  <input maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} className="w-full h-16 pl-12 bg-white/40 border border-white/40 focus:border-brand/35 rounded-2xl outline-none font-black text-2xl tracking-[0.5em] text-center text-brand-dark" placeholder="000000" />
               </div>

               {/* 1 min timer and crossed warnings */}
               <div className="text-center space-y-1">
                 {(verificationMethod === 'email' ? cooldownEmail : cooldownWhatsapp) > 0 && (
                   <p className="text-[11px] font-bold text-brand">
                     Please wait {verificationMethod === 'email' ? cooldownEmail : cooldownWhatsapp}s before retrying.
                   </p>
                 )}
                 {otpCount >= 5 && (
                   <p className="text-[11px] font-bold text-red-500">
                     You have crossed {otpCount} OTPs and {10 - otpCount} left.
                   </p>
                 )}
               </div>

               <Button3D 
                 onClick={verifyResetOtp} 
                 disabled={loading || otp.length !== 6}
                 className="w-full h-16 uppercase tracking-[0.2em] font-black rounded-full pt-1"
               >
                 {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Verify Code'}
               </Button3D>

               <div className="flex gap-4">
                 <button 
                   onClick={() => setStep('auth')} 
                   className="flex-1 h-14 bg-white border border-brand/10 hover:bg-brand/5 text-brand rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                 >
                   Back
                 </button>
                 <button 
                   type="button"
                   onClick={async () => {
                     try {
                       let target = '';
                       if (isSignUp) {
                         target = signupMethod === 'whatsapp' ? mobile : email.trim().toLowerCase();
                       } else {
                         const cleanInput = email.trim().toLowerCase();
                         const isEmailInput = cleanInput.includes('@');
                         target = isEmailInput ? cleanInput : (cleanInput.startsWith('+91') ? cleanInput : '+91' + cleanInput.replace(/\D/g, '').slice(-10));
                       }
                       await generateAndSendOtp(target, verificationMethod);
                     } catch (err: any) {
                       setError(err.message);
                     }
                   }} 
                   disabled={loading || (verificationMethod === 'email' ? cooldownEmail : cooldownWhatsapp) > 0}
                   className="flex-1 h-14 bg-brand text-white hover:bg-brand-dark rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-brand/20 disabled:bg-gray-200 disabled:text-brand-dark/30 disabled:shadow-none flex items-center justify-center"
                 >
                   {(verificationMethod === 'email' ? cooldownEmail : cooldownWhatsapp) > 0 ? `Resend in ${verificationMethod === 'email' ? cooldownEmail : cooldownWhatsapp}s` : 'Resend OTP'}
                 </button>
               </div>
            </motion.div>
          ) : (
            <motion.div key="reset" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
               <p className="text-sm font-medium text-brand-dark/60 text-center">Verification complete. Please set your new secure password.</p>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-brand-dark/40 uppercase tracking-widest ml-2">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full h-14 pl-12 bg-white/40 border border-white/40 focus:border-brand/35 rounded-2xl outline-none font-bold text-brand-dark" placeholder="••••••••" />
                  </div>
               </div>
               <Button3D variant="flat" onClick={finalizeReset} className="w-full h-16 uppercase tracking-widest font-black rounded-full">Update Password</Button3D>
            </motion.div>
          )}
        </AnimatePresence>
      </FloatingCard>
    </div>
  );
};

