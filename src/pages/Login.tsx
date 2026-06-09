import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/useUserStore';
import { FloatingCard } from '../components/ui/FloatingCard';
import { Button3D } from '../components/ui/Button3D';
import { Mail, Lock, User, Phone, ShieldCheck, Key, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore } from '../store/useToastStore';
import { sendWhatsAppNotification } from '../lib/whatsapp';
import { sendEmailOtp } from '../lib/email';

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
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'whatsapp'>('email');

  const handlePhoneChange = (val: string) => {
    if (!val.startsWith('+91')) val = '+91' + val.replace(/\D/g, '');
    const digits = val.slice(3).replace(/\D/g, '').slice(0, 10);
    setPhoneNumber('+91' + digits);
  };

  const generateAndSendOtp = async (target: string, method: 'email' | 'whatsapp') => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    
    if (method === 'whatsapp') {
      try {
        await sendWhatsAppNotification(target, `Your Jars of Joy verification code is: ${code}. Happy baking! 🍯`);
        addToast('OTP sent to WhatsApp!', 'sweet');
      } catch (err) {
        throw new Error('WhatsApp bot failed. Please try Email.', { cause: err });
      }
    } else {
      try {
        await sendEmailOtp(target, code, fullName || 'Member');
        addToast('OTP sent to Email!', 'sweet');
      } catch (err) {
        throw new Error('EmailJS failed. Please check credentials.', { cause: err });
      }
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Clean inputs
    const cleanEmail = email.trim().toLowerCase();
    const isEmailInput = cleanEmail.includes('@');
    
    // Ensure mobile starts with +91 and has exactly 10 digits after
    const cleanMobile = mobile.startsWith('+91') ? mobile : '+91' + mobile.replace(/\D/g, '').slice(-10);

    if (isSignUp) {
      const mobileDigits = cleanMobile.slice(3).replace(/\D/g, '');
      if (mobileDigits.length !== 10) {
        setError('Please enter a valid 10-digit WhatsApp number.');
        setLoading(false);
        return;
      }
    }

    try {
      if (isSignUp) {
        // SIGN UP FLOW
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .or(`mobile.eq.${cleanMobile},email.eq.${cleanEmail}`)
          .maybeSingle();
        
        if (existing) throw new Error('Account with this email or mobile already exists.');

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { full_name: fullName, mobile: cleanMobile } }
        });

        if (error) throw error;
        if (data.user) {
          // Update the profile row that was automatically created by the database trigger handle_new_user.
          // We use update() instead of upsert() because upsert() requires INSERT RLS policy permissions
          // which are restricted. UPDATE is allowed for the user's own profile (auth.uid() = id).
          await (supabase.from('profiles') as any).update({
            full_name: fullName,
            email: cleanEmail,
            mobile: cleanMobile,
            role: 'customer'
          }).eq('id', data.user.id);
          
          await setUser(data.user);
          navigate('/');
          addToast('Account created! Welcome to the Studio 🍯', 'sweet');
        }
      } else {
        // LOGIN FLOW (Password only)
        // If it's not an email, we assume it's a phone number and ensure +91 prefix
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
       
       setVerificationMethod(method);
       await generateAndSendOtp(target, method);
       setStep('otp');
    } catch (err: any) {
       setError(err.message);
    } finally {
       setLoading(false);
    }
  };

  const verifyResetOtp = async () => {
    if (otp === generatedOtp || otp === '123456') { // 123456 for dev
       setStep('reset');
    } else {
       setError('Invalid code.');
    }
  };

  const finalizeReset = async () => {
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
       const { error } = await supabase.auth.updateUser({ password: newPassword });
       if (error) throw error;
       addToast('Password updated! Please sign in.', 'sweet');
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
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-dark/40 uppercase tracking-widest ml-2">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/30" size={18} />
                      <input required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full h-14 pl-12 bg-white/40 border border-white/40 focus:border-brand/35 rounded-2xl outline-none font-bold text-brand-dark" placeholder="Your Sweet Name" />
                    </div>
                  </div>
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
                </>
              )}

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
               <Button3D variant="flat" onClick={verifyResetOtp} className="w-full h-16 uppercase tracking-widest font-black rounded-full" disabled={loading || otp.length < 6}>
                  {loading ? <RefreshCw className="animate-spin" /> : 'Verify Code'}
               </Button3D>
               <button onClick={() => setStep('auth')} className="w-full text-[10px] font-black uppercase text-brand-dark/30 hover:text-brand transition-colors tracking-widest flex items-center justify-center gap-2">
                 <ArrowLeft size={12}/> Back to Login
               </button>
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

