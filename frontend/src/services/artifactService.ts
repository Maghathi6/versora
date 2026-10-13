import { apiClient, ApiError } from './apiClient';
import { ApiSuccessResponse } from '../types/api';
import {
  ArtifactItem,
  ArtifactContentResponse,
  ArtifactPreviewResponse,
  CreateFolderInput,
  CreateArtifactInput,
  RenameArtifactInput,
  MoveArtifactInput,
  ProjectOverviewData,
} from '../types/artifact';
import { authStorage } from '../utils/authStorage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Artifact Service
 * Communicates with backend file and folder workspace endpoints.
 */
export const artifactService = {
  /**
   * Lists artifacts within a project folder (or root if parentId is not specified).
   */
  async listArtifacts(projectId: string, parentId?: string | null): Promise<ArtifactItem[]> {
    const params: Record<string, string | undefined> = {};
    if (parentId) {
      params.parentId = parentId;
    }
    const response = await apiClient.get<ApiSuccessResponse<ArtifactItem[]>>(
      `/v1/projects/${projectId}/artifacts`,
      { params }
    );
    return response.data;
  },

  /**
   * Retrieves single artifact metadata by ID.
   */
  async getArtifact(projectId: string, artifactId: string): Promise<ArtifactItem> {
    const response = await apiClient.get<ApiSuccessResponse<ArtifactItem>>(
      `/v1/projects/${projectId}/artifacts/${artifactId}`
    );
    return response.data;
  },

  /**
   * Creates a new directory in the project workspace.
   */
  async createFolder(projectId: string, input: CreateFolderInput): Promise<ArtifactItem> {
    const response = await apiClient.post<ApiSuccessResponse<ArtifactItem>>(
      `/v1/projects/${projectId}/folders`,
      input
    );
    return response.data;
  },

  /**
   * Creates a new file artifact with empty or initial content in the project workspace.
   */
  async createArtifact(projectId: string, input: CreateArtifactInput): Promise<ArtifactItem> {
    const response = await apiClient.post<ApiSuccessResponse<ArtifactItem>>(
      `/v1/projects/${projectId}/artifacts`,
      input
    );
    return response.data;
  },

  /**
   * Uploads a file to the project workspace using multipart/form-data.
   */
  async uploadFile(
    projectId: string,
    file: File,
    parentId?: string | null
  ): Promise<ArtifactItem> {
    const formData = new FormData();
    formData.append('file', file);
    if (parentId) {
      formData.append('parentId', parentId);
    }

    const token = authStorage.getToken();
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}/v1/projects/${projectId}/files`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
    } catch (networkError) {
      throw new ApiError(
        'Unable to connect to the Versora backend server. Please verify the API is running.',
        'NETWORK_ERROR',
        0,
        networkError
      );
    }

    let json: any;
    try {
      json = await response.json();
    } catch {
      throw new ApiError(
        `Received non-JSON response from server (${response.status})`,
        'INVALID_RESPONSE',
        response.status
      );
    }

    if (!response.ok) {
      throw new ApiError(
        json?.error?.message || `Upload failed with status ${response.status}`,
        json?.error?.code || 'UPLOAD_ERROR',
        response.status,
        json?.error?.details
      );
    }

    return json.data as ArtifactItem;
  },

  /**
   * Downloads a file from the project workspace and triggers a browser file save.
   */
  async downloadFile(projectId: string, artifactId: string, filename: string): Promise<void> {
    const token = authStorage.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}/v1/projects/${projectId}/artifacts/${artifactId}/download`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      let errorMessage = `Download failed with status ${response.status}`;
      try {
        const errorJson = await response.json();
        errorMessage = errorJson?.error?.message || errorMessage;
      } catch {}
      throw new ApiError(errorMessage, 'DOWNLOAD_ERROR', response.status);
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
  },

  /**
   * Renames a file or folder.
   */
  async renameArtifact(
    projectId: string,
    artifactId: string,
    input: RenameArtifactInput
  ): Promise<ArtifactItem> {
    const response = await apiClient.patch<ApiSuccessResponse<ArtifactItem>>(
      `/v1/projects/${projectId}/artifacts/${artifactId}/rename`,
      input
    );
    return response.data;
  },

  /**
   * Moves a file or folder to a new parent folder.
   */
  async moveArtifact(
    projectId: string,
    artifactId: string,
    input: MoveArtifactInput
  ): Promise<ArtifactItem> {
    const response = await apiClient.patch<ApiSuccessResponse<ArtifactItem>>(
      `/v1/projects/${projectId}/artifacts/${artifactId}/move`,
      input
    );
    return response.data;
  },

  /**
   * Deletes a file or folder.
   */
  async deleteArtifact(
    projectId: string,
    artifactId: string
  ): Promise<{ deletedIds: string[]; message: string }> {
    const response = await apiClient.delete<ApiSuccessResponse<{ deletedIds: string[]; message: string }>>(
      `/v1/projects/${projectId}/artifacts/${artifactId}`
    );
    return response.data;
  },

  /**
   * Reads text content of an artifact for in-browser code editing.
   */
  async getArtifactContent(projectId: string, artifactId: string): Promise<ArtifactContentResponse> {
    const response = await apiClient.get<ApiSuccessResponse<ArtifactContentResponse>>(
      `/v1/projects/${projectId}/artifacts/${artifactId}/content`
    );
    return response.data;
  },

  /**
   * Updates text content of an artifact from the in-browser code editor.
   */
  async updateArtifactContent(
    projectId: string,
    artifactId: string,
    content: string
  ): Promise<ArtifactItem> {
    const response = await apiClient.put<ApiSuccessResponse<ArtifactItem>>(
      `/v1/projects/${projectId}/artifacts/${artifactId}/content`,
      { content }
    );
    return response.data;
  },

  /**
   * Retrieves structured rich preview data for DOCX, XLSX, PPTX, CSV, media, and unsupported files.
   */
  async getArtifactPreviewData(
    projectId: string,
    artifactId: string
  ): Promise<ArtifactPreviewResponse> {
    const response = await apiClient.get<ApiSuccessResponse<ArtifactPreviewResponse>>(
      `/v1/projects/${projectId}/artifacts/${artifactId}/preview-data`
    );
    return response.data;
  },

  /**
   * Retrieves an authenticated Blob URL for previewing images and PDF files safely.
   */
  async getArtifactBlob(
    projectId: string,
    artifactId: string
  ): Promise<{ blob: Blob; url: string; mimeType: string }> {
    const token = authStorage.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}/v1/projects/${projectId}/artifacts/${artifactId}/preview`;
    let response: Response;
    try {
      response = await fetch(url, { headers });
    } catch (networkError) {
      throw new ApiError(
        'Unable to connect to the Versora backend server. Please verify the API is running.',
        'NETWORK_ERROR',
        0,
        networkError
      );
    }

    if (!response.ok) {
      let errorMessage = `Failed to load preview (status ${response.status})`;
      try {
        const errorJson = await response.json();
        errorMessage = errorJson?.error?.message || errorMessage;
      } catch {}
      throw new ApiError(errorMessage, 'PREVIEW_ERROR', response.status);
    }

    const mimeType = response.headers.get('Content-Type') || 'application/octet-stream';
    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    return { blob, url: objectUrl, mimeType };
  },

  /**
   * Retrieves summary statistics and project metadata for the workspace overview.
   */
  async getProjectOverview(projectId: string): Promise<ProjectOverviewData> {
    const response = await apiClient.get<ApiSuccessResponse<ProjectOverviewData>>(
      `/v1/projects/${projectId}/overview`
    );
    return response.data;
  },
};
