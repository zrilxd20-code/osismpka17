import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createClient } from '@/lib/supabase/server';
import { CheckinSchema, formatZodError } from '@/lib/validations/api-schemas';
import { getServerDateWIB, isServerWithinTimeWindow, getServerTimestampWIB } from '@/lib/server-time';
import { checkRateLimit } from '@/lib/rate-limiter';
import { dataService } from '@/lib/data-service';

export async function POST(req: NextRequest) {
  try {
    // 1. Verifikasi Sesi User
    const authResult = await getAuthenticatedUserAndRole(req);
    if (!authResult.user) {
      return NextResponse.json(
        { ok: false, error: authResult.error || 'Autentikasi gagal.' },
        { status: authResult.statusCode || 401 }
      );
    }
    const currentUser = authResult.user;

    // 2. Rate Limiting Dasar (5 request per menit per user)
    const rateCheck = checkRateLimit(`checkin-${currentUser.id}`, 5, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Terlalu banyak permintaan check-in. Silakan coba lagi dalam ${rateCheck.retryAfterSeconds} detik.`,
        },
        { status: 429 }
      );
    }

    // 3. Validasi Request Body dengan Zod
    const body = await req.json();
    const parseResult = CheckinSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ ok: false, error: formatZodError(parseResult.error) }, { status: 400 });
    }
    const { jenis_ibadah_id, status, keterangan, saksi } = parseResult.data;

    // 4. Ambil Data Jenis Ibadah dari Database / Mock
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    let jenisIbadah: {
      id: string;
      nama: string;
      label: string;
      agama_wajib: string[];
      jam_mulai: string;
      jam_selesai: string;
      jam_maksimal?: string;
      hari_aktif: number[];
    } | null = null;

    if (!isDemo) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('jenis_ibadah')
        .select('*')
        .eq('id', jenis_ibadah_id)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { ok: false, error: 'Jenis ibadah tidak ditemukan dalam sistem.' },
          { status: 404 }
        );
      }
      jenisIbadah = {
        ...data,
        jam_selesai: data.jam_selesai || '18:00:00',
        jam_maksimal: data.jam_maksimal || '21:00:00',
      };
    } else {
      // Mock lookup
      const stts = dataService.getSettings();
      const matched = stts.find((s) => s.id === jenis_ibadah_id || s.ibadah === jenis_ibadah_id || s.nama === jenis_ibadah_id);
      if (matched) {
        jenisIbadah = {
          id: matched.id,
          nama: matched.nama || matched.ibadah || 'sholat_dzuhur',
          label: matched.label,
          agama_wajib: matched.agama_wajib || (matched.ibadah === 'sholat_dzuhur' ? ['islam'] : ['kristen', 'katolik']),
          jam_mulai: matched.jam_mulai || matched.start_time,
          jam_selesai: matched.jam_selesai || matched.end_time || '18:00:00',
          jam_maksimal: matched.jam_maksimal || matched.max_end_time || '21:00:00',
          hari_aktif: matched.hari_aktif || matched.days_active,
        };
      } else {
        jenisIbadah = {
          id: jenis_ibadah_id,
          nama: currentUser.agama === 'islam' ? 'sholat_dzuhur' : 'pendalaman_iman',
          label: currentUser.agama === 'islam' ? 'Sholat Dzuhur' : 'Pendalaman Iman',
          agama_wajib: currentUser.agama === 'islam' ? ['islam'] : ['kristen', 'katolik'],
          jam_mulai: '11:30:00',
          jam_selesai: '18:00:00',
          jam_maksimal: '21:00:00',
          hari_aktif: [1, 2, 3, 4, 5],
        };
      }
    }

    if (!jenisIbadah) {
      return NextResponse.json({ ok: false, error: 'Jenis ibadah tidak valid.' }, { status: 400 });
    }

    // 5. Cek Kesesuaian Agama Anggota dengan Jenis Ibadah
    const userAgama = (currentUser.agama || '').toLowerCase();
    const isAgamaValid = jenisIbadah.agama_wajib.map((a) => a.toLowerCase()).includes(userAgama);
    if (!isAgamaValid) {
      return NextResponse.json(
        {
          ok: false,
          error: `Jenis ibadah "${jenisIbadah.label}" tidak sesuai dengan agama Anda (${currentUser.agama}). Form check-in ditolak.`,
        },
        { status: 403 }
      );
    }

    // 6. Cek Jendela Waktu Server (Asia/Jakarta, Bukan Jam Perangkat)
    // Batas normal: 18:00 WIB, Maksimal ditunggu: 21:00 WIB
    const bypassHeader = req.headers.get('x-bypass-time-window') === 'true';
    let isLateSubmission = false;
    if (!bypassHeader) {
      const windowCheck = isServerWithinTimeWindow(
        jenisIbadah.jam_mulai,
        jenisIbadah.jam_selesai || '18:00:00',
        jenisIbadah.jam_maksimal || '21:00:00',
        jenisIbadah.hari_aktif
      );
      if (!windowCheck.isOpen) {
        return NextResponse.json(
          {
            ok: false,
            error: windowCheck.reason || 'Batas maksimal pengiriman laporan ibadah telah ditutup pada pukul 21:00 WIB.',
          },
          { status: 400 }
        );
      }
      isLateSubmission = windowCheck.isLate;
    }

    // 7. Cek Duplikasi Check-In Hari Ini di Server
    const tanggalWIB = getServerDateWIB();

    if (!isDemo) {
      const supabase = await createClient();
      const { data: existingCheckin } = await supabase
        .from('checkin')
        .select('id')
        .eq('profile_id', currentUser.id)
        .eq('jenis_ibadah_id', jenisIbadah.id)
        .eq('tanggal', tanggalWIB)
        .maybeSingle();

      if (existingCheckin) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Anda sudah melakukan check-in untuk ibadah ini pada hari ini.',
          },
          { status: 409 }
        );
      }

      // 8. Insert ke Database Supabase
      const newRecord = {
        profile_id: currentUser.id,
        jenis_ibadah_id: jenisIbadah.id,
        tanggal: tanggalWIB,
        status,
        keterangan: status === 'izin' ? keterangan : null,
        saksi: saksi?.trim() || null,
        status_verifikasi: 'menunggu',
        catatan_verifikasi: isLateSubmission
          ? 'Tercatat terlambat (dikirim setelah pukul 18:00 WIB, dalam toleransi s.d. 21:00 WIB)'
          : null,
        dibuat_pada: getServerTimestampWIB(),
      };

      const { data: inserted, error: insertError } = await supabase
        .from('checkin')
        .insert(newRecord)
        .select()
        .single();

      if (insertError) {
        return NextResponse.json(
          { ok: false, error: `Gagal menyimpan check-in: ${insertError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          data: inserted,
          message: isLateSubmission
            ? 'Check-in mandiri berhasil (tercatat terlambat setelah jam 18:00 WIB). Menunggu verifikasi pengurus.'
            : 'Check-in mandiri berhasil dikirim. Menunggu verifikasi pengurus.',
        },
        { status: 201 }
      );
    } else {
      // Demo fallback via dataService
      const checkinRes = dataService.checkInMandiri({
        userId: currentUser.id,
        ibadah: jenisIbadah.nama as 'sholat_dzuhur' | 'pendalaman_iman',
        status: status as 'hadir' | 'tidak_hadir' | 'izin_halangan',
        keteranganHalangan: keterangan || undefined,
        saksi: saksi || undefined,
        bypassTimeCheck: bypassHeader,
      });

      if (!checkinRes.success) {
        const isDuplicate = checkinRes.message.toLowerCase().includes('sudah melakukan check-in');
        return NextResponse.json(
          { ok: false, error: checkinRes.message },
          { status: isDuplicate ? 409 : 400 }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          data: checkinRes.data,
          message: checkinRes.message,
        },
        { status: 201 }
      );
    }
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: `Terjadi kesalahan internal server: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
