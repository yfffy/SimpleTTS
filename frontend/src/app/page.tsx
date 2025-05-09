'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Voice {
  name: string;
  gender: string;
  locale: string;
}

export default function Home() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [rate, setRate] = useState<string>('+0%');
  const [volume, setVolume] = useState<string>('+0%');
  const [pitch, setPitch] = useState<string>('+0Hz');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>('');
  const [groupedVoices, setGroupedVoices] = useState<Record<string, Voice[]>>({});
  const [currentFilename, setCurrentFilename] = useState<string>('text_to_speech.txt');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text || !selectedVoice) return;

    setIsLoading(true);
    setApiError('');
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice: selectedVoice,
          rate,
          volume,
          pitch,
          filename: currentFilename
        }),
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setAudioUrl(data.output_url);
      } else if (data.error) {
        setApiError(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error processing text to speech:', error);
      setApiError('Failed to generate speech. Please check if the backend service is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setIsUploading(true);
    setApiError('');
    
    try {
      // First upload the file
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`API responded with status: ${uploadResponse.status}`);
      }

      const uploadData = await uploadResponse.json();
      if (uploadData.error) {
        throw new Error(uploadData.error);
      }

      // Find the UTF-8 converted file
      const fileId = uploadData.file_id;

      // Read the file content and set it to the text field
      const utf8Files = await fetch(`/api/file-content/${fileId}`);
      
      if (!utf8Files.ok) {
        throw new Error(`API responded with status: ${utf8Files.status}`);
      }
      
      const contentData = await utf8Files.json();
      setText(contentData.content);
      
      // Set the current filename from the uploaded file
      if (contentData.filename) {
        setCurrentFilename(contentData.filename);
      }
      
    } catch (error) {
      console.error('Error uploading file:', error);
      setApiError(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">SimpleTTS</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            {apiError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <h3 className="text-sm font-medium text-red-800">API Error</h3>
                <p className="mt-1 text-sm text-red-700">{apiError}</p>
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
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

              <div className="mb-2">
                <div className="flex justify-between">
                  <label htmlFor="text" className="block text-sm font-medium text-gray-700 mb-1">
                    Text
                  </label>
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer text-sm text-indigo-600 hover:text-indigo-900"
                  >
                    {isUploading ? 'Uploading...' : 'Upload Text File'}
                    <input
                      id="file-upload"
                      type="file"
                      className="sr-only"
                      accept=".txt"
                      disabled={isUploading || isLoading}
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
                <textarea
                  id="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="mt-1 block w-full sm:text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  rows={8}
                  placeholder="Enter text to convert to speech or upload a text file..."
                  required
                ></textarea>
                <p className="mt-1 text-xs text-gray-500">
                  The text will be automatically converted to UTF-8 encoding if needed.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label htmlFor="rate" className="block text-sm font-medium text-gray-700 mb-1">
                    Rate
                  </label>
                  <select
                    id="rate"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
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
                  >
                    <option value="-50Hz">Very Low (-50Hz)</option>
                    <option value="-25Hz">Low (-25Hz)</option>
                    <option value="+0Hz">Normal (+0Hz)</option>
                    <option value="+25Hz">High (+25Hz)</option>
                    <option value="+50Hz">Very High (+50Hz)</option>
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <button
                  type="submit"
                  disabled={isLoading || voices.length === 0 || !text.trim()}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Processing...' : 'Generate Speech'}
                </button>
              </div>
            </form>

            {audioUrl && (
              <div className="mt-6 p-4 border border-gray-200 rounded-md">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Generated Audio</h3>
                <audio 
                  controls 
                  className="w-full" 
                  src={audioUrl.startsWith('/api') ? audioUrl : `/api${audioUrl}`}
                >
                  Your browser does not support the audio element.
                </audio>
                <div className="mt-2">
                  <a
                    href={`/api/download/${audioUrl.split('/').pop()?.replace(/\.mp3$/, '')}.mp3`}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    download
                  >
                    Download Audio
                  </a>
                </div>
              </div>
            )}
            
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Batch Processing</h3>
              <Link
                href="/batch"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Go to Batch Processing
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 