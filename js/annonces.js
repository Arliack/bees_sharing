// Chargement des essaims depuis Supabase et affichage sur la carte

async function chargerEssaims() {
  const compteur = document.getElementById('compteur');

  try {
    // Récupère uniquement les essaims disponibles, du plus récent au plus ancien
    const { data: essaims, error } = await supabaseClient
      .from('essaims')
      .select('id, latitude, longitude, commune, departement, description, date_dispo, prenom, email')
      .eq('disponible', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!essaims || essaims.length === 0) {
      if (compteur) compteur.textContent = 'Aucun essaim disponible pour le moment';
      return;
    }

    essaims.forEach(essaim => ajouterMarqueur(essaim));

    if (compteur) {
      compteur.textContent = `${essaims.length} essaim${essaims.length > 1 ? 's' : ''} disponible${essaims.length > 1 ? 's' : ''}`;
    }

    // Active le filtre département une fois les données chargées
    activerFiltre(essaims.length);

  } catch (err) {
    console.error('Erreur lors du chargement des essaims :', err);
    if (compteur) {
      compteur.textContent = 'Erreur de chargement — vérifiez la configuration Supabase';
      compteur.style.color = '#c0392b';
    }
  }
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
