import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = createAdminClient();

    // 1. Ambil seluruh data profiles resmi
    const { data: profiles, error: pError } = await admin
      .from('profiles')
      .select('*')
      .order('nis', { ascending: true });

    if (pError) {
      console.error('[API Sync] Gagal mengambil profiles:', pError);
    }

    // 2. Ambil data checkin
    const { data: checkins, error: cError } = await admin
      .from('checkin')
      .select('*')
      .order('dibuat_pada', { ascending: false });

    if (cError) {
      console.error('[API Sync] Gagal mengambil checkin:', cError);
    }

    return NextResponse.json({
      ok: true,
      profiles: profiles || [],
      checkins: checkins || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API Sync Error]:', message);
    return NextResponse.json(
      { ok: false, error: 'Gagal melakukan sinkronisasi data cloud.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const admin = createAdminClient();

    if (action === 'checkin') {
      let { profile_id } = body.data;
      const { nis, jenis_ibadah_id, tanggal, status, keterangan, saksi, status_verifikasi, catatan_verifikasi, dibuat_pada } = body.data;

      // Jika profile_id lokal (usr-xx) atau tidak ditemukan, cari UUID resmi via NIS
      if ((!profile_id || profile_id.startsWith('usr-') || profile_id.length !== 36) && nis) {
        const { data: pFound } = await admin.from('profiles').select('id').eq('nis', nis).maybeSingle();
        if (pFound) {
          profile_id = pFound.id;
        }
      }

      if (!profile_id) {
        return NextResponse.json({ ok: false, error: 'Profil tidak valid untuk checkin.' }, { status: 400 });
      }

      // Cek apakah sudah ada checkin untuk user, ibadah, dan tanggal yang sama
      const { data: existing } = await admin
        .from('checkin')
        .select('id')
        .eq('profile_id', profile_id)
        .eq('jenis_ibadah_id', jenis_ibadah_id)
        .eq('tanggal', tanggal)
        .maybeSingle();

      let checkinId: string;

      if (existing) {
        checkinId = existing.id;
        const { error: updateErr } = await admin
          .from('checkin')
          .update({
            status,
            keterangan: keterangan || null,
            saksi: saksi || null,
            status_verifikasi: status_verifikasi || 'menunggu',
            catatan_verifikasi: catatan_verifikasi || null,
          })
          .eq('id', existing.id);

        if (updateErr) {
          return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
        }
      } else {
        const { data: inserted, error: insertErr } = await admin
          .from('checkin')
          .insert({
            profile_id,
            jenis_ibadah_id,
            tanggal,
            status,
            keterangan: keterangan || null,
            saksi: saksi || null,
            status_verifikasi: status_verifikasi || 'menunggu',
            catatan_verifikasi: catatan_verifikasi || null,
            dibuat_pada: dibuat_pada || new Date().toISOString(),
          })
          .select('id')
          .single();

        if (insertErr) {
          return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
        }
        checkinId = inserted?.id;
      }

      return NextResponse.json({ ok: true, id: checkinId });
    }

    if (action === 'verify') {
      const { presensiId, status, catatan, diverifikasi_oleh } = body;
      const { error: verifyErr } = await admin
        .from('checkin')
        .update({
          status_verifikasi: status === 'terverifikasi' ? 'valid' : status === 'pelanggaran' ? 'tidak_valid' : 'menunggu',
          catatan_verifikasi: catatan || null,
          diverifikasi_oleh: diverifikasi_oleh || null,
        })
        .eq('id', presensiId);

      if (verifyErr) {
        return NextResponse.json({ ok: false, error: verifyErr.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === 'add_profile') {
      const { nis, nama, kelas, jabatan, agama, role } = body.profile;
      const { data: newP, error: pErr } = await admin
        .from('profiles')
        .insert({
          nis,
          nama,
          kelas,
          jabatan,
          agama,
          role,
          aktif: true,
          must_change_password: false,
        })
        .select()
        .single();

      if (pErr) {
        return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, profile: newP });
    }

    return NextResponse.json({ ok: false, error: 'Aksi tidak dikenali.' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
