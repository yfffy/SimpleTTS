"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VoiceInfo, UploadedFile } from '@/types';
import { api, APIError } from '@/lib/api';
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
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [settings, setSettings] = useState({
    rate: "+0%",
    volume: "+0%",
    pitch: "+0Hz"
  });

  // Check authentication and fetch voices
  useEffect(() => {
    async function initializeApp() {
      // Try with default credentials first
      api.setCredentials('admin', 'admin123');
      
      try {
        await api.healthCheck();
        setAuthenticated(true);
        await fetchVoices();
      } catch (error) {
        if (error instanceof APIError && error.status === 401) {
          setAuthenticated(false);
          setAuthError('Authentication required. Please enter your credentials.');
        } else {
          setAuthError('Failed to connect to the API. Please check if the server is running.');
        }
      }
    }

    initializeApp();
  }, []);

  async function fetchVoices() {
    try {
      const data = await api.getVoices();
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
      setAuthError("Failed to fetch voices. Please check your connection.");
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);

    try {
      api.setCredentials(credentials.username, credentials.password);
      await api.healthCheck();
      setAuthenticated(true);
      await fetchVoices();
    } catch (error) {
      if (error instanceof APIError) {
        if (error.status === 401) {
          setAuthError('Invalid username or password');
        } else {
          setAuthError(`Authentication failed: ${error.message}`);
        }
      } else {
        setAuthError('Network error. Please check your connection.');
      }
      api.clearCredentials();
    } finally {
      setLoading(false);
    }
  };

  const handleFileDelete = async (fileId: string) => {
    try {
      await api.deleteFile(fileId);
      setUploadedFiles(uploadedFiles.filter(file => file.file_id !== fileId));
    } catch (error) {
      console.error("Failed to delete file:", error);
    }
  };

  // Show authentication form if not authenticated
  if (!authenticated) {
    return (
      <div className="container py-8 max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>SimpleTTS - Authentication Required</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter username"
                  disabled={loading}
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter password"
                  disabled={loading}
                />
              </div>

              {authError && (
                <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {authError}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Authenticating...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-4 text-sm text-gray-600 text-center">
              <p>Default credentials for testing:</p>
              <p className="font-mono">Username: admin</p>
              <p className="font-mono">Password: admin123</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">SimpleTTS Web Interface</h1>
        <Button 
          variant="outline" 
          onClick={() => {
            api.clearCredentials();
            setAuthenticated(false);
          }}
        >
          Sign Out
        </Button>
      </div>
      
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