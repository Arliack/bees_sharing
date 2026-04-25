# 🐝 Plateforme de partage d'essaims

Site statique de mise en relation entre particuliers ayant trouvé un essaim d'abeilles et apiculteurs souhaitant le récupérer.

## Mise en route

### 1. Créer un projet Supabase

1. Aller sur [supabase.com](https://supabase.com) et créer un compte gratuit
2. Créer un nouveau projet (choisir la région Europe la plus proche, ex. Paris)
3. Attendre la fin de l'initialisation (1-2 minutes)

### 2. Créer la table `essaims`

Dans votre projet Supabase, ouvrir **SQL Editor** et exécuter :

```sql
CREATE TABLE essaims (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz DEFAULT now(),
  latitude    float NOT NULL,
  longitude   float NOT NULL,
  commune     text NOT NULL,
  departement text NOT NULL,
  description text,
  disponible  boolean DEFAULT true,
  date_dispo  date,
  prenom      text NOT NULL,
  email       text NOT NULL,
  telephone   text
);

-- Lecture publique (la carte est accessible à tous)
ALTER TABLE essaims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecture publique"   ON essaims FOR SELECT USING (true);
CREATE POLICY "insertion publique" ON essaims FOR INSERT WITH CHECK (true);
CREATE POLICY "mise a jour token"  ON essaims FOR UPDATE USING (true);
```

### 3. Configurer les clés dans `js/config.js`

Dans **Settings → API** de votre projet Supabase, copier :
- **Project URL** → remplacer `REMPLACER_PAR_TON_URL_SUPABASE`
- **anon public** key → remplacer `REMPLACER_PAR_TA_CLE_ANON`

```js
const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGci...';
```

### 4. Tester en local

Ouvrir le projet dans VSCode et lancer **Live Server** (clic droit sur `index.html` → *Open with Live Server*).

> Ne pas ouvrir `index.html` directement dans le navigateur (protocole `file://`) : les requêtes Supabase seront bloquées par CORS.

### 5. Déployer sur GitHub Pages

1. Pousser le dépôt sur GitHub
2. Aller dans **Settings → Pages**
3. Source : `Deploy from a branch`, branche `main`, dossier `/`
4. Après quelques minutes, le site est accessible à `https://<utilisateur>.github.io/<repo>/`

## Structure des fichiers

```
/
├── index.html        Page principale avec la carte
├── deposer.html      Formulaire de signalement d'un essaim
├── css/
│   └── style.css     Styles globaux
├── js/
│   ├── config.js     Clés Supabase (à personnaliser)
│   ├── carte.js      Initialisation Leaflet + marqueurs
│   ├── annonces.js   Chargement des essaims depuis Supabase
│   └── formulaire.js Soumission d'un nouvel essaim
└── README.md
```

## Notes de sécurité

- L'email des déposants n'est **jamais affiché dans le DOM**. Il est uniquement injecté dans un lien `mailto:` généré dynamiquement en JavaScript.
- La clé `anon` Supabase est publique par conception (elle est visible dans le code client). Les politiques RLS garantissent que seules les opérations autorisées sont possibles.
- Pour permettre aux déposants de marquer leur essaim comme "non disponible", vous pouvez ajouter un champ `token` (UUID généré à l'insertion) et envoyer un lien de gestion par email.
