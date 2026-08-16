import { createClient } from"@supabase/supabase-js";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
console.log("supabaseUrl raw:", supabaseUrl);
console.log("supabaseUrl trimmed:", supabaseUrl?.trim());
console.log("supabaseAnonKey present:", !!supabaseAnonKey);
export const supabase = createClient( 
 supabaseUrl?.trim() ?? "",
  supabaseAnonKey?.trim() ?? ""
);