export interface UploadedFile {
  file_id: string;
  filename: string;
  original_encoding: string;
  size: number;
}

export interface ProcessedFile {
  file_id: string;
  original_name: string;
  output_id: string;
  output_url: string;
}

export interface TTSResponse {
  success: boolean;
  output_id: string;
  output_url: string;
}

export interface BatchProcessResponse {
  success: boolean;
  files: ProcessedFile[];
}

export interface VoiceInfo {
  name: string;
  gender: string;
  locale: string;
}

export interface TTSSettings {
  voice: string;
  rate: string;
  volume: string;
  pitch: string;
} 