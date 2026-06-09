/* eslint-disable @typescript-eslint/no-explicit-any */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ========================================================
// Bakery Store: Generative AI WhatsApp Bot (Debug Version)
// ========================================================

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN")
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") 

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

// ── Helpers ──────────────────────────────────────────────

async function sendWhatsApp(to: string, message: string) {
  const response = await fetch(
    `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      }),
    }
  );
  const data = await response.json();
  if (!response.ok) {
    console.error("WhatsApp API Error:", JSON.stringify(data));
  } else {
    console.log(`AI message delivered to ${to}`);
  }
}

async function sendTelegram(message: string) {
  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    }
  )
}

async function getAIResponse(userMessage: string, context: string, chatHistory: any[]) {
  if (!GEMINI_API_KEY) {
    console.error("DEBUG: GEMINI_API_KEY is missing!");
    return null;
  }

  try {
    // Using Gemini 3 Flash for better performance and availability
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    // Process chat history to ensure alternating roles and merge consecutive same-role messages
    const cleanedHistory: any[] = [];
    for (const msg of chatHistory) {
      if (cleanedHistory.length > 0 && cleanedHistory[cleanedHistory.length - 1].role === msg.role) {
        // Merge with previous message if same role
        cleanedHistory[cleanedHistory.length - 1].parts[0].text += "\n" + msg.parts[0].text;
      } else {
        cleanedHistory.push(msg);
      }
    }

    // Ensure the history doesn't end with a model message if we are about to append a user message
    // Actually, contents + userMessage is fine as long as they alternate.
    
    const requestBody = {
      contents: [
        ...cleanedHistory,
        { role: "user", parts: [{ text: userMessage }] }
      ],
      system_instruction: {
        parts: [{ text: context }]
      },
      generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
       console.error("DEBUG: Gemini API HTTP Error:", response.status, JSON.stringify(data));
       return null;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      console.error("DEBUG: Gemini API returned no text. Full response:", JSON.stringify(data));
      return null;
    }

    return text;
  } catch (err) {
    console.error("DEBUG: AI Fetch Exception:", (err as Error).message);
    return null;
  }
}

// ── Main Logic ───────────────────────────────────────────

async function processMessage(from: string, text: string) {
  console.log(`DEBUG: Processing message from ${from}`);

  // 1. Fetch Context
  const [{ data: products }, { data: siteInfo }] = await Promise.all([
    supabase.from("products").select("name, price, description, category"),
    supabase.from("site_content").select("key, value")
  ]);

  const productContext = products?.map(p => `- ${p.name} (${p.category}): ₹${p.price}. ${p.description}`).join("\n") || "";
  const brandInfo = siteInfo?.map(i => `${i.key}: ${i.value}`).join(", ") || "";

  const systemContext = `
    You are the AI Assistant for our premium bakery.
    Brand Info: ${brandInfo}
    Current Menu:
    ${productContext}

    Guidelines:
    1. Be warm, professional, and helpful like a human host.
    2. If a user wants to order a standard item, guide them.
    3. If they want a CUSTOM order (e.g., custom themes, large weddings), tell them you'll notify the owner immediately.
    4. Keep replies concise but sweet.
  `;

  // 2. Chat History
  const { data: messages } = await supabase
    .from("whatsapp_messages")
    .select("content, direction")
    .eq("customer_phone", from)
    .order("created_at", { ascending: false })
    .limit(10); // Increased limit for better context

  const history = messages?.reverse()
    .filter(m => m.content !== "I'm having a little trouble thinking! 🧁 Please wait a moment or reply with 'menu'.")
    .filter(m => m.content !== text) // Avoid including the current message if it was already logged
    .map(m => ({
      role: m.direction === "inbound" ? "user" : "model",
      parts: [{ text: m.content }]
    })) || [];

  // 3. Get AI Reply
  let aiReply = await getAIResponse(text, systemContext, history);

  if (!aiReply) {
    aiReply = "I'm having a little trouble thinking! 🧁 Please wait a moment or reply with 'menu'.";
  }

  // 4. Custom Order Detection
  if (text.toLowerCase().includes("custom") || text.toLowerCase().includes("theme") || text.toLowerCase().includes("wedding")) {
    await sendTelegram(`⚠️ *CUSTOM ORDER REQUEST* from +${from}\n"${text}"`);
  }

  // 5. Send & Save
  await sendWhatsApp(from, aiReply);
  await supabase.from("whatsapp_messages").insert({
    customer_phone: from,
    content: aiReply,
    direction: "outbound",
    sender_type: "bot"
  });
}

// ── Server ───────────────────────────────────────────────

serve(async (req) => {
  const { method } = req;
  const url = new URL(req.url);

  if (method === "GET") {
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (token === VERIFY_TOKEN) return new Response(challenge, { status: 200 });
    return new Response("Forbidden", { status: 403 });
  }

  if (method === "POST") {
    try {
      const body = await req.json();
      const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      if (message) {
        const from = message.from;
        const text = message.text?.body?.trim() || "";
        
        console.log(`Incoming from +${from}: ${text}`);

        // 1. Log Inbound
        await supabase.from("whatsapp_messages").insert({
          customer_phone: from,
          content: text,
          direction: "inbound",
          sender_type: "system"
        });

        // 2. Notify Telegram
        await sendTelegram(`📩 *Message from +${from}*\n"${text}"`);

        // 3. Process
        await processMessage(from, text);
      }
    } catch (err) {
      console.error("SERVER ERROR:", (err as Error).message);
    }

    return new Response("OK", { status: 200 })
  }

  return new Response("Not Found", { status: 404 })
})
