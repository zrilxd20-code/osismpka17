// =====================================================================
// SUPABASE SERVER & ADMIN CLIENT (SERVICE ROLE) HELPER
// =====================================================================

import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { Profile } from '@/types/database';
import { dataService } from '@/lib/data-service';

/**
 * Client Supabase dengan cookie sesi (untuk route handlers biasa)
 */
export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sample.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sample-anon-key';

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Dipanggil dari Server Component
        }
      },
    },
  });
}

/**
 * Client Supabase dengan Service Role Key (HANYA DI SERVER, tidak pernah diekspos ke client)
 * Digunakan untuk: pembuatan akun Auth, reset password, dan batch import data siswa
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sample.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sample-key';

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Helper otentikasi di route handlers:
 * Memverifikasi user aktif, role, dan profile dari Supabase Auth atau Mock Demo fallback
 */
export async function getAuthenticatedUserAndRole(req?: NextRequest): Promise<{
  user: Profile | null;
  error?: string;
  statusCode?: number;
}> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  // 1. Cek header demo atau query jika ada
  if (req) {
    const demoUserId = req.headers.get('x-user-id');
    if (demoUserId) {
      const profile = dataService.getProfileById(demoUserId);
      if (profile && profile.aktif) {
        return { user: profile };
      }
    }
  }

  // 2. Cek Supabase Auth Session
  try {
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (!authError && authUser) {
      // Ambil profile dari database
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (!profileError && profile) {
        if (!profile.aktif) {
          return {
            user: null,
            error: 'Akun Anda dinonaktifkan. Hubungi pengurus divisi keagamaan.',
            statusCode: 403,
          };
        }
        return { user: profile as Profile };
      }
    }
  } catch (err) {
    console.error('Error verifying Supabase user session:', err);
  }

  // 3. Fallback demo mode untuk lingkungan pengujian lokal / pratinjau
  if (isDemo) {
    const demoUser = dataService.getCurrentUser();
    if (demoUser && demoUser.aktif) {
      return { user: demoUser };
    }
  }

  return {
    user: null,
    error: 'Sesi login tidak valid atau sudah kedaluwarsa. Silakan login kembali.',
    statusCode: 401,
  };
}
