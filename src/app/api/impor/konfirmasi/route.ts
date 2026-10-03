import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createAdminClient, createClient } from '@/lib/supabase/server';
import { ValidRowItem, ErrorRowItem, generateCredentialsExcelBuffer } from '@/lib/impor-parser';
import { getServerTimestampWIB } from '@/lib/server-time';
import { dataService } from '@/lib/data-service';
import crypto from 'crypto';

interface KonfirmasiRequestBody {
  nama_file?: string;
  baris_valid: ValidRowItem[];
  baris_error?: ErrorRowItem[];
  nonaktifkan_anggota_lain?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Cek Sesi Pengurus
    const authResult = await getAuthenticatedUserAndRole(req);
    if (!authResult.user) {
      return NextResponse.json(
        { ok: false, error: authResult.error || 'Autentikasi gagal.' },
        { status: authResult.statusCode || 401 }
      );
    }
    const currentUser = authResult.user;

    if (currentUser.role !== 'pengurus') {
      return NextResponse.json(
        { ok: false, error: 'Akses ditolak. Hanya pengurus yang dapat mengonfirmasi impor data.' },
        { status: 403 }
      );
    }

    const body: KonfirmasiRequestBody = await req.json();
    const {
      nama_file = 'impor_siswa.xlsx',
      baris_valid = [],
      baris_error = [],
      nonaktifkan_anggota_lain = false,
    } = body;

    if (baris_valid.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Tidak ada baris data valid yang dapat disimpan.' },
        { status: 400 }
      );
    }

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    const credentialsList: Array<{
      nis: string;
      nama: string;
      email: string;
      temporaryPassword: string;
    }> = [];

    const importedNisSet = new Set(baris_valid.map((r) => r.nis));
    let berhasilCount = 0;
    let gagalCount = baris_error.length;
    const finalErrorReports = [...baris_error];

    if (!isDemo) {
      const adminClient = createAdminClient();
      const supabase = await createClient();

      for (const row of baris_valid) {
        try {
          const userEmail = row.email || `${row.nis}@sekolah.local`;
          const tempPassword = `Siswa#${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

          // Cek apakah NIS sudah ada di profiles
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, nis')
            .eq('nis', row.nis)
            .maybeSingle();

          let authUserId = existingProfile?.id;

          if (!authUserId) {
            // Buat user baru di Supabase Auth via Admin Service Role
            const { data: authCreated, error: authErr } = await adminClient.auth.admin.createUser({
              email: userEmail,
              password: tempPassword,
              email_confirm: true,
              user_metadata: {
                nis: row.nis,
                nama: row.nama,
              },
            });

            if (authErr) {
              // Jika email sudah dipakai, cari user id-nya
              const { data: userList } = await adminClient.auth.admin.listUsers();
              const matchedUser = userList?.users?.find((u) => u.email === userEmail);
              if (matchedUser) {
                authUserId = matchedUser.id;
              } else {
                gagalCount += 1;
                finalErrorReports.push({
                  rowNumber: row.rowNumber,
                  nis: row.nis,
                  nama: row.nama,
                  alasan: `Gagal membuat akun auth: ${authErr.message}`,
                });
                continue;
              }
            } else {
              authUserId = authCreated.user.id;
              credentialsList.push({
                nis: row.nis,
                nama: row.nama,
                email: userEmail,
                temporaryPassword: tempPassword,
              });
            }
          }

          // Upsert ke tabel profiles
          const { error: profileUpsertErr } = await supabase.from('profiles').upsert(
            {
              id: authUserId,
              nis: row.nis,
              nama: row.nama,
              kelas: row.kelas,
              jabatan: row.jabatan,
              agama: row.agamaNormalized,
              role: 'anggota',
              aktif: true,
              must_change_password: true,
              updated_at: getServerTimestampWIB(),
            },
            { onConflict: 'nis' }
          );

          if (profileUpsertErr) {
            gagalCount += 1;
            finalErrorReports.push({
              rowNumber: row.rowNumber,
              nis: row.nis,
              nama: row.nama,
              alasan: `Gagal menyimpan profil: ${profileUpsertErr.message}`,
            });
          } else {
            berhasilCount += 1;
          }
        } catch (rowErr) {
          gagalCount += 1;
          finalErrorReports.push({
            rowNumber: row.rowNumber,
            nis: row.nis,
            nama: row.nama,
            alasan: `Kesalahan: ${rowErr instanceof Error ? rowErr.message : 'Unknown'}`,
          });
        }
      }

      // Opsi: Nonaktifkan anggota yang tidak ada di file
      if (nonaktifkan_anggota_lain) {
        const { data: allActive } = await supabase
          .from('profiles')
          .select('id, nis')
          .eq('aktif', true)
          .neq('role', 'pembina');

        const toDeactivate = (allActive || []).filter((p) => !importedNisSet.has(p.nis));
        if (toDeactivate.length > 0) {
          const idsToDeactivate = toDeactivate.map((p) => p.id);
          await supabase
            .from('profiles')
            .update({ aktif: false, updated_at: getServerTimestampWIB() })
            .in('id', idsToDeactivate);
        }
      }

      // Simpan riwayat ke import_batch
      const { data: batchInserted } = await supabase
        .from('import_batch')
        .insert({
          nama_file,
          diunggah_oleh: currentUser.id,
          total_baris: baris_valid.length + baris_error.length,
          berhasil: berhasilCount,
          gagal: gagalCount,
          laporan_error: finalErrorReports,
          dibuat_pada: getServerTimestampWIB(),
        })
        .select()
        .single();

      // Hasilkan file Excel kredensial awal jika ada akun baru
      let kredensialBase64: string | undefined = undefined;
      if (credentialsList.length > 0) {
        const credBuffer = await generateCredentialsExcelBuffer(credentialsList);
        kredensialBase64 = credBuffer.toString('base64');
      }

      return NextResponse.json({
        ok: true,
        data: {
          batch_id: batchInserted?.id || 'batch-' + Date.now(),
          berhasil: berhasilCount,
          gagal: gagalCount,
          total_kredensial_baru: credentialsList.length,
          kredensial_excel_base64: kredensialBase64,
          message: `Impor berhasil: ${berhasilCount} data tersimpan, ${gagalCount} data gagal.`,
        },
      });
    } else {
      // Mock demo handling
      for (const row of baris_valid) {
        const existing = dataService.getProfileByNis(row.nis);
        const tempPassword = `Siswa#${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const userEmail = row.email || `${row.nis}@sekolah.local`;

        if (!existing) {
          dataService.addProfile({
            nis: row.nis,
            full_name: row.nama,
            role: 'anggota',
            agama: row.agamaNormalized,
            organisasi: row.jabatan.toUpperCase().includes('MPK') ? 'MPK' : 'OSIS',
            jabatan: row.jabatan,
            kelas: row.kelas,
            is_active: true,
          });

          credentialsList.push({
            nis: row.nis,
            nama: row.nama,
            email: userEmail,
            temporaryPassword: tempPassword,
          });
        }
        berhasilCount += 1;
      }

      let kredensialBase64: string | undefined = undefined;
      if (credentialsList.length > 0) {
        const credBuffer = await generateCredentialsExcelBuffer(credentialsList);
        kredensialBase64 = credBuffer.toString('base64');
      }

      return NextResponse.json({
        ok: true,
        data: {
          batch_id: 'batch-' + Date.now(),
          berhasil: berhasilCount,
          gagal: gagalCount,
          total_kredensial_baru: credentialsList.length,
          kredensial_excel_base64: kredensialBase64,
          message: `Impor data demo berhasil: ${berhasilCount} baris tersimpan.`,
        },
      });
    }
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: `Terjadi kesalahan saat mengonfirmasi impor: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
