import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button3D } from './ui/Button3D';
import { FloatingCard } from './ui/FloatingCard';
import { Settings, RefreshCw, Wifi, Loader2 } from 'lucide-react';
import { useToastStore } from '../store/useToastStore';
import { io } from 'socket.io-client';

export const AdminBot = () => {
  const [config, setConfig] = useState<any[]>([]);
  const [botStatus, setBotStatus] = useState<string>('Connecting');
  const [qrCode, setQrCode] = useState<string>('');
  const [socket, setSocket] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToastStore();

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('site_content')
      .select('*')
      .eq('category', 'whatsapp');
    if (data) setConfig(data);
  };

  useEffect(() => {
    fetchConfig();

    // Connect to the WhatsApp websocket server on port 3001
    const socketUrl = `http://${window.location.hostname}:3001`;
    console.log('Connecting to WhatsApp socket at:', socketUrl);
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    newSocket.on('connect', () => {
      console.log('Socket.io connected to WhatsApp server');
    });

    newSocket.on('status', (data: { status: string; qr?: string }) => {
      console.log('Received WhatsApp status update:', data);
      setBotStatus(data.status);
      if (data.qr) {
        setQrCode(data.qr);
      } else {
        setQrCode('');
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Socket.io disconnected from WhatsApp server');
      setBotStatus('Disconnected');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const toggleBot = () => {
    if (!socket) return;
    if (botStatus === 'Connected' || botStatus === 'Scanning' || botStatus === 'Connecting') {
      socket.emit('logout');
      addToast('Requesting WhatsApp disconnect...', 'info');
    } else {
      socket.emit('reconnect');
      addToast('Attempting to reconnect WhatsApp...', 'info');
    }
  };

  const handleConfigChange = (id: string, value: string) => {
    setConfig(prev => prev.map(item => item.id === id ? { ...item, value } : item));
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      for (const item of config) {
        const { error } = await (supabase
          .from('site_content') as any)
          .update({ value: item.value })
          .eq('id', item.id);
        if (error) throw error;
      }
      addToast('WhatsApp Web configuration updated!', 'sweet');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center animate-fade-in">
        <div>
          <h2 className="text-4xl font-black text-brand-dark tracking-tight">WhatsApp Web</h2>
          <p className="text-brand-dark/40 font-bold">Monitor connection and manage agent persona</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-black uppercase tracking-wider shadow-sm transition-all duration-300 ${
          botStatus === 'Connected' ? 'bg-green-50 border-green-200 text-green-600' :
          botStatus === 'Scanning' ? 'bg-amber-50 border-amber-200 text-amber-600' :
          botStatus === 'Connecting' ? 'bg-blue-50 border-blue-200 text-blue-600 animate-pulse' :
          'bg-red-50 border-red-200 text-red-600'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full ${
            botStatus === 'Connected' ? 'bg-green-500' :
            botStatus === 'Scanning' ? 'bg-amber-500' :
            botStatus === 'Connecting' ? 'bg-blue-500' :
            'bg-red-500'
          }`} />
          {botStatus}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* WhatsApp Connection Card */}
        <FloatingCard>
          <div className="flex items-center gap-3 mb-6">
            <Wifi className="text-brand animate-pulse" />
            <h3 className="text-xl font-bold">WhatsApp Device Link</h3>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-brand/5 rounded-2xl border border-brand-light/10">
              <div className="flex items-center gap-3">
                <div className={`w-3.5 h-3.5 rounded-full ${
                  botStatus === 'Connected' ? 'bg-green-500 animate-pulse' :
                  botStatus === 'Scanning' ? 'bg-amber-500 animate-pulse' :
                  botStatus === 'Connecting' ? 'bg-blue-500 animate-pulse' :
                  'bg-red-500'
                }`} />
                <div>
                  <p className="font-black text-brand-dark text-sm leading-tight">
                    {botStatus}
                  </p>
                  <p className="text-[10px] font-bold text-brand-dark/40 uppercase tracking-wider">
                    Connection Status
                  </p>
                </div>
              </div>
              
              <Button3D
                variant={botStatus === 'Connected' || botStatus === 'Scanning' || botStatus === 'Connecting' ? 'outline' : 'primary'}
                onClick={toggleBot}
                className="scale-90"
              >
                {botStatus === 'Connected' || botStatus === 'Scanning' || botStatus === 'Connecting' ? 'Disconnect' : 'Connect'}
              </Button3D>
            </div>

            {botStatus === 'Scanning' && qrCode && (
              <div className="flex flex-col items-center justify-center p-6 bg-white/60 rounded-3xl border border-brand-light/20 shadow-sm space-y-4">
                <div className="relative p-3 bg-white rounded-2xl border-2 border-brand/10 shadow-inner">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`}
                    alt="WhatsApp QR Code"
                    className="w-48 h-48 rounded-lg"
                  />
                  <div className="absolute inset-0 border-2 border-brand/20 rounded-2xl pointer-events-none animate-pulse" />
                </div>
                <div className="text-center max-w-[220px]">
                  <p className="text-[11px] font-black text-brand-dark/70 uppercase tracking-widest mb-1">Link Your Device</p>
                  <p className="text-[10px] font-bold text-brand-dark/50 leading-relaxed">
                    Open WhatsApp on your phone &gt; Settings &gt; Linked Devices &gt; Scan this QR code.
                  </p>
                </div>
              </div>
            )}

            {botStatus === 'Connecting' && (
              <div className="flex flex-col items-center justify-center p-8 bg-brand/5 rounded-3xl border border-brand-light/10 space-y-3">
                <Loader2 className="animate-spin text-brand" size={32} />
                <p className="text-xs font-bold text-brand-dark/60 text-center">
                  Initializing WhatsApp engine... <br />
                  <span className="text-[10px] font-medium opacity-50">Please wait.</span>
                </p>
              </div>
            )}

            {botStatus === 'Connected' && (
              <div className="p-4 bg-green-50/50 border border-green-100 rounded-2xl space-y-2">
                <p className="text-[11px] font-black text-green-700 uppercase tracking-wider">Device Linked Successfully</p>
                <p className="text-[10px] font-semibold text-green-600/80 leading-relaxed">
                  Your WhatsApp account is active and linked. The bot is ready to automatically send:
                </p>
                <ul className="text-[9px] font-bold text-green-700/70 space-y-1 list-disc list-inside">
                  <li>Payment Requests</li>
                  <li>Order details & lifecycle notifications</li>
                  <li>Invoice PDFs</li>
                  <li>OTP verification codes</li>
                  <li>Password reset & change alerts</li>
                  <li>Promotions & offers</li>
                </ul>
              </div>
            )}

            {botStatus === 'Disconnected' && (
              <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl">
                <p className="text-[11px] font-black text-red-700 uppercase tracking-wider">Bot is Offline</p>
                <p className="text-[10px] font-semibold text-red-600/80 leading-relaxed mt-1">
                  Notifications and verification codes cannot be sent while disconnected. Click "Connect" to scan a QR code and link your device.
                </p>
              </div>
            )}
          </div>
        </FloatingCard>

        {/* WhatsApp Web Persona Card */}
        <FloatingCard>
          <div className="flex items-center gap-3 mb-6">
            <Settings className="text-brand" />
            <h3 className="text-xl font-bold">WhatsApp Web Persona</h3>
          </div>
          <div className="space-y-5">
            {config.length === 0 ? (
              <p className="text-sm opacity-40 italic">No WhatsApp configuration found in site_content.</p>
            ) : (
              config.map(item => (
                <div key={item.id}>
                  <label className="block text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">{item.key.replace(/_/g, ' ')}</label>
                  <textarea 
                    value={item.value}
                    onChange={(e) => handleConfigChange(item.id, e.target.value)}
                    rows={4}
                    className="w-full p-3 bg-brand/5 border-2 border-transparent focus:border-brand/20 rounded-xl outline-none font-bold text-xs resize-none transition-all"
                  />
                </div>
              ))
            )}
            <Button3D 
              className="w-full mt-4" 
              variant="secondary"
              onClick={saveConfig}
              disabled={saving}
            >
              {saving ? <RefreshCw className="animate-spin mr-2" size={16} /> : null}
              {saving ? 'Saving...' : 'Update Settings'}
            </Button3D>
          </div>
        </FloatingCard>
      </div>
    </div>
  );
};
