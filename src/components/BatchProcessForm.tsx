"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Loader2, Download, Trash2 } from 'lucide-react';
import { UploadedFile, ProcessedFile, TTSSettings } from '@/types';

interface BatchProcessFormProps {
  files: UploadedFile[];
  voice: string;
  settings: TTSSettings;
  setLoading: (loading: boolean) => void;
}

export default function BatchProcessForm({ 
  files, 
  voice, 
  settings, 
  setLoading 
}: BatchProcessFormProps) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  
  const handleBatchProcess = async () => {
    if (!voice || files.length === 0) return;
    
    setProcessing(true);
    setLoading(true);
    setProgress(0);
    
    try {
      const fileIds = files.map(file => file.file_id);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/batch-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_ids: fileIds,
          voice,
          rate: settings.rate,
          volume: settings.volume,
          pitch: settings.pitch
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setProcessedFiles(data.files);
      } else {
        console.error('Batch processing failed:', data);
      }
    } catch (error) {
      console.error('Error during batch processing:', error);
    } finally {
      setProcessing(false);
      setLoading(false);
      setProgress(100);
    }
  };

  const handleDelete = async (outputId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/output/${outputId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setProcessedFiles(processedFiles.filter(file => file.output_id !== outputId));
      } else {
        console.error('Failed to delete output:', await response.json());
      }
    } catch (error) {
      console.error('Error deleting output:', error);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <Button 
        onClick={handleBatchProcess} 
        disabled={processing || !voice || files.length === 0}
        className="w-full"
      >
        {processing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" />
            Process All Files
          </>
        )}
      </Button>
      
      {processing && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-xs text-center text-muted-foreground">
            Processing files ({Math.round(progress)}%)...
          </p>
        </div>
      )}
      
      {processedFiles.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-3">Generated Audio</h3>
            <ul className="space-y-3">
              {processedFiles.map((file) => (
                <li 
                  key={file.output_id} 
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {file.original_name}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <a 
                      href={`${process.env.NEXT_PUBLIC_API_URL}${file.output_url}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </a>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(file.output_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 