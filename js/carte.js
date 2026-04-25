// Initialisation de la carte Leaflet principale (index.html)

let carteLeaflet = null;
let tousLesMarqueurs = [];

function initialiserCarte() {
  carteLeaflet = L.map('carte', { zoomControl: false }).setView([46.5, 2.5], 6);

  // Tuiles CartoDB Voyager — plus belles que les tuiles OSM par défaut
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  }).addTo(carteLeaflet);

  // Contrôle de zoom en bas à droite
  L.control.zoom({ position: 'bottomright' }).addTo(carteLeaflet);

  return carteLeaflet;
}

// ── Icône ─────────────────────────────────────────────────────────────────────

function creerIconeEssaim(ageHeures) {
  const isNouveau = ageHeures < 24;
  const bg      = isNouveau ? '#5a7a3a' : '#e8a020';
  const bordure = isNouveau ? '#2d5016' : '#7a4e2d';
  const ombre   = isNouveau ? '0 3px 12px rgba(90,122,58,0.5)' : '0 2px 8px rgba(0,0,0,0.2)';

  const pulse = isNouveau ? '<div class="marqueur-pulse"></div>' : '';
  const badge = isNouveau
    ? `<div style="position:absolute;top:-7px;right:-18px;background:#e74c3c;color:#fff;font-size:8px;font-weight:800;border-radius:6px;padding:1px 5px;white-space:nowrap;letter-spacing:.4px;border:1.5px solid #c0392b;pointer-events:none;">NOUVEAU</div>`
    : '';

  return L.divIcon({
    className: '',
    html: `<div style="position:relative;display:inline-block;">
      ${pulse}
      <div style="background:${bg};width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid ${bordure};box-shadow:${ombre};display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);font-size:14px;line-height:1;">🐝</span>
      </div>
      ${badge}
    </div>`,
    iconSize:    [50, 38],
    iconAnchor:  [16, 35],
    popupAnchor: [9, -36],
  });
}

// ── Popup / Bottom-sheet ───────────────────────────────────────────────────────

function construireContenuEssaim(essaim, ageHeures) {
  const dateDispo = essaim.date_dispo
    ? new Date(essaim.date_dispo).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Non précisée';

  const description = essaim.description
    ? `<p class="desc">${escapeHtml(essaim.description)}</p>` : '';

  const labelAge = construireLabelAge(ageHeures);

  const avertissement = ageHeures > 72
    ? `<p style="background:#fef9e7;border:1px solid #f0c040;border-radius:6px;padding:.4rem .6rem;font-size:.8rem;color:#7a6000;margin-bottom:.6rem;">⚠️ Signalé il y a plusieurs jours — contactez avant de vous déplacer.</p>`
    : '';

  const mailHref = `mailto:${encodeURIComponent(essaim.email)}?subject=${encodeURIComponent('Essaim à ' + essaim.commune)}&body=${encodeURIComponent('Bonjour ' + essaim.prenom + ',\n\nJ\'ai vu votre annonce sur la plateforme de partage d\'essaims et je suis intéressé(e).\n\nCordialement')}`;

  return `
    <div class="popup-essaim">
      <h3>🐝 ${escapeHtml(essaim.commune)}</h3>
      <div style="margin-bottom:.5rem;">${labelAge}</div>
      ${avertissement}
      <p class="date">📅 Disponible le : ${dateDispo}</p>
      ${description}
      <p class="deposant">👤 Signalé par ${escapeHtml(essaim.prenom)}</p>
      <a class="btn-contact" href="${mailHref}">✉️ Je suis intéressé(e)</a>
      <div class="popup-gestion">
        <p class="popup-gestion-titre">C'est votre essaim ?</p>
        <div class="popup-gestion-boutons">
          <button class="popup-btn-gestion popup-btn-parti"
                  onclick="marquerEssaimDepuisCarte('${essaim.token}', 'parti', this)">
            🍃 Parti
          </button>
          <button class="popup-btn-gestion popup-btn-recupere"
                  onclick="marquerEssaimDepuisCarte('${essaim.token}', 'recupere', this)">
            ✅ Récupéré
          </button>
        </div>
        <div id="popup-msg" class="popup-gestion-msg"></div>
      </div>
    </div>`;
}

function ajouterMarqueur(essaim, ageHeures) {
  const icone   = creerIconeEssaim(ageHeures);
  const marqueur = L.marker([essaim.latitude, essaim.longitude], { icon: icone });
  const contenu  = construireContenuEssaim(essaim, ageHeures);

  // Desktop : popup Leaflet / Mobile : bottom sheet
  marqueur.on('popupopen', () => {
    if (window.innerWidth < 768) {
      marqueur.closePopup();
      ouvrirBottomSheet(contenu);
    }
  });
  marqueur.bindPopup(contenu, { maxWidth: 300 });
  marqueur.addTo(carteLeaflet);

  tousLesMarqueurs.push({
    marqueur,
    departement: (essaim.departement || '').toLowerCase().trim(),
    commune:     (essaim.commune     || '').toLowerCase().trim(),
    token:       essaim.token,
  });
}

// ── Bottom-sheet (mobile) ─────────────────────────────────────────────────────

function ouvrirBottomSheet(html) {
  const sheet   = document.getElementById('bottom-sheet');
  const overlay = document.getElementById('bs-overlay');
  const contenu = document.getElementById('bs-contenu');
  if (!sheet) return;

  contenu.innerHTML = html;
  overlay.hidden = false;
  sheet.hidden   = false;
  sheet.offsetHeight; // force reflow pour la transition
  sheet.classList.add('ouvert');
  document.body.style.overflow = 'hidden';
}

function fermerBottomSheet() {
  const sheet   = document.getElementById('bottom-sheet');
  const overlay = document.getElementById('bs-overlay');
  if (!sheet) return;

  sheet.classList.remove('ouvert');
  setTimeout(() => {
    sheet.hidden   = true;
    overlay.hidden = true;
    document.body.style.overflow = '';
  }, 340);
}

// ── Actions depuis popup/bottom-sheet ─────────────────────────────────────────

async function marquerEssaimDepuisCarte(token, statut, btnClique) {
  const zone = btnClique.closest('.popup-essaim');
  const msg  = zone?.querySelector('#popup-msg') || zone?.querySelector('.popup-gestion-msg');
  const btns = zone?.querySelectorAll('.popup-btn-gestion');

  btns?.forEach(b => { b.disabled = true; });
  btnClique.textContent = '⌛…';

  try {
    const { data, error } = await supabaseClient.rpc('gerer_essaim', { p_token: token, p_statut: statut });
    if (error) throw error;

    if (data === 'not_found') {
      if (msg) msg.textContent = 'Déjà clôturé.';
      return;
    }

    const libelle = statut === 'recupere' ? 'récupéré ✅' : 'parti 🍃';
    if (msg) {
      msg.innerHTML = `Essaim marqué comme <strong>${libelle}</strong>. Merci !`;
      msg.className = 'popup-gestion-msg popup-gestion-msg--ok';
    }
    zone?.querySelector('.popup-gestion-boutons')?.style.setProperty('display', 'none');

    setTimeout(() => {
      carteLeaflet.closePopup();
      fermerBottomSheet();
      supprimerMarqueurParToken(token);
    }, 1200);

  } catch (err) {
    console.error('Erreur marquage :', err);
    if (msg) { msg.textContent = 'Erreur — réessayez.'; msg.className = 'popup-gestion-msg popup-gestion-msg--erreur'; }
    btns?.forEach(b => { b.disabled = false; });
  }
}

function supprimerMarqueurParToken(token) {
  const idx = tousLesMarqueurs.findIndex(m => m.token === token);
  if (idx === -1) return;
  tousLesMarqueurs[idx].marqueur.remove();
  tousLesMarqueurs.splice(idx, 1);
  mettreAJourCompteur();
}

function mettreAJourCompteur() {
  const compteur = document.getElementById('compteur');
  if (!compteur) return;
  const dept  = document.getElementById('filtre-dept')?.value  || '';
  const ville = document.getElementById('filtre-ville')?.value || '';
  const filtre = dept || ville;
  const nb = filtre
    ? tousLesMarqueurs.filter(({ marqueur }) => carteLeaflet.hasLayer(marqueur)).length
    : tousLesMarqueurs.length;
  const mot = filtre ? 'trouvé' : 'disponible';
  compteur.textContent = `${nb} essaim${nb !== 1 ? 's' : ''} ${mot}${nb !== 1 ? 's' : ''}`;
}

// ── Labels de fraîcheur ───────────────────────────────────────────────────────

function construireLabelAge(ageHeures) {
  if (ageHeures < 1) return `<span class="badge-age badge-nouveau">🟢 Tout juste signalé !</span>`;
  if (ageHeures < 24) return `<span class="badge-age badge-nouveau">🟢 Il y a ${Math.floor(ageHeures)}h</span>`;
  return `<span class="badge-age">🕐 ${tempsRelatif(ageHeures)}</span>`;
}

function tempsRelatif(ageHeures) {
  if (ageHeures < 48) return `il y a ${Math.round(ageHeures)} heures`;
  return `il y a ${Math.floor(ageHeures / 24)} jour${Math.floor(ageHeures / 24) > 1 ? 's' : ''}`;
}

// ── Filtres ───────────────────────────────────────────────────────────────────

function filtrerMarqueurs(dept, ville) {
  const filtreDept  = (dept  || '').toLowerCase().trim();
  const filtreVille = (ville || '').toLowerCase().trim();
  let visibles = 0;
  tousLesMarqueurs.forEach(({ marqueur, departement, commune }) => {
    const ok = (!filtreDept || departement.includes(filtreDept))
            && (!filtreVille || commune.includes(filtreVille));
    if (ok) { marqueur.addTo(carteLeaflet); visibles++; }
    else      marqueur.remove();
  });
  return visibles;
}

// ── Zoom département via Nominatim ────────────────────────────────────────────

let _timerZoomDept = null;

function zoomSurDepartement(valeur) {
  clearTimeout(_timerZoomDept);
  if (!valeur || valeur.trim().length < 2) { carteLeaflet.setView([46.5, 2.5], 6); return; }

  _timerZoomDept = setTimeout(async () => {
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(valeur + ', France')}&format=json&limit=1&countrycodes=fr`);
      const data = await res.json();
      if (data.length > 0) {
        const bb = data[0].boundingbox;
        carteLeaflet.fitBounds([[+bb[0], +bb[2]], [+bb[1], +bb[3]]], { padding: [30, 30] });
      }
    } catch (err) { console.warn('Geocoding département :', err); }
  }, 600);
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function escapeHtml(texte) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(texte || ''));
  return div.innerHTML;
}
