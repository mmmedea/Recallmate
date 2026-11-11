export type GeneratedNotesData = {
  fileName?: string;
  summary?: string;
  notes?: string[];
  source?: import('@/lib/source/academic-source').AcademicSource;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]!));
}

function cleanLine(value: string) {
  const line = value.replace(/\bloading(?:\.{1,3})?/gi, " ").replace(/\s+/g, " ").trim();
  if (!line || /^(?:loading\.{0,3}|factors?|effects?)$/i.test(line)) return "";
  return line;
}

function splitExtractedUnits(value: string) {
  return value
    .split(/\r?\n|\s+[•·]\s*/)
    .map(cleanLine)
    .filter(Boolean);
}

function parseFactorsEffects(value: string) {
  const content = value.replace(/^factors?\s+effects?\s*/i, "").trim();
  if (content === value || !content) return null;
  const matches = [...content.matchAll(/(?:^|[.;]\s+)([A-Z][A-Za-z0-9 /&()'-]{1,45}?)\s+(?=(?:Increased|Decreased|Unchanged|No change)\b)/g)];
  if (!matches.length) return null;
  const rows: Array<[string, string]> = [];
  for (let index = 0; index < matches.length; index++) {
    const match = matches[index];
    const factor = cleanLine(match[1]);
    const effectStart = (match.index || 0) + match[0].lastIndexOf(match[1]) + match[1].length;
    const effectEnd = index + 1 < matches.length ? matches[index + 1].index! : content.length;
    const effects = cleanLine(content.slice(effectStart, effectEnd).replace(/^[\s:;.-]+|[\s;.-]+$/g, ""));
    if (factor && effects) rows.push([factor, effects]);
  }
  return rows.length ? rows : null;
}

function isHeading(value: string) {
  return value.length <= 90 && !/[.!?]$/.test(value) && (
    /^(?:\d+[A-Z]?\.?\s+)?[A-Z][A-Z0-9 /&()+,:-]{3,}$/.test(value) ||
    /^(?:chapter|lesson|section|part)\s+[\dIVXLC]+\b/i.test(value)
  );
}

function isFormula(value: string) {
  return /(?:^|\s)[A-Za-z][A-Za-z0-9 ()/%.-]{0,42}\s*=\s*[^=]+$/.test(value);
}

export function buildEditableNotesHtml(data: GeneratedNotesData) {
  const title = cleanLine(data.fileName || "Study notes") || "Study notes";
  const rawSummary = cleanLine(data.summary || "");
  const summary = rawSummary.toLowerCase() === title.toLowerCase() || rawSummary.toLowerCase().startsWith(title.toLowerCase()) ? "" : rawSummary;
  const seen = new Set<string>();
  const sourceLines = (Array.isArray(data.notes) ? data.notes : [])
    .flatMap(note => splitExtractedUnits(String(note)))
    .filter(line => {
      const key = line.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key) || key === title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()) return false;
      seen.add(key);
      return true;
    });

  const body: string[] = [];
  let listOpen = false;
  const closeList = () => {
    if (listOpen) body.push("</ul>");
    listOpen = false;
  };

  for (const line of sourceLines) {
    const unbulleted = line.replace(/^(?:[-•*]|\d+[.)])\s*/, "");
    const factorRows = parseFactorsEffects(unbulleted);
    if (factorRows) {
      closeList();
      body.push("<table><thead><tr><th>Factor</th><th>Effects</th></tr></thead><tbody>");
      for (const [factor, effects] of factorRows) {
        body.push(`<tr><td>${escapeHtml(factor)}</td><td>${escapeHtml(effects)}</td></tr>`);
      }
      body.push("</tbody></table>");
    } else if (isFormula(unbulleted)) {
      closeList();
      body.push(`<aside><strong>FORMULA</strong><p>${escapeHtml(unbulleted)}</p></aside>`);
    } else if (isHeading(unbulleted)) {
      closeList();
      body.push(`<h2>${escapeHtml(unbulleted)}</h2>`);
    } else {
      if (!listOpen) body.push("<ul>");
      listOpen = true;
      body.push(`<li>${escapeHtml(unbulleted)}</li>`);
    }
  }
  closeList();

  return [
    `<h1>${escapeHtml(title)}</h1>`,
    summary ? `<p class="lead">${escapeHtml(summary)}</p>` : "",
    ...body,
  ].join("");
}
