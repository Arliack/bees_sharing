// Edge Function Supabase — Notifier les abonnés lors d'un nouvel essaim
// Déclenchée par un Database Webhook sur INSERT dans la table `essaims`
//
// Variables d'environnement requises (supabase secrets set …) :
//   RESEND_API_KEY          → clé API Resend
//   RESEND_FROM             → expéditeur vérifié, ex: "Essaims <noreply@mondomaine.fr>"
//                             (ou "onboarding@resend.dev" pour les tests)
//   SITE_URL                → URL publique du site, ex: "https://arliack.github.io/bees_sharing"
//   WEBHOOK_SECRET          → secret à vérifier dans le header Authorization du webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY')!;
const RESEND_FROM     = Deno.env.get('RESEND_FROM') ?? 'onboarding@resend.dev';
const SITE_URL        = Deno.env.get('SITE_URL')    ?? 'https://arliack.github.io/bees_sharing';
const WEBHOOK_SECRET  = Deno.env.get('WEBHOOK_SECRET');
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  // ── Vérification du secret webhook ──────────────────────────────────────
  if (WEBHOOK_SECRET) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${WEBHOOK_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  // ── Lecture du payload ──────────────────────────────────────────────────
  const payload = await req.json();

  // On ne traite que les insertions d'essaims disponibles
  if (payload.type !== 'INSERT' || !payload.record?.disponible) {
    return new Response('OK', { status: 200 });
  }

  const essaim = payload.record;

  // ── Recherche des abonnés pour ce département ───────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: abonnes, error } = await supabase
    .from('abonnements')
    .select('email, departement, token')
    .eq('actif', true)
    .ilike('departement', essaim.departement);

  if (error) {
    console.error('Erreur lecture abonnements :', error);
    return new Response('Error', { status: 500 });
  }

  if (!abonnes?.length) {
    return new Response('OK — aucun abonné pour ce département', { status: 200 });
  }

  // ── Envoi des emails via Resend ─────────────────────────────────────────
  const resultats = await Promise.allSettled(
    abonnes.map(abonne => envoyerEmail(essaim, abonne))
  );

  const nbOk     = resultats.filter(r => r.status === 'fulfilled').length;
  const nbEchecs = resultats.filter(r => r.status === 'rejected').length;

  console.log(`Emails envoyés : ${nbOk} OK, ${nbEchecs} échec(s)`);
  return new Response(`Emails : ${nbOk} envoyé(s)`, { status: 200 });
});

// ── Construction et envoi d'un email ──────────────────────────────────────

async function envoyerEmail(
  essaim: Record<string, unknown>,
  abonne: { email: string; departement: string; token: string }
) {
  const lienCarte   = `${SITE_URL}/index.html`;
  const lienDesabo  = `${SITE_URL}/desabonner.html?token=${abonne.token}`;
  const dateDispo   = essaim.date_dispo
    ? new Date(essaim.date_dispo as string).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : 'Non précisée';

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from:    RESEND_FROM,
      to:      abonne.email,
      subject: `🐝 Nouvel essaim disponible en ${essaim.departement}`,
      html:    construireEmail(essaim, dateDispo, lienCarte, lienDesabo),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

// ── Template email HTML ────────────────────────────────────────────────────

function construireEmail(
  essaim:    Record<string, unknown>,
  dateDispo: string,
  lienCarte: string,
  lienDesabo: string
): string {
  const descriptionHtml = essaim.description
    ? `<p style="margin:0 0 8px;color:#2c2010;line-height:1.5;">${String(essaim.description)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:20px;background:#faf7f0;font-family:'Segoe UI',system-ui,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.10);">

    <!-- En-tête -->
    <div style="background:#7a4e2d;padding:28px 24px;text-align:center;">
      <p style="margin:0 0 4px;font-size:2rem;line-height:1;">🐝</p>
      <h1 style="margin:0;color:#ffffff;font-size:1.3rem;font-weight:700;">
        Nouvel essaim disponible !
      </h1>
    </div>

    <!-- Corps -->
    <div style="padding:28px 24px;">
      <p style="margin:0 0 18px;color:#2c2010;font-size:1rem;line-height:1.6;">
        Un essaim vient d'être signalé dans le département que vous suivez :
        <strong>${String(essaim.departement)}</strong>.
      </p>

      <!-- Carte d'annonce -->
      <div style="background:#fdf3d0;border:2px solid #e8a020;border-radius:10px;padding:18px 20px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:1.05rem;font-weight:700;color:#7a4e2d;">
          📍 ${String(essaim.commune)} — ${String(essaim.departement)}
        </p>
        ${descriptionHtml}
        <p style="margin:0;color:#888;font-size:.875rem;">📅 Disponible le : ${dateDispo}</p>
      </div>

      <p style="margin:0 0 20px;color:#666;font-size:.9rem;line-height:1.5;">
        Annonce déposée par <strong>${String(essaim.prenom)}</strong>.
        Cliquez sur le bouton ci-dessous pour voir la localisation exacte et contacter la personne.
      </p>

      <!-- Bouton CTA -->
      <div style="text-align:center;margin:24px 0;">
        <a href="${lienCarte}"
           style="display:inline-block;background:#e8a020;color:#7a4e2d;text-decoration:none;
                  font-weight:700;font-size:1rem;border-radius:2rem;padding:14px 32px;
                  box-shadow:0 2px 8px rgba(232,160,32,0.35);">
          🗺️ Voir sur la carte
        </a>
      </div>
    </div>

    <!-- Pied de page -->
    <div style="background:#f5f2eb;border-top:1px solid #e0d0a0;padding:16px 24px;text-align:center;">
      <p style="margin:0;color:#999;font-size:.78rem;line-height:1.6;">
        Vous recevez cet email car vous avez demandé à être alerté(e)
        pour le département <strong>${String(essaim.departement)}</strong>.<br/>
        <a href="${lienDesabo}" style="color:#b07840;text-decoration:underline;">
          Me désabonner
        </a>
      </p>
    </div>

  </div>
</body>
</html>`;
}
