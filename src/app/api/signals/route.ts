import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const signals = await prisma.signal.findMany({
      take: 100,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        match: true,
      },
    });

    return NextResponse.json(signals, { status: 200 });
  } catch (error) {
    console.error('Error fetching signals:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
