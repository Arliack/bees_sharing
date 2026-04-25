// Gestion d'un essaim via son token (gerer.html)

async function chargerEssaim(token) {
  const zone = document.getElementById('zone-gestion');

  try {
    // Lecture publique autorisée par la politique RLS existante
    const { data: essaim, error } = await supabaseClient
      .from('essaims')
      .select('commune, departement, prenom, description, created_at, disponible, statut')
      .eq('token', token)
      .single();

    if (error || !essaim) {
      zone.innerHTML = rendrePage('❌', 'Lien invalide',
        'Ce lien est incorrect ou a expiré.', false);
      return;
    }

    // Essaim déjà clôturé
    if (!essaim.disponible) {
      const libelle = essaim.statut === 'recupere'
        ? '✅ Récupéré par un apiculteur'
        : '🍃 Parti de lui-même';
      zone.innerHTML = rendrePage('🐝', 'Annonce déjà clôturée',
        `Cet essaim a été marqué comme : <strong>${libelle}</strong>.<br>Merci pour votre signalement !`,
        true);
      return;
    }

    // Affiche la page de gestion
    afficherGestion(zone, essaim, token);

  } catch (err) {
    console.error('Erreur chargement essaim :', err);
    zone.innerHTML = rendrePage('❌', 'Erreur',
      'Impossible de charger les informations. Vérifiez votre connexion.', false);
  }
}

function afficherGestion(zone, essaim, token) {
  const age = Math.floor((Date.now() - new Date(essaim.created_at)) / (1000 * 3600));
  const ageTexte = age < 24
    ? `il y a ${age} heure${age > 1 ? 's' : ''}`
    : `il y a ${Math.floor(age / 24)} jour${Math.floor(age / 24) > 1 ? 's' : ''}`;

  const description = essaim.description
    ? `<p class="gestion-desc">"${escapeHtml(essaim.description)}"</p>`
    : '';

  zone.innerHTML = `
    <div class="gestion-carte">
      <div class="gestion-entete">
        <span class="gestion-emoji">🐝</span>
        <div>
          <h2>${escapeHtml(essaim.commune)} <span class="gestion-dept">(${escapeHtml(essaim.departement)})</span></h2>
          <p class="gestion-meta">Signalé par ${escapeHtml(essaim.prenom)} · ${ageTexte}</p>
        </div>
      </div>
      ${description}
      <p class="gestion-question">Que s'est-il passé avec cet essaim ?</p>
      <div class="gestion-boutons">
        <button class="btn-statut btn-parti" onclick="marquerEssaim('${token}', 'parti', this)">
          🍃 Essaim parti de lui-même
        </button>
        <button class="btn-statut btn-recupere" onclick="marquerEssaim('${token}', 'recupere', this)">
          ✅ Essaim récupéré par un apiculteur
        </button>
      </div>
      <div id="gestion-message" role="status" aria-live="polite"></div>
    </div>`;
}

async function marquerEssaim(token, statut, btnClique) {
  const tousLesBoutons = document.querySelectorAll('.btn-statut');
  tousLesBoutons.forEach(b => { b.disabled = true; });
  btnClique.textContent = '⌛ Traitement…';

  try {
    const { data, error } = await supabaseClient
      .rpc('gerer_essaim', { p_token: token, p_statut: statut });

    if (error) throw error;

    if (data === 'not_found') {
      afficherMessageGestion('Cette annonce est déjà clôturée.', 'info');
      return;
    }

    const libelle = statut === 'recupere'
      ? 'récupéré par un apiculteur'
      : 'parti de lui-même';

    document.querySelector('.gestion-boutons').style.display = 'none';
    afficherMessageGestion(
      `✅ Merci ! L'essaim a été marqué comme <strong>${libelle}</strong>. Il ne sera plus visible sur la carte.`,
      'ok'
    );

  } catch (err) {
    console.error('Erreur marquage essaim :', err);
    afficherMessageGestion('Une erreur s\'est produite. Réessayez dans quelques instants.', 'erreur');
    tousLesBoutons.forEach(b => { b.disabled = false; });
    btnClique.textContent = btnClique.dataset.label;
  }
}

function afficherMessageGestion(html, type) {
  const el = document.getElementById('gestion-message');
  if (!el) return;
  el.innerHTML = html;
  el.className = `gestion-msg gestion-msg--${type}`;
}

function rendrePage(ico, titre, corps, avecRetour) {
  const retour = avecRetour
    ? '<a href="index.html" class="desabo-retour">← Retour à la carte</a>'
    : '';
  return `
    <div class="desabo-carte">
      <div class="desabo-ico">${ico}</div>
      <h2>${titre}</h2>
      <p>${corps}</p>
      ${retour}
    </div>`;
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(t || ''));
  return d.innerHTML;
}

// Point d'entrée
document.addEventListener('DOMContentLoaded', () => {
  const token = new URLSearchParams(window.location.search).get('token');
  if (!token) {
    document.getElementById('zone-gestion').innerHTML =
      rendrePage('❌', 'Lien invalide', 'Aucun token trouvé dans l\'URL.', false);
    return;
  }
  chargerEssaim(token);
});
