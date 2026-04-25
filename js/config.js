// Configuration Supabase — remplacer les valeurs avant déploiement
const SUPABASE_URL = 'REMPLACER_PAR_TON_URL_SUPABASE';
const SUPABASE_ANON_KEY = 'REMPLACER_PAR_TA_CLE_ANON';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
