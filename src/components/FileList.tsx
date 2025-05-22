"use client";

import React from 'react';
import { Trash2, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/utils';
import { UploadedFile } from '@/types';

interface FileListProps {
  files: UploadedFile[];
  onFileDelete: (fileId: string) => void;
}

export default function FileList({ files, onFileDelete }: FileListProps) {
  const handleDelete = async (fileId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/file/${fileId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        onFileDelete(fileId);
      } else {
        console.error('Failed to delete file:', await response.json());
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  return (
    <div className="space-y-2 mb-4">
      <div className="text-sm text-muted-foreground mb-2">
        {files.length} file(s) uploaded
      </div>
      <ul className="space-y-2">
        {files.map((file) => (
          <li 
            key={file.file_id} 
            className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
          >
            <div className="flex items-center space-x-3">
              <File className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium truncate max-w-[250px]">
                  {file.filename}
                </div>
                <div className="text-xs text-muted-foreground flex gap-2">
                  <span>{formatBytes(file.size)}</span>
                  <span>•</span>
                  <span>Encoding: {file.original_encoding || 'Unknown'}</span>
                </div>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(file.file_id)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
} 