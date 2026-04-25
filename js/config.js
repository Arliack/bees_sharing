// Configuration Supabase — remplacer les valeurs avant déploiement
const SUPABASE_URL = 'https://guevxdvgciqhuhyhhpvy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZXZ4ZHZnY2lxaHVoeWhocHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwODk3OTIsImV4cCI6MjA5MjY2NTc5Mn0.d49azaDW5ZWLjE3zrCaOk8I0yA-UyEuYjTopn7yI73I';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
