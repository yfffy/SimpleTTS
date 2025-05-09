import { NextRequest, NextResponse } from 'next/server';

interface ProcessedFile {
  file_id?: string;
  original_name?: string;
  output_id?: string;
  output_url?: string;
}

export async function POST(request: NextRequest) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
  
  try {
    const body = await request.json();
    
    const response = await fetch(`${apiUrl}/batch-process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      console.error(`Batch process failed with status: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Failed to process batch: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    // Fix the output_url for each file to use our download API route
    if (data.files && Array.isArray(data.files)) {
      data.files = data.files.map((file: ProcessedFile) => {
        if (file.output_url) {
          // Transform /outputs/ID.mp3 to /api/download/ID
          const parts = file.output_url.split('/');
          const filename = parts.pop() || '';
          const id = filename.replace('.mp3', '');
          file.output_url = `/api/download/${id}`;
        }
        return file;
      });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error processing batch:', error);
    return NextResponse.json(
      { error: 'Failed to process batch request' },
      { status: 500 }
    );
  }
} 