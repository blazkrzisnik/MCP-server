export default function handler(req, res) {
  res.status(200).json({
    SUPABASE_URL: process.env.SUPABASE_URL ?? null,
    SUPABASE_KEY: process.env.SUPABASE_KEY ?? null,
    ALL_ENV: process.env  // previdno — lahko je veliko
  });
}
