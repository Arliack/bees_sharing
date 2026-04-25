-- ═══════════════════════════════════════════════════════════
--  Table des abonnements aux alertes email
--  À exécuter dans Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════

CREATE TABLE abonnements (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz DEFAULT now(),
  email       text        NOT NULL,
  departement text        NOT NULL,
  -- token unique envoyé dans le lien de désabonnement
  token       uuid        DEFAULT gen_random_uuid() NOT NULL,
  actif       boolean     DEFAULT true
);

-- Évite les doublons email + département
CREATE UNIQUE INDEX abonnements_email_dept_unique
  ON abonnements (lower(email), lower(departement))
  WHERE actif = true;

-- Index pour la recherche par département (requête de l'Edge Function)
CREATE INDEX abonnements_dept_actif ON abonnements (lower(departement)) WHERE actif = true;

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE abonnements ENABLE ROW LEVEL SECURITY;

-- Insertion publique (pour s'abonner depuis le site)
CREATE POLICY "insertion abonnements"
  ON abonnements FOR INSERT WITH CHECK (true);

-- ── Fonction RPC de désabonnement ────────────────────────────
-- Utilisée par desabonner.html via supabaseClient.rpc('desabonner', { p_token })
-- SECURITY DEFINER : s'exécute en tant que propriétaire, contourne le RLS
-- sans exposer les données des autres abonnés

CREATE OR REPLACE FUNCTION desabonner(p_token uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  nb int;
BEGIN
  UPDATE abonnements
    SET actif = false
    WHERE token = p_token AND actif = true;
  GET DIAGNOSTICS nb = ROW_COUNT;
  IF nb = 0 THEN
    RETURN 'not_found';
  END IF;
  RETURN 'ok';
END;
$$;

-- Autorise l'utilisateur anonyme (navigateur) à appeler cette fonction
GRANT EXECUTE ON FUNCTION desabonner(uuid) TO anon;
