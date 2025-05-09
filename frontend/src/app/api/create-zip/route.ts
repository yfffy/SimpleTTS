import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
  
  try {
    const body = await request.json();
    
    const response = await fetch(`${apiUrl}/create-zip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to create ZIP: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const zipData = await response.arrayBuffer();
    
    return new NextResponse(zipData, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="tts_batch_${new Date().toISOString().slice(0, 10)}.zip"`,
      },
    });
  } catch (error) {
    console.error('Error creating ZIP:', error);
    return NextResponse.json(
      { error: 'Failed to create ZIP file' },
      { status: 500 }
    );
  }
} 