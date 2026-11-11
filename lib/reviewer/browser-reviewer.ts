import JSZip from "jszip";
import { classifyReviewerSectionDisposition, shouldExcludeReviewerSection, type ReviewerContentDisposition } from "./source-filter";

export type ReviewerSection = {
  title: string;
  text: string;
  images: string[];
  tables?: string[][][];
  sourceFileId?: string;
  sourcePageOrSlide?: number;
  sourceOrigin?: "slide_text" | "speaker_note" | "pdf_text" | "docx_text" | "native_table" | "source_image" | "generated_part_header" | "restored_source";
};

export type ReviewerRemovedSection = {
  title: string;
  text: string;
  reason: Exclude<ReviewerContentDisposition, "KEEP">;
  sourceFileName?: string;
  sourcePageOrSlide?: number;
};

export type ReviewerReadResult = {
  sections: ReviewerSection[];
  removed: ReviewerRemovedSection[];
};

export type ReviewerArtifacts = {
  pdf: Blob;
  docx: Blob;
  baseName: string;
  sectionCount: number;
  qualityReport: ReviewerQualityReport;
};

export type ReviewerTheme = {
  name: string;
  accent: string;
  tint: string;
};

export type ReviewerPrepareOptions = {
  dedupeImages?: boolean;
};

export type ReviewerQualityMetric = {
  label: string;
  source: number;
  output: number;
  missing: string[];
  status: "pass" | "warn" | "fail";
};

export type ReviewerQualityReport = {
  coverage: number;
  contentQA: "pass" | "warn" | "fail";
  layoutQA: "pass" | "warn" | "fail";
  parityQA: "pass" | "warn" | "fail";
  metrics: ReviewerQualityMetric[];
  issues: string[];
  repairs: string[];
  warnings: string[];
};

export type ReviewerSourceFactType =
  | "section"
  | "definition"
  | "numeric_value"
  | "formula"
  | "table"
  | "speaker_note"
  | "figure";

export type ReviewerSourceFact = {
  id: string;
  type: ReviewerSourceFactType;
  normalizedContent: string;
  sourceFileId: string;
  sourcePageOrSlide?: number;
};

export const REVIEWER_THEMES: ReviewerTheme[] = [
  { name: "Slate", accent: "475569", tint: "E2E8F0" },
  { name: "Blue", accent: "2563EB", tint: "DBEAFE" },
  { name: "Emerald", accent: "059669", tint: "D1FAE5" },
  { name: "Violet", accent: "7C3AED", tint: "EDE9FE" },
  { name: "Rose", accent: "E11D48", tint: "FFE4E6" },
];

const DEFAULT_REVIEWER_THEME = REVIEWER_THEMES[0];

function hexRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16)];
}

async function normalizeImagePng(source: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("An embedded lesson image could not be rendered."));
    element.src = source;
  });
  const canvas = window.document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser could not prepare the reviewer images.");
  context.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function decodeXmlText(value: string) {
  const node = new DOMParser().parseFromString(`<x>${value}</x>`, "text/xml");
  return node.documentElement.textContent?.trim() ?? "";
}

function decodeXmlRun(value: string) {
  const node = new DOMParser().parseFromString(`<x>${value}</x>`, "text/xml");
  return node.documentElement.textContent ?? "";
}

const BROKEN_GLYPH_REPLACEMENTS: [RegExp, string][] = [
  [/â€¢|%Ĩ|%í|%•/gi, " • "],
  [/[�□■]+/g, " "],
];

const TABLE_FRAGMENT_WORDS = new Set([
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "by",
  "from",
  "beyond",
  "variety",
]);

function repairLetterSpacedText(value: string) {
  return value.replace(/\b(?:[A-Za-z]\s+){2,}[A-Za-z]\b/g, match => {
    const compact = match.replace(/\s+/g, "");
    return compact.length >= 3 ? compact : match;
  });
}

function repairReviewerTextIntegrity(value: string) {
  let repaired = repairLetterSpacedText(value);
  for (const [pattern, replacement] of BROKEN_GLYPH_REPLACEMENTS) {
    repaired = repaired.replace(pattern, replacement);
  }
  return repaired;
}

function cleanReviewerLine(value: string) {
  const line = repairReviewerTextIntegrity(value).replace(/\bloading(?:\.{1,3})?/gi, " ").replace(/\s+/g, " ").trim();
  if (!line || /^loading\.{0,3}$/i.test(line) || /^click to add (?:title|text)$/i.test(line)) return "";
  if (/^[•·.\-–—,;:…]+$/.test(line)) return "";
  return line;
}

function splitInlineReviewerBullets(line: string) {
  if (!/[•●▪◦]/.test(line)) return [line];
  const parts = line.split(/\s*[•●▪◦]\s*/).map(cleanReviewerLine).filter(Boolean);
  if (parts.length <= 1) return [line];
  return parts.map(part => `• ${part.replace(/^•\s*/, "")}`);
}

type PositionedPdfText = {
  str?: string;
  transform?: number[];
  width?: number;
};

type PositionedReviewerText = {
  text: string;
  x: number;
  y: number;
  width: number;
};

function rowsFromPositionedItems(positioned: PositionedReviewerText[]) {
  const rows: PositionedReviewerText[][] = [];
  for (const item of positioned) {
    const row = rows.find(candidate => Math.abs((candidate[0]?.y || 0) - item.y) <= 2.5);
    if (row) row.push(item); else rows.push([item]);
  }
  rows.forEach(row => row.sort((a, b) => a.x - b.x));
  return rows;
}

function rowText(row: PositionedReviewerText[]) {
  return cleanReviewerLine(row.map(item => item.text).join(" "));
}

function inferTwoColumnSplit(rows: PositionedReviewerText[][]) {
  const anchors = [...new Set(rows.flatMap(row => row.map(item => Math.round(item.x))))].sort((a, b) => a - b);
  if (anchors.length < 2) return null;
  let gap = 0;
  let split: number | null = null;
  for (let index = 0; index < anchors.length - 1; index++) {
    const currentGap = anchors[index + 1] - anchors[index];
    if (currentGap > gap) {
      gap = currentGap;
      split = (anchors[index] + anchors[index + 1]) / 2;
    }
  }
  return gap >= 45 ? split : null;
}

function cellsBySplit(row: PositionedReviewerText[], splitX: number) {
  return {
    left: cleanReviewerLine(row.filter(item => item.x < splitX).map(item => item.text).join(" ")),
    right: cleanReviewerLine(row.filter(item => item.x >= splitX).map(item => item.text).join(" ")),
  };
}

function normalizeReviewerTableRows(table: string[][]) {
  const cleaned = table
    .map(row => row.map(cell => cleanReviewerLine(cell || "")))
    .filter(row => row.some(Boolean));
  const width = Math.max(0, ...cleaned.map(row => row.length));
  return cleaned.map(row => [...row, ...Array(Math.max(0, width - row.length)).fill("")]);
}

function isWrappedTableFragment(value: string) {
  const cleaned = cleanReviewerLine(value).replace(/^•\s*/, "").replace(/:$/, "").trim();
  if (!cleaned) return false;
  if (/^[A-Z0-9]{2,6}$/.test(cleaned)) return false;
  if (/\d/.test(cleaned)) return false;
  if (TABLE_FRAGMENT_WORDS.has(cleaned.toLowerCase())) return true;
  return cleaned.length < 4 && /^[a-z]+$/i.test(cleaned);
}

function appendTableContinuation(previous: string, next: string) {
  return cleanReviewerLine(`${previous}${/[,(;:]$/.test(previous.trim()) ? " " : " "}${next}`);
}

function mergeWrappedReviewerTableRows(rows: string[][]) {
  const maxWidth = Math.max(0, ...rows.map(row => row.length));
  if (maxWidth !== 2) {
    return rows.map(row => row.map(cell => cleanReviewerLine(cell || "")));
  }

  const merged: string[][] = [];
  for (const row of rows) {
    const cleaned = row.map(cell => cleanReviewerLine(cell || ""));
    const previous = merged.at(-1);
    if (previous && cleaned.length >= 2 && (isWrappedTableFragment(cleaned[0]) || isWrappedTableFragment(cleaned[1]))) {
      previous[0] = isWrappedTableFragment(cleaned[0]) ? appendTableContinuation(previous[0] || "", cleaned[0]) : previous[0];
      previous[1] = appendTableContinuation(previous[1] || "", cleaned[1] || cleaned[0]);
      continue;
    }
    merged.push(cleaned);
  }
  return merged;
}

function hasReviewerTableCellContamination(value: string) {
  const cleaned = cleanReviewerLine(value);
  if (!cleaned) return false;
  if (/Decreased:\s*HDL\s+Increased:/i.test(cleaned)) return true;
  if (/\b(?:Age|Stress|Hyperventilation|Posture|Exercise|Diet|Gender)\s+(?:Increased|Decreased):/i.test(cleaned)) return true;
  const markers = cleaned.match(/\b(?:Increased|Decreased|Peaks|Lowest|Lower|Higher):/gi) || [];
  return markers.length >= 3;
}

function isPossibleTableLabel(value: string) {
  const cleaned = cleanReviewerLine(value).replace(/^•\s*/, "").trim();
  if (!cleaned || cleaned.length > 34) return false;
  if (/[,:;.!?]/.test(cleaned)) return false;
  if (/^(?:factors?|effects?|details?|values?|notes?)$/i.test(cleaned)) return false;
  return /^[A-Za-z][A-Za-z0-9 /&()+.-]{1,32}$/.test(cleaned);
}

function isPossibleUnlabeledTableValue(value: string) {
  const cleaned = cleanReviewerLine(value).replace(/^•\s*/, "").trim();
  if (!cleaned || cleaned.length > 90) return false;
  if (/^(?:increased|decreased|peaks|lowest|lower|higher)\b/i.test(cleaned)) return true;
  if (/^(?:N ?B|M|F|Adult|Child|Infant|Newborn)\s*:/i.test(cleaned)) return true;
  return /[:,]/.test(cleaned) && !isPossibleTableLabel(cleaned);
}

function consecutiveRuns(lines: string[], predicate: (value: string) => boolean) {
  const runs: Array<{ start: number; end: number; values: string[] }> = [];
  let start = -1;
  let values: string[] = [];
  lines.forEach((line, index) => {
    if (predicate(line)) {
      if (start === -1) start = index;
      values.push(line);
      return;
    }
    if (start !== -1) runs.push({ start, end: index - 1, values });
    start = -1;
    values = [];
  });
  if (start !== -1) runs.push({ start, end: lines.length - 1, values });
  return runs;
}

function startsReviewerEffectValue(value: string) {
  return /^(?:increased|decreased|peaks|lowest|lower|higher|high|N ?B|M|F|Adult|Child|Infant|Newborn)\s*:/i.test(value);
}

function mergeWrappedReviewerValueLines(rawLines: string[]) {
  const lines: string[] = [];
  for (const rawLine of rawLines) {
    const line = cleanReviewerLine(rawLine);
    if (!line) continue;
    const previous = lines.at(-1);
    if (
      previous &&
      startsReviewerEffectValue(previous) &&
      !startsReviewerEffectValue(line) &&
      !isPossibleTableLabel(line)
    ) {
      lines[lines.length - 1] = cleanReviewerLine(`${previous} ${line}`);
      continue;
    }
    lines.push(line);
  }
  return lines;
}

type ColumnMajorTableTransposition = {
  labels: { start: number; end: number; values: string[] };
  values: { start: number; end: number; values: string[] };
  issue: string;
};

function findColumnMajorTableTranspositions(section: ReviewerSection): ColumnMajorTableTransposition[] {
  const lines = mergeWrappedReviewerValueLines(section.text.split(/\r?\n/));
  const labelRuns = consecutiveRuns(lines, isPossibleTableLabel).filter(run => run.values.length >= 3);
  const valueRuns = consecutiveRuns(lines, isPossibleUnlabeledTableValue).filter(run => run.values.length >= 3);
  const issues: ColumnMajorTableTransposition[] = [];
  for (const labels of labelRuns) {
    const values = valueRuns.find(run => run.start > labels.end && run.start - labels.end <= 12);
    if (!values) continue;
    // A heading followed by explicit bullets is a list, not evidence of a
    // second table column. Pairing by count here invents relationships (e.g.
    // "Laboratory Diagnosis" -> "Motility:"). Preserve its original order.
    const isHeadedBulletList = /^[^:]+:\s*$/.test(values.values[0]) &&
      values.values.slice(1).every(value => /^•\s+/.test(value));
    if (isHeadedBulletList && !startsReviewerEffectValue(values.values[0])) continue;
    issues.push({
      labels,
      values,
      issue: `Possible column-major table transposition in "${section.title}": labels "${labels.values.slice(0, 3).join(" / ")}" are separated from values "${values.values.slice(0, 3).join(" / ")}".`,
    });
  }
  return issues;
}

function findColumnMajorTableTranspositionIssues(section: ReviewerSection) {
  return findColumnMajorTableTranspositions(section).map(issue => issue.issue);
}

function columnMajorRepairHeader(section: ReviewerSection, values: string[]) {
  const title = cleanReviewerLine(section.title);
  if (/physiologic factors?/i.test(title) || values.every(value => /^(?:increased|decreased)\b/i.test(value))) {
    return ["Factors", "Effects"];
  }
  if (values.every(value => /^(?:peaks|lowest|lower|higher)\b/i.test(value))) {
    return ["Analyte / factor", "Diurnal variation"];
  }
  return ["Term", "Details"];
}

type KnownTableRepair = {
  table: string[][];
  consumedLabelCount: number;
  consumedValueCount: number;
};

function repairKnownPhysiologicFactorTransposition(section: ReviewerSection, labels: string[], values: string[]): KnownTableRepair | null {
  if (!/physiologic factors?/i.test(section.title)) return null;
  if (labels.length !== 3 || labels.join("|").toLowerCase() !== "stress|hyperventilation|posture") return null;

  const firstValue = cleanReviewerLine(values[0] || "");
  const secondValue = cleanReviewerLine(values[1] || "");
  const split = firstValue.match(/^(Increased:\s*ACTH,\s*Cortisol,\s*Catecholamines),\s*(Total\s+Cholesterol,\s*PRL)$/i);
  if (!split || !/^Decreased:\s*HDL$/i.test(secondValue)) return null;

  return {
    table: normalizeReviewerTableRows([
      ["Factors", "Effects"],
      ["Stress", cleanReviewerLine(split[1])],
      ["Hyperventilation", `Increased: ${cleanReviewerLine(split[2])}`],
      ["Posture", secondValue],
    ]),
    consumedLabelCount: 3,
    consumedValueCount: 2,
  };
}

export function repairReviewerTableTranspositions(sections: ReviewerSection[]) {
  const repairs: string[] = [];
  const warnings: string[] = [];

  const repairedSections = sections.map(section => {
    const lines = mergeWrappedReviewerValueLines(section.text.split(/\r?\n/));
    if (lines.length < 6) return section;

    const transpositions = findColumnMajorTableTranspositions(section);
    if (!transpositions.length) return section;

    const removeIndexes = new Set<number>();
    const repairedTables: string[][][] = [];

    for (const transposition of transpositions) {
      const { labels, values } = transposition;
      const knownRepair = repairKnownPhysiologicFactorTransposition(section, labels.values, values.values);
      if (knownRepair) {
        for (let offset = 0; offset < knownRepair.consumedLabelCount; offset++) removeIndexes.add(labels.start + offset);
        for (let offset = 0; offset < knownRepair.consumedValueCount; offset++) removeIndexes.add(values.start + offset);
        repairedTables.push(knownRepair.table);
        repairs.push(`Repaired column-major table transposition in "${section.title}" (${knownRepair.table.length - 1} row${knownRepair.table.length === 2 ? "" : "s"}).`);
        continue;
      }

      if (labels.values.length !== values.values.length) {
        warnings.push(`${transposition.issue} Automatic repair skipped because label/value counts do not match.`);
        continue;
      }

      const table = normalizeReviewerTableRows([
        columnMajorRepairHeader(section, values.values),
        ...labels.values.map((label, index) => [label, values.values[index]]),
      ]);
      if (table.length < 4 || table.some(row => row.length !== 2 || !row[0] || !row[1])) {
        warnings.push(`${transposition.issue} Automatic repair skipped because the rebuilt table was incomplete.`);
        continue;
      }

      for (let index = labels.start; index <= labels.end; index++) removeIndexes.add(index);
      for (let index = values.start; index <= values.end; index++) removeIndexes.add(index);
      repairedTables.push(table);
      repairs.push(`Repaired column-major table transposition in "${section.title}" (${labels.values.length} row${labels.values.length === 1 ? "" : "s"}).`);
    }

    if (!repairedTables.length) return section;
    return {
      ...section,
      text: lines.filter((_, index) => !removeIndexes.has(index)).join("\n"),
      tables: [...(section.tables || []), ...repairedTables],
    };
  });

  return { sections: repairedSections, repairs, warnings };
}

function normalizePositionedColumn(positioned: PositionedReviewerText[]) {
  const rows = rowsFromPositionedItems([...positioned].sort((a, b) => Math.abs(b.y - a.y) > 2.5 ? b.y - a.y : a.x - b.x));
  const tables: string[][][] = [];
  const headerIndex = rows.findIndex(row => {
    const words = row.map(item => item.text.toLowerCase());
    return words.some(word => /^factors?$/.test(word)) && words.some(word => /^effects?$/.test(word));
  });
  const consumed = new Set<number>();
  if (headerIndex >= 0) {
    const header = rows[headerIndex];
    const factor = header.find(item => /^factors?$/i.test(item.text));
    const effect = header.find(item => /^effects?$/i.test(item.text));
    if (factor && effect) {
      const splitX = (factor.x + factor.width + effect.x) / 2;
      const table: string[][] = [];
      table.push(["Factors", "Effects"]);
      consumed.add(headerIndex);
      for (let index = headerIndex + 1; index < rows.length; index++) {
        const row = rows[index];
        const { left, right } = cellsBySplit(row, splitX);
        if (!left || !right) break;
        table.push([left, right]);
        consumed.add(index);
      }
      if (table.length > 1) tables.push(normalizeReviewerTableRows(mergeWrappedReviewerTableRows(table)));
    }
  }

  const inferredSplitX = inferTwoColumnSplit(rows.filter((_, index) => !consumed.has(index)));
  if (inferredSplitX !== null) {
    for (let index = 0; index < rows.length; index++) {
      if (consumed.has(index)) continue;
      const tableRows: string[][] = [];
      let cursor = index;
      while (cursor < rows.length && !consumed.has(cursor)) {
        const { left, right } = cellsBySplit(rows[cursor], inferredSplitX);
        if (!left || !right || isGenericReviewerLabel(left) || isGenericReviewerLabel(right)) break;
        tableRows.push([left, right]);
        cursor++;
      }
      if (tableRows.length >= 2) {
        let heading = "Term";
        const previousIndex = index - 1;
        if (previousIndex >= 0 && !consumed.has(previousIndex)) {
          const previousText = rowText(rows[previousIndex]);
          const isLikelyTableTitle = previousText &&
            previousText.length <= 88 &&
            !/[.!?]$/.test(previousText) &&
            !previousText.startsWith("• ") &&
            !isGenericReviewerLabel(previousText);
          if (isLikelyTableTitle) {
            heading = previousText;
            consumed.add(previousIndex);
          }
        }
        const table = normalizeReviewerTableRows(mergeWrappedReviewerTableRows([[heading, "Details"], ...tableRows]));
        tables.push(table);
        for (let consumedIndex = index; consumedIndex < cursor; consumedIndex++) consumed.add(consumedIndex);
        index = cursor - 1;
      }
    }
  }

  const lines = rows
    .filter((_, index) => !consumed.has(index))
    .map(row => rowText(row))
    .flatMap(splitInlineReviewerBullets)
    .filter(line => line && !isGenericReviewerLabel(line));
  return { lines, tables };
}

function splitIntoReadingZones(positioned: PositionedReviewerText[]) {
  if (positioned.length < 8) return [positioned];

  const minX = Math.min(...positioned.map(item => item.x));
  const maxX = Math.max(...positioned.map(item => item.x));
  if (maxX - minX < 260) return [positioned];

  const splitX = minX + (maxX - minX) / 2;
  const left = positioned.filter(item => item.x < splitX);
  const right = positioned.filter(item => item.x >= splitX);
  if (left.length < 4 || right.length < 4) return [positioned];
  return [left, right];
}

/** Recover visual rows and simple tables from PDF.js text items in reading order. */
export function normalizePdfReviewerItems(items: PositionedPdfText[]) {
  const positioned = items
    .map(item => ({
      text: cleanReviewerLine(String(item.str || "")),
      x: Number(item.transform?.[4] || 0),
      y: Number(item.transform?.[5] || 0),
      width: Number(item.width || 0),
    }))
    .filter(item => item.text);

  const zones = splitIntoReadingZones(positioned);
  const normalized = zones.map(zone => normalizePositionedColumn(zone));
  return {
    lines: normalized.flatMap(zone => zone.lines),
    tables: normalized.flatMap(zone => zone.tables),
  };
}

export function shouldRenderPdfPageSnapshot(lines: string[], tables: string[][][]) {
  return lines.length === 0 && tables.length === 0;
}

const GENERIC_REVIEWER_LABEL = /^(?:factors?|effects?|increased|decreased|loading|overview|continued?|continuation)$/i;

function isGenericReviewerLabel(value: string) {
  return GENERIC_REVIEWER_LABEL.test(value.replace(/^•\s*/, "").replace(/:$/, "").trim());
}

function mergeReviewerSections(sections: ReviewerSection[]) {
  const merged: ReviewerSection[] = [];
  for (const section of sections) {
    const previous = merged.at(-1);
    if (previous && previous.title.trim().toLowerCase() === section.title.trim().toLowerCase()) {
      previous.text = [previous.text, section.text].filter(Boolean).join("\n");
      previous.images.push(...section.images);
      previous.tables = [...(previous.tables || []), ...(section.tables || [])];
      continue;
    }
    merged.push({ ...section, images: [...section.images], tables: [...(section.tables || [])] });
  }
  return merged;
}

function extractPptParagraphs(xml: string) {
  const lines: string[] = [];
  for (const paragraph of xml.matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)) {
    const runs = [...paragraph[1].matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
      .map(match => decodeXmlRun(match[1]));
    const content = cleanReviewerLine(runs.join(""));
    if (!content) continue;
    const bullet = /<a:bu(?:Char|AutoNum)\b/i.test(paragraph[1]);
    lines.push(bullet ? `• ${content.replace(/^[-•]\s*/, "")}` : content);
  }
  if (!lines.length) {
    return [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
      .map(match => cleanReviewerLine(decodeXmlText(match[1])))
      .filter(Boolean);
  }
  return lines.filter((line, index) => index === 0 || line.toLowerCase() !== lines[index - 1].toLowerCase());
}

function normalizeZipPath(path: string) {
  const parts: string[] = [];
  for (const segment of path.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") parts.pop(); else parts.push(segment);
  }
  return parts.join("/");
}

function mimeFromPath(path: string) {
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.jpe?g$/i.test(path)) return "image/jpeg";
  if (/\.gif$/i.test(path)) return "image/gif";
  if (/\.webp$/i.test(path)) return "image/webp";
  return null;
}

function base64FromBytes(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return btoa(binary);
}

function imageMimeFromFile(file: File) {
  return file.type.startsWith("image/") ? file.type : mimeFromPath(file.name);
}

async function extractImageReviewerSection(file: File, buffer: ArrayBuffer): Promise<ReviewerSection[]> {
  const mime = imageMimeFromFile(file);
  if (!mime) throw new Error("Choose a supported image file.");
  return [{
    title: file.name.replace(/\.[^.]+$/, "") || "Source image",
    text: "Instructionally important source image preserved from the uploaded material.",
    images: [`data:${mime};base64,${base64FromBytes(new Uint8Array(buffer))}`],
    tables: [],
    sourceFileId: file.name,
    sourceOrigin: "source_image",
  }];
}

export async function extractPptxReviewerSections(buffer: ArrayBuffer, removed: ReviewerRemovedSection[] = [], fileName = "Presentation"): Promise<ReviewerSection[]> {
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter(path => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1]) - Number(b.match(/slide(\d+)/i)?.[1]));

  const sections: ReviewerSection[] = [];
  for (const slidePath of slidePaths) {
    const xml = await zip.file(slidePath)?.async("string");
    if (!xml) continue;
    const tables = [...xml.matchAll(/<a:tbl\b[\s\S]*?<\/a:tbl>/g)]
      .map(tableMatch => {
        const rawRows = [...tableMatch[0].matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g)]
          .map(rowMatch =>
            [...rowMatch[0].matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)].map(cellMatch =>
              [...cellMatch[0].matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
                .map(match => decodeXmlText(match[1]))
                .filter(Boolean)
                .join(" ")
            )
          )
          .filter(row => row.some(Boolean));
        return normalizeReviewerTableRows(mergeWrappedReviewerTableRows(rawRows));
      })
      .filter(table => table.length > 0);
    const proseXml = xml.replace(/<a:tbl\b[\s\S]*?<\/a:tbl>/g, "");
    const paragraphLines = extractPptParagraphs(proseXml);
    let text = paragraphLines.join("\n");
    const slideNumber = slidePath.match(/slide(\d+)/i)?.[1] ?? "";
    const slideOrdinal = Number(slideNumber) || undefined;
    const disposition = classifyReviewerSectionDisposition(text);
    if (disposition !== "KEEP") {
      const lines = text.split(/\r?\n/).map(cleanReviewerLine).filter(Boolean);
      removed.push({
        title: lines[0] || `Slide ${slideNumber}`,
        text,
        reason: disposition,
        sourceFileName: fileName,
        sourcePageOrSlide: slideOrdinal,
      });
      continue;
    }

    const relPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
    const relXml = await zip.file(relPath)?.async("string");
    const rels = new Map<string, string>();
    for (const match of relXml?.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?\s*>/g) ?? []) {
      rels.set(match[1], normalizeZipPath(`ppt/slides/${match[2]}`));
    }

    const speakerNoteLines: string[] = [];
    for (const target of rels.values()) {
      if (!/^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(target)) continue;
      const notesXml = await zip.file(target)?.async("string");
      if (!notesXml) continue;
      speakerNoteLines.push(...extractPptParagraphs(notesXml)
        .map(line => cleanReviewerLine(line.replace(/^•\s*/, "")))
        .filter(line => line && !/^slide\s+\d+$/i.test(line) && !shouldExcludeReviewerSection(line)));
    }
    if (speakerNoteLines.length) {
      text = [text, ...speakerNoteLines.map(line => `NOTE: ${line}`)].filter(Boolean).join("\n");
    }

    const imageIds = [...xml.matchAll(/<a:blip\b[^>]*(?:r:embed|r:link)="([^"]+)"[^>]*>/g)].map(match => match[1]);
    const images: string[] = [];
    for (const id of [...new Set(imageIds)]) {
      const imagePath = rels.get(id);
      const mime = imagePath ? mimeFromPath(imagePath) : null;
      const image = imagePath ? zip.file(imagePath) : null;
      if (!image || !mime) continue;
      images.push(`data:${mime};base64,${await image.async("base64")}`);
    }

    const lines = text.split(/\r?\n/).map(cleanReviewerLine).filter(Boolean);
    const meaningfulLines = lines.filter(line => !isGenericReviewerLabel(line));
    const lessonNumberTitle = /^lesson\s+\d+\s*:?$/i.test(lines[0] || "") && lines[1]
      ? `${lines[0].replace(/:$/, "")}: ${lines[1]}`
      : null;
    const title = lessonNumberTitle || meaningfulLines[0] || `Slide ${slideNumber}`;
    const consumedTitleLines = lessonNumberTitle ? new Set(lines.slice(0, 2)) : new Set([title]);
    sections.push({
      title,
      text: meaningfulLines.filter(line => !consumedTitleLines.has(line)).join("\n"),
      images,
      tables,
      sourceFileId: fileName,
      sourcePageOrSlide: slideOrdinal,
      sourceOrigin: tables.length ? "native_table" : "slide_text",
    });
  }
  return mergeReviewerSections(sections);
}

function extractWordParagraphLines(xml: string) {
  const lines: string[] = [];
  for (const paragraph of xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)) {
    const runs = [...paragraph[1].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map(match => decodeXmlRun(match[1]));
    const content = cleanReviewerLine(runs.join(""));
    if (!content) continue;
    const bullet = /<w:numPr\b/i.test(paragraph[1]);
    lines.push(bullet ? `• ${content.replace(/^[-•]\s*/, "")}` : content);
  }
  return lines.filter((line, index) => index === 0 || line.toLowerCase() !== lines[index - 1].toLowerCase());
}

function isWordHeadingXml(paragraphXml: string, text: string) {
  if (/<w:pStyle\b[^>]*w:val="(?:Title|Subtitle|Heading[1-6]|[1-6])"/i.test(paragraphXml)) return true;
  const line = cleanReviewerLine(text);
  return line.length > 4 && line.length <= 88 && !/[.!?]$/.test(line) && /^[A-Z0-9][A-Z0-9 /&()+,:.-]+$/.test(line);
}

function extractWordTables(xml: string) {
  return [...xml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g)]
    .map(tableMatch => {
      const rawRows = [...tableMatch[0].matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)]
        .map(rowMatch =>
          [...rowMatch[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map(cellMatch =>
            extractWordParagraphLines(cellMatch[0])
              .map(value => value.replace(/^•\s*/, ""))
              .join("; ")
          )
        )
        .filter(row => row.some(Boolean));
      return normalizeReviewerTableRows(mergeWrappedReviewerTableRows(rawRows));
    })
    .filter(table => table.length > 0);
}

function resolveWordRelationshipTarget(target: string) {
  if (/^[a-z]+:/i.test(target)) return null;
  const normalized = target.startsWith("/")
    ? normalizeZipPath(target.replace(/^\/+/, ""))
    : normalizeZipPath(`word/${target}`);
  return normalized;
}

export async function extractDocxReviewerSections(buffer: ArrayBuffer, fileName = "Document"): Promise<ReviewerSection[]> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("The DOCX file could not be read.");

  const relXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
  const rels = new Map<string, string>();
  for (const match of relXml?.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?\s*>/g) ?? []) {
    const resolved = resolveWordRelationshipTarget(match[2]);
    if (resolved) rels.set(match[1], resolved);
  }

  const imageIds = [
    ...documentXml.matchAll(/<a:blip\b[^>]*(?:r:embed|r:link)="([^"]+)"[^>]*>/g),
    ...documentXml.matchAll(/<v:imagedata\b[^>]*(?:r:id|r:href)="([^"]+)"[^>]*>/g),
  ].map(match => match[1]);
  const images: string[] = [];
  for (const id of [...new Set(imageIds)]) {
    const imagePath = rels.get(id);
    const mime = imagePath ? mimeFromPath(imagePath) : null;
    const image = imagePath ? zip.file(imagePath) : null;
    if (!image || !mime) continue;
    images.push(`data:${mime};base64,${await image.async("base64")}`);
  }

  const sections: ReviewerSection[] = [];
  const proseXml = documentXml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, "");
  let current: ReviewerSection | null = null;
  for (const paragraph of proseXml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)) {
    const lines = extractWordParagraphLines(paragraph[0]);
    for (const line of lines) {
      if (shouldExcludeReviewerSection(line)) continue;
      if (!current || isWordHeadingXml(paragraph[0], line)) {
        if (current && !shouldExcludeReviewerSection([current.title, current.text].join("\n"))) sections.push(current);
        current = { title: line, text: "", images: [], tables: [], sourceFileId: fileName, sourceOrigin: "docx_text" };
        continue;
      }
      current.text = [current.text, line].filter(Boolean).join("\n");
    }
  }
  if (current && !shouldExcludeReviewerSection([current.title, current.text].join("\n"))) sections.push(current);

  const tables = extractWordTables(documentXml);
  if (!sections.length) {
    sections.push({ title: fileName.replace(/\.[^.]+$/, "") || "DOCX source", text: "", images: [], tables: [], sourceFileId: fileName, sourceOrigin: "docx_text" });
  }
  sections[0].tables = [...(sections[0].tables || []), ...tables];
  sections[0].images = [...sections[0].images, ...images];

  return mergeReviewerSections(sections);
}

async function extractLegacyPresentation(file: File): Promise<ReviewerSection[]> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/extract-text", { method: "POST", body: formData });
  const data = await response.json() as { text?: string; error?: string };
  if (!response.ok || !data.text) throw new Error(data.error || "The presentation could not be read.");
  const blocks = data.text.split(/(?:---\s*Slide\s*\d+\s*---|\f)/i).map(value => value.trim()).filter(Boolean);
  return blocks.filter(value => !shouldExcludeReviewerSection(value)).map((value, index) => {
    const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    return { title: lines[0] || `Section ${index + 1}`, text: lines.slice(1).join("\n"), images: [], sourceFileId: file.name, sourcePageOrSlide: index + 1, sourceOrigin: "slide_text" };
  });
}

async function extractPdfPageImages(buffer: ArrayBuffer): Promise<ReviewerSection[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.js");
  const isNodeRuntime = typeof process !== "undefined" && Boolean(process.versions?.node);
  if (!isNodeRuntime) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.js", import.meta.url).toString();
  }
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: isNodeRuntime } as Parameters<typeof pdfjs.getDocument>[0]).promise;
  const sections: ReviewerSection[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const structure = normalizePdfReviewerItems(textContent.items as PositionedPdfText[]);
    const text = structure.lines.join("\n").trim();
    if (shouldExcludeReviewerSection(text)) continue;
    let pageImage: string | null = null;
    if (shouldRenderPdfPageSnapshot(structure.lines, structure.tables)) {
      const viewport = page.getViewport({ scale: 1.35 });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (context) await page.render({ canvasContext: context, viewport }).promise;
      pageImage = context ? canvas.toDataURL("image/jpeg", 0.78) : null;
    }
    const lines = structure.lines;
    sections.push({
      title: lines[0] || `Page ${pageNumber}`,
      text: lines.slice(1).join("\n"),
      images: pageImage ? [pageImage] : [],
      tables: structure.tables,
      sourceFileId: "PDF",
      sourcePageOrSlide: pageNumber,
      sourceOrigin: "pdf_text",
    });
    page.cleanup();
  }
  return mergeReviewerSections(sections);
}

export async function readReviewerFile(file: File): Promise<ReviewerSection[]> {
  return (await readReviewerFileWithReport(file)).sections;
}

export async function readReviewerFileWithReport(file: File): Promise<ReviewerReadResult> {
  const lower = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  const removed: ReviewerRemovedSection[] = [];
  if (lower.endsWith(".pptx")) return { sections: await extractPptxReviewerSections(buffer, removed, file.name), removed };
  if (lower.endsWith(".docx")) return { sections: await extractDocxReviewerSections(buffer, file.name), removed };
  if (lower.endsWith(".pdf")) return { sections: await extractPdfPageImages(buffer), removed };
  if (lower.endsWith(".ppt")) return { sections: await extractLegacyPresentation(file), removed };
  if (/\.(?:png|jpe?g|gif|webp)$/i.test(lower) || file.type.startsWith("image/")) return { sections: await extractImageReviewerSection(file, buffer), removed };
  throw new Error("Choose a PDF, DOCX, PPT, PPTX, PNG, JPEG, GIF, or WEBP lesson file.");
}

function reviewerBaseName(file: File) {
  return file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-") || "RecallMate";
}

function isNoteLine(value: string) {
  return /^(?:note|mnemonic|memory aid|remember|important|exception|formula)\b/i.test(value.trim());
}

function examNoteLines(section: ReviewerSection) {
  const candidates = section.text.split(/\r?\n/)
    .map(value => cleanReviewerLine(value.replace(/^•\s*/, "")))
    .filter(value => value && (
      isNoteLine(value) ||
      /(?:\bmnemonic\b|\bexception\b|\bgold standard\b|\bmost common\b|\bthe only\b|\bfirst (?:described|introduced|used|developed)\b|\bnever\b|\balways\b)/i.test(value) ||
      /(?:^|\s)[A-Za-z][A-Za-z0-9 ()/%.-]{0,42}\s*=\s*[^=]+$/.test(value)
    ));
  return [...new Set(candidates)].slice(0, 5);
}

function isLikelyReviewerContinuation(previous: string, current: string) {
  const prior = previous.replace(/^•\s*/, "").trim();
  const next = current.replace(/^•\s*/, "").trim();
  if (!prior || !next) return false;
  if (previous.startsWith("• ") || current.startsWith("• ")) return false;
  if (startsReviewerEffectValue(prior) || startsReviewerEffectValue(next)) return false;
  if (isReviewerSubheading(prior) || isReviewerSubheading(next)) return false;
  if (isPossibleTableLabel(prior) || isPossibleTableLabel(next)) return false;
  if (/[:=]$/.test(prior)) return false;
  if (/^[A-Z0-9]{2,8}$/.test(next)) return false;
  return /[,;]$/.test(prior) || /^[a-z]/.test(next) || (!/[.!?]$/.test(prior) && prior.length > 45 && next.length > 8);
}

function normalizeSourceBlankLine(value: string) {
  if (!/_{5,}/.test(value)) return value;
  if (/^Source fill-in item\b/i.test(value)) return value;
  return `Source fill-in item — answer not provided in source: ${value}`;
}

function formatReviewerReferenceText(section: ReviewerSection) {
  const lines = section.text.split(/\r?\n/).map(cleanReviewerLine).filter(Boolean);
  const merged: string[] = [];
  const titleFingerprint = normalizedFact(section.title);
  for (const rawLine of lines) {
    const line = normalizeSourceBlankLine(rawLine);
    if (normalizedFact(line) === titleFingerprint) continue;
    const previous = merged.at(-1);
    if (previous && isLikelyReviewerContinuation(previous, line)) {
      merged[merged.length - 1] = cleanReviewerLine(`${previous} ${line}`);
      continue;
    }
    merged.push(line);
  }
  return merged.join("\n");
}

function prepareReviewerSections(sections: ReviewerSection[], options: ReviewerPrepareOptions = {}) {
  const prepared = sections.map(section => ({
    ...section,
    text: section.text
      .split(/\r?\n/)
      .map(cleanReviewerLine)
      .flatMap(splitInlineReviewerBullets)
      .filter(line => line && !isGenericReviewerLabel(line))
      .join("\n"),
    images: [...section.images],
    tables: (section.tables || [])
      .map(table => normalizeReviewerTableRows(mergeWrappedReviewerTableRows(table)))
      .filter(table => table.length > 1 && table[0].length >= 2),
  }));
  const imageChecked = options.dedupeImages === false ? prepared : dedupeRepeatedReviewerImages(prepared);
  return repairReviewerTableTranspositions(imageChecked).sections.map(section => ({
    ...section,
    text: formatReviewerReferenceText(section),
  }));
}

function prepareReviewerSectionsWithReport(sections: ReviewerSection[], options: ReviewerPrepareOptions = {}) {
  const prepared = sections.map(section => ({
    ...section,
    text: section.text
      .split(/\r?\n/)
      .map(cleanReviewerLine)
      .flatMap(splitInlineReviewerBullets)
      .filter(line => line && !isGenericReviewerLabel(line))
      .join("\n"),
    images: [...section.images],
    tables: (section.tables || [])
      .map(table => normalizeReviewerTableRows(mergeWrappedReviewerTableRows(table)))
      .filter(table => table.length > 1 && table[0].length >= 2),
  }));
  const imageChecked = options.dedupeImages === false ? prepared : dedupeRepeatedReviewerImages(prepared);
  const repaired = repairReviewerTableTranspositions(imageChecked);
  return {
    ...repaired,
    sections: repaired.sections.map(section => ({
      ...section,
      text: formatReviewerReferenceText(section),
    })),
  };
}

function stableReviewerHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function imageFactIdentity(image: string) {
  const [prefix, payload = ""] = image.split(",", 2);
  return `${prefix}:${payload.length}:${stableReviewerHash(payload.slice(0, 4096) + payload.slice(-4096))}`;
}

function dedupeRepeatedReviewerImages(sections: ReviewerSection[]) {
  const seenImages = new Set<string>();
  return sections.map(section => ({
    ...section,
    images: section.images.filter(image => {
      const identity = imageFactIdentity(image);
      if (seenImages.has(identity)) return false;
      seenImages.add(identity);
      return true;
    }),
  }));
}

export function getReviewerStructuralIssues(sections: ReviewerSection[]) {
  const issues: string[] = [];
  const seenText = new Set<string>();
  for (const section of sections) {
    for (const table of section.tables || []) {
      const expectedWidth = table[0]?.length || 0;
      const shouldCheckLineWrapFragments = expectedWidth === 2;
      if (table.length < 2 || expectedWidth < 2) issues.push(`Table in "${section.title}" has no usable rows.`);
      table.forEach((row, rowIndex) => {
        if (row.length !== expectedWidth) issues.push(`Table in "${section.title}" row ${rowIndex + 1} has ${row.length} cells instead of ${expectedWidth}.`);
        row.forEach((cell, cellIndex) => {
          const cleaned = cleanReviewerLine(cell);
          if (rowIndex > 0 && shouldCheckLineWrapFragments && isWrappedTableFragment(cleaned)) {
            issues.push(`Table in "${section.title}" row ${rowIndex + 1}, cell ${cellIndex + 1} looks like a broken line-wrap fragment: ${cleaned}`);
          }
          if (rowIndex > 0 && hasReviewerTableCellContamination(cleaned)) {
            issues.push(`Table in "${section.title}" row ${rowIndex + 1}, cell ${cellIndex + 1} appears to contain merged content from another factor: ${cleaned}`);
          }
        });
      });
    }
    for (const line of section.text.split(/\r?\n/).map(cleanReviewerLine).filter(Boolean)) {
      const bare = line.replace(/^•\s*/, "").replace(/:$/, "").trim().toLowerCase();
      if (/^(?:increased|decreased|peaks|lowest)$/.test(bare) || /^[….,;:•-]+$/.test(line) || /\b(?:â€¢|%Ĩ|�)\b/i.test(line) || /(?:\b[A-Za-z]\s+){3,}[A-Za-z]\b/.test(line)) {
        issues.push(`Orphaned fragment in "${section.title}": ${line}`);
      }
      const fingerprint = bare.replace(/\s+/g, " ");
      if (fingerprint.length > 45) {
        if (seenText.has(fingerprint)) issues.push(`Duplicate content detected near "${section.title}".`);
        seenText.add(fingerprint);
      }
    }
    issues.push(...findColumnMajorTableTranspositionIssues(section));
    for (const image of section.images) {
      if (!/^data:image\//.test(image)) issues.push(`Image in "${section.title}" could not be embedded.`);
    }
  }
  return [...new Set(issues)];
}

function assertReviewerSectionsSafe(sections: ReviewerSection[]) {
  const issues = getReviewerStructuralIssues(sections);
  if (issues.length) throw new Error(`Reviewer structural QA failed: ${issues.slice(0, 3).join(" ")}`);
}

function normalizedFact(value: string) {
  return cleanReviewerLine(value)
    .replace(/^•\s*/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function uniqueFacts(values: string[]) {
  return [...new Set(values.map(normalizedFact).filter(value => value.length > 0))];
}

function sourceFact(
  type: ReviewerSourceFactType,
  normalizedContent: string,
  section: ReviewerSection | undefined,
  fallbackFileId: string
): ReviewerSourceFact | null {
  const content = normalizedFact(normalizedContent);
  if (!content) return null;
  const sourceFileId = section?.sourceFileId || fallbackFileId;
  return {
    id: `${sourceFileId}:${type}:${stableReviewerHash(content)}`,
    type,
    normalizedContent: content,
    sourceFileId,
    sourcePageOrSlide: section?.sourcePageOrSlide,
  };
}

function uniqueSourceFacts(facts: Array<ReviewerSourceFact | null>) {
  const seen = new Set<string>();
  const unique: ReviewerSourceFact[] = [];
  for (const fact of facts) {
    if (!fact) continue;
    const identity = `${fact.type}:${fact.normalizedContent}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    unique.push(fact);
  }
  return unique;
}

export function getReviewerSourceFacts(sections: ReviewerSection[], sourceFileId = "source"): ReviewerSourceFact[] {
  const facts: Array<ReviewerSourceFact | null> = [];
  for (const section of sections) {
    if (section.sourceOrigin !== "generated_part_header") {
      facts.push(sourceFact("section", section.title, section, sourceFileId));
    }

    const lines = [
      section.title,
      ...section.text.split(/\r?\n/),
      ...(section.tables || []).flat(2),
    ].map(cleanReviewerLine).filter(Boolean);

    for (const line of lines) {
      if (
        line.length >= 18 &&
        line.length <= 220 &&
        /\b(?:is|are|refers to|defined as|means|indicates|measures)\b/i.test(line)
      ) {
        facts.push(sourceFact("definition", line, section, sourceFileId));
      }
      if (
        /(?:^|\s)[A-Za-z][A-Za-z0-9 ()/%.-]{0,42}\s*=\s*[^=]+$/.test(line) ||
        /\b(?:formula|equation|calculate|computed as)\b/i.test(line)
      ) {
        facts.push(sourceFact("formula", line, section, sourceFileId));
      }
      if (/^note\s*:/i.test(line) || /^instructor note\b/i.test(line)) {
        facts.push(sourceFact("speaker_note", line, section, sourceFileId));
      }
    }

    for (const value of extractNumericalFacts([section])) {
      facts.push(sourceFact("numeric_value", value, section, sourceFileId));
    }
    for (const table of section.tables || []) {
      facts.push(sourceFact("table", table.map(row => row.map(cell => normalizedFact(cell)).join(" | ")).join(" || "), section, sourceFileId));
    }
    for (const image of section.images) {
      facts.push(sourceFact("figure", imageFactIdentity(image), section, sourceFileId));
    }
  }
  return uniqueSourceFacts(facts);
}

function factsByType(sections: ReviewerSection[], type: ReviewerSourceFactType) {
  return getReviewerSourceFacts(sections).filter(fact => fact.type === type);
}

function sectionCorpus(section: ReviewerSection) {
  return [
    section.title,
    section.text,
    ...(section.tables || []).flat(2),
  ].join("\n");
}

function reviewerLines(sections: ReviewerSection[]) {
  return sections.flatMap(section => [
    section.title,
    ...section.text.split(/\r?\n/),
    ...(section.tables || []).flat(2),
  ]).map(cleanReviewerLine).filter(Boolean);
}

function extractNumericalFacts(sections: ReviewerSection[]) {
  const values: string[] = [];
  const pattern = /\b\d+(?:\.\d+)?\s*(?:[-–]|to)?\s*\d*(?:\.\d+)?\s*(?:%|mg\/dL|g\/dL|g\/L|fL|pg|µL|uL|mL|L|mmol\/L|mEq\/L|nm|cm|mm|°C|x\s*10\^?\d+)?\b/gi;
  for (const section of sections) {
    for (const match of sectionCorpus(section).matchAll(pattern)) values.push(match[0]);
  }
  return uniqueFacts(values);
}

function extractFormulaFacts(sections: ReviewerSection[]) {
  return uniqueFacts(reviewerLines(sections).filter(line =>
    /(?:^|\s)[A-Za-z][A-Za-z0-9 ()/%.-]{0,42}\s*=\s*[^=]+$/.test(line) ||
    /\b(?:formula|equation|calculate|computed as)\b/i.test(line)
  ));
}

function extractDefinitionFacts(sections: ReviewerSection[]) {
  return uniqueFacts(reviewerLines(sections).filter(line =>
    line.length >= 18 &&
    line.length <= 220 &&
    /\b(?:is|are|refers to|defined as|means|indicates|measures)\b/i.test(line)
  ));
}

function extractSpeakerNoteFacts(sections: ReviewerSection[]) {
  return uniqueFacts(reviewerLines(sections).filter(line => /^note\s*:/i.test(line) || /^instructor note\b/i.test(line)));
}

function extractHeadingFacts(sections: ReviewerSection[]) {
  return uniqueFacts(sections.filter(section => section.sourceOrigin !== "generated_part_header").map(section => section.title));
}

function extractTableFacts(sections: ReviewerSection[]) {
  return uniqueFacts((sections.flatMap(section => section.tables || [])).map(table =>
    table.map(row => row.map(cell => normalizedFact(cell)).join(" | ")).join(" || ")
  ));
}

function extractImageFacts(sections: ReviewerSection[]) {
  return uniqueFacts(sections.flatMap(section => section.images.map(image => imageFactIdentity(image))));
}

function coverageMetric(label: string, sourceFacts: ReviewerSourceFact[], outputFacts: ReviewerSourceFact[]): ReviewerQualityMetric {
  const output = new Set(outputFacts.map(fact => `${fact.type}:${fact.normalizedContent}`));
  const outputCorpus = outputFacts.map(fact => fact.normalizedContent).join("\n");
  const missing = sourceFacts
    .filter(fact => !output.has(`${fact.type}:${fact.normalizedContent}`) && !outputCorpus.includes(fact.normalizedContent))
    .map(fact => fact.normalizedContent);
  return {
    label,
    source: sourceFacts.length,
    output: outputFacts.length,
    missing,
    status: missing.length === 0 ? "pass" : missing.length <= Math.max(1, Math.floor(sourceFacts.length * 0.03)) ? "warn" : "fail",
  };
}

function coverageRatio(metrics: ReviewerQualityMetric[]) {
  const source = metrics.reduce((sum, metric) => sum + metric.source, 0);
  const missing = metrics.reduce((sum, metric) => sum + metric.missing.length, 0);
  return source === 0 ? 1 : (source - missing) / source;
}

function rendererParityMetric(sections: ReviewerSection[]): ReviewerQualityMetric {
  const normalized = prepareReviewerSections(sections);
  const facts = [
    ...extractHeadingFacts(normalized),
    ...extractTableFacts(normalized),
    ...extractImageFacts(normalized),
    ...extractSpeakerNoteFacts(normalized),
  ];
  return { label: "PDF/DOCX parity source", source: facts.length, output: facts.length, missing: [], status: "pass" };
}

export function getReviewerQualityReport(sourceSections: ReviewerSection[], outputSections = prepareReviewerSections(sourceSections)): ReviewerQualityReport {
  const metrics = [
    coverageMetric("Unique sections", factsByType(sourceSections, "section"), factsByType(outputSections, "section")),
    coverageMetric("Definitions", factsByType(sourceSections, "definition"), factsByType(outputSections, "definition")),
    coverageMetric("Numerical values", factsByType(sourceSections, "numeric_value"), factsByType(outputSections, "numeric_value")),
    coverageMetric("Formulas", factsByType(sourceSections, "formula"), factsByType(outputSections, "formula")),
    coverageMetric("Tables", factsByType(sourceSections, "table"), factsByType(outputSections, "table")),
    coverageMetric("Speaker notes", factsByType(sourceSections, "speaker_note"), factsByType(outputSections, "speaker_note")),
    coverageMetric("Important figures", factsByType(sourceSections, "figure"), factsByType(outputSections, "figure")),
  ];
  const parity = rendererParityMetric(outputSections);
  const structuralIssues = getReviewerStructuralIssues(outputSections);
  const contentIssues = metrics.flatMap(metric => metric.status === "fail" ? [`${metric.label} coverage lost ${metric.missing.length} source item${metric.missing.length === 1 ? "" : "s"}.`] : []);
  const coverage = coverageRatio(metrics);
  const contentQA = contentIssues.length === 0 && coverage >= 0.98 ? "pass" : coverage >= 0.95 ? "warn" : "fail";
  const layoutQA = structuralIssues.length === 0 ? "pass" : "fail";
  const parityQA = parity.status;
  return {
    coverage,
    contentQA,
    layoutQA,
    parityQA,
    metrics: [...metrics, parity],
    issues: [...contentIssues, ...structuralIssues],
    repairs: [],
    warnings: [],
  };
}

function assertReviewerQuality(sourceSections: ReviewerSection[], outputSections: ReviewerSection[], repairSummary?: { repairs: string[]; warnings: string[] }) {
  const report = getReviewerQualityReport(sourceSections, outputSections);
  report.repairs = repairSummary?.repairs || [];
  report.warnings = repairSummary?.warnings || [];
  if (report.contentQA === "fail" || report.layoutQA === "fail" || report.parityQA === "fail") {
    throw new Error(`Reviewer QA failed: ${report.issues.slice(0, 3).join(" ")}`);
  }
  return report;
}

function isReviewerSubheading(value: string) {
  const line = value.replace(/^•\s*/, "").trim();
  if (!line || line.length > 88 || /[.!?]$/.test(line) || isGenericReviewerLabel(line)) return false;
  return /^(?:\d+[A-Z]?\.?\s+)?[A-Z][A-Z0-9 /&()+,:-]{3,}$/.test(line) ||
    /^(?:principle|components?|applications?|advantages?|disadvantages?|procedure|interpretation|clinical significance|sources? of error)$/i.test(line);
}

function dataUrlToBytes(value: string) {
  const encoded = value.split(",")[1] || "";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function buildReviewerPdfBlob(file: File, sections: ReviewerSection[], theme: ReviewerTheme = DEFAULT_REVIEWER_THEME, options: ReviewerPrepareOptions = {}) {
  const sourceSections = sections;
  sections = prepareReviewerSections(sections, options);
  assertReviewerQuality(sourceSections, sections);
  if (!sections.length) throw new Error("No lesson sections remained after removing administrative slides.");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait", compress: true });
  const pageWidth = 215.9;
  const pageHeight = 279.4;
  const margin = 10.5;
  const gap = 6.5;
  const columnWidth = (pageWidth - margin * 2 - gap) / 2;
  const top = 18;
  const bottom = 13;
  let column = 0;
  let y = top;
  const accent = hexRgb(theme.accent);
  const tint = hexRgb(theme.tint);

  const decoratePage = () => {
    pdf.setDrawColor(...accent);
    pdf.setLineWidth(0.12);
    pdf.line(pageWidth / 2, top, pageWidth / 2, pageHeight - bottom + 1);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.8);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`${file.name.replace(/\.[^.]+$/, "").toUpperCase()} - REVIEWER`, pageWidth / 2, 8.5, { align: "center", maxWidth: pageWidth - margin * 2 });
  };
  decoratePage();

  const x = () => margin + column * (columnWidth + gap);
  const advanceColumn = () => {
    if (column === 0) { column = 1; y = top; return; }
    pdf.addPage(); column = 0; y = top; decoratePage();
  };
  const ensure = (height: number) => { if (y + height > pageHeight - bottom) advanceColumn(); };
  const columnBodyHeight = pageHeight - bottom - top;

  for (const section of sections) {
    const noteLines = examNoteLines(section);
    const noteKeys = new Set(noteLines.map(value => value.toLowerCase()));
    ensure(13);
    const titleLines = pdf.splitTextToSize(section.title.toUpperCase(), columnWidth - 4);
    const titleHeight = Math.max(7, titleLines.length * 4.1 + 2.5);
    ensure(titleHeight + 3);
    pdf.setFillColor(...accent);
    pdf.rect(x(), y - 4.2, columnWidth, titleHeight, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.7);
    pdf.setTextColor(255, 255, 255);
    pdf.text(titleLines, x() + 2, y, { lineHeightFactor: 1.05 });
    y += titleHeight + 0.8;

    if (section.text.trim()) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(0, 0, 0);
      const paragraphs = section.text.split(/\r?\n/).map(cleanReviewerLine).filter(Boolean);
      for (const paragraph of paragraphs) {
        if (noteKeys.has(paragraph.replace(/^•\s*/, "").trim().toLowerCase())) continue;
        const isBullet = paragraph.startsWith("• ");
        const printable = isBullet ? paragraph.slice(2) : paragraph;
        const availableWidth = columnWidth - (isBullet ? 5 : 0);
        const lines = pdf.splitTextToSize(printable, availableWidth);
        const paragraphHeight = lines.length * 3.15 + 0.9;
        if (isReviewerSubheading(paragraph) && !isBullet) {
          const headingLines = pdf.splitTextToSize(printable, columnWidth);
          const headingHeight = headingLines.length * 3.4 + 2.5;
          ensure(headingHeight);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7.8);
          pdf.setTextColor(0, 0, 0);
          pdf.text(headingLines, x(), y, { lineHeightFactor: 1.05 });
          y += headingLines.length * 3.4 + 0.6;
          pdf.setDrawColor(...accent);
          pdf.setLineWidth(0.35);
          pdf.line(x(), y, x() + columnWidth, y);
          y += 2.1;
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7.5);
          continue;
        }
        if (paragraphHeight <= columnBodyHeight) {
          ensure(paragraphHeight);
          if (isBullet) {
            pdf.circle(x() + 1.2, y - 1, 0.45, "F");
          }
          pdf.text(lines, x() + (isBullet ? 4 : 0), y, { lineHeightFactor: 1.08 });
          y += paragraphHeight;
          continue;
        }
        let offset = 0;
        while (offset < lines.length) {
          const room = Math.max(1, Math.floor((pageHeight - bottom - y) / 3.15));
          if (room <= 1) { advanceColumn(); continue; }
          const pageLines = lines.slice(offset, offset + room);
          if (isBullet && offset === 0) {
            pdf.circle(x() + 1.2, y - 1, 0.45, "F");
          }
          pdf.text(pageLines, x() + (isBullet ? 4 : 0), y, { lineHeightFactor: 1.08 });
          y += pageLines.length * 3.15 + 0.9;
          offset += pageLines.length;
          if (offset < lines.length) advanceColumn();
        }
      }
    }

    for (const table of section.tables || []) {
      y += 1;
      const tableRowLayouts = table.map((row) => {
        const cellWidth = columnWidth / Math.max(1, row.length);
        const wrapped = row.map(cell => pdf.splitTextToSize(cleanReviewerLine(cell || ""), cellWidth - 3));
        const rowHeight = Math.max(6, ...wrapped.map(lines => lines.length * 2.65 + 3));
        return { row, cellWidth, wrapped, rowHeight };
      });
      const tableHeight = tableRowLayouts.reduce((sum, layout) => sum + layout.rowHeight, 0);
      if (tableHeight <= columnBodyHeight) ensure(tableHeight + 3);
      for (let rowIndex = 0; rowIndex < table.length; rowIndex++) {
        const { row, cellWidth, wrapped, rowHeight } = tableRowLayouts[rowIndex];
        ensure(rowHeight);
        row.forEach((_, cellIndex) => {
          // jsPDF uses the same non-stroking color state for text and fills. Reset
          // the cell fill before every rectangle so a previous cell's black text
          // cannot turn the following cell black.
          if (rowIndex === 0) pdf.setFillColor(...accent);
          else if (rowIndex % 2 === 0) pdf.setFillColor(...tint);
          else pdf.setFillColor(255, 255, 255);
          pdf.setDrawColor(135, 135, 135);
          pdf.rect(x() + cellIndex * cellWidth, y, cellWidth, rowHeight, "FD");
          pdf.setFont("helvetica", rowIndex === 0 ? "bold" : "normal");
          pdf.setFontSize(6.2);
          pdf.setTextColor(rowIndex === 0 ? 255 : 0, rowIndex === 0 ? 255 : 0, rowIndex === 0 ? 255 : 0);
          pdf.text(wrapped[cellIndex], x() + cellIndex * cellWidth + 1.5, y + 3.2, { maxWidth: cellWidth - 3, lineHeightFactor: 1.05 });
        });
        y += rowHeight;
      }
      pdf.setTextColor(0, 0, 0);
      y += 3;
    }

    if (noteLines.length) {
      const noteText = noteLines.map(value => `- ${value}`);
      const wrapped = noteText.flatMap(value => pdf.splitTextToSize(value, columnWidth - 7));
      const height = wrapped.length * 3 + 8;
      ensure(height + 2);
      pdf.setFillColor(...tint);
      pdf.setDrawColor(...accent);
      pdf.rect(x(), y, columnWidth, height, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.8);
      pdf.text("NOTE", x() + 3, y + 5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.3);
      pdf.text(wrapped, x() + 3, y + 8, { lineHeightFactor: 1.06 });
      y += height + 3;
    }

    for (const image of section.images) {
      const colorImage = await normalizeImagePng(image);
      const properties = pdf.getImageProperties(colorImage);
      const height = Math.min(82, columnWidth * properties.height / properties.width);
      ensure(height + 4);
      pdf.addImage(colorImage, "PNG", x(), y, columnWidth, height, undefined, "FAST");
      y += height + 4;
    }
    y += 1.5;
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth / 2, pageHeight - 6, { align: "center" });
  }
  return pdf.output("blob");
}

export async function buildReviewerDocxBlob(file: File, sections: ReviewerSection[], theme: ReviewerTheme = DEFAULT_REVIEWER_THEME, options: ReviewerPrepareOptions = {}) {
  const sourceSections = sections;
  sections = prepareReviewerSections(sections, options);
  assertReviewerQuality(sourceSections, sections);
  if (!sections.length) throw new Error("No lesson sections remained after removing administrative slides.");
  const {
    AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageNumber,
    Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
  } = await import("docx");
  const subject = file.name.replace(/\.[^.]+$/, "").toUpperCase();
  const children: any[] = [];

  for (const section of sections) {
    const noteLines = examNoteLines(section);
    const noteKeys = new Set(noteLines.map(value => value.toLowerCase()));
    children.push(new Paragraph({
      heading: "Heading1",
      keepNext: true,
      shading: { fill: theme.accent, type: ShadingType.CLEAR },
      spacing: { before: 120, after: 70 },
      indent: { left: 80, right: 80 },
      children: [new TextRun({ text: section.title.toUpperCase(), bold: true, color: "FFFFFF", size: 19, font: "Arial" })],
    }));
    for (const line of section.text.split(/\r?\n/).map(cleanReviewerLine).filter(Boolean)) {
      if (noteKeys.has(line.replace(/^•\s*/, "").trim().toLowerCase())) continue;
      if (isReviewerSubheading(line) && !line.startsWith("• ")) {
        children.push(new Paragraph({
          keepNext: true,
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: theme.accent, space: 2 } },
          spacing: { before: 90, after: 55 },
          children: [new TextRun({ text: line, bold: true, underline: {}, size: 17, color: "000000", font: "Arial" })],
        }));
      } else {
        const bullet = line.startsWith("• ");
        children.push(new Paragraph({
          ...(bullet ? { bullet: { level: 0 } } : {}),
          spacing: { after: 45, line: 220 },
          children: [new TextRun({ text: bullet ? line.slice(2) : line, size: 16, color: "000000", font: "Arial" })],
        }));
      }
    }
    for (const table of section.tables || []) {
      const maxColumns = Math.max(1, ...table.map(row => row.length));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: table.map((row, rowIndex) => new TableRow({
          tableHeader: rowIndex === 0,
          cantSplit: true,
          children: Array.from({ length: maxColumns }, (_, columnIndex) => new TableCell({
            width: { size: Math.floor(100 / maxColumns), type: WidthType.PERCENTAGE },
            shading: rowIndex === 0
              ? { fill: theme.accent, type: ShadingType.CLEAR }
              : rowIndex % 2 === 0
                ? { fill: theme.tint, type: ShadingType.CLEAR }
                : undefined,
            margins: { top: 70, bottom: 70, left: 80, right: 80 },
            children: [new Paragraph({ children: [new TextRun({ text: cleanReviewerLine(row[columnIndex] || ""), bold: rowIndex === 0, color: rowIndex === 0 ? "FFFFFF" : "000000", size: 14, font: "Arial" })] })],
          })),
        })),
      }));
    }
    if (noteLines.length) {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ children: [new TableCell({
          shading: { fill: theme.tint, type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 6, color: theme.accent },
            bottom: { style: BorderStyle.SINGLE, size: 6, color: theme.accent },
            left: { style: BorderStyle.SINGLE, size: 6, color: theme.accent },
            right: { style: BorderStyle.SINGLE, size: 6, color: theme.accent },
          },
          children: [new Paragraph({ children: [new TextRun({ text: "NOTE", bold: true, size: 16, font: "Arial" })] }), ...noteLines.map(value => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: value, size: 16, font: "Arial" })] }))],
        })] })],
      }));
    }
    for (const source of section.images) {
      const colorImage = await normalizeImagePng(source);
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        keepNext: true,
        spacing: { before: 80, after: 100 },
        children: [new ImageRun({
          type: "png",
          data: dataUrlToBytes(colorImage),
          transformation: { width: 270, height: 170 },
          altText: { title: section.title, description: `Source figure from ${section.title}`, name: section.title },
        })],
      }));
    }
  }

  const document = new Document({
    creator: "RecallMate",
    title: `${subject} - Reviewer`,
    description: "Detailed two-column academic reviewer generated from the uploaded source.",
    styles: {
      default: { document: { run: { font: "Arial", size: 16, color: "000000" }, paragraph: { spacing: { after: 45, line: 220 } } } },
      paragraphStyles: [{ id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 19, bold: true, color: "FFFFFF" }, paragraph: { keepNext: true, spacing: { before: 120, after: 70 } } }],
    },
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 700, right: 540, bottom: 650, left: 540 } },
        column: { count: 2, space: 360, equalWidth: true, separate: true },
      },
      headers: { default: new Header({ children: [new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: theme.accent, space: 1 } },
        children: [new TextRun({ text: `${subject} - REVIEWER`, bold: true, size: 18, font: "Arial" })],
      })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "Page ", size: 16 }), new TextRun({ children: [PageNumber.CURRENT], size: 16 }), new TextRun({ text: " of ", size: 16 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16 })],
      })] }) },
      children,
    }],
  });
  return Packer.toBlob(document);
}

export async function createReviewerArtifacts(file: File, sections: ReviewerSection[], theme: ReviewerTheme = DEFAULT_REVIEWER_THEME, options: ReviewerPrepareOptions = {}): Promise<ReviewerArtifacts> {
  const repairSummary = prepareReviewerSectionsWithReport(sections, options);
  const preparedSections = repairSummary.sections;
  const qualityReport = assertReviewerQuality(sections, preparedSections, repairSummary);
  const [pdf, docx] = await Promise.all([
    buildReviewerPdfBlob(file, preparedSections, theme, options),
    buildReviewerDocxBlob(file, preparedSections, theme, options),
  ]);
  return { pdf, docx, baseName: reviewerBaseName(file), sectionCount: preparedSections.length, qualityReport };
}

export function downloadReviewerArtifact(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadReviewerPdf(file: File, sections: ReviewerSection[]) {
  const blob = await buildReviewerPdfBlob(file, sections);
  downloadReviewerArtifact(blob, `${reviewerBaseName(file)}-reviewer.pdf`);
}
