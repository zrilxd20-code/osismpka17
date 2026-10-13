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

      // Pastikan status & status_verifikasi sesuai CHECK constraint Postgres
      const safeStatus =
        status === 'izin_halangan' || status === 'izin'
          ? 'izin'
          : status === 'tidak_hadir'
          ? 'tidak_hadir'
          : 'hadir';

      const safeVerif =
        status_verifikasi === 'terverifikasi' || status_verifikasi === 'valid'
          ? 'valid'
          : status_verifikasi === 'pelanggaran' || status_verifikasi === 'tidak_valid' || status_verifikasi === 'ditolak'
          ? 'tidak_valid'
          : 'menunggu';

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
            status: safeStatus,
            keterangan: keterangan || null,
            saksi: saksi || null,
            status_verifikasi: safeVerif,
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
            status: safeStatus,
            keterangan: keterangan || null,
            saksi: saksi || null,
            status_verifikasi: safeVerif,
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
      const { presensiId, status, catatan, diverifikasi_oleh, profile_id, nis, tanggal, ibadah } = body;

      const safeVerif =
        status === 'terverifikasi' || status === 'valid'
          ? 'valid'
          : status === 'pelanggaran' || status === 'tidak_valid' || status === 'ditolak'
          ? 'tidak_valid'
          : 'menunggu';

      // Pastikan diverifikasi_oleh adalah UUID 36-karakter valid agar tidak error 22P02
      let verifierUuid: string | null = null;
      if (
        diverifikasi_oleh &&
        typeof diverifikasi_oleh === 'string' &&
        diverifikasi_oleh.length === 36 &&
        !diverifikasi_oleh.startsWith('usr-')
      ) {
        verifierUuid = diverifikasi_oleh;
      }

      let updated = false;

      // 1. Coba update via presensiId jika formatnya UUID
      if (presensiId && typeof presensiId === 'string' && presensiId.length === 36 && !presensiId.startsWith('pre-')) {
        const { error: verifyErr, data } = await admin
          .from('checkin')
          .update({
            status_verifikasi: safeVerif,
            catatan_verifikasi: catatan || (safeVerif === 'valid' ? 'Diverifikasi langsung oleh pengurus' : null),
            diverifikasi_oleh: verifierUuid,
          })
          .eq('id', presensiId)
          .select('id');

        if (!verifyErr && data && data.length > 0) {
          updated = true;
        }
      }

      // 2. Fallback: jika presensiId bukan UUID (misal ID lokal 'pre-xx'), cari via profile & tanggal
      if (!updated) {
        let pUuid =
          profile_id && typeof profile_id === 'string' && profile_id.length === 36 && !profile_id.startsWith('usr-')
            ? profile_id
            : null;

        if (!pUuid && nis) {
          const { data: pFound } = await admin.from('profiles').select('id').eq('nis', nis).maybeSingle();
          if (pFound) pUuid = pFound.id;
        }

        if (pUuid && tanggal) {
          const jenisIbadahId =
            ibadah === 'pendalaman_iman'
              ? 'f952c418-479e-4c8e-a9ba-762ee71871f3'
              : '0728ae44-4ba3-458f-8427-462d24bc8724';

          const { error: matchErr } = await admin
            .from('checkin')
            .update({
              status_verifikasi: safeVerif,
              catatan_verifikasi: catatan || (safeVerif === 'valid' ? 'Diverifikasi langsung oleh pengurus' : null),
              diverifikasi_oleh: verifierUuid,
            })
            .eq('profile_id', pUuid)
            .eq('tanggal', tanggal)
            .eq('jenis_ibadah_id', jenisIbadahId);

          if (!matchErr) {
            updated = true;
          } else {
            console.error('[API Sync Fallback Verify Error]:', matchErr);
          }
        }
      }

      return NextResponse.json({ ok: true, updated });
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
