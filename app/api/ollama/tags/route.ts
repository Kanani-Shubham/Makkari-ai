import { NextResponse } from 'next/server';
import { OllamaAdapter } from '@/lib/ai/providers/ollama';

export async function GET() {
  const status = await OllamaAdapter.getTags();
  return NextResponse.json(status);
}
