'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Voice {
  name: string;
  gender: string;
  locale: string;
}

interface UploadedFile {
  file_id: string;
  filename: string;
  original_encoding: string;
  encoding_confidence: number;
  size: number;
}

interface ProcessedFile {
  file_id: string;
  original_name: string;
  output_id: string;
  output_url: string;
}

export default function BatchProcessing() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [rate, setRate] = useState<string>('+0%');
  const [volume, setVolume] = useState<string>('+0%');
  const [pitch, setPitch] = useState<string>('+0Hz');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCreatingZip, setIsCreatingZip] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [groupedVoices, setGroupedVoices] = useState<Record<string, Voice[]>>({});

  // Fetch voices on component mount
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        setIsLoading(true);
        setApiError('');
        const response = await fetch('/api/voices');
        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status}`);
        }
        const voiceData = await response.json();
        setVoices(voiceData);

        // Group voices by locale
        const grouped: Record<string, Voice[]> = {};
        voiceData.forEach((voice: Voice) => {
          if (!grouped[voice.locale]) {
            grouped[voice.locale] = [];
          }
          grouped[voice.locale].push(voice);
        });
        setGroupedVoices(grouped);

        // Set default voice (English US)
        const defaultVoice = voiceData.find((v: Voice) => v.locale === 'en-US');
        if (defaultVoice) {
          setSelectedVoice(defaultVoice.name);
        }
      } catch (error) {
        console.error('Error fetching voices:', error);
        setApiError('Failed to load voices. Please check if the backend service is running.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchVoices();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setIsLoading(true);
    setApiError('');
    const files = Array.from(e.target.files);
    const newUploadedFiles: UploadedFile[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status} when uploading ${file.name}`);
        }

        const data = await response.json();
        if (!data.error) {
          newUploadedFiles.push({
            file_id: data.file_id,
            filename: data.filename,
            original_encoding: data.original_encoding,
            encoding_confidence: data.encoding_confidence || 0,
            size: data.size,
          });
        } else {
          setApiError(`Error uploading ${file.name}: ${data.error}`);
        }
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        setApiError(`Error uploading ${file.name}. Please check if the backend service is running.`);
      }
    }

    setUploadedFiles((prev) => [...prev, ...newUploadedFiles]);
    setIsLoading(false);
    e.target.value = '';
  };

  const handleBatchProcess = async () => {
    if (uploadedFiles.length === 0 || !selectedVoice) return;

    setIsLoading(true);
    setApiError('');
    try {
      const response = await fetch('/api/batch-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_ids: uploadedFiles.map((file) => file.file_id),
          voice: selectedVoice,
          rate,
          volume,
          pitch,
        }),
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setProcessedFiles(data.files);
        setUploadedFiles([]);
      } else if (data.error) {
        setApiError(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error processing batch:', error);
      setApiError('Failed to process files. Please check if the backend service is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUploadedFile = async (fileId: string) => {
    try {
      setApiError('');
      const response = await fetch(`/api/file/${fileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      setUploadedFiles((prev) => prev.filter((file) => file.file_id !== fileId));
    } catch (error) {
      console.error('Error deleting file:', error);
      setApiError('Failed to delete file. Please check if the backend service is running.');
    }
  };

  const handleDeleteOutputFile = async (outputId: string) => {
    try {
      setApiError('');
      const response = await fetch(`/api/output/${outputId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      setProcessedFiles((prev) => prev.filter((file) => file.output_id !== outputId));
    } catch (error) {
      console.error('Error deleting output file:', error);
      setApiError('Failed to delete output file. Please check if the backend service is running.');
    }
  };

  const downloadAllAsZip = async () => {
    if (processedFiles.length === 0) return;
    
    setIsCreatingZip(true);
    setApiError('');
    
    try {
      const response = await fetch('/api/create-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_ids: processedFiles.map(file => file.output_id),
        }),
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      // Create a download link and click it
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tts_batch_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error creating ZIP file:', error);
      setApiError('Failed to create ZIP file. Please check if the backend service is running.');
    } finally {
      setIsCreatingZip(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getEncodingBadgeColor = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-100 text-green-800';
    if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">SimpleTTS - Batch Processing</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="mb-6">
              <Link
                href="/"
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Back to Single Text
              </Link>
            </div>

            {apiError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <h3 className="text-sm font-medium text-red-800">API Error</h3>
                <p className="mt-1 text-sm text-red-700">{apiError}</p>
              </div>
            )}

            <div className="mb-6 p-4 border border-gray-200 rounded-md">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Text Files</h3>
              <p className="mb-4 text-sm text-gray-500">
                Upload .txt files for conversion to speech. Files will automatically be converted to UTF-8 encoding.
              </p>
              <input
                type="file"
                onChange={handleFileUpload}
                multiple
                accept=".txt"
                disabled={isLoading || voices.length === 0}
                className="mt-1 block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-indigo-50 file:text-indigo-700
                  hover:file:bg-indigo-100
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {uploadedFiles.length > 0 && (
              <div className="mb-6 p-4 border border-gray-200 rounded-md">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Uploaded Files ({uploadedFiles.length})</h3>
                <ul className="divide-y divide-gray-200">
                  {uploadedFiles.map((file) => (
                    <li key={file.file_id} className="py-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.filename}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-sm text-gray-500">{formatFileSize(file.size)}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getEncodingBadgeColor(file.encoding_confidence)}`}>
                            {file.original_encoding || 'Unknown'} ({Math.round(file.encoding_confidence * 100)}% confidence)
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteUploadedFile(file.file_id)}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-6 p-4 border border-gray-200 rounded-md">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Voice Settings</h3>

              <div className="mb-4">
                <label htmlFor="voice" className="block text-sm font-medium text-gray-700 mb-1">
                  Voice
                </label>
                <select
                  id="voice"
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  required
                  disabled={isLoading || voices.length === 0}
                >
                  <option value="">Select a voice</option>
                  {Object.keys(groupedVoices).sort().map((locale) => (
                    <optgroup key={locale} label={locale}>
                      {groupedVoices[locale].map((voice) => (
                        <option key={voice.name} value={voice.name}>
                          {voice.name.split('(')[1]?.split(')')[0]} ({voice.gender})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <div>
                  <label htmlFor="rate" className="block text-sm font-medium text-gray-700 mb-1">
                    Rate
                  </label>
                  <select
                    id="rate"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    disabled={isLoading}
                  >
                    <option value="-50%">Very Slow (-50%)</option>
                    <option value="-25%">Slow (-25%)</option>
                    <option value="+0%">Normal (+0%)</option>
                    <option value="+25%">Fast (+25%)</option>
                    <option value="+50%">Very Fast (+50%)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="volume" className="block text-sm font-medium text-gray-700 mb-1">
                    Volume
                  </label>
                  <select
                    id="volume"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    disabled={isLoading}
                  >
                    <option value="-50%">Very Quiet (-50%)</option>
                    <option value="-25%">Quiet (-25%)</option>
                    <option value="+0%">Normal (+0%)</option>
                    <option value="+25%">Loud (+25%)</option>
                    <option value="+50%">Very Loud (+50%)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="pitch" className="block text-sm font-medium text-gray-700 mb-1">
                    Pitch
                  </label>
                  <select
                    id="pitch"
                    value={pitch}
                    onChange={(e) => setPitch(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    disabled={isLoading}
                  >
                    <option value="-50Hz">Very Low (-50Hz)</option>
                    <option value="-25Hz">Low (-25Hz)</option>
                    <option value="+0Hz">Normal (+0Hz)</option>
                    <option value="+25Hz">High (+25Hz)</option>
                    <option value="+50Hz">Very High (+50Hz)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <button
                onClick={handleBatchProcess}
                disabled={isLoading || uploadedFiles.length === 0 || voices.length === 0}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Processing...' : `Convert ${uploadedFiles.length} ${uploadedFiles.length === 1 ? 'File' : 'Files'} to Speech`}
              </button>
            </div>

            {processedFiles.length > 0 && (
              <div className="mt-6 p-4 border border-gray-200 rounded-md">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Processed Files ({processedFiles.length})</h3>
                  <button
                    onClick={downloadAllAsZip}
                    disabled={isCreatingZip}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isCreatingZip ? 'Creating ZIP...' : 'Download All as ZIP'}
                  </button>
                </div>
                <ul className="divide-y divide-gray-200">
                  {processedFiles.map((file) => (
                    <li key={file.output_id} className="py-3">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-medium text-gray-900">{file.original_name}</p>
                        <button
                          onClick={() => handleDeleteOutputFile(file.output_id)}
                          disabled={isLoading || isCreatingZip}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Delete
                        </button>
                      </div>
                      <audio 
                        controls 
                        className="w-full" 
                        src={file.output_url.startsWith('/api') ? file.output_url : `/api${file.output_url}`}
                      >
                        Your browser does not support the audio element.
                      </audio>
                      <div className="mt-2">
                        <a
                          href={`/api/download/${file.output_id}.mp3`}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          download
                        >
                          Download MP3
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 