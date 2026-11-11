import puppeteer from 'puppeteer-core';
import { GeneratedReviewerDocument } from '@/lib/ai/schemas';
import { renderReviewerHTML } from './reviewer-html';

export async function renderReviewerPdf(doc: GeneratedReviewerDocument): Promise<Buffer> {
  const html = renderReviewerHTML(doc);
  
  // Pivot to external WebSocket rendering (Browserless) for Vercel
  const browserWSEndpoint = process.env.BROWSERLESS_WSS_URL;
  
  if (!browserWSEndpoint) {
    throw new Error("PDF rendering requires BROWSERLESS_WSS_URL to be set in the environment.");
  }

  const browser = await puppeteer.connect({ browserWSEndpoint });
  
  try {
    const page = await browser.newPage();
    
    // We inject the HTML and wait until network is idle (crucial for Google Fonts to load)
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Setup explicit PDF layout matches the UI and CSS
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.7in', // Extra bottom margin for footer
        left: '0.5in'
      },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>', // We handled header inside HTML natively via .reviewer-header
      footerTemplate: `
        <div style="width: 100%; font-size: 8pt; font-family: Inter, sans-serif; display: flex; justify-content: space-between; padding: 0 0.5in; color: #4b5563;">
          <span>${escapeHtmlForFooter(doc.subject)} — REVIEWER</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function escapeHtmlForFooter(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
