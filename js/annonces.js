// Chargement des essaims depuis Supabase et affichage sur la carte

// Seuil au-delà duquel un essaim est masqué de la carte (en jours)
const EXPIRATION_JOURS = 7;

async function chargerEssaims() {
  const compteur = document.getElementById('compteur');

  try {
    const { data: essaims, error } = await supabaseClient
      .from('essaims')
      .select('id, latitude, longitude, commune, departement, description, date_dispo, prenom, email, created_at')
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

      // Masque les annonces trop vieilles (l'essaim a probablement été récupéré)
      if (ageHeures > EXPIRATION_JOURS * 24) return;

      ajouterMarqueur(essaim, ageHeures);
      nbAffiches++;
      if (ageHeures < 24) nbNouveaux++;
    });

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

    activerFiltre(nbAffiches);

  } catch (err) {
    console.error('Erreur lors du chargement des essaims :', err);
    if (compteur) {
      compteur.textContent = 'Erreur de chargement — vérifiez la configuration Supabase';
      compteur.style.color = '#c0392b';
    }
  }
}

// Calcule l'âge d'une annonce en heures à partir de sa date de création
function calculerAgeHeures(dateStr) {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 3600);
}

function activerFiltre(totalInitial) {
  const input = document.getElementById('filtre-dept');
  const compteur = document.getElementById('compteur');
  if (!input) return;

  input.addEventListener('input', () => {
    const nb = filtrerParDepartement(input.value);
    zoomSurDepartement(input.value);
    if (compteur) {
      compteur.textContent = input.value.trim()
        ? `${nb} essaim${nb > 1 ? 's' : ''} dans ce département`
        : `${totalInitial} essaim${totalInitial > 1 ? 's' : ''} disponible${totalInitial > 1 ? 's' : ''}`;
    }
  });
}
