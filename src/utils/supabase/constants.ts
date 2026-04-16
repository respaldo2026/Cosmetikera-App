// Estas llaves ahora se leen del entorno (.env.local o .env.production)
// Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY configurados

const normalizeSupabaseUrl = (url: string) => {
	const trimmed = url.trim();
	if (!trimmed) return "";
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
};

export const SUPABASE_URL = normalizeSupabaseUrl(
	process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
);
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

if (!SUPABASE_URL) {
	console.error("Supabase URL env var missing at runtime");
}

if (!SUPABASE_KEY) {
	console.error("Supabase anon key env var missing at runtime");
}
