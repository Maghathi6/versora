import path from 'node:path';
import { artifacts } from '../../db/schema/artifacts';

export type Artifact = typeof artifacts.$inferSelect;
export type NewArtifact = typeof artifacts.$inferInsert;

export type ArtifactKind = 'file' | 'folder';

export type ArtifactType =
  | 'code'
  | 'document'
  | 'dataset'
  | 'result'
  | 'presentation'
  | 'model'
  | 'folder'
  | 'other';

export type ArtifactCapability = 'editable' | 'previewable' | 'download-only';

/**
 * Public response contract for an artifact.
 */
export interface ArtifactResponse {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  path: string;
  type: ArtifactKind;
  artifactType: ArtifactType;
  capability: ArtifactCapability;
  mimeType: string | null;
  sizeBytes: number;
  hash: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Resolves standard MIME type based on file extension and optional client hint.
 */
export function resolveMimeType(filename: string, providedMime?: string | null): string {
  if (providedMime && providedMime !== 'application/octet-stream' && providedMime.trim()) {
    return providedMime.trim();
  }

  const ext = path.extname(filename).toLowerCase();
  const MIME_MAP: Record<string, string> = {
    '.ts': 'text/typescript',
    '.tsx': 'text/typescript',
    '.js': 'application/javascript',
    '.jsx': 'application/javascript',
    '.mjs': 'application/javascript',
    '.cjs': 'application/javascript',
    '.json': 'application/json',
    '.jsonl': 'application/json',
    '.py': 'text/x-python',
    '.pyw': 'text/x-python',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.scss': 'text/x-scss',
    '.less': 'text/x-less',
    '.md': 'text/markdown',
    '.markdown': 'text/markdown',
    '.txt': 'text/plain',
    '.sql': 'text/x-sql',
    '.csv': 'text/csv',
    '.tsv': 'text/tab-separated-values',
    '.xml': 'application/xml',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.c': 'text/x-c',
    '.h': 'text/x-c',
    '.cpp': 'text/x-c++',
    '.hpp': 'text/x-c++',
    '.java': 'text/x-java-source',
    '.cs': 'text/plain',
    '.go': 'text/x-go',
    '.rs': 'text/rust',
    '.rb': 'text/x-ruby',
    '.php': 'text/x-php',
    '.sh': 'application/x-sh',
    '.bash': 'application/x-sh',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.doc': 'application/msword',
    '.xls': 'application/vnd.ms-excel',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
  };

  return MIME_MAP[ext] || providedMime || 'application/octet-stream';
}

/**
 * Resolves the operational capability of an artifact.
 * Classifies items as:
 * - 'editable': Source code and plain text files openable in Monaco Editor.
 * - 'previewable': Images and PDF documents rendered in read-only visual previews.
 * - 'download-only': Word documents, spreadsheets, slides, archives, executables, ML models, and binary formats.
 */
export function getArtifactCapability(
  filename: string,
  isFolder: boolean,
  mimeType?: string | null
): ArtifactCapability {
  if (isFolder) {
    return 'download-only';
  }

  const ext = path.extname(filename).toLowerCase();

  // 1. Previewable formats (Images, PDF, DOCX, XLSX, PPTX)
  const PREVIEWABLE_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg',
    '.pdf',
    '.docx', '.xlsx', '.pptx',
  ]);

  if (PREVIEWABLE_EXTENSIONS.has(ext)) {
    return 'previewable';
  }

  if (mimeType) {
    const lowerMime = mimeType.toLowerCase();
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

  // 2. Download-only formats (Legacy office docs, archives, binaries, datasets, models)
  const DOWNLOAD_ONLY_EXTENSIONS = new Set([
    '.doc', '.xls', '.ppt', '.odt', '.ods', '.odp',
    '.zip', '.tar', '.gz', '.tgz', '.7z', '.rar', '.bz2', '.xz',
    '.exe', '.dll', '.so', '.dylib', '.bin', '.iso', '.dmg',
    '.parquet', '.arrow', '.h5', '.hdf5', '.feather', '.onnx',
    '.pt', '.pth', '.pkl', '.joblib', '.safetensors', '.weights',
    '.mp3', '.mp4', '.wav', '.mov', '.avi', '.mkv', '.webm', '.ogg',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
  ]);

  if (DOWNLOAD_ONLY_EXTENSIONS.has(ext)) {
    return 'download-only';
  }

  // 3. Editable formats: standard text / source code
  if (isTextArtifact(filename, mimeType)) {
    return 'editable';
  }

  return 'download-only';
}

/**
 * Formats a database artifact record into a sanitized API response.
 * Strictly excludes internal storage paths or filesystem identifiers.
 */
export function toArtifactResponse(artifact: Artifact): ArtifactResponse {
  const isFolder = artifact.type === 'folder';
  return {
    id: artifact.id,
    projectId: artifact.projectId,
    parentId: artifact.parentId,
    name: artifact.name,
    path: artifact.path,
    type: artifact.type as ArtifactKind,
    artifactType: artifact.artifactType as ArtifactType,
    capability: getArtifactCapability(artifact.name, isFolder, artifact.mimeType),
    mimeType: artifact.mimeType,
    sizeBytes: Number(artifact.sizeBytes),
    hash: artifact.hash,
    createdAt: artifact.createdAt instanceof Date ? artifact.createdAt.toISOString() : String(artifact.createdAt),
    updatedAt: artifact.updatedAt instanceof Date ? artifact.updatedAt.toISOString() : String(artifact.updatedAt),
  };
}

/**
 * Detects the artifact category based on file extension and type.
 * Prepares the foundation for future artifact traceability.
 */
export function detectArtifactType(filename: string, isFolder: boolean): ArtifactType {
  if (isFolder) {
    return 'folder';
  }

  const ext = path.extname(filename).toLowerCase();

  const CODE_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
    '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.html', '.css',
    '.scss', '.sass', '.less', '.json', '.yaml', '.yml', '.xml', '.sh',
    '.bash', '.zsh', '.ps1', '.sql', '.toml', '.env', '.dockerfile', '.vue',
    '.svelte', '.lua', '.scala', '.r', '.m'
  ]);

  const DOCUMENT_EXTENSIONS = new Set([
    '.md', '.markdown', '.txt', '.pdf', '.docx', '.doc', '.rtf', '.odt',
    '.tex', '.rst', '.asciidoc', '.epub', '.pages'
  ]);

  const DATASET_EXTENSIONS = new Set([
    '.csv', '.tsv', '.parquet', '.arrow', '.xlsx', '.xls', '.jsonl',
    '.h5', '.hdf5', '.feather', '.dta', '.sav', '.sas7bdat'
  ]);

  const RESULT_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif', '.bmp', '.tiff',
    '.log', '.out', '.metrics', '.chart', '.fig', '.eps'
  ]);

  const PRESENTATION_EXTENSIONS = new Set([
    '.pptx', '.ppt', '.key', '.odp'
  ]);

  const MODEL_EXTENSIONS = new Set([
    '.pt', '.pth', '.onnx', '.bin', '.safetensors', '.pkl', '.joblib',
    '.h5', '.tflite', '.weights', '.caffemodel', '.pb'
  ]);

  if (CODE_EXTENSIONS.has(ext)) return 'code';
  if (DOCUMENT_EXTENSIONS.has(ext)) return 'document';
  if (DATASET_EXTENSIONS.has(ext)) return 'dataset';
  if (RESULT_EXTENSIONS.has(ext)) return 'result';
  if (PRESENTATION_EXTENSIONS.has(ext)) return 'presentation';
  if (MODEL_EXTENSIONS.has(ext)) return 'model';

  return 'other';
}

/**
 * Public response contract when reading artifact text content for the in-browser code editor.
 */
export interface ArtifactContentResponse {
  artifact: ArtifactResponse;
  content: string;
  language: string;
  isBinary: boolean;
}

/**
 * Determines whether a file can be opened and edited as text.
 * Checks file extension, MIME type, and optional initial byte sample for null bytes.
 */
export function isTextArtifact(
  filename: string,
  mimeType?: string | null,
  bufferSample?: Buffer
): boolean {
  const ext = path.extname(filename).toLowerCase();

  const BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff',
    '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar', '.bz2',
    '.exe', '.dll', '.so', '.dylib', '.bin', '.iso', '.dmg',
    '.parquet', '.arrow', '.h5', '.hdf5', '.feather', '.onnx',
    '.pt', '.pth', '.pkl', '.joblib', '.safetensors',
    '.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt',
    '.mp3', '.mp4', '.wav', '.mov', '.avi', '.mkv', '.webm', '.ogg',
    '.woff', '.woff2', '.ttf', '.eot', '.otf'
  ]);

  if (BINARY_EXTENSIONS.has(ext)) {
    return false;
  }

  if (mimeType) {
    const lowerMime = mimeType.toLowerCase();
    if (
      lowerMime.startsWith('image/') && !lowerMime.includes('svg') ||
      lowerMime.startsWith('audio/') ||
      lowerMime.startsWith('video/') ||
      lowerMime === 'application/pdf' ||
      lowerMime === 'application/zip' ||
      lowerMime === 'application/x-tar' ||
      lowerMime === 'application/gzip'
    ) {
      return false;
    }
  }

  // Inspect first 8000 bytes for null bytes (Git binary heuristic)
  if (bufferSample && bufferSample.length > 0) {
    const sampleLength = Math.min(bufferSample.length, 8000);
    for (let i = 0; i < sampleLength; i++) {
      if (bufferSample[i] === 0x00) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Maps a file extension to a Monaco Editor language identifier.
 */
export function getMonacoLanguage(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const lowerName = path.basename(filename).toLowerCase();

  // Special full filenames
  if (lowerName === 'dockerfile') return 'dockerfile';
  if (lowerName === 'makefile') return 'makefile';
  if (lowerName.startsWith('.env')) return 'shell';

  const LANGUAGE_MAP: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.py': 'python',
    '.pyw': 'python',
    '.c': 'c',
    '.h': 'c',
    '.cpp': 'cpp',
    '.hpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.java': 'java',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.kts': 'kotlin',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'scss',
    '.less': 'less',
    '.json': 'json',
    '.jsonl': 'json',
    '.xml': 'xml',
    '.svg': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.md': 'markdown',
    '.markdown': 'markdown',
    '.sql': 'sql',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.ps1': 'powershell',
    '.bat': 'bat',
    '.cmd': 'bat',
    '.dockerfile': 'dockerfile',
    '.toml': 'ini',
    '.ini': 'ini',
    '.conf': 'ini',
    '.cfg': 'ini',
    '.r': 'r',
    '.lua': 'lua',
    '.vue': 'html',
    '.svelte': 'html',
    '.graphql': 'graphql',
    '.gql': 'graphql',
    '.txt': 'plaintext',
    '.log': 'plaintext',
    '.csv': 'plaintext',
    '.tsv': 'plaintext',
  };

  return LANGUAGE_MAP[ext] || 'plaintext';
}
