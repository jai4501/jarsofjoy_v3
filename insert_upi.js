require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  await supabase.from('site_content').upsert([
    { key: 'upi_id', value: '', category: 'payment' }
  ], { onConflict: 'key' });
  console.log('Done');
}
run();
