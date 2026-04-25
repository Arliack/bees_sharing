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

  carteFormulaire.on('click', (e) => {
    placerMarqueurSurCarte(e.latlng.lat, e.latlng.lng);
  });
}

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

  carteFormulaire.setView(latlng, zoom || Math.max(carteFormulaire.getZoom(), 13));
  mettreAJourAffichageCoords();
  document.getElementById('champ-carte').classList.remove('invalide');
}

function mettreAJourAffichageCoords() {
  const el = document.getElementById('coords-affichage');
  if (el && latChoisie !== null) {
    el.textContent = `Position sélectionnée : ${latChoisie}, ${lngChoisie} — vous pouvez déplacer le marqueur pour affiner.`;
  }
}

// ── Autocomplete communes (API Géo officielle, sans clé) ──────────────────────

let _timerCommune = null;

function rechercherCommunes(valeur) {
  clearTimeout(_timerCommune);
  const liste = document.getElementById('commune-suggestions');

  if (valeur.trim().length < 2) {
    fermerSuggestions();
    return;
  }

  _timerCommune = setTimeout(async () => {
    try {
      const res = await fetch(
        `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(valeur)}&fields=nom,departement,centre&limit=8&format=json&type=commune-actuelle`
      );
      const communes = await res.json();

      liste.innerHTML = '';

      if (!communes.length) {
        fermerSuggestions();
        return;
      }

      communes.forEach((c, i) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.setAttribute('id', `suggestion-${i}`);
        li.textContent = `${c.nom} (${c.departement.code} — ${c.departement.nom})`;
        li.addEventListener('mousedown', (e) => {
          // mousedown pour éviter que le blur de l'input ferme la liste avant le clic
          e.preventDefault();
          selectionnerCommune(c);
        });
        liste.appendChild(li);
      });

      liste.hidden = false;

    } catch (err) {
      console.warn('Erreur autocomplete communes :', err);
      fermerSuggestions();
    }
  }, 280);
}

function selectionnerCommune(commune) {
  document.getElementById('commune').value = commune.nom;
  document.getElementById('departement').value = commune.departement.nom;

  fermerSuggestions();

  // Place le marqueur aux coordonnées du centre de la commune (GeoJSON : [lng, lat])
  if (commune.centre?.coordinates) {
    const [lng, lat] = commune.centre.coordinates;
    placerMarqueurSurCarte(lat, lng, 14);
  }

  // Retire les marques d'erreur
  ['commune', 'departement'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.closest('.champ')?.classList.remove('invalide');
      el.classList.remove('erreur');
    }
  });
}

function fermerSuggestions() {
  const liste = document.getElementById('commune-suggestions');
  if (liste) { liste.innerHTML = ''; liste.hidden = true; }
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
      const msgs = { 1: "Accès à la localisation refusé.", 2: "Position indisponible.", 3: "Délai expiré." };
      alert(msgs[err.code] || "Impossible d'obtenir votre position.");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
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
    // La date est automatiquement celle d'aujourd'hui
    date_dispo:  new Date().toISOString().split('T')[0],
    latitude:    latChoisie,
    longitude:   lngChoisie,
    disponible:  true,
  };

  try {
    // .select('token') récupère le token généré automatiquement par Supabase
    const { data, error } = await supabaseClient
      .from('essaims')
      .insert([donnees])
      .select('token')
      .single();

    if (error) throw error;

    // Construit le lien de gestion à partir de l'URL courante
    const base = window.location.href.replace(/deposer\.html.*$/, '');
    const lienGestion = `${base}gerer.html?token=${data.token}`;
    afficherConfirmation(lienGestion);

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

// Injecte le lien de gestion dans la page de confirmation
function afficherConfirmation(lienGestion) {
  const zone = document.getElementById('lien-gestion');
  if (!zone) return;
  zone.innerHTML = `
    <div class="gestion-alerte">
      <p>🔑 <strong>Sauvegardez ce lien</strong> — il vous permettra de marquer votre essaim comme parti ou récupéré :</p>
      <a href="${lienGestion}" class="lien-gestion-url" target="_blank">${lienGestion}</a>
      <button type="button" class="btn-copier" onclick="copierLien('${lienGestion}', this)">Copier</button>
    </div>`;
}

function copierLien(url, btn) {
  navigator.clipboard.writeText(url).then(() => {
    btn.textContent = '✅ Copié !';
    setTimeout(() => { btn.textContent = 'Copier'; }, 2000);
  });
}

// ── Initialisation ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initialiserCarteFormulaire();

  const form = document.getElementById('formulaire');
  if (form) form.addEventListener('submit', soumettreFormulaire);

  // Autocomplete sur le champ commune
  const champCommune = document.getElementById('commune');
  if (champCommune) {
    champCommune.addEventListener('input', (e) => rechercherCommunes(e.target.value));
    champCommune.addEventListener('blur', () => setTimeout(fermerSuggestions, 150));
    champCommune.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') fermerSuggestions();
    });
  }

  // Retire les erreurs de validation en temps réel
  document.querySelectorAll('input:not([readonly]), textarea, select').forEach(input => {
    input.addEventListener('input', () => {
      const conteneur = input.closest('.champ');
      if (conteneur) {
        conteneur.classList.remove('invalide');
        input.classList.remove('erreur');
      }
    });
  });
});
