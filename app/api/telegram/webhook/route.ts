import { NextRequest, NextResponse } from 'next/server';
import { bot } from '@/lib/telegram';

// This handles incoming webhooks from Telegram
export async function POST(req: NextRequest) {
  try {
    if (!bot) {
      return NextResponse.json({ error: 'Bot is not configured' }, { status: 500 });
    }

    const body = await req.json();
    
    // Pass the incoming update to Telegraf to process
    await bot.handleUpdate(body);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error handling Telegram webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// In Next.js App Router, we can also configure Telegraf to react to commands here
// But it's usually better to define them once. They are now defined in lib/bot-setup.ts
