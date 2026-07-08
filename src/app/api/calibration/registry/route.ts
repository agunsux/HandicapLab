import { NextResponse } from 'next/server';
import { CalibrationRegistry, CalibrationRegistryEntrySchema } from '@/lib/calibration/CalibrationRegistry';

export async function GET() {
  const entries = await CalibrationRegistry.getAll();
  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CalibrationRegistryEntrySchema.parse(body);
    const entry = await CalibrationRegistry.register(parsed);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
