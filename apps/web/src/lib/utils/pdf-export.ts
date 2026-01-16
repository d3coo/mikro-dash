import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';

interface VoucherForPDF {
  name: string;
  packageName?: string;
  priceLE: number;
}

interface PDFOptions {
  businessName: string;
  wifiSSID: string;
}

// Card layout constants
const CARDS_PER_ROW = 3;
const CARDS_PER_COL = 4;
const CARDS_PER_PAGE = CARDS_PER_ROW * CARDS_PER_COL;

/**
 * Generate a PDF with voucher cards using html2canvas for Arabic support
 */
export async function generateVoucherPDF(
  vouchers: VoucherForPDF[],
  options: PDFOptions
): Promise<Blob> {
  // Generate WiFi QR code once
  const wifiString = `WIFI:T:nopass;S:${options.wifiSSID};H:false;;`;
  const qrDataUrl = await QRCode.toDataURL(wifiString, {
    width: 200,
    margin: 1,
    errorCorrectionLevel: 'M'
  });

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const totalPages = Math.ceil(vouchers.length / CARDS_PER_PAGE);

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    if (pageIndex > 0) {
      doc.addPage();
    }

    const pageVouchers = vouchers.slice(
      pageIndex * CARDS_PER_PAGE,
      (pageIndex + 1) * CARDS_PER_PAGE
    );

    // Create HTML for this page
    const pageHtml = createPageHtml(pageVouchers, qrDataUrl, options);

    // Render to canvas
    const container = document.createElement('div');
    container.innerHTML = pageHtml;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
        scale: 2, // Higher quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // Add to PDF (A4 dimensions: 210mm x 297mm)
      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', 0, 0, 210, 297);
    } finally {
      document.body.removeChild(container);
    }
  }

  return doc.output('blob');
}

/**
 * Create HTML for a single page of voucher cards
 */
function createPageHtml(
  vouchers: VoucherForPDF[],
  qrDataUrl: string,
  options: PDFOptions
): string {
  const cards = vouchers.map(v => createCardHtml(v, qrDataUrl, options)).join('');

  return `
    <div style="
      width: 210mm;
      height: 297mm;
      padding: 10mm 15mm;
      box-sizing: border-box;
      background: white;
      font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    ">
      <div style="
        display: grid;
        grid-template-columns: repeat(3, 52mm);
        grid-template-rows: repeat(4, 65mm);
        gap: 6mm;
        justify-content: center;
      ">
        ${cards}
      </div>
    </div>
  `;
}

/**
 * Create HTML for a single voucher card
 */
function createCardHtml(
  voucher: VoucherForPDF,
  qrDataUrl: string,
  options: PDFOptions
): string {
  return `
    <table style="
      width: 52mm;
      height: 65mm;
      border: 2px solid #222;
      border-radius: 8px;
      background: white;
      border-collapse: collapse;
      overflow: hidden;
      table-layout: fixed;
    ">
      <!-- Header -->
      <tr>
        <td style="
          background: #0891b2;
          color: white;
          padding: 6px 8px;
          height: 24px;
          direction: rtl;
        ">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="text-align: right; font-size: 10px; font-weight: 700; font-family: 'Cairo', sans-serif; color: white;">${options.businessName}</td>
              <td style="text-align: left; font-size: 9px; font-weight: 600; font-family: 'Cairo', sans-serif; color: white;">${voucher.packageName || 'باقة'} | ${voucher.priceLE} ج.م</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- QR Code -->
      <tr>
        <td style="text-align: center; vertical-align: middle; background: white; padding: 4px;">
          <img src="${qrDataUrl}" style="width: 30mm; height: 30mm;" />
        </td>
      </tr>

      <!-- Code Section -->
      <tr>
        <td style="background: #f5f5f5; border-top: 1px solid #ddd; text-align: center; vertical-align: middle; padding: 6px; height: 50px;">
          <div style="font-size: 9px; color: #555; font-family: 'Cairo', sans-serif; margin-bottom: 4px;">كود الدخول</div>
          <div style="
            font-size: 22px;
            font-weight: 800;
            color: #000;
            font-family: 'Courier New', monospace;
            letter-spacing: 4px;
            background: #fff;
            padding: 8px 16px;
            border-radius: 6px;
            border: 3px solid #0891b2;
            display: inline-block;
            line-height: 22px;
          ">${voucher.name}</div>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="
          background: #1a1a1a;
          text-align: center;
          vertical-align: middle;
          height: 22px;
          color: white;
          font-size: 9px;
          font-family: 'Cairo', sans-serif;
        ">امسح للاتصال بالواي فاي ← أدخل الكود</td>
      </tr>
    </table>
  `;
}

/**
 * Download the PDF
 */
export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
