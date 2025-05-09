import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
  
  try {
    const formData = await request.formData();
    
    const response = await fetch(`${apiUrl}/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to upload file: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file to backend service' },
      { status: 500 }
    );
  }
} 