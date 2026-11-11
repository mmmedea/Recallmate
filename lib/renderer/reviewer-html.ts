import { GeneratedReviewerDocument, GeneratedReviewerPart } from '@/lib/ai/schemas';

export function renderReviewerHTML(doc: GeneratedReviewerDocument): string {
  // Use a deterministic font stack (Inter for body, Georgia for headings is a nice academic mix)
  // We include Google Fonts so the preview and the PDF both fetch the exact same typography.
  
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@700&display=swap');

    :root {
      --text-main: #1f2937;
      --text-muted: #4b5563;
      --border-color: #e5e7eb;
      --bg-note: #f3f4f6;
    }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: var(--text-main);
      margin: 0;
      padding: 0;
    }

    .reviewer-container {
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.5in;
      background: white;
      box-sizing: border-box;
    }

    /* Print-specific overrides to match the PDF rendering engine's page size */
    @media print {
      body {
        /* Let puppeteer inject its own page margins via config, or explicitly handle it */
        margin: 0;
      }
      .reviewer-container {
        max-width: none;
        padding: 0;
      }
    }

    /* Full-width header spanning both columns */
    .reviewer-header {
      width: 100%;
      border-bottom: 2px solid var(--text-main);
      padding-bottom: 12px;
      margin-bottom: 24px;
      column-span: all;
    }

    .reviewer-title {
      font-family: 'Merriweather', serif;
      font-size: 24pt;
      font-weight: 700;
      margin: 0 0 4px 0;
    }
    
    .reviewer-subject {
      font-size: 12pt;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0;
    }

    /* Core Layout: Continuous Newspaper Columns */
    .reviewer-body {
      column-count: 2;
      column-gap: 0.35in;
      column-rule: 1px solid var(--border-color);
    }

    /* Avoid breaks inside elements to prevent orphans/widows */
    .break-avoid {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Part Styling */
    h3.reviewer-heading {
      font-family: 'Merriweather', serif;
      font-size: 14pt;
      font-weight: 700;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      break-after: avoid;
      page-break-after: avoid;
    }

    p.reviewer-paragraph {
      margin-top: 0;
      margin-bottom: 1em;
      text-align: justify;
    }

    /* Note Callouts */
    .reviewer-note {
      background-color: var(--bg-note);
      border-left: 4px solid var(--text-main);
      padding: 12px;
      margin-bottom: 1em;
      font-size: 9.5pt;
    }
    
    .reviewer-note-title {
      font-weight: 600;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .reviewer-note ul {
      margin: 0;
      padding-left: 20px;
    }

    /* Tables */
    .reviewer-table-container {
      margin-bottom: 1em;
    }

    table.reviewer-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }

    table.reviewer-table th, 
    table.reviewer-table td {
      border: 1px solid var(--border-color);
      padding: 6px 8px;
      text-align: left;
    }

    table.reviewer-table th {
      background-color: var(--bg-note);
      font-weight: 600;
    }

    /* Process Blocks */
    .reviewer-process {
      margin-bottom: 1em;
    }
    
    .reviewer-process-step {
      display: flex;
      margin-bottom: 8px;
    }
    
    .reviewer-process-num {
      font-weight: 700;
      background: var(--text-main);
      color: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8pt;
      margin-right: 12px;
      flex-shrink: 0;
    }
    
    .reviewer-process-text {
      flex: 1;
    }
  `;

  const renderPart = (part: GeneratedReviewerPart): string => {
    switch (part.type) {
      case 'heading':
        return `<h3 class="reviewer-heading break-avoid">${escapeHtml(part.text || '')}</h3>`;
      
      case 'paragraph':
        return `<p class="reviewer-paragraph">${escapeHtml(part.text || '')}</p>`;
      
      case 'note':
        const noteItems = (part.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('');
        return `
          <div class="reviewer-note break-avoid">
            ${part.title ? `<div class="reviewer-note-title">📝 ${escapeHtml(part.title)}</div>` : ''}
            <ul>${noteItems}</ul>
          </div>
        `;
      
      case 'table':
        const headerCells = (part.columns || []).map(c => `<th>${escapeHtml(c)}</th>`).join('');
        const rowCells = (part.rows || []).map(row => 
          `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
        ).join('');
        return `
          <div class="reviewer-table-container break-avoid">
            <table class="reviewer-table">
              <thead><tr>${headerCells}</tr></thead>
              <tbody>${rowCells}</tbody>
            </table>
          </div>
        `;
      
      case 'process':
        const stepsHtml = (part.steps || []).map((step, i) => `
          <div class="reviewer-process-step break-avoid">
            <div class="reviewer-process-num">${i + 1}</div>
            <div class="reviewer-process-text">${escapeHtml(step)}</div>
          </div>
        `).join('');
        return `<div class="reviewer-process">${stepsHtml}</div>`;
      
      default:
        return '';
    }
  };

  const bodyContent = doc.parts.map(renderPart).join('\\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(doc.title)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="reviewer-container">
    <header class="reviewer-header">
      <h1 class="reviewer-title">${escapeHtml(doc.title)}</h1>
      <p class="reviewer-subject">${escapeHtml(doc.subject)}</p>
    </header>
    <section class="reviewer-body">
      ${bodyContent}
    </section>
  </div>
</body>
</html>`;
}

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
