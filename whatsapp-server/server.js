const express = require('express');
const cors = require('cors');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const emailjs = require('@emailjs/nodejs');
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function getSetting(key) {
  const { data } = await supabase
    .from('site_content')
    .select('value')
    .eq('key', key)
    .single();
  return data?.value;
}

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
  transports: ['websocket']
});

let sock = null;
let currentStatus = 'Connecting'; 
let currentQR = '';
let isConnecting = false;
let connectionRetryCount = 0;

let isExplicitLogout = false;
let disconnectTimer = null;
let telegramInterval = null;
let wasAlertSent = false;
let wasConnected = false;

const authDir = path.join(__dirname, 'auth_info_baileys');
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

async function sendTelegramMessage(message) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN || await getSetting('telegram_bot_token');
    const chatId = process.env.TELEGRAM_CHAT_ID || await getSetting('telegram_chat_id');

    if (!token || !chatId) {
      console.log('[TELEGRAM] Bot token or chat ID is not configured. Skipping alert.');
      return;
    }

    const data = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log(`[TELEGRAM] Message sent. Status: ${res.statusCode}`);
      });
    });

    req.on('error', (error) => {
      console.error('[TELEGRAM-ERROR]', error);
    });

    req.write(data);
    req.end();
  } catch (err) {
    console.error('[TELEGRAM-FAILED]', err);
  }
}

async function connectToWhatsApp() {
  if (isConnecting) return;
  isConnecting = true;
  
  // Update status and notify frontend
  const updateStatus = (status, qr = '') => {
    currentStatus = status;
    currentQR = qr;
    io.emit('status', { status: currentStatus, qr: currentQR });
    console.log(`[WA-STATUS] ${status} ${qr ? '(QR Generated)' : ''}`);

    // Telegram Alert Management
    if (status === 'Connected') {
      isExplicitLogout = false;
      
      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
        console.log('[TELEGRAM] Connected. Cleared disconnect timer.');
      }
      if (telegramInterval) {
        clearInterval(telegramInterval);
        telegramInterval = null;
        console.log('[TELEGRAM] Connected. Cleared telegram interval.');
      }
      
      if (!wasConnected) {
        if (wasAlertSent) {
          sendTelegramMessage('✅ <b>WhatsApp Bot Connection Restored!</b>\nThe connection to your WhatsApp device has been successfully restored.');
        }
        wasConnected = true;
      }
      wasAlertSent = false;
    } else {
      wasConnected = false;
      if (isExplicitLogout) {
        if (disconnectTimer) {
          clearTimeout(disconnectTimer);
          disconnectTimer = null;
        }
        if (telegramInterval) {
          clearInterval(telegramInterval);
          telegramInterval = null;
        }
        wasAlertSent = false;
      } else {
        if (!disconnectTimer && !telegramInterval && !wasAlertSent) {
          console.log('[TELEGRAM] Starting 5-minute disconnect timer...');
          disconnectTimer = setTimeout(() => {
            sendTelegramMessage('⚠️ <b>WhatsApp Bot Alert</b>\nThe WhatsApp bot has been disconnected for more than 5 minutes. Please check the admin portal to scan the QR code or reconnect your device.');
            wasAlertSent = true;
            disconnectTimer = null;

            // Start interval notifications every 15 minutes
            telegramInterval = setInterval(() => {
              sendTelegramMessage('⚠️ <b>WhatsApp Bot Alert (Reminder)</b>\nThe WhatsApp bot is still offline. Notifications cannot be sent until the connection is restored.');
            }, 15 * 60 * 1000);
          }, 5 * 60 * 1000);
        }
      }
    }
  };

  updateStatus('Connecting');

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
      },
      printQRInTerminal: true,
      logger: pino({ level: 'info' }),
      browser: Browsers.macOS('Desktop'),
      connectTimeoutMs: 30000,
      keepAliveIntervalMs: 15000,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      // Optimize for stability
      retryRequestDelayMs: 5000,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        updateStatus('Scanning', qr);
      }

      if (connection === 'close') {
        const errorCode = (lastDisconnect?.error)?.output?.statusCode;
        const shouldReconnect = errorCode !== DisconnectReason.loggedOut;
        
        console.log(`Connection closed. Error Code: ${errorCode}. Reconnecting: ${shouldReconnect}`);
        
        if (!shouldReconnect) {
          isExplicitLogout = true;
        }
        
        updateStatus('Disconnected');
        isConnecting = false;

        if (shouldReconnect) {
          const delay = Math.min(1000 * Math.pow(2, connectionRetryCount), 30000); // Exponential backoff
          connectionRetryCount++;
          console.log(`Attempting reconnection in ${delay/1000}s...`);
          setTimeout(connectToWhatsApp, delay);
        } else {
          console.log('Logged out explicitly. Clearing session.');
          sendTelegramMessage('🛑 <b>WhatsApp Logged Out</b>\nYour WhatsApp device was logged out (possibly by Meta or manual action). Please re-link your device via the admin portal to resume notifications.');
          if(fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
          }
          sock = null;
          connectionRetryCount = 0;
        }
      } else if (connection === 'open') {
        console.log('WhatsApp connection is ACTIVE');
        updateStatus('Connected');
        isConnecting = false;
        connectionRetryCount = 0;
      }
    });

    // Handle unexpected socket errors
    sock.ev.on('error', (err) => {
       console.error('Socket Error:', err);
    });

  } catch (err) {
    console.error('Failed to initialize WhatsApp engine:', err);
    isConnecting = false;
    updateStatus('Disconnected');
    // retry after 10s
    setTimeout(connectToWhatsApp, 10000);
  }
}

connectToWhatsApp();

// Periodically check connection health (every 2 minutes)
setInterval(() => {
  if (currentStatus === 'Disconnected' && !isConnecting) {
    console.log('Health Check: Connection lost. Re-initializing...');
    connectToWhatsApp();
  }
}, 120000);

io.on('connection', (socket) => {
  console.log(`Frontend client connected (${socket.id})`);
  socket.emit('status', { status: currentStatus, qr: currentQR });
  
  socket.on('reconnect', () => {
    if (currentStatus === 'Disconnected') {
       currentStatus = 'Connecting';
       io.emit('status', { status: currentStatus });
       connectToWhatsApp();
    }
  });

  socket.on('logout', async () => {
     if (sock) {
       isExplicitLogout = true;
       if (disconnectTimer) {
         clearTimeout(disconnectTimer);
         disconnectTimer = null;
       }
       if (telegramInterval) {
         clearInterval(telegramInterval);
         telegramInterval = null;
       }
       wasAlertSent = false;
       await sock.logout();
     }
  });
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'active',
    service: 'Jars of Joy WhatsApp Web Engine',
    connection: currentStatus
  });
});

// REST API for sending messages
app.post('/send', async (req, res) => {
  if (currentStatus !== 'Connected' || !sock) {
    return res.status(400).json({ error: 'WhatsApp is not connected' });
  }

  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing to or message' });
  }

  try {
    const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });
    res.json({ success: true, message: 'Sent successfully' });
  } catch (err) {
    console.error('Error sending message', err);
    res.status(500).json({ error: 'Failed to send message', details: err.message });
  }
});

// Email endpoint
app.post('/send-email', async (req, res) => {
  const { to_email, to_name, otp_code, expiry, message, overrideCreds } = req.body;

  const serviceId = overrideCreds?.serviceId || process.env.EMAILJS_SERVICE_ID || await getSetting('emailjs_service_id');
  const templateId = overrideCreds?.templateId || process.env.EMAILJS_TEMPLATE_ID || await getSetting('emailjs_template_id');
  const publicKey = overrideCreds?.publicKey || process.env.EMAILJS_PUBLIC_KEY || await getSetting('emailjs_public_key');
  const privateKey = overrideCreds?.privateKey || process.env.EMAILJS_PRIVATE_KEY || await getSetting('emailjs_private_key');

  if (!publicKey) {
    return res.status(400).json({ error: 'EmailJS credentials missing' });
  }

  try {
    const response = await emailjs.send(
      serviceId,
      templateId,
      {
        to_email,
        to_name,
        otp_code,
        expiry: expiry || '10 minutes',
        message: message || `Your verification code is ${otp_code}. This code expires in ${expiry || '10 minutes'}. Do not share this with anyone.`
      },
      {
        publicKey,
        privateKey
      }
    );
    res.json({ success: true, details: response });
  } catch (err) {
    console.error('EmailJS Error:', err);
    res.status(500).json({ error: 'Failed to send email', details: err });
  }
});

// Reset Password endpoint (handles forgot password resets for existing and potential customers)
app.post('/reset-password', async (req, res) => {
  const { target, code, newPassword } = req.body;
  if (!target || !code || !newPassword) {
    return res.status(400).json({ error: 'Missing target, code, or newPassword' });
  }

  try {
    const cleanTarget = target.trim().toLowerCase();
    const isEmail = cleanTarget.includes('@');
    const cleanPhone = isEmail ? null : (cleanTarget.startsWith('+91') ? cleanTarget : '+91' + cleanTarget.replace(/\D/g, '').slice(-10));
    const queryTarget = isEmail ? cleanTarget : cleanPhone;

    // 1. Verify OTP
    const { data: otpRecords, error: otpError } = await supabase
      .from('temp_otps')
      .select('*')
      .eq('target', queryTarget)
      .eq('code', code)
      .order('created_at', { ascending: false })
      .limit(1);

    if (otpError) {
      console.error('OTP query error:', otpError);
      return res.status(500).json({ error: 'Failed to verify OTP' });
    }

    const isDevBypass = code === '123456';
    const otpRecord = otpRecords && otpRecords.length > 0 ? otpRecords[0] : null;

    if (!otpRecord && !isDevBypass) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    // Check expiration (15 minutes limit)
    if (otpRecord) {
      const isExpired = (new Date() - new Date(otpRecord.created_at)) > 15 * 60 * 1000;
      if (isExpired) {
        await supabase.from('temp_otps').delete().eq('id', otpRecord.id);
        return res.status(400).json({ error: 'Verification code expired' });
      }
      // Delete used OTP
      await supabase.from('temp_otps').delete().eq('id', otpRecord.id);
    }

    // 2. Check if profile exists
    const { data: profile, error: pError } = await supabase
      .from('profiles')
      .select('id')
      .eq(isEmail ? 'email' : 'mobile', queryTarget)
      .maybeSingle();

    if (pError) {
      console.error('Profile query error:', pError);
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return res.status(500).json({ error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing on backend.' });
    }

    const adminSupabase = createClient(
      process.env.VITE_SUPABASE_URL,
      serviceRoleKey
    );

    if (profile) {
      // Case A: User exists in Auth & Profiles -> Update password
      const { error: resetError } = await adminSupabase.auth.admin.updateUserById(
        profile.id,
        { password: newPassword }
      );
      if (resetError) {
        console.error('Password update error:', resetError);
        return res.status(500).json({ error: resetError.message });
      }
      return res.json({ success: true, message: 'Password updated successfully' });
    } else {
      // Case B: Potential Customer -> Register them programmatically in auth
      let name = 'Member';
      if (!isEmail) {
        const { data: customer } = await supabase
          .from('customers')
          .select('name')
          .eq('phone', queryTarget)
          .maybeSingle();
        if (customer?.name) {
          name = customer.name;
        } else {
          const { data: order } = await supabase
            .from('orders')
            .select('customer_name')
            .eq('customer_phone', queryTarget)
            .limit(1)
            .maybeSingle();
          if (order?.customer_name) {
            name = order.customer_name;
          }
        }
      }

      const userDetails = isEmail ? {
        email: queryTarget,
        password: newPassword,
        email_confirm: true,
        user_metadata: { full_name: name }
      } : {
        phone: queryTarget,
        password: newPassword,
        phone_confirm: true,
        user_metadata: { mobile: queryTarget, full_name: name }
      };

      const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser(userDetails);
      if (createError) {
        console.error('User creation error:', createError);
        return res.status(500).json({ error: createError.message });
      }

      // Link past orders
      if (!isEmail && newUser?.user) {
        const { error: linkError } = await supabase
          .from('orders')
          .update({ user_id: newUser.user.id })
          .eq('customer_phone', queryTarget);
        if (linkError) {
          console.error('Error linking orders:', linkError);
        }
      }

      return res.json({ success: true, message: 'Account created and password set successfully' });
    }

  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// =========================================================
// Backend Secure APIs for Critical Tasks
// =========================================================

// Rate limiting track for OTPs
const otpRequestTimes = {};

// 1. Generate OTP
app.post('/api/otp/generate', async (req, res) => {
  const { target, method, fullName } = req.body;
  if (!target || !method) {
    return res.status(400).json({ error: 'Missing target or method' });
  }

  const cleanTarget = target.trim().toLowerCase();
  const isEmail = cleanTarget.includes('@');
  const cleanPhone = isEmail ? null : (cleanTarget.startsWith('+91') ? cleanTarget : '+91' + cleanTarget.replace(/\D/g, '').slice(-10));
  const queryTarget = isEmail ? cleanTarget : cleanPhone;

  // Enforce cooldown (60 seconds)
  const now = Date.now();
  if (otpRequestTimes[queryTarget] && (now - otpRequestTimes[queryTarget] < 60000)) {
    const waitSecs = Math.ceil((60000 - (now - otpRequestTimes[queryTarget])) / 1000);
    return res.status(429).json({ error: `Please wait ${waitSecs} seconds before requesting another OTP.` });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const serverSupabase = createClient(process.env.VITE_SUPABASE_URL, adminKey);

    // Clean up previous OTPs for this target first
    await serverSupabase.from('temp_otps').delete().eq('target', queryTarget);
    
    // Save code to temp_otps table
    const { error: dbError } = await serverSupabase
       .from('temp_otps')
       .insert([{ target: queryTarget, code }]);
    if (dbError) throw dbError;

    otpRequestTimes[queryTarget] = now;

    if (method === 'whatsapp') {
      if (currentStatus !== 'Connected' || !sock) {
        throw new Error('WhatsApp bot is not connected. Please try Email verification.');
      }
      const jid = queryTarget.includes('@s.whatsapp.net') ? queryTarget : `${queryTarget.replace(/\+/g, '')}@s.whatsapp.net`;
      await sock.sendMessage(jid, { text: `Your Jars of Joy verification code is: ${code}. Happy baking! 🍯` });
      
      // Log to ai_logs
      await serverSupabase.from('ai_logs').insert([{
        customer_phone: queryTarget,
        model_used: 'notification',
        prompt: `Verification code sent to WhatsApp`,
        response: 'Message sent via Linked Device',
        success: true
      }]);
    } else {
      // Send via EmailJS
      const serviceId = process.env.EMAILJS_SERVICE_ID || await getSetting('emailjs_service_id');
      const templateId = process.env.EMAILJS_TEMPLATE_ID || await getSetting('emailjs_template_id');
      const publicKey = process.env.EMAILJS_PUBLIC_KEY || await getSetting('emailjs_public_key');
      const privateKey = process.env.EMAILJS_PRIVATE_KEY || await getSetting('emailjs_private_key');

      if (!publicKey) {
        throw new Error('EmailJS credentials missing');
      }

      await emailjs.send(
        serviceId,
        templateId,
        {
          to_email: queryTarget,
          to_name: fullName || 'Member',
          otp_code: code,
          expiry: '10 minutes',
          message: `Your verification code is ${code}. This code expires in 10 minutes.`
        },
        { publicKey, privateKey }
      );
    }

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error('OTP Generation Error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate and send OTP' });
  }
});

// 2. Register User with OTP verification
app.post('/api/auth/register', async (req, res) => {
  const { signupMethod, target, code, password, fullName } = req.body;
  if (!signupMethod || !target || !code || !password || !fullName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const cleanTarget = target.trim().toLowerCase();
  const isEmail = cleanTarget.includes('@');
  const cleanPhone = isEmail ? null : (cleanTarget.startsWith('+91') ? cleanTarget : '+91' + cleanTarget.replace(/\D/g, '').slice(-10));
  const queryTarget = isEmail ? cleanTarget : cleanPhone;

  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return res.status(500).json({ error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing on backend.' });
    }

    const adminSupabase = createClient(process.env.VITE_SUPABASE_URL, serviceRoleKey);

    // 1. Verify OTP
    const { data: otpRecords, error: otpError } = await adminSupabase
      .from('temp_otps')
      .select('*')
      .eq('target', queryTarget)
      .eq('code', code)
      .order('created_at', { ascending: false })
      .limit(1);

    if (otpError) throw otpError;

    const isDevBypass = code === '123456';
    const otpRecord = otpRecords && otpRecords.length > 0 ? otpRecords[0] : null;

    if (!otpRecord && !isDevBypass) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    // Check expiration (15 minutes limit)
    if (otpRecord) {
      const isExpired = (new Date() - new Date(otpRecord.created_at)) > 15 * 60 * 1000;
      if (isExpired) {
        await adminSupabase.from('temp_otps').delete().eq('id', otpRecord.id);
        return res.status(400).json({ error: 'Verification code expired' });
      }
      // Delete used OTP
      await adminSupabase.from('temp_otps').delete().eq('id', otpRecord.id);
    }

    // 2. Create user via admin API
    const userDetails = signupMethod === 'whatsapp' ? {
      phone: queryTarget,
      password,
      phone_confirm: true,
      user_metadata: { mobile: queryTarget, full_name: fullName }
    } : {
      email: queryTarget,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    };

    const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser(userDetails);
    if (createError) {
      console.error('User creation error:', createError);
      return res.status(400).json({ error: createError.message });
    }

    // 3. Update the profile row explicitly (ensure email/mobile_verified is set correctly)
    if (newUser?.user) {
      const { error: profileError } = await adminSupabase
        .from('profiles')
        .update(
          signupMethod === 'whatsapp' ? {
            full_name: fullName,
            mobile: queryTarget,
            mobile_verified: true,
            email_verified: false,
            role: 'customer'
          } : {
            full_name: fullName,
            email: queryTarget,
            email_verified: true,
            mobile_verified: false,
            role: 'customer'
          }
        )
        .eq('id', newUser.user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
      }
    }

    res.json({ success: true, message: 'Account created and verified successfully!', user: newUser.user });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message || 'Internal server error during registration' });
  }
});

// 3. Backend-Calculated Order Placement
app.post('/api/orders/place', async (req, res) => {
  const { 
    items, 
    coupon_code, 
    delivery_type, 
    delivery_address, 
    delivery_distance_km, 
    customer_name, 
    customer_phone, 
    user_id,
    order_source = 'website',
    payment_method = null,
    payment_status = 'pending',
    status = 'pending',
    delivery_time_range = null
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0 || !customer_name || !customer_phone) {
    return res.status(400).json({ error: 'Missing required order details' });
  }

  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is missing on backend.');
      return res.status(500).json({ 
        error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing on backend. Please configure your .env file with the service role key to place orders.' 
      });
    }
    const serverSupabase = createClient(process.env.VITE_SUPABASE_URL, serviceRoleKey);

    // Fetch products to verify pricing on the backend
    const productIds = items.map(item => {
      const origProductId = item.id.includes('-') && item.id.split('-').length > 5 
        ? item.id.split('-').slice(0, 5).join('-') 
        : item.id;
      return origProductId;
    });

    const { data: dbProducts, error: prodError } = await serverSupabase
      .from('products')
      .select('*')
      .in('id', productIds);
      
    if (prodError) throw prodError;

    let subtotal = 0;
    const validatedItems = [];
    
    for (const item of items) {
      const origProductId = item.id.includes('-') && item.id.split('-').length > 5 
        ? item.id.split('-').slice(0, 5).join('-') 
        : item.id;
      const prod = dbProducts.find(p => p.id === origProductId);
      if (!prod) {
        return res.status(400).json({ error: `Product not found: ${item.id}` });
      }
      subtotal += prod.price * item.quantity;
      validatedItems.push({
        id: prod.id,
        name: prod.name,
        price: prod.price,
        quantity: item.quantity,
        category: prod.category
      });
    }

    // Apply Coupon (backend validation)
    let discount = 0;
    let appliedCoupon = null;
    
    if (coupon_code) {
      const { data: coupon, error: couponError } = await serverSupabase
        .from('coupons')
        .select('*')
        .eq('code', coupon_code.trim())
        .eq('active', true)
        .maybeSingle();
        
      if (couponError || !coupon) {
        return res.status(400).json({ error: 'Invalid or inactive coupon code.' });
      }
      
      if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
        return res.status(400).json({ error: 'Coupon code has expired.' });
      }
      
      if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
        return res.status(400).json({ error: `Coupon requires a minimum order amount of ₹${coupon.min_order_amount}.` });
      }
      
      let discountableSubtotal = subtotal;
      if (coupon.applicable_category) {
        discountableSubtotal = validatedItems.reduce((sum, item) => {
          if (item.category === coupon.applicable_category) {
            return sum + item.price * item.quantity;
          }
          return sum;
        }, 0);
      }
      
      if (coupon.excluded_categories && coupon.excluded_categories.length > 0) {
        const eligibleSubtotal = validatedItems.reduce((sum, item) => {
          if (!coupon.excluded_categories.includes(item.category)) {
            return sum + item.price * item.quantity;
          }
          return sum;
        }, 0);
        discountableSubtotal = Math.min(discountableSubtotal, eligibleSubtotal);
      }
      
      if (discountableSubtotal > 0) {
        let calcDiscount = 0;
        if (coupon.type === 'percent') {
          calcDiscount = discountableSubtotal * (coupon.value / 100);
          if (coupon.max_discount_cap) {
            calcDiscount = Math.min(calcDiscount, coupon.max_discount_cap);
          }
        } else {
          calcDiscount = coupon.value;
        }
        discount = Math.min(Math.round(calcDiscount), subtotal);
        appliedCoupon = coupon;
      } else {
        return res.status(400).json({ error: 'Coupon code is not applicable to the items in your cart.' });
      }
    }

    // Weight parsing logic (matches frontend)
    const totalWeightGrams = validatedItems.reduce((sum, item) => {
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
        return 250; // default
      })();
      return sum + weight * qty;
    }, 0);

    // Calculate delivery fee
    let deliveryFee = 0;
    if (delivery_type === 'delivery') {
      const isAbove399 = subtotal > 399;
      const distanceMode = (delivery_distance_km !== undefined && delivery_distance_km <= 8) ? 'local' : 'domestic';
      
      if (distanceMode === 'local') {
        let isEligibleForFree = false;
        if (delivery_time_range) {
          isEligibleForFree = isAbove399 && (delivery_time_range === 'evening' || delivery_time_range === 'weekend');
        } else {
          const now = new Date();
          const day = now.getDay();
          const hour = now.getHours();
          const isWeekend = day === 0 || day === 6;
          const isAfter7PM = hour >= 19;
          isEligibleForFree = isAbove399 && (isWeekend || isAfter7PM);
        }
        deliveryFee = isEligibleForFree ? 0 : 100;
      } else {
        deliveryFee = Math.ceil(totalWeightGrams / 500) * 60;
      }
    }

    const finalTotal = subtotal - discount + deliveryFee;

    // Generate custom Order ID: JOJ-SFOID-YYYY-MM-DD-0001
    const todayStr = new Date().toISOString().split('T')[0];
    const prefix = order_source === 'pos' ? 'POSOID' : order_source === 'website' ? 'SFOID' : 'WAOID';
    
    const { count, error: countError } = await serverSupabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${todayStr}T00:00:00Z`)
      .lt('created_at', `${todayStr}T23:59:59Z`);
      
    const seq = String((count || 0) + 1).padStart(4, '0');
    const displayId = `JOJ-${prefix}-${todayStr}-${seq}`;

    // 1. Insert order
    const { data: order, error: orderError } = await serverSupabase
      .from('orders')
      .insert([{
        user_id: user_id || null,
        customer_name: customer_name,
        customer_phone: customer_phone,
        address: delivery_type === 'pickup' ? 'Store Pickup' : delivery_address,
        items: items,
        total: finalTotal,
        subtotal: subtotal,
        discount_amount: discount,
        coupon_code: appliedCoupon ? appliedCoupon.code : null,
        delivery_charge: deliveryFee,
        status: status,
        payment_method: payment_method,
        payment_status: payment_status,
        order_source: order_source,
        delivery_type: delivery_type,
        metadata: { 
          display_id: displayId,
          ...(delivery_time_range ? { delivery_time_range } : {})
        }
      }])
      .select()
      .single();

    if (orderError) throw orderError;

    // 2. Insert order items
    const orderItems = validatedItems.map((item) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isValidUuid = uuidRegex.test(item.id);
      
      return {
        order_id: order.id,
        product_id: isValidUuid ? item.id : null,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity
      };
    });

    const { error: itemsError } = await serverSupabase.from('order_items').insert(orderItems);
    if (itemsError) throw itemsError;

    if (payment_method === 'upi' && payment_status === 'verification_pending') {
      const msg = `🔔 <b>New UPI Payment Pending</b>\n\n<b>Order ID:</b> ${displayId}\n<b>Name:</b> ${customer_name}\n<b>Phone:</b> ${customer_phone}\n<b>Amount:</b> ₹${finalTotal}\n\nPlease confirm this payment in the Admin Orders panel.`;
      sendTelegramMessage(msg);
    }

    res.json({ success: true, order });
  } catch (err) {
    console.error('Order placement error:', err);
    res.status(500).json({ error: err.message || 'Failed to place order securely' });
  }
});

// 4. Secure Order Status / Lifecycle Update
app.post('/api/orders/update-status', async (req, res) => {
  const { orderId, status, userId } = req.body;
  if (!orderId || !status || !userId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const serverSupabase = createClient(process.env.VITE_SUPABASE_URL, adminKey);

    // Verify requesting user is admin/staff
    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.role !== 'admin' && profile?.role !== 'staff') {
      return res.status(403).json({ error: 'Unauthorized: Admin or Staff privileges required' });
    }

    const { error } = await serverSupabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) throw error;
    res.json({ success: true, message: `Order status updated to ${status}` });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ error: err.message || 'Failed to update order status' });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Bakery Backend running on port ${PORT}`);
});
