/**
 * WhatsApp integration via local Bakery Backend.
 */

import { supabase } from './supabase';

export const sendWhatsAppNotification = async (to: string, message: string) => {
  // Clean phone number: remove non-digits
  let cleanTo = to.replace(/\D/g, '');
  if (cleanTo.length === 10) {
    cleanTo = '91' + cleanTo; // Default to India if only 10 digits
  }

  try {
    const { data: urlData } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', 'whatsapp_backend_url')
      .single();
    const backendUrl = (urlData as any)?.value || `http://${window.location.hostname}:3001`;

    const response = await fetch(`${backendUrl}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: cleanTo,
        message: message,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to send WhatsApp message');
    }

    // Log the successful message to ai_logs
    await (supabase.from('ai_logs') as any).insert([{
      customer_phone: cleanTo,
      model_used: 'notification',
      prompt: message,
      response: 'Message sent via Linked Device',
      success: true
    } as any]);

    return data;
  } catch (error: any) {
    console.error('WhatsApp Notification Error:', error);
    // Log the error to ai_logs
    await (supabase.from('ai_logs') as any).insert([{
      customer_phone: cleanTo,
      model_used: 'notification',
      prompt: message,
      response: 'Failed to send',
      error: error.message,
      success: false
    } as any]);
    throw error;
  }
};

export const formatOrderMessage = (order: Record<string, unknown>, customerName: string) => {
  const itemsList = (order.items as Record<string, unknown>[])
    .map((item: Record<string, unknown>) => `• ${item.name} x${item.quantity}\n  ~₹${Math.round(Number(item.price) * 1.3) * Number(item.quantity)}~  *₹${Number(item.price) * Number(item.quantity)}*`)
    .join('\n');

  return `*New Order from Jars of Joy!* 🍯🍰\n\n` +
         `*Customer:* ${customerName}\n` +
         `*Total:* ₹${order.total}\n\n` +
         `*Items:*\n${itemsList}\n\n` +
         `*Delivery Address:* ${order.address}\n\n` +
         `Joy will contact you shortly to confirm! ✨`;
};
