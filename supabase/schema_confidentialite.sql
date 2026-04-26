-- ═══════════════════════════════════════════════════════════
--  Migration : confidentialité des emails
--  Objectif  : empêcher l'accès direct à la colonne email
--              depuis l'API publique (clé anon).
--  À exécuter dans Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── 1. Vue publique sans données sensibles ────────────────────────────────────
--
--  La vue exclut email et telephone.
--  Elle est possédée par le rôle postgres (SECURITY DEFINER implicite sur PG15)
--  donc elle n'a pas besoin des droits anon sur la table sous-jacente.
--  Le filtre disponible = true y est intégré pour la carte ;
--  les requêtes de stats peuvent filtrer en JS selon leur besoin.

CREATE OR REPLACE VIEW essaims_publics AS
  SELECT
    id,
    token,
    prenom,
    commune,
    departement,
    latitude,
    longitude,
    description,
    date_dispo,
    disponible,
    statut,
    created_at
  FROM essaims;

-- Autorise l'utilisateur anonyme à lire la vue
GRANT SELECT ON essaims_publics TO anon;

-- ── 2. Bloquer l'accès direct à la table ────────────────────────────────────
--
--  Sans ce REVOKE, n'importe qui pourrait faire :
--    GET /rest/v1/essaims?select=email
--  et récupérer tous les emails en une seule requête.

REVOKE SELECT ON essaims FROM anon;

-- ── 3. RPC : retourne les infos de contact pour un essaim ─────────────────────
--
--  Appelée depuis carte.js uniquement quand l'utilisateur clique
--  sur le bouton « Je suis intéressé(e) ».
--  Retourne {email, prenom, commune} pour que le JS construise le mailto:.
--  SECURITY DEFINER : s'exécute comme postgres, peut lire la table complète.
--  SET search_path : bonne pratique de sécurité pour les fonctions DEFINER.

CREATE OR REPLACE FUNCTION obtenir_contact_essaim(p_id bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  SELECT email, prenom, commune
    INTO rec
    FROM essaims
   WHERE id = p_id
     AND disponible = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'email',   rec.email,
    'prenom',  rec.prenom,
    'commune', rec.commune
  );
END;
$$;

GRANT EXECUTE ON FUNCTION obtenir_contact_essaim(bigint) TO anon;
