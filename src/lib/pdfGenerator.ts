import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Type definitions for internal use
interface Product {
  name: string;
  price: number;
  category: string;
  description?: string;
  tags?: string[];
  images?: string[];
  active?: boolean;
  variations?: { name: string; price: number }[];
}

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  created_at: string;
  total: number;
  items: OrderItem[];
  address: string;
  customer_name?: string;
}

const BRAND_COLOR: [number, number, number] = [159, 18, 57]; // #9F1239 - Deep Berry
const TEXT_COLOR: [number, number, number] = [46, 12, 28]; // Darker Berry for text
const ACCENT_COLOR: [number, number, number] = [159, 18, 57]; // Same as brand

// Robust image loader with timeout
const loadImage = (url: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    const timeout = setTimeout(() => resolve(''), 5000); // 5s timeout
    
    img.onload = () => {
      clearTimeout(timeout);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.6)); // High compression
      } catch (e) {
        resolve('');
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve('');
    };
    img.src = url;
  });
};

export const generateMenuPDF = async (products: Product[], businessInfo: Record<string, string>) => {
  const doc = new jsPDF();
  const info = {
    name: businessInfo.business_name || 'Your Business Name',
    owner: businessInfo.owner_name || 'Your Name',
    address: businessInfo.address_full || 'Your Business Address',
    city: businessInfo.address_city || 'City',
    phone: businessInfo.contact_phone || '+91 00000 00000',
    fssai: businessInfo.fssai_number || '00000000000000',
    tagline: businessInfo.business_tagline || 'Homemade with Love',
    logo: businessInfo.business_logo || ''
  };

  const drawHeader = async (isContinuation = false, categoryName = '') => {
    // Background
    doc.setFillColor(255, 245, 247);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setFillColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
    doc.rect(0, 0, 210, 2, 'F');
    
    if (!isContinuation) {
      if (info.logo) {
         const logoData = await loadImage(info.logo);
         if (logoData) {
            try { doc.addImage(logoData, 'JPEG', 95, 10, 20, 20); } catch (e) { console.warn('Failed to add logo to PDF:', e); }
         }
      }

      doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.text(info.name, 105, info.logo ? 40 : 25, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(info.tagline, 105, info.logo ? 47 : 32, { align: 'center' });

      doc.setDrawColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
      doc.setLineWidth(0.5);
      doc.line(80, info.logo ? 51 : 36, 130, info.logo ? 51 : 36);
    } else {
      doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`${categoryName} (Continued)`, 15, 15);
      doc.setDrawColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
      doc.setLineWidth(0.2);
      doc.line(15, 18, 195, 18);
    }
  };

  const activeProducts = products.filter(p => p.active !== false).sort((a, b) => a.price - b.price);
  const categories = [...new Set(activeProducts.map(p => p.category || 'Specials'))].sort();

  await drawHeader();
  let currentY = info.logo ? 65 : 50;

  for (const category of categories) {
    const categoryProducts = activeProducts.filter(p => (p.category || 'Specials') === category);

    if (currentY > 230) {
      doc.addPage();
      await drawHeader();
      currentY = info.logo ? 65 : 50;
    }

    doc.setFillColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);
    doc.roundedRect(15, currentY, 180, 12, 6, 6, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(category.toUpperCase(), 25, currentY + 8);
    
    doc.setFontSize(9);
    doc.text('SIZES / PRICES', 185, currentY + 8, { align: 'right' });

    currentY += 20;

    for (const p of categoryProducts) {
      const variationCount = p.variations?.length || 0;
      const itemHeight = Math.max(40, 20 + (variationCount * 6));

      if (currentY + itemHeight > 275) {
        doc.addPage();
        await drawHeader(true, category);
        currentY = 25; 
      }

      doc.setFillColor(255, 255, 255);
      doc.roundedRect(15, currentY, 180, itemHeight - 5, 5, 5, 'F');
      doc.setDrawColor(255, 230, 240);
      doc.setLineWidth(0.1);
      doc.roundedRect(15, currentY, 180, itemHeight - 5, 5, 5, 'S');

      let imgData = '';
      if (p.images && p.images[0]) { imgData = await loadImage(p.images[0]); }

      if (imgData) {
        try { doc.addImage(imgData, 'JPEG', 20, currentY + 5, 30, 30); } 
        catch (e) {
          doc.setFillColor(245, 245, 245); doc.rect(20, currentY + 5, 30, 30, 'F');
          doc.setTextColor(180, 180, 180); doc.setFontSize(24); doc.text('🧁', 28, currentY + 25);
        }
      } else {
        doc.setFillColor(245, 245, 245); doc.rect(20, currentY + 5, 30, 30, 'F');
        doc.setTextColor(180, 180, 180); doc.setFontSize(24); doc.text('🧁', 28, currentY + 25);
      }

      doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(p.name, 58, currentY + 12);

      if (p.tags && p.tags.length > 0) {
        doc.setFontSize(7);
        doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
        doc.text(p.tags.join(' • ').toUpperCase(), 58, currentY + 18);
      }

      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(p.description || '', 90);
      doc.text(lines, 58, currentY + 24);

      doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
      doc.setFont('helvetica', 'bold');
      if (p.variations && p.variations.length > 0) {
        doc.setFontSize(9);
        p.variations.forEach((v, vIdx) => {
          doc.text(`${v.name}: Rs.${v.price}`, 185, currentY + 12 + (vIdx * 6), { align: 'right' });
        });
      } else {
        doc.setFontSize(16);
        doc.text(`Rs.${p.price}`, 185, currentY + 22, { align: 'right' });
      }

      currentY += itemHeight;
    }
    currentY += 10;
  }

  const pages = (doc as any).internal.pages.length - 1;
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`${info.owner} | ${info.phone} | FSSAI: ${info.fssai}`, 105, 288, { align: 'center' });
    doc.text(`Page ${i} of ${pages}`, 195, 288, { align: 'right' });
  }

  doc.save(`${info.name.replace(/\s+/g, '_')}_Menu.pdf`);
};

export const generateInvoicePDF = async (order: Order, businessInfo: Record<string, string>) => {
  const doc = new jsPDF();
  const info = {
    name: businessInfo.business_name || 'JARS OF JOY',
    owner: businessInfo.owner_name || 'Sneha',
    address: businessInfo.address_full || 'PRK Garden, Cheran Ma Nagar',
    phone: businessInfo.contact_phone || '+91 76959 64392',
    fssai: businessInfo.fssai_number || '22426552000456',
    logo: businessInfo.business_logo || ''
  };

  doc.setFillColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.rect(0, 0, 210, 45, 'F');

  if (info.logo) {
    const logoData = await loadImage(info.logo);
    if (logoData) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(15, 6, 14, 14, 2, 2, 'F');
        doc.addImage(logoData, 'JPEG', 16, 7, 12, 12);
      } catch (e) {
        console.warn('Failed to add logo to invoice:', e);
      }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICIAL INVOICE', 15, 35);
  doc.setFontSize(18);
  doc.text(info.name.toUpperCase(), 195, 22, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('HANDCRAFTED WITH LOVE', 195, 28, { align: 'right' });
  doc.setFontSize(9);
  doc.text(`${info.owner} | ${info.phone}`, 195, 36, { align: 'right' });
  doc.text(info.address, 195, 40, { align: 'right' });

  const detailsY = 60;
  doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', 15, detailsY);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(order.customer_name || 'Valued Customer', 15, detailsY + 7);
  doc.text(order.address || 'N/A', 15, detailsY + 14, { maxWidth: 80 });

  doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE DETAILS:', 130, detailsY);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  const orderId = order.id?.slice(0, 8).toUpperCase() || 'UNKNOWN';
  doc.text(`Invoice No: #INV-${orderId}`, 130, detailsY + 7);
  doc.text(`Order Date: ${new Date(order.created_at).toLocaleDateString('en-IN')}`, 130, detailsY + 13);
  doc.text(`FSSAI No: ${info.fssai}`, 130, detailsY + 19);

  const tableData = (order.items || []).map((item, idx) => [
    idx + 1,
    item.name,
    item.quantity,
    `Rs. ${Number(item.price).toFixed(2)}`,
    `Rs. ${(item.quantity * item.price).toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: detailsY + 45,
    head: [['#', 'Description', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 5 },
    columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 1: { cellWidth: 90 }, 2: { halign: 'center', cellWidth: 20 }, 3: { halign: 'right', cellWidth: 35 }, 4: { halign: 'right', cellWidth: 35 } },
    alternateRowStyles: { fillColor: [250, 250, 250] }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setDrawColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.setLineWidth(0.5);
  doc.line(130, finalY - 5, 195, finalY - 5);
  doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.text('GRAND TOTAL:', 130, finalY); doc.text(`Rs. ${Number(order.total).toFixed(2)}`, 195, finalY, { align: 'right' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
  doc.text('Notes: Please pay via UPI and share screenshot on WhatsApp.', 15, finalY + 20);
  doc.setFontSize(11); doc.setFont('helvetica', 'italic'); doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.text(`"Thank you for letting ${info.name} be part of your joy!"`, 105, 270, { align: 'center' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
  doc.text(`This is a computer-generated invoice. No signature required.`, 105, 285, { align: 'center' });

  doc.save(`Invoice_${orderId}.pdf`);
};
