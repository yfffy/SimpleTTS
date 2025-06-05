import { VoiceInfo, UploadedFile, ProcessedFile, TTSSettings } from '@/types';

class APIError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = 'APIError';
  }
}

class SimpleTTSAPI {
  private baseUrl: string;
  private username: string | null = null;
  private password: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || (typeof window !== 'undefined' ? (window as any).NEXT_PUBLIC_API_URL : null) || 'http://localhost:5001';
  }

  setCredentials(username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  clearCredentials() {
    this.username = null;
    this.password = null;
  }

  private getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.username && this.password) {
      const credentials = btoa(`${this.username}:${this.password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    return headers;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Merge auth headers with any existing headers
    const headers = {
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        let errorCode = `HTTP_${response.status}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
          errorCode = errorData.error_code || errorCode;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }

        throw new APIError(response.status, errorMessage, errorCode);
      }

      // Handle non-JSON responses (like downloads)
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      } else {
        return response as any;
      }
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      // Network or other errors
      throw new APIError(0, error instanceof Error ? error.message : 'Network error');
    }
  }

  async healthCheck(): Promise<{ message: string; version: string; status: string; timestamp: string }> {
    return this.makeRequest('/');
  }

  async getVoices(): Promise<VoiceInfo[]> {
    return this.makeRequest('/voices');
  }

  async uploadFile(file: File): Promise<UploadedFile> {
    const formData = new FormData();
    formData.append('file', file);

    const headers: HeadersInit = {};
    if (this.username && this.password) {
      const credentials = btoa(`${this.username}:${this.password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    return this.makeRequest('/upload', {
      method: 'POST',
      body: formData,
      headers,
    });
  }

  async generateTTS(
    text: string,
    voice: string,
    settings: TTSSettings,
    filename?: string
  ): Promise<{ success: boolean; output_id: string; output_url: string; message?: string }> {
    return this.makeRequest('/tts', {
      method: 'POST',
      body: JSON.stringify({
        text,
        voice,
        rate: settings.rate,
        volume: settings.volume,
        pitch: settings.pitch,
        filename,
      }),
    });
  }

  async batchProcess(
    fileIds: string[],
    voice: string,
    settings: TTSSettings
  ): Promise<{ success: boolean; files: ProcessedFile[]; message?: string }> {
    return this.makeRequest('/batch-process', {
      method: 'POST',
      body: JSON.stringify({
        file_ids: fileIds,
        voice,
        rate: settings.rate,
        volume: settings.volume,
        pitch: settings.pitch,
      }),
    });
  }

  async getFileContent(fileId: string): Promise<{ content: string; filename: string; file_size: number; encoding: string }> {
    return this.makeRequest(`/file-content/${fileId}`);
  }

  async deleteFile(fileId: string): Promise<{ success: boolean; message: string }> {
    return this.makeRequest(`/file/${fileId}`, {
      method: 'DELETE',
    });
  }

  async deleteOutput(outputId: string): Promise<{ success: boolean; message: string }> {
    return this.makeRequest(`/output/${outputId}`, {
      method: 'DELETE',
    });
  }

  async listUploads(): Promise<{ files: string[] }> {
    return this.makeRequest('/uploads');
  }

  async createZip(fileIds: string[]): Promise<Response> {
    return this.makeRequest('/create-zip', {
      method: 'POST',
      body: JSON.stringify({
        file_ids: fileIds,
      }),
    });
  }

  getDownloadUrl(outputId: string): string {
    return `${this.baseUrl}/download/${outputId}`;
  }

  async downloadFile(outputId: string): Promise<void> {
    const url = this.getDownloadUrl(outputId);
    const headers: HeadersInit = {};
    
    if (this.username && this.password) {
      const credentials = btoa(`${this.username}:${this.password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new APIError(response.status, `Download failed: ${response.statusText}`);
    }

    // Trigger download
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `audio_${outputId}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  }

  // Test authentication
  async testAuth(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      if (error instanceof APIError && error.status === 401) {
        return false;
      }
      throw error;
    }
  }
}

// Create singleton instance
export const api = new SimpleTTSAPI();
export { APIError };
export type { SimpleTTSAPI }; 