import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  // Clean the ID to ensure consistent behavior
  const fileId = id.replace(/\.mp3$/, '');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
  
  try {
    // Log the download request for debugging
    console.log(`Attempting to download file: ${fileId}`);
    
    const response = await fetch(`${apiUrl}/download/${fileId}`);
    
    if (!response.ok) {
      console.error(`Download failed with status: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Failed to download file: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const audioData = await response.arrayBuffer();
    
    return new NextResponse(audioData, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="${fileId}.mp3"`,
      },
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json(
      { error: 'Failed to download file from backend service' },
      { status: 500 }
    );
  }
} 