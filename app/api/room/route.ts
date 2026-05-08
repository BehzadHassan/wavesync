import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

function getRedisClient() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return Redis.fromEnv();
  }
  return null;
}

export async function POST(req: Request) {
  const redis = getRedisClient();
  if (!redis) {
    return NextResponse.json({ error: 'Redis is not configured' }, { status: 500 });
  }

  // Create a room code (4 characters)
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  const roomState = {
    createdAt: Date.now(),
  };

  // Set with TTL of 4 hours (14400 seconds)
  await redis.set(`room:${code}`, roomState, { ex: 14400 });

  return NextResponse.json({ code });
}

export async function GET(req: Request) {
  const redis = getRedisClient();
  if (!redis) {
    return NextResponse.json({ error: 'Redis is not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 });
  }

  const roomState = await redis.get(`room:${code}`);

  if (!roomState) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  return NextResponse.json(roomState);
}
