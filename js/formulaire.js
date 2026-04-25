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
    placerMarqueurSurCarte(e.latlng.lat, e.latlng.lng);
  });
}

// Place (ou déplace) le marqueur sur la mini-carte
function placerMarqueurSurCarte(lat, lng, zoom) {
  const latlng = L.latLng(lat, lng);
  latChoisie = parseFloat(lat.toFixed(6));
  lngChoisie = parseFloat(lng.toFixed(6));

  if (marqueurPosition) {
    marqueurPosition.setLatLng(latlng);
  } else {
    marqueurPosition = L.marker(latlng, { draggable: true }).addTo(carteFormulaire);
    marqueurPosition.on('dragend', (ev) => {
      latChoisie = parseFloat(ev.target.getLatLng().lat.toFixed(6));
      lngChoisie = parseFloat(ev.target.getLatLng().lng.toFixed(6));
      mettreAJourAffichageCoords();
    });
  }

  carteFormulaire.setView(latlng, zoom || Math.max(carteFormulaire.getZoom(), 14));
  mettreAJourAffichageCoords();
  document.getElementById('champ-carte').classList.remove('invalide');
}

function mettreAJourAffichageCoords() {
  const el = document.getElementById('coords-affichage');
  if (el && latChoisie !== null) {
    el.textContent = `Position sélectionnée : ${latChoisie}, ${lngChoisie} — vous pouvez déplacer le marqueur pour affiner.`;
  }
}

// ── Géolocalisation GPS ───────────────────────────────────────────────────────

function utiliserMaPosition() {
  if (!navigator.geolocation) {
    alert("La géolocalisation n'est pas disponible sur ce navigateur.");
    return;
  }

  const btn = document.getElementById('btn-geoloc');
  btn.textContent = '⌛ Localisation…';
  btn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      placerMarqueurSurCarte(pos.coords.latitude, pos.coords.longitude, 16);
      btn.textContent = '📍 Ma position';
      btn.disabled = false;
    },
    (err) => {
      btn.textContent = '📍 Ma position';
      btn.disabled = false;
      const msgs = {
        1: "Vous avez refusé l'accès à la localisation.",
        2: "Position indisponible pour le moment.",
        3: "La demande de localisation a expiré.",
      };
      alert(msgs[err.code] || "Impossible d'obtenir votre position.");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// ── Centrage automatique depuis commune + département ─────────────────────────

let _timerGeocode = null;

function geocoderCommune() {
  clearTimeout(_timerGeocode);

  const commune = document.getElementById('commune').value.trim();
  const dept    = document.getElementById('departement').value.trim();

  // Attend au moins la commune pour lancer la recherche
  if (commune.length < 2) return;

  _timerGeocode = setTimeout(async () => {
    try {
      const requete = commune + (dept ? ', ' + dept : '') + ', France';
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(requete)}&format=json&limit=1&countrycodes=fr`
      );
      const data = await res.json();
      if (data.length === 0) return;

      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);

      // Centre la carte sans placer le marqueur — la personne clique pour confirmer
      carteFormulaire.setView([lat, lon], 14);

      const el = document.getElementById('coords-affichage');
      if (el && latChoisie === null) {
        el.textContent = `Carte centrée sur ${commune}. Cliquez pour placer l'essaim précisément.`;
      }
    } catch (err) {
      console.warn('Geocoding commune échoué :', err);
    }
  }, 800);
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
    const premier = document.querySelector('.invalide');
    if (premier) premier.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const btn = document.getElementById('btn-soumettre');
  btn.disabled = true;
  btn.textContent = 'Envoi en cours…';

  const donnees = {
    prenom:      document.getElementById('prenom').value.trim(),
    email:       document.getElementById('email').value.trim(),
    telephone:   document.getElementById('telephone').value.trim() || null,
    commune:     document.getElementById('commune').value.trim(),
    departement: document.getElementById('departement').value.trim(),
    description: document.getElementById('description').value.trim() || null,
    date_dispo:  document.getElementById('date-dispo').value || null,
    latitude:    latChoisie,
    longitude:   lngChoisie,
    disponible:  true,
  };

  try {
    const { error } = await supabaseClient.from('essaims').insert([donnees]);
    if (error) throw error;

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

  // Centrage auto quand commune ou département changent
  document.getElementById('commune').addEventListener('input', geocoderCommune);
  document.getElementById('departement').addEventListener('input', geocoderCommune);

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
