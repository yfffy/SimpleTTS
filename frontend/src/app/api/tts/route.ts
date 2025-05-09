import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
  
  try {
    const body = await request.json();
    
    const response = await fetch(`${apiUrl}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      console.error(`TTS request failed with status: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Failed to process TTS: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    // Fix the output_url to use our download API route
    if (data.output_url) {
      // Transform /outputs/ID.mp3 to /api/download/ID
      const parts = data.output_url.split('/');
      const filename = parts.pop() || '';
      const id = filename.replace('.mp3', '');
      data.output_url = `/api/download/${id}`;
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error processing TTS request:', error);
    return NextResponse.json(
      { error: 'Failed to process TTS request' },
      { status: 500 }
    );
  }
} 