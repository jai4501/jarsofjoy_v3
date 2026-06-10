const express = require('express');
const cors = require('cors');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
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
        'Content-Length': data.length
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
        sendTelegramMessage('✅ <b>WhatsApp Bot Connection Active!</b>\nThe connection to your WhatsApp device is active and fully functional.');
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
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: 'info' }),
      browser: Browsers.macOS('Jars of Joy Bot'),
      connectTimeoutMs: 30000,
      keepAliveIntervalMs: 15000,
      generateHighQualityLinkPreview: true,
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Bakery Backend running on port ${PORT}`);
});
