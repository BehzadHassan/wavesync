import { NextResponse } from 'next/server';
import * as Ably from 'ably';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!process.env.ABLY_API_KEY) {
    return NextResponse.json({ error: "Missing ABLY_API_KEY" }, { status: 500 });
  }

  const client = new Ably.Rest(process.env.ABLY_API_KEY);
  const tokenRequestData = await client.auth.createTokenRequest({
    clientId: Math.random().toString(36).substring(7)
  });
  
  return NextResponse.json(tokenRequestData);
}
