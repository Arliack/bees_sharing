// Gestion des abonnements aux alertes email

// ── Widget d'abonnement (index.html) ─────────────────────────────────────────

function basculerPanneauAbonnement() {
  const panneau = document.getElementById('panneau-abonnement');
  const btn     = document.getElementById('btn-alerte');
  if (!panneau) return;

  const ouvert = !panneau.hidden;
  panneau.hidden = ouvert;
  btn.setAttribute('aria-expanded', String(!ouvert));

  // Pré-remplit le département avec la valeur du filtre si disponible
  if (!ouvert) {
    const filtre = document.getElementById('filtre-dept');
    const deptInput = document.getElementById('abonne-dept');
    if (filtre?.value.trim() && deptInput && !deptInput.value) {
      deptInput.value = filtre.value.trim();
    }
    document.getElementById('abonne-email')?.focus();
  }
}

async function soumettreAbonnement(e) {
  e.preventDefault();
  const email = document.getElementById('abonne-email').value.trim();
  const dept  = document.getElementById('abonne-dept').value.trim();
  const msg   = document.getElementById('abonne-message');
  const btn   = document.getElementById('btn-form-abonnement');

  if (!email || !dept) return;

  btn.disabled    = true;
  btn.textContent = '…';
  msg.textContent = '';
  msg.className   = '';

  try {
    const { error } = await supabaseClient
      .from('abonnements')
      .insert([{ email, departement: dept }]);

    if (error) {
      // Code 23505 = violation de contrainte unique → déjà abonné
      if (error.code === '23505') {
        afficherMessageAbonnement(msg, '✅ Vous êtes déjà abonné(e) pour ce département.', 'ok');
      } else {
        throw error;
      }
    } else {
      afficherMessageAbonnement(
        msg,
        `✅ Abonnement confirmé ! Vous recevrez un email dès qu'un essaim sera signalé en ${dept}.`,
        'ok'
      );
      document.getElementById('form-abonnement').reset();
    }
  } catch (err) {
    console.error('Erreur abonnement :', err);
    afficherMessageAbonnement(msg, "Une erreur s'est produite. Veuillez réessayer.", 'erreur');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'M\'alerter';
  }
}

function afficherMessageAbonnement(el, texte, type) {
  el.textContent = texte;
  el.className   = 'abonne-msg abonne-msg--' + type;
}

// ── Page de désabonnement (desabonner.html) ───────────────────────────────────

async function traiterDesabonnement() {
  const zone = document.getElementById('zone-desabo');
  if (!zone) return;

  const params = new URLSearchParams(window.location.search);
  const token  = params.get('token');

  if (!token) {
    zone.innerHTML = messageDesabo('❌', 'Lien invalide', 'Ce lien de désabonnement est incomplet ou incorrect.', false);
    return;
  }

  zone.innerHTML = '<p class="desabo-chargement">Traitement en cours…</p>';

  try {
    const { data, error } = await supabaseClient.rpc('desabonner', { p_token: token });

    if (error) throw error;

    if (data === 'not_found') {
      zone.innerHTML = messageDesabo(
        'ℹ️', 'Déjà désabonné(e)',
        'Ce lien a déjà été utilisé ou l\'abonnement est introuvable.',
        true
      );
    } else {
      zone.innerHTML = messageDesabo(
        '✅', 'Désabonnement effectué',
        'Vous ne recevrez plus d\'alertes email pour ce département.',
        true
      );
    }
  } catch (err) {
    console.error('Erreur désabonnement :', err);
    zone.innerHTML = messageDesabo(
      '❌', 'Une erreur s\'est produite',
      'Impossible de traiter votre demande. Réessayez dans quelques instants.',
      false
    );
  }
}

function messageDesabo(ico, titre, corps, avecLienRetour) {
  const lien = avecLienRetour
    ? '<a href="index.html" class="desabo-retour">← Retour à la carte</a>'
    : '';
  return `
    <div class="desabo-carte">
      <div class="desabo-ico">${ico}</div>
      <h2>${titre}</h2>
      <p>${corps}</p>
      ${lien}
    </div>`;
}

// Initialisation selon la page active
document.addEventListener('DOMContentLoaded', () => {
  // Widget abonnement (index.html)
  const formAbonnement = document.getElementById('form-abonnement');
  if (formAbonnement) {
    formAbonnement.addEventListener('submit', soumettreAbonnement);
  }

  // Page désabonnement (desabonner.html)
  if (document.getElementById('zone-desabo')) {
    traiterDesabonnement();
  }
});
