// Chargement des essaims et gestion des filtres (index.html)

const EXPIRATION_JOURS = 7;

// Liste officielle des 101 départements français
const DEPARTEMENTS = [
  ['01','Ain'],['02','Aisne'],['03','Allier'],['04','Alpes-de-Haute-Provence'],
  ['05','Hautes-Alpes'],['06','Alpes-Maritimes'],['07','Ardèche'],['08','Ardennes'],
  ['09','Ariège'],['10','Aube'],['11','Aude'],['12','Aveyron'],
  ['13','Bouches-du-Rhône'],['14','Calvados'],['15','Cantal'],['16','Charente'],
  ['17','Charente-Maritime'],['18','Cher'],['19','Corrèze'],['2A','Corse-du-Sud'],
  ['2B','Haute-Corse'],['21','Côte-d\'Or'],['22','Côtes-d\'Armor'],['23','Creuse'],
  ['24','Dordogne'],['25','Doubs'],['26','Drôme'],['27','Eure'],
  ['28','Eure-et-Loir'],['29','Finistère'],['30','Gard'],['31','Haute-Garonne'],
  ['32','Gers'],['33','Gironde'],['34','Hérault'],['35','Ille-et-Vilaine'],
  ['36','Indre'],['37','Indre-et-Loire'],['38','Isère'],['39','Jura'],
  ['40','Landes'],['41','Loir-et-Cher'],['42','Loire'],['43','Haute-Loire'],
  ['44','Loire-Atlantique'],['45','Loiret'],['46','Lot'],['47','Lot-et-Garonne'],
  ['48','Lozère'],['49','Maine-et-Loire'],['50','Manche'],['51','Marne'],
  ['52','Haute-Marne'],['53','Mayenne'],['54','Meurthe-et-Moselle'],['55','Meuse'],
  ['56','Morbihan'],['57','Moselle'],['58','Nièvre'],['59','Nord'],
  ['60','Oise'],['61','Orne'],['62','Pas-de-Calais'],['63','Puy-de-Dôme'],
  ['64','Pyrénées-Atlantiques'],['65','Hautes-Pyrénées'],['66','Pyrénées-Orientales'],
  ['67','Bas-Rhin'],['68','Haut-Rhin'],['69','Rhône'],['70','Haute-Saône'],
  ['71','Saône-et-Loire'],['72','Sarthe'],['73','Savoie'],['74','Haute-Savoie'],
  ['75','Paris'],['76','Seine-Maritime'],['77','Seine-et-Marne'],['78','Yvelines'],
  ['79','Deux-Sèvres'],['80','Somme'],['81','Tarn'],['82','Tarn-et-Garonne'],
  ['83','Var'],['84','Vaucluse'],['85','Vendée'],['86','Vienne'],
  ['87','Haute-Vienne'],['88','Vosges'],['89','Yonne'],['90','Territoire de Belfort'],
  ['91','Essonne'],['92','Hauts-de-Seine'],['93','Seine-Saint-Denis'],
  ['94','Val-de-Marne'],['95','Val-d\'Oise'],['971','Guadeloupe'],
  ['972','Martinique'],['973','Guyane'],['974','La Réunion'],['976','Mayotte'],
];

// Remplit un <select> avec la liste des départements
function genererSelectDepartements(selectId, labelVide) {
  const select = document.getElementById(selectId);
  if (!select) return;

  // Conserve la première option (vide) existante
  const premiere = select.options[0];
  select.innerHTML = '';
  if (premiere) select.appendChild(premiere);
  if (labelVide && !premiere) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = labelVide;
    select.appendChild(opt);
  }

  DEPARTEMENTS.forEach(([code, nom]) => {
    const opt = document.createElement('option');
    opt.value = nom;
    opt.textContent = `${code} — ${nom}`;
    select.appendChild(opt);
  });
}

async function chargerStats() {
  const debut = new Date(new Date().getFullYear(), 0, 1).toISOString();
  try {
    const [{ count: total }, { count: recuperes }] = await Promise.all([
      supabaseClient.from('essaims_publics').select('*', { count: 'exact', head: true }).gte('created_at', debut),
      supabaseClient.from('essaims_publics').select('*', { count: 'exact', head: true }).gte('created_at', debut).eq('statut', 'recupere'),
    ]);
    const elSaison    = document.getElementById('stat-saison');
    const elRecuperes = document.getElementById('stat-recuperes');
    if (elSaison)    elSaison.textContent    = total     ?? '–';
    if (elRecuperes) elRecuperes.textContent = recuperes ?? '–';
  } catch (e) { console.warn('Stats saison :', e); }
}

async function chargerEssaims() {
  const compteur = document.getElementById('compteur');

  // Peuple les selects de départements
  genererSelectDepartements('filtre-dept');
  genererSelectDepartements('abonne-dept', 'Choisir un département…');
  chargerStats();

  try {
    const { data: essaims, error } = await supabaseClient
      .from('essaims_publics')
      .select('id, latitude, longitude, commune, departement, description, date_dispo, prenom, created_at, token')
      .eq('disponible', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!essaims || essaims.length === 0) {
      if (compteur) compteur.textContent = 'Aucun essaim disponible pour le moment';
      return;
    }

    let nbAffiches = 0;
    let nbNouveaux = 0;

    essaims.forEach(essaim => {
      const ageHeures = calculerAgeHeures(essaim.created_at);
      if (ageHeures > EXPIRATION_JOURS * 24) return;
      ajouterMarqueur(essaim, ageHeures);
      nbAffiches++;
      if (ageHeures < 24) nbNouveaux++;
    });

    const elDispo = document.getElementById('stat-disponibles');
    if (elDispo) elDispo.textContent = nbAffiches;

    if (compteur) {
      if (nbAffiches === 0) {
        compteur.textContent = 'Aucun essaim disponible pour le moment';
      } else {
        const labelNouveaux = nbNouveaux > 0
          ? ` dont ${nbNouveaux} 🟢 nouveau${nbNouveaux > 1 ? 'x' : ''}`
          : '';
        compteur.textContent =
          `${nbAffiches} essaim${nbAffiches > 1 ? 's' : ''} disponible${nbAffiches > 1 ? 's' : ''}${labelNouveaux}`;
      }
    }

    activerFiltres(nbAffiches);

  } catch (err) {
    console.error('Erreur lors du chargement des essaims :', err);
    if (compteur) {
      compteur.textContent = 'Erreur de chargement — vérifiez la configuration Supabase';
      compteur.style.color = '#c0392b';
    }
  }
}

function calculerAgeHeures(dateStr) {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 3600);
}

function activerFiltres(totalInitial) {
  const selectDept = document.getElementById('filtre-dept');
  const inputVille = document.getElementById('filtre-ville');
  const compteur   = document.getElementById('compteur');

  function appliquerFiltres() {
    const dept  = selectDept?.value || '';
    const ville = inputVille?.value || '';
    const nb    = filtrerMarqueurs(dept, ville);

    if (dept) {
      zoomSurDepartement(dept);
    } else if (!ville) {
      carteLeaflet.setView([46.5, 2.5], 6);
    }

    if (compteur) {
      compteur.textContent = (dept || ville)
        ? `${nb} essaim${nb !== 1 ? 's' : ''} trouvé${nb !== 1 ? 's' : ''}`
        : `${totalInitial} essaim${totalInitial !== 1 ? 's' : ''} disponible${totalInitial !== 1 ? 's' : ''}`;
    }
  }

  selectDept?.addEventListener('change', appliquerFiltres);
  // L'input déclenche le filtre texte ; l'autocomplete gère le zoom séparément
  inputVille?.addEventListener('input', appliquerFiltres);

  activerAutocompleteVille(inputVille, appliquerFiltres);
}

// ── Autocomplete ville sur la carte ──────────────────────────────────────────

let _timerVille = null;

function activerAutocompleteVille(inputVille, appliquerFiltres) {
  if (!inputVille) return;
  const liste = document.getElementById('ville-suggestions');

  inputVille.addEventListener('input', (e) => {
    clearTimeout(_timerVille);
    const val = e.target.value.trim();

    if (val.length < 2) { fermerSuggestionsVille(); return; }

    _timerVille = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(val)}&fields=nom,departement,centre&limit=8&format=json&type=commune-actuelle`
        );
        const communes = await res.json();
        liste.innerHTML = '';

        if (!communes.length) { fermerSuggestionsVille(); return; }

        communes.forEach((c) => {
          const li = document.createElement('li');
          li.setAttribute('role', 'option');
          li.textContent = `${c.nom} (${c.departement.code} — ${c.departement.nom})`;
          li.addEventListener('mousedown', (ev) => {
            ev.preventDefault();
            inputVille.value = c.nom;
            fermerSuggestionsVille();
            appliquerFiltres();
            // Zoom sur la ville sélectionnée
            if (c.centre?.coordinates) {
              const [lng, lat] = c.centre.coordinates;
              carteLeaflet.setView([lat, lng], 13);
            }
          });
          liste.appendChild(li);
        });

        liste.hidden = false;
      } catch (err) {
        console.warn('Autocomplete ville carte :', err);
        fermerSuggestionsVille();
      }
    }, 280);
  });

  inputVille.addEventListener('blur',    () => setTimeout(fermerSuggestionsVille, 150));
  inputVille.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermerSuggestionsVille(); });
}

function fermerSuggestionsVille() {
  const liste = document.getElementById('ville-suggestions');
  if (liste) { liste.innerHTML = ''; liste.hidden = true; }
}
