// Initialisation de la carte Leaflet principale (index.html)

let carteLeaflet = null;
let tousLesMarqueurs = []; // { marqueur, departement }

function initialiserCarte() {
  // Centre approximatif de la France métropolitaine
  carteLeaflet = L.map('carte').setView([46.5, 2.5], 6);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(carteLeaflet);

  return carteLeaflet;
}

// Icône personnalisée en forme d'alvéole / ruche
function creerIconeEssaim() {
  return L.divIcon({
    className: '',
    html: '<div style="'
      + 'background:#e8a020;'
      + 'width:32px;height:32px;'
      + 'border-radius:50% 50% 50% 0;'
      + 'transform:rotate(-45deg);'
      + 'border:3px solid #7a4e2d;'
      + 'box-shadow:0 2px 6px rgba(0,0,0,0.25);'
      + 'display:flex;align-items:center;justify-content:center;'
      + '">'
      + '<span style="transform:rotate(45deg);font-size:14px;line-height:1;">🐝</span>'
      + '</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  });
}

// Ajout d'un essaim sur la carte
function ajouterMarqueur(essaim) {
  const icone = creerIconeEssaim();
  const marqueur = L.marker([essaim.latitude, essaim.longitude], { icon: icone });

  const dateDispo = essaim.date_dispo
    ? new Date(essaim.date_dispo).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Non précisée';

  const description = essaim.description
    ? `<p class="desc">${escapeHtml(essaim.description)}</p>`
    : '';

  // L'email n'apparaît jamais dans le DOM — utilisé uniquement dans le href
  const contenuPopup = `
    <div class="popup-essaim">
      <h3>🐝 ${escapeHtml(essaim.commune)}</h3>
      <p class="date">📅 Disponible le : ${dateDispo}</p>
      ${description}
      <p class="deposant">👤 Signalé par ${escapeHtml(essaim.prenom)}</p>
      <a class="btn-contact" href="mailto:${encodeURIComponent(essaim.email)}?subject=${encodeURIComponent('Essaim à ' + essaim.commune)}&body=${encodeURIComponent('Bonjour ' + essaim.prenom + ',\n\nJ\'ai vu votre annonce sur la plateforme de partage d\'essaims et je suis intéressé(e).\n\nCordialement')}">
        ✉️ Je suis intéressé(e)
      </a>
    </div>`;

  marqueur.bindPopup(contenuPopup);
  marqueur.addTo(carteLeaflet);

  tousLesMarqueurs.push({
    marqueur,
    departement: (essaim.departement || '').toLowerCase().trim(),
  });
}

// Filtrage des marqueurs par département
function filtrerParDepartement(valeur) {
  const filtre = valeur.toLowerCase().trim();
  let visibles = 0;

  tousLesMarqueurs.forEach(({ marqueur, departement }) => {
    if (!filtre || departement.includes(filtre)) {
      marqueur.addTo(carteLeaflet);
      visibles++;
    } else {
      marqueur.remove();
    }
  });

  return visibles;
}

// Zoom sur un département via Nominatim (geocoding OpenStreetMap)
let _timerZoomDept = null;

function zoomSurDepartement(valeur) {
  clearTimeout(_timerZoomDept);

  if (!valeur || valeur.trim().length < 2) {
    carteLeaflet.setView([46.5, 2.5], 6);
    return;
  }

  _timerZoomDept = setTimeout(async () => {
    try {
      const q = encodeURIComponent(valeur.trim() + ', France');
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=fr`
      );
      const data = await res.json();
      if (data.length > 0) {
        const bb = data[0].boundingbox; // [south, north, west, east]
        carteLeaflet.fitBounds([[+bb[0], +bb[2]], [+bb[1], +bb[3]]], { padding: [30, 30] });
      }
    } catch (err) {
      console.warn('Geocoding département échoué :', err);
    }
  }, 600);
}

// Échappe le HTML pour éviter les injections XSS dans les popups
function escapeHtml(texte) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(texte || ''));
  return div.innerHTML;
}
