import path from 'node:path';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { ArtifactResponse } from './artifact.types';

export const MAX_PREVIEW_DOCUMENT_SIZE = 15 * 1024 * 1024; // 15 MB
export const MAX_SHEET_ROWS = 500;
export const MAX_SHEET_COLS = 50;
export const MAX_CSV_ROWS = 500;
export const MAX_CSV_COLS = 50;
export const MAX_PPTX_SLIDES = 100;

export type PreviewKind =
  | 'docx'
  | 'xlsx'
  | 'pptx'
  | 'csv'
  | 'image'
  | 'pdf'
  | 'unsupported'
  | 'error';

export interface DocxPreviewResult {
  kind: 'docx';
  html: string;
  metadata: {
    wordCount: number;
    charCount: number;
  };
}

export interface XlsxSheetData {
  name: string;
  rows: (string | number | boolean | null)[][];
  totalRows: number;
  totalCols: number;
  isTruncated: boolean;
}

export interface XlsxPreviewResult {
  kind: 'xlsx';
  sheetNames: string[];
  activeSheet: string;
  sheets: Record<string, XlsxSheetData>;
}

export interface PptxSlideData {
  index: number;
  title: string;
  paragraphs: string[];
  rawText: string;
}

export interface PptxPreviewResult {
  kind: 'pptx';
  totalSlides: number;
  slides: PptxSlideData[];
}

export interface CsvPreviewResult {
  kind: 'csv';
  headers: string[];
  rows: string[][];
  totalRows: number;
  totalCols: number;
  isTruncated: boolean;
}

export interface MediaPreviewResult {
  kind: 'image' | 'pdf';
  mimeType: string;
}

export interface UnsupportedPreviewResult {
  kind: 'unsupported';
  formatName: string;
  reason: string;
  extension: string;
}

export interface ErrorPreviewResult {
  kind: 'error';
  message: string;
  details?: string;
}

export type PreviewData =
  | DocxPreviewResult
  | XlsxPreviewResult
  | PptxPreviewResult
  | CsvPreviewResult
  | MediaPreviewResult
  | UnsupportedPreviewResult
  | ErrorPreviewResult;

export interface ArtifactPreviewResponse {
  artifact: ArtifactResponse;
  preview: PreviewData;
}

/**
 * Strips potentially dangerous tags, attributes, and protocol schemes from HTML.
 * Ensures rendered DOCX content cannot execute JavaScript or access application origin.
 */
export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  // 1. Remove dangerous elements entirely (tags and all nested content)
  let clean = rawHtml.replace(
    /<(script|style|iframe|object|embed|applet|meta|link|form|input|button)[\s\S]*?<\/\1>/gi,
    ''
  );
  clean = clean.replace(/<(script|style|iframe|object|embed|applet|meta|link|form|input|button)[^>]*\/?>/gi, '');

  // 2. Remove all event handlers (on*)
  clean = clean.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // 3. Remove javascript: or data: URIs from href and src (except safe image data URIs)
  clean = clean.replace(/\s+href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*'|[^\s>]+javascript:[^\s>]+)/gi, ' href="#"');
  clean = clean.replace(/\s+src\s*=\s*(?:"data:text\/html[^"]*"|'data:text\/html[^']*')/gi, ' src=""');

  // 4. Force links to open safely in new window
  clean = clean.replace(/<a\s+(?![^>]*target=)/gi, '<a target="_blank" rel="noopener noreferrer" ');

  return clean;
}

/**
 * Parses and extracts formatted HTML and text statistics from DOCX buffer.
 */
export async function parseDocx(buffer: Buffer): Promise<DocxPreviewResult | ErrorPreviewResult> {
  try {
    const result = await mammoth.convertToHtml({ buffer });
    const cleanHtml = sanitizeHtml(result.value);

    // Extract word count and char count from the plain text
    const textResult = await mammoth.extractRawText({ buffer });
    const rawText = textResult.value.trim();
    const wordCount = rawText ? rawText.split(/\s+/).filter(Boolean).length : 0;
    const charCount = rawText.length;

    return {
      kind: 'docx',
      html: cleanHtml || '<p style="color: var(--text-muted); font-style: italic;">(Document contains no readable text)</p>',
      metadata: {
        wordCount,
        charCount,
      },
    };
  } catch (err: any) {
    return {
      kind: 'error',
      message: 'Unable to parse Word document. The file may be corrupted, password-protected, or in an unsupported format.',
      details: err?.message || String(err),
    };
  }
}

/**
 * Parses worksheets and cell grids from XLSX buffer with row/col limits.
 */
export function parseXlsx(buffer: Buffer): XlsxPreviewResult | ErrorPreviewResult {
  try {
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      dense: true,
    });

    const sheetNames = workbook.SheetNames || [];
    if (sheetNames.length === 0) {
      return {
        kind: 'error',
        message: 'Workbook contains no worksheets.',
      };
    }

    const sheets: Record<string, XlsxSheetData> = {};

    for (const name of sheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet) continue;

      // Extract raw grid as 2D array
      const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
      });

      const totalRows = rawRows.length;
      let totalCols = 0;
      for (const row of rawRows) {
        if (Array.isArray(row) && row.length > totalCols) {
          totalCols = row.length;
        }
      }

      const isTruncated = totalRows > MAX_SHEET_ROWS || totalCols > MAX_SHEET_COLS;
      const slicedRows = rawRows.slice(0, MAX_SHEET_ROWS).map((row) => {
        if (!Array.isArray(row)) return [];
        return row.slice(0, MAX_SHEET_COLS).map((cell) => {
          if (cell === null || cell === undefined) return '';
          if (cell instanceof Date) return cell.toISOString().split('T')[0];
          return cell;
        });
      });

      sheets[name] = {
        name,
        rows: slicedRows,
        totalRows,
        totalCols,
        isTruncated,
      };
    }

    return {
      kind: 'xlsx',
      sheetNames,
      activeSheet: sheetNames[0],
      sheets,
    };
  } catch (err: any) {
    return {
      kind: 'error',
      message: 'Unable to parse Excel workbook. The spreadsheet may be corrupted or protected.',
      details: err?.message || String(err),
    };
  }
}

/**
 * Helper to strip XML tags and decode XML entities.
 */
function cleanXmlText(xmlSnippet: string): string {
  return xmlSnippet
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

/**
 * Parses PPTX OpenXML slides, slide titles, and paragraph bullet points.
 */
export async function parsePptx(buffer: Buffer): Promise<PptxPreviewResult | ErrorPreviewResult> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles: { path: string; num: number }[] = [];

    // Find all ppt/slides/slide*.xml files
    zip.forEach((relPath) => {
      const match = relPath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
      if (match) {
        slideFiles.push({ path: relPath, num: parseInt(match[1], 10) });
      }
    });

    if (slideFiles.length === 0) {
      return {
        kind: 'error',
        message: 'Presentation contains no valid slides or is not in OpenXML (.pptx) format.',
      };
    }

    // Sort slides in natural order
    slideFiles.sort((a, b) => a.num - b.num);

    const slides: PptxSlideData[] = [];
    const limit = Math.min(slideFiles.length, MAX_PPTX_SLIDES);

    for (let i = 0; i < limit; i++) {
      const slideEntry = slideFiles[i];
      const xml = await zip.file(slideEntry.path)?.async('string');
      if (!xml) continue;

      let title = '';
      const paragraphs: string[] = [];

      // Extract shapes: <p:sp>...</p:sp>
      const shapeMatches = xml.match(/<p:sp\b[\s\S]*?<\/p:sp>/gi) || [];

      for (const shapeXml of shapeMatches) {
        const isTitleShape = /<p:ph\b[^>]*\btype="(?:title|ctrTitle)"/i.test(shapeXml);

        // Extract paragraphs inside shape: <a:p>...</a:p>
        const pMatches = shapeXml.match(/<a:p\b[\s\S]*?<\/a:p>/gi) || [];
        const shapeParagraphs: string[] = [];

        for (const pXml of pMatches) {
          // Extract text runs: <a:t>...</a:t>
          const tMatches = pXml.match(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/gi) || [];
          const textRuns = tMatches.map((t) => cleanXmlText(t)).filter(Boolean);
          const pText = textRuns.join('');
          if (pText.trim()) {
            shapeParagraphs.push(pText.trim());
          }
        }

        if (shapeParagraphs.length > 0) {
          if (isTitleShape && !title) {
            title = shapeParagraphs.join(' ');
          } else {
            paragraphs.push(...shapeParagraphs);
          }
        }
      }

      // If no explicit title placeholder was found, use the first paragraph as title
      if (!title && paragraphs.length > 0) {
        title = paragraphs.shift()!;
      }

      const rawText = [title, ...paragraphs].filter(Boolean).join('\n');

      slides.push({
        index: i + 1,
        title: title || `Slide ${i + 1}`,
        paragraphs,
        rawText,
      });
    }

    return {
      kind: 'pptx',
      totalSlides: slideFiles.length,
      slides,
    };
  } catch (err: any) {
    return {
      kind: 'error',
      message: 'Unable to parse PowerPoint presentation. The file may be corrupted or invalid.',
      details: err?.message || String(err),
    };
  }
}

/**
 * Parses RFC 4180 CSV / TSV text with sensible row and column limits.
 */
export function parseCsv(text: string): CsvPreviewResult {
  const lines = text.split(/\r\n|\n|\r/);
  const rows: string[][] = [];

  // Detect delimiter: comma, semicolon, or tab
  const sample = lines.slice(0, 10).join('\n');
  const commaCount = (sample.match(/,/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;
  const semiCount = (sample.match(/;/g) || []).length;

  let delimiter = ',';
  if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
  else if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';

  // Parse lines with quotes support
  for (const line of lines) {
    if (!line.trim() && rows.length > 0) continue; // skip trailing blanks

    const row: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === delimiter && !inQuotes) {
        row.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    row.push(cur.trim());

    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  const totalRows = rows.length;
  let totalCols = 0;
  for (const r of rows) {
    if (r.length > totalCols) totalCols = r.length;
  }

  if (totalRows === 0) {
    return {
      kind: 'csv',
      headers: [],
      rows: [],
      totalRows: 0,
      totalCols: 0,
      isTruncated: false,
    };
  }

  const isTruncated = totalRows > MAX_CSV_ROWS || totalCols > MAX_CSV_COLS;
  const headers = rows[0].slice(0, MAX_CSV_COLS);
  const dataRows = rows.slice(1, MAX_CSV_ROWS).map((r) => r.slice(0, MAX_CSV_COLS));

  return {
    kind: 'csv',
    headers,
    rows: dataRows,
    totalRows,
    totalCols,
    isTruncated,
  };
}

/**
 * Maps unsupported or download-only binary formats to human explanations.
 */
export function getUnsupportedDetails(filename: string, mimeType?: string | null): UnsupportedPreviewResult {
  const ext = path.extname(filename).toLowerCase();

  const LEGACY_OFFICE: Record<string, string> = {
    '.doc': 'Legacy Microsoft Word 97-2003 Document (.doc)',
    '.xls': 'Legacy Microsoft Excel 97-2003 Spreadsheet (.xls)',
    '.ppt': 'Legacy Microsoft PowerPoint 97-2003 Presentation (.ppt)',
  };

  if (LEGACY_OFFICE[ext]) {
    return {
      kind: 'unsupported',
      formatName: LEGACY_OFFICE[ext],
      reason: 'Legacy binary compound document format (OLE2/CFBF). Versora supports rich in-browser previews for modern OpenXML (.docx, .xlsx, .pptx) files. Download this file to inspect in desktop software.',
      extension: ext,
    };
  }

  const ARCHIVES = new Set(['.zip', '.tar', '.gz', '.tgz', '.7z', '.rar', '.bz2', '.xz']);
  if (ARCHIVES.has(ext)) {
    return {
      kind: 'unsupported',
      formatName: `Compressed Archive (${ext.toUpperCase().slice(1)})`,
      reason: 'Compressed package containing multiple files or directories. Download the archive to extract and examine files on your machine.',
      extension: ext,
    };
  }

  const EXECUTABLES = new Set(['.exe', '.dll', '.so', '.dylib', '.bin', '.iso', '.dmg']);
  if (EXECUTABLES.has(ext)) {
    return {
      kind: 'unsupported',
      formatName: 'Executable / System Binary',
      reason: 'Compiled binary executable or system image. Cannot be decoded in the browser for security and execution boundaries.',
      extension: ext,
    };
  }

  const ML_MODELS = new Set(['.pt', '.pth', '.onnx', '.safetensors', '.pkl', '.joblib', '.h5', '.weights']);
  if (ML_MODELS.has(ext)) {
    return {
      kind: 'unsupported',
      formatName: 'Machine Learning Model Weights',
      reason: 'Binary serialized tensors or model checkpoint. Download the model to inspect or run in PyTorch, ONNX Runtime, or TensorFlow.',
      extension: ext,
    };
  }

  const DATASETS = new Set(['.parquet', '.arrow', '.feather', '.dta', '.sav']);
  if (DATASETS.has(ext)) {
    return {
      kind: 'unsupported',
      formatName: 'Columnar / Binary Dataset',
      reason: 'Binary columnar dataset format. Download the file to query in DuckDB, Apache Arrow, or Pandas.',
      extension: ext,
    };
  }

  return {
    kind: 'unsupported',
    formatName: `Binary File (${ext ? ext.toUpperCase() : 'UNKNOWN'})`,
    reason: 'This file format is binary and cannot be decoded into an in-browser preview. Download the original file to view on your device.',
    extension: ext,
  };
}

/**
 * Main dispatcher to parse an artifact into rich preview data.
 */
export async function generateArtifactPreview(
  filename: string,
  buffer: Buffer,
  mimeType?: string | null
): Promise<PreviewData> {
  const ext = path.extname(filename).toLowerCase();

  // Size limit check for documents
  if (buffer.length > MAX_PREVIEW_DOCUMENT_SIZE) {
    return {
      kind: 'error',
      message: `File exceeds the maximum preview size of ${Math.round(MAX_PREVIEW_DOCUMENT_SIZE / (1024 * 1024))}MB. Please download the file to inspect.`,
    };
  }

  // 1. DOCX
  if (ext === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return parseDocx(buffer);
  }

  // 2. XLSX
  if (ext === '.xlsx' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return parseXlsx(buffer);
  }

  // 3. PPTX
  if (ext === '.pptx' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return parsePptx(buffer);
  }

  // 4. CSV / TSV
  if (ext === '.csv' || ext === '.tsv' || mimeType === 'text/csv' || mimeType === 'text/tab-separated-values') {
    return parseCsv(buffer.toString('utf-8'));
  }

  // 5. Visual Media & PDF
  const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg']);
  if (IMAGE_EXTS.has(ext) || (mimeType && mimeType.startsWith('image/'))) {
    return { kind: 'image', mimeType: mimeType || 'image/png' };
  }
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    return { kind: 'pdf', mimeType: 'application/pdf' };
  }

  // 6. Unsupported / Download-only
  return getUnsupportedDetails(filename, mimeType);
}
