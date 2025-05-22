"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VoiceInfo, UploadedFile } from '@/types';
import FileUploader from '@/components/FileUploader';
import VoiceSelector from '@/components/VoiceSelector';
import TTSSettings from '@/components/TTSSettings';
import FileList from '@/components/FileList';
import BatchProcessForm from '@/components/BatchProcessForm';

export default function Home() {
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [settings, setSettings] = useState({
    rate: "+0%",
    volume: "+0%",
    pitch: "+0Hz"
  });

  // Fetch voices from the API on component mount
  useEffect(() => {
    async function fetchVoices() {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/voices`);
        const data = await response.json();
        setVoices(data);
        
        // Set default voice (English)
        const defaultVoice = data.find((voice: VoiceInfo) => voice.name === "en-US-AndrewNeural");
        if (defaultVoice) {
          setSelectedVoice(defaultVoice.name);
        } else if (data.length > 0) {
          setSelectedVoice(data[0].name);
        }
      } catch (error) {
        console.error("Failed to fetch voices:", error);
      }
    }

    fetchVoices();
  }, []);

  const handleFileDelete = (fileId: string) => {
    setUploadedFiles(uploadedFiles.filter(file => file.file_id !== fileId));
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Edge TTS Web Interface</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Files</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUploader 
              onFileUpload={(file) => setUploadedFiles([...uploadedFiles, file])} 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voice & Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <VoiceSelector 
              voices={voices} 
              selectedVoice={selectedVoice} 
              onVoiceChange={setSelectedVoice} 
            />
            <TTSSettings 
              settings={settings} 
              onSettingsChange={setSettings} 
            />
          </CardContent>
        </Card>
      </div>

      {uploadedFiles.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Uploaded Files</CardTitle>
          </CardHeader>
          <CardContent>
            <FileList 
              files={uploadedFiles} 
              onFileDelete={handleFileDelete} 
            />
            <BatchProcessForm 
              files={uploadedFiles} 
              voice={selectedVoice} 
              settings={settings} 
              setLoading={setLoading}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
} 