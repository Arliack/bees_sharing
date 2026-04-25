// Gestion du formulaire de dépôt d'un essaim (deposer.html)

let latChoisie = null;
let lngChoisie = null;
let carteFormulaire = null;
let marqueurPosition = null;

// ── Initialisation de la mini-carte ──────────────────────────────────────────

function initialiserCarteFormulaire() {
  carteFormulaire = L.map('carte-form').setView([46.5, 2.5], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(carteFormulaire);

  // Clic sur la carte pour placer le marqueur
  carteFormulaire.on('click', (e) => {
    latChoisie = parseFloat(e.latlng.lat.toFixed(6));
    lngChoisie = parseFloat(e.latlng.lng.toFixed(6));

    // Déplace ou crée le marqueur
    if (marqueurPosition) {
      marqueurPosition.setLatLng(e.latlng);
    } else {
      marqueurPosition = L.marker(e.latlng, { draggable: true }).addTo(carteFormulaire);

      // Permet de repositionner par glisser-déposer
      marqueurPosition.on('dragend', (ev) => {
        latChoisie = parseFloat(ev.target.getLatLng().lat.toFixed(6));
        lngChoisie = parseFloat(ev.target.getLatLng().lng.toFixed(6));
        mettreAJourAffichageCoords();
      });
    }

    mettreAJourAffichageCoords();
    // Retire la marque d'erreur si elle était présente
    document.getElementById('champ-carte').classList.remove('invalide');
  });
}

function mettreAJourAffichageCoords() {
  const el = document.getElementById('coords-affichage');
  if (el && latChoisie !== null) {
    el.textContent = `Position sélectionnée : ${latChoisie}, ${lngChoisie}`;
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

function validerChamp(id, condition) {
  const champ = document.getElementById(id);
  const conteneur = champ ? champ.closest('.champ') || document.getElementById('champ-' + id) : null;
  const valide = condition(champ ? champ.value.trim() : '');

  if (conteneur) {
    conteneur.classList.toggle('invalide', !valide);
    const input = conteneur.querySelector('input, textarea, select');
    if (input) input.classList.toggle('erreur', !valide);
  }

  return valide;
}

function validerEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validerFormulaire() {
  const checks = [
    validerChamp('prenom',      v => v.length >= 2),
    validerChamp('email',       v => validerEmail(v)),
    validerChamp('commune',     v => v.length >= 2),
    validerChamp('departement', v => v.length >= 1),
  ];

  // Validation de la carte (pas de querySelector classique ici)
  const champCarte = document.getElementById('champ-carte');
  const carteValide = latChoisie !== null;
  if (champCarte) champCarte.classList.toggle('invalide', !carteValide);

  return checks.every(Boolean) && carteValide;
}

// ── Soumission ───────────────────────────────────────────────────────────────

async function soumettreFormulaire(e) {
  e.preventDefault();

  const erreurGlobal = document.getElementById('erreur-global');
  erreurGlobal.style.display = 'none';

  if (!validerFormulaire()) {
    erreurGlobal.textContent = 'Veuillez corriger les champs indiqués avant de continuer.';
    erreurGlobal.style.display = 'block';
    // Défile jusqu'au premier champ invalide
    const premier = document.querySelector('.invalide');
    if (premier) premier.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const btn = document.getElementById('btn-soumettre');
  btn.disabled = true;
  btn.textContent = 'Envoi en cours…';

  const dateDispo = document.getElementById('date-dispo').value || null;
  const telephone = document.getElementById('telephone').value.trim() || null;
  const description = document.getElementById('description').value.trim() || null;

  const donnees = {
    prenom:      document.getElementById('prenom').value.trim(),
    email:       document.getElementById('email').value.trim(),
    telephone,
    commune:     document.getElementById('commune').value.trim(),
    departement: document.getElementById('departement').value.trim(),
    description,
    date_dispo:  dateDispo,
    latitude:    latChoisie,
    longitude:   lngChoisie,
    disponible:  true,
  };

  try {
    const { error } = await supabaseClient.from('essaims').insert([donnees]);

    if (error) throw error;

    // Affiche la confirmation et masque le formulaire
    document.getElementById('formulaire').style.display = 'none';
    document.getElementById('confirmation').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error('Erreur Supabase :', err);
    erreurGlobal.textContent = `Erreur lors de l'envoi : ${err.message || 'Problème réseau, veuillez réessayer.'}`;
    erreurGlobal.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Signaler cet essaim';
  }
}

// ── Initialisation au chargement de la page ──────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initialiserCarteFormulaire();

  const form = document.getElementById('formulaire');
  if (form) form.addEventListener('submit', soumettreFormulaire);

  // Retire les erreurs de validation en temps réel
  document.querySelectorAll('input, textarea, select').forEach(input => {
    input.addEventListener('input', () => {
      const conteneur = input.closest('.champ');
      if (conteneur) {
        conteneur.classList.remove('invalide');
        input.classList.remove('erreur');
      }
    });
  });
});
