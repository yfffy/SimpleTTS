import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
  
  try {
    console.log(`Attempting to fetch file content for ID: ${id}`);
    
    // Use the file-content endpoint on the backend
    const response = await fetch(`${apiUrl}/file-content/${id}`);
    
    if (!response.ok) {
      console.error(`Failed to fetch file content with status: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Failed to fetch file content: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching file content:', error);
    return NextResponse.json(
      { error: 'Failed to get file content from backend service' },
      { status: 500 }
    );
  }
} 