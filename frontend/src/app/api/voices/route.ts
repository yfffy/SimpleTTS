import { NextResponse } from 'next/server';

export async function GET() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
  
  try {
    const response = await fetch(`${apiUrl}/voices`);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch voices: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching voices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voices from backend service' },
      { status: 500 }
    );
  }
} 