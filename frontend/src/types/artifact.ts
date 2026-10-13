/**
 * Artifact and Project Workspace Types
 */

export type ArtifactKind = 'file' | 'folder';

export type ArtifactCategory =
  | 'code'
  | 'document'
  | 'dataset'
  | 'result'
  | 'presentation'
  | 'model'
  | 'folder'
  | 'other';

export type ArtifactCapability = 'editable' | 'previewable' | 'download-only';

export interface ArtifactItem {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  path: string;
  type: ArtifactKind;
  artifactType: ArtifactCategory;
  capability?: ArtifactCapability;
  mimeType: string | null;
  sizeBytes: number;
  hash: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Derives operational capability of an artifact with fallback rules.
 */
export function getArtifactCapability(item: ArtifactItem): ArtifactCapability {
  if (item.capability) return item.capability;
  if (item.type === 'folder') return 'download-only';

  const ext = item.name.lastIndexOf('.') !== -1 ? item.name.slice(item.name.lastIndexOf('.')).toLowerCase() : '';
  const PREVIEWABLE_EXT = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg', '.pdf',
    '.docx', '.xlsx', '.pptx',
  ]);
  if (PREVIEWABLE_EXT.has(ext)) return 'previewable';

  if (item.mimeType) {
    const lowerMime = item.mimeType.toLowerCase();
    if (
      lowerMime.startsWith('image/') ||
      lowerMime === 'application/pdf' ||
      lowerMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lowerMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      lowerMime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ) {
      return 'previewable';
    }
  }

  const DOWNLOAD_ONLY_EXT = new Set([
    '.doc', '.xls', '.ppt', '.odt', '.ods', '.odp',
    '.zip', '.tar', '.gz', '.tgz', '.7z', '.rar',
    '.exe', '.dll', '.so', '.dylib', '.bin', '.iso', '.dmg',
    '.parquet', '.arrow', '.h5', '.hdf5', '.feather', '.onnx',
    '.pt', '.pth', '.pkl', '.joblib', '.safetensors',
    '.mp3', '.mp4', '.wav', '.mov', '.avi',
  ]);
  if (DOWNLOAD_ONLY_EXT.has(ext)) return 'download-only';

  const EDITABLE_EXT = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.json', '.py', '.html', '.css', '.scss',
    '.md', '.txt', '.sql', '.csv', '.tsv', '.xml', '.yaml', '.yml',
    '.c', '.h', '.cpp', '.hpp', '.java', '.cs', '.go', '.rs', '.rb', '.php',
    '.sh', '.bash', '.env', '.gitignore', '.dockerignore',
  ]);
  if (EDITABLE_EXT.has(ext)) return 'editable';

  return 'download-only';
}

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
  artifact: ArtifactItem;
  preview: PreviewData;
}

export interface CreateFolderInput {
  name: string;
  parentId?: string | null;
}

export interface CreateArtifactInput {
  name: string;
  parentId?: string | null;
  content?: string;
}

export interface RenameArtifactInput {
  name: string;
}

export interface MoveArtifactInput {
  targetParentId?: string | null;
}

export interface ProjectStats {
  totalFiles: number;
  totalFolders: number;
  totalSizeBytes: number;
}

export interface ProjectOverviewData {
  project: {
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    createdAt: string;
    updatedAt: string;
  };
  stats: ProjectStats;
}

export interface ArtifactContentResponse {
  artifact: ArtifactItem;
  content: string;
  language: string;
  isBinary: boolean;
}
