"use client";

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, X, Check, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { isTextFile } from '@/lib/utils';
import { UploadedFile } from '@/types';
import { api, APIError } from '@/lib/api';

interface FileUploaderProps {
  onFileUpload: (file: UploadedFile) => void;
}

export default function FileUploader({ onFileUpload }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    setUploading(true);
    
    for (const file of acceptedFiles) {
      // Check if it's a text file
      if (!isTextFile(file.name)) {
        setError(`File "${file.name}" is not a supported text file.`);
        setUploading(false);
        return;
      }

      try {
        const data = await api.uploadFile(file);
        onFileUpload(data);
      } catch (error) {
        console.error('Error uploading file:', error);
        if (error instanceof APIError) {
          setError(error.message);
        } else {
          setError('Failed to upload file. Please try again.');
        }
      }
    }
    
    setUploading(false);
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'text/*': ['.txt', '.srt', '.md', '.csv', '.json', '.html', '.xml', '.css', '.js', '.ts'],
    },
    maxFiles: 10,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-300 ${
          isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-primary/50'
        }`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-1">
          {isDragActive ? 'Drop files here...' : 'Drag & drop files here, or click to select files'}
        </p>
        <p className="text-xs text-muted-foreground">
          Supported files: TXT, SRT, MD, and other text-based formats
        </p>
      </div>

      {uploading && (
        <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
          <span className="animate-spin">⏳</span>
          <span>Uploading...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>{error}</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="ml-auto h-5 w-5" 
            onClick={() => setError(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
} 