/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { Save, RefreshCw, Phone, Truck, Clock, MessageSquare, ShieldCheck, Mail, Trash2, Upload, ImageIcon } from 'lucide-react';
import { useToastStore } from '../store/useToastStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { sendEmailOtp } from '../lib/email';

interface SiteContent {
  key: string;
  value: string;
  category: string;
}

export const AdminSettings = () => {
  const { fetchSettings: fetchGlobalSettings } = useSettingsStore();
  const [settings, setSettings] = useState<SiteContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const { addToast } = useToastStore();

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from('site_content')
      .select('key, value, category')
      .order('category', { ascending: true });
    
    if (error) {
      addToast('Failed to load settings', 'error');
    } else if (data) {
      setSettings(data);
    }
    setLoading(false);
  };

  const handleUpdate = (key: string, value: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      for (const setting of settings) {
        await (supabase
          .from('site_content') as any)
          .update({ value: setting.value })
          .eq('key', setting.key);
      }
      addToast('All settings updated!', 'sweet');
      await fetchGlobalSettings();
      fetchSettings();
    } catch (err) {
      addToast('Error saving settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    const testRecipient = settings.find(s => s.key === 'emailjs_test_recipient')?.value;
    const serviceId = settings.find(s => s.key === 'emailjs_service_id')?.value || '';
    const templateId = settings.find(s => s.key === 'emailjs_template_id')?.value || '';
    const publicKey = settings.find(s => s.key === 'emailjs_public_key')?.value || '';

    if (!testRecipient) {
      addToast('Please set a test recipient email first', 'info');
      return;
    }

    setTestEmailLoading(true);
    try {
      await sendEmailOtp(testRecipient, '123456', 'Admin Test', {
        serviceId,
        templateId,
        publicKey
      });
      addToast(`Test email sent to ${testRecipient}!`, 'sweet');
    } catch (err: any) {
      addToast(err.message || 'Failed to send test email', 'error');
    } finally {
      setTestEmailLoading(false);
    }
  };

  const saveCategorySettings = async (category: string) => {
    setSaving(true);
    try {
      const categoryItems = settings.filter(s => (s.category || 'general') === category);
      for (const item of categoryItems) {
        await (supabase
          .from('site_content') as any)
          .update({ value: item.value })
          .eq('key', item.key);
      }
      addToast(`${category.charAt(0).toUpperCase() + category.slice(1)} settings updated!`, 'sweet');
      await fetchGlobalSettings();
      fetchSettings();
    } catch (err) {
      addToast('Error saving section settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `Logo/business_logo_${Date.now()}.${fileExt}`;
      const bucketName = 'products';
      
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      // Update business_logo key in settings or create it
      const logoKey = 'business_logo';
      const existing = settings.find(s => s.key === logoKey);
      
      if (existing) {
        await (supabase.from('site_content') as any)
          .update({ value: publicUrl })
          .eq('key', logoKey);
      } else {
        await (supabase.from('site_content') as any)
          .insert([{ key: logoKey, value: publicUrl, category: 'general' }]);
      }

      addToast('Logo updated successfully!', 'sweet');
      await fetchGlobalSettings();
      fetchSettings();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const deleteSetting = async (key: string) => {
    if (!window.confirm(`Delete setting ${key}?`)) return;
    const { error } = await (supabase.from('site_content') as any).delete().eq('key', key);
    if (!error) {
      addToast('Key removed', 'sweet');
      fetchSettings();
    }
  };

  const groupedSettings = settings.reduce((acc, curr) => {
    const cat = curr.category || 'general';
    // Specifically filter out WhatsApp number as it's now in AdminBot
    if (curr.key === 'whatsapp_number') return acc;
    // Remove specific categories as requested
    if (['about', 'general', 'hero', 'support', 'location', 'whatsapp'].includes(cat)) return acc;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(curr);
    return acc;
  }, {} as Record<string, SiteContent[]>);

  // Group categories into sections for better organization
  const sectionDefinitions = [
    {
      title: 'Business Identity',
      description: 'Brand presence and business details',
      categories: ['business']
    },
    {
      title: 'Operations & Logistics',
      description: 'Delivery zones, fees and prep times',
      categories: ['delivery', 'preparation']
    },
    {
      title: 'Communication Channels',
      description: 'Contact information',
      categories: ['contact']
    },
    {
      title: 'Technical & Legal',
      description: 'System integrations and legal compliance',
      categories: ['legal', 'emailjs', 'payment', 'social', 'telegram']
    }
  ];

  // Map settings to sections and identify "other" categories
  const mappedCategories = new Set(sectionDefinitions.flatMap(s => s.categories));
  const otherCategories = Object.keys(groupedSettings).filter(cat => !mappedCategories.has(cat));

  const getIcon = (category: string) => {
    switch (category) {
      case 'contact': return <Phone size={18} />;
      case 'delivery': return <Truck size={18} />;
      case 'preparation': return <Clock size={18} />;
      case 'whatsapp': return <MessageSquare size={18} />;
      case 'legal': return <ShieldCheck size={18} />;
      case 'emailjs': return <Mail size={18} />;
      default: return <Save size={18} />;
    }
  };

  const logoUrl = settings.find(s => s.key === 'business_logo')?.value;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <RefreshCw className="text-brand animate-spin" size={40} />
        <p className="font-black text-brand uppercase tracking-widest text-xs">Accessing System Core...</p>
      </div>
    );
  }

  const renderCategory = (category: string) => {
    const items = groupedSettings[category];
    if (!items || items.length === 0) return null;

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        key={category} 
        className="fluid-glass p-10 rounded-[3.5rem] glossy-edge flex flex-col h-full"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 pb-6 border-b border-brand/5 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand/10 text-brand rounded-2xl flex items-center justify-center shadow-inner shrink-0">
              {getIcon(category)}
            </div>
            <h3 className="text-2xl font-black text-brand-dark capitalize leading-tight">{category} Configuration</h3>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {category === 'emailjs' && (
              <button 
                onClick={handleTestEmail}
                disabled={testEmailLoading}
                className="flex-1 sm:flex-none h-10 px-4 bg-brand/5 text-brand rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand/10 transition-all disabled:opacity-50"
              >
                {testEmailLoading ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
                TEST
              </button>
            )}
            <button 
              onClick={() => saveCategorySettings(category)}
              disabled={saving}
              className="flex-1 sm:flex-none h-10 px-6 bg-brand text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-brand/10 hover:scale-105 transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              SAVE
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {items.map(item => (
            <div key={item.key} className="space-y-2.5 relative group/item">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-2 block">
                  {item.key.replace(/_/g, ' ')}
                </label>
                <button 
                  onClick={() => deleteSetting(item.key)}
                  className="opacity-0 group-hover/item:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              {item.value.length > 50 ? (
                <textarea 
                  value={item.value}
                  onChange={(e) => handleUpdate(item.key, e.target.value)}
                  className="w-full bg-white/50 border-2 border-brand/5 rounded-2xl p-5 font-bold text-brand-dark outline-none focus:border-brand/20 transition-all min-h-[100px] resize-none"
                />
              ) : (
                <input 
                  type="text"
                  value={item.value}
                  onChange={(e) => handleUpdate(item.key, e.target.value)}
                  className="w-full h-14 bg-white/50 border-2 border-brand/5 rounded-2xl px-6 font-bold text-brand-dark outline-none focus:border-brand/20 transition-all"
                />
              )}
            </div>
          ))}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h2 className="heading-serif text-5xl text-brand-dark mb-2">Ecosystem Configuration</h2>
          <p className="text-brand-dark/40 font-black uppercase tracking-[0.2em] text-xs">Manage essential studio parameters</p>
        </div>
        <button 
          onClick={saveSettings}
          disabled={saving}
          className="bg-brand text-white px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-lg shadow-brand/20 hover:scale-105 transition-all active:scale-95 disabled:opacity-50"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          Apply Global Updates
        </button>
      </div>

      {/* Brand Identity / Logo Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fluid-glass p-10 rounded-[3.5rem] border border-brand/5 bg-white/20"
      >
        <div className="flex flex-col md:flex-row items-center gap-12">
           <div className="relative group">
              <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-deep border-4 border-white overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} className="w-full h-full object-cover" alt="Business Logo" />
                ) : (
                  <div className="text-brand-dark/10 flex flex-col items-center">
                    <ImageIcon size={48} />
                  </div>
                )}
              </div>
              <label className="absolute bottom-2 right-2 w-10 h-10 bg-brand text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-all border-2 border-white">
                {uploadingLogo ? <RefreshCw size={18} className="animate-spin" /> : <Upload size={18} />}
                <input type="file" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} accept="image/*" />
              </label>
           </div>
           
           <div className="flex-1 text-center md:text-left space-y-4">
              <h3 className="text-3xl font-black text-brand-dark">Brand Identity</h3>
              <p className="text-brand-dark/60 font-medium leading-relaxed max-w-xl">
                 Upload your official business logo. This will be automatically used in the app header, footer, and generated PDFs (Menu & Invoices).
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                 <span className="bg-brand/5 text-brand px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-brand/10">Official Logo</span>
                 <span className="bg-white text-brand-dark/40 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-brand/5 shadow-sm">2048 x 2048px Recommended</span>
              </div>
           </div>
        </div>
      </motion.div>

      <div className="space-y-16">
        {sectionDefinitions.map(section => {
          const sectionCategories = section.categories.filter(cat => groupedSettings[cat]);
          if (sectionCategories.length === 0) return null;

          return (
            <div key={section.title} className="space-y-8">
              <div className="px-6">
                <h3 className="text-3xl font-black text-brand-dark">{section.title}</h3>
                <p className="text-brand-dark/40 font-bold uppercase tracking-widest text-[10px] mt-1">{section.description}</p>
              </div>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                {sectionCategories.map(renderCategory)}
              </div>
            </div>
          );
        })}

        {otherCategories.length > 0 && (
          <div className="space-y-8">
            <div className="px-6">
              <h3 className="text-3xl font-black text-brand-dark">Miscellaneous</h3>
              <p className="text-brand-dark/40 font-bold uppercase tracking-widest text-[10px] mt-1">Other configuration keys found in database</p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
              {otherCategories.map(renderCategory)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
