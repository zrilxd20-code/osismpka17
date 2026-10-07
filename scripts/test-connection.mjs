import { createClient } from '@supabase/supabase-js';

const url = 'https://walilvzlcomrhbeyfbfy.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhbGlsdnpsY29tcmhiZXlmYmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMzA5MDYsImV4cCI6MjEwNjkwNjkwNn0.PLobmYVn3tdU1_kQdnyHX9zrzUmybHL0xYvbA33EeIg';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhbGlsdnpsY29tcmhiZXlmYmZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTMzMDkwNiwiZXhwIjoyMTA2OTA2OTA2fQ.WkbMnyG1Bu_4nZeh3xHCaoQBBguBLtXY5JmWOVfvnvY';

async function test() {
  console.log('Testing Supabase connection...');
  const supabase = createClient(url, anonKey);
  const adminClient = createClient(url, serviceRoleKey);

  // 1. Check jenis_ibadah
  const { data: ibadah, error: ibadahErr } = await supabase.from('jenis_ibadah').select('*');
  if (ibadahErr) {
    console.error('Error fetching jenis_ibadah:', ibadahErr.message);
  } else {
    console.log(`Success! Found ${ibadah.length} jenis_ibadah entries:`, ibadah.map(i => i.label));
  }

  // 2. Check profiles
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('*');
  if (profErr) {
    console.error('Error fetching profiles:', profErr.message);
  } else {
    console.log(`Success! Found ${profiles.length} profiles:`, profiles.map(p => `${p.nama} (${p.role})`));
  }
}

test();
