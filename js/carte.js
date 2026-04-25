// Initialisation de la carte Leaflet principale (index.html)

let carteLeaflet = null;
let tousLesMarqueurs = []; // { marqueur, departement }

function initialiserCarte() {
  carteLeaflet = L.map('carte').setView([46.5, 2.5], 6);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(carteLeaflet);

  return carteLeaflet;
}

// Icône adaptée à la fraîcheur de l'annonce
function creerIconeEssaim(ageHeures) {
  const isNouveau = ageHeures < 24;
  const bg      = isNouveau ? '#5a7a3a' : '#e8a020';
  const bordure = isNouveau ? '#2d5016' : '#7a4e2d';
  const ombre   = isNouveau
    ? '0 2px 10px rgba(90,122,58,0.55)'
    : '0 2px 6px rgba(0,0,0,0.25)';

  // Badge rouge "NOUVEAU" uniquement pour les < 24h
  const badge = isNouveau
    ? `<div style="
        position:absolute;top:-7px;right:-18px;
        background:#e74c3c;color:#fff;
        font-size:8px;font-weight:800;
        border-radius:6px;padding:1px 5px;
        white-space:nowrap;letter-spacing:.4px;
        border:1.5px solid #c0392b;
        pointer-events:none;">NOUVEAU</div>`
    : '';

  return L.divIcon({
    className: '',
    html: `<div style="position:relative;display:inline-block;">
      <div style="
        background:${bg};width:32px;height:32px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:3px solid ${bordure};
        box-shadow:${ombre};
        display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);font-size:14px;line-height:1;">🐝</span>
      </div>
      ${badge}
    </div>`,
    // iconSize plus large pour que le badge ne soit pas rogné par Leaflet
    iconSize:    [50, 38],
    iconAnchor:  [16, 35],
    popupAnchor: [9, -36],
  });
}

// Ajout d'un essaim sur la carte
function ajouterMarqueur(essaim, ageHeures) {
  const icone   = creerIconeEssaim(ageHeures);
  const marqueur = L.marker([essaim.latitude, essaim.longitude], { icon: icone });

  const dateDispo = essaim.date_dispo
    ? new Date(essaim.date_dispo).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Non précisée';

  const description = essaim.description
    ? `<p class="desc">${escapeHtml(essaim.description)}</p>`
    : '';

  // Indicateur de fraîcheur coloré
  const labelAge = construireLabelAge(ageHeures);

  // Avertissement si l'essaim date de plus de 3 jours
  const avertissement = ageHeures > 72
    ? `<p style="
        background:#fef9e7;border:1px solid #f0c040;border-radius:6px;
        padding:.4rem .6rem;font-size:.8rem;color:#7a6000;margin-bottom:.6rem;">
        ⚠️ Signalé il y a plusieurs jours — contactez avant de vous déplacer.
      </p>`
    : '';

  // L'email n'apparaît jamais dans le DOM — uniquement dans le href mailto
  const contenuPopup = `
    <div class="popup-essaim">
      <h3>🐝 ${escapeHtml(essaim.commune)}</h3>
      <div style="margin-bottom:.5rem;">${labelAge}</div>
      ${avertissement}
      <p class="date">📅 Disponible le : ${dateDispo}</p>
      ${description}
      <p class="deposant">👤 Signalé par ${escapeHtml(essaim.prenom)}</p>
      <a class="btn-contact"
        href="mailto:${encodeURIComponent(essaim.email)}?subject=${encodeURIComponent('Essaim à ' + essaim.commune)}&body=${encodeURIComponent('Bonjour ' + essaim.prenom + ',\n\nJ\'ai vu votre annonce sur la plateforme de partage d\'essaims et je suis intéressé(e).\n\nCordialement')}">
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

// Badge textuel de fraîcheur affiché dans le popup
function construireLabelAge(ageHeures) {
  if (ageHeures < 1) {
    return `<span style="background:#5a7a3a;color:#fff;font-size:.75rem;font-weight:700;border-radius:8px;padding:2px 8px;">
              🟢 Tout juste signalé !
            </span>`;
  }
  if (ageHeures < 24) {
    return `<span style="background:#5a7a3a;color:#fff;font-size:.75rem;font-weight:700;border-radius:8px;padding:2px 8px;">
              🟢 Il y a ${Math.floor(ageHeures)} heure${ageHeures >= 2 ? 's' : ''}
            </span>`;
  }
  return `<span style="color:#888;font-size:.8rem;">
            🕐 Signalé ${tempsRelatif(ageHeures)}
          </span>`;
}

// Convertit un âge en heures en texte lisible
function tempsRelatif(ageHeures) {
  if (ageHeures < 48) return `il y a ${Math.round(ageHeures)} heures`;
  const jours = Math.floor(ageHeures / 24);
  return `il y a ${jours} jour${jours > 1 ? 's' : ''}`;
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
