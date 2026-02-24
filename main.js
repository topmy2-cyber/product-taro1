// Supabase Configuration
const SUPABASE_URL = "https://sexcgfyentbyevaneqko.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1L6Iktl7Lw3DEPE0gzhn-A_2a3a-ztN";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.supabaseClient = supabaseClient;
