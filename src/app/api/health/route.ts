import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerTimestampWIB } from '@/lib/server-time';

export async function GET() {
  try {
    const supabase = await createClient();
    const startTime = Date.now();
    
    // Ping ringan ke database Supabase untuk menjaga project tetap aktif (cegah 7-day pause)
    const { error } = await supabase
      .from('jenis_ibadah')
      .select('*', { count: 'exact', head: true });

    const responseTimeMs = Date.now() - startTime;

    if (error) {
      return NextResponse.json({
        ok: false,
        status: 'degraded',
        database: 'error',
        message: error.message,
        wibTime: getServerTimestampWIB(),
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      app: 'Presensi Ibadah A17',
      status: 'healthy',
      database: 'connected',
      latencyMs: responseTimeMs,
      wibTime: getServerTimestampWIB(),
      message: 'Sistem presensi A17 & database Supabase aktif normal.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({
      ok: false,
      status: 'error',
      message,
      wibTime: getServerTimestampWIB(),
    }, { status: 500 });
  }
}
