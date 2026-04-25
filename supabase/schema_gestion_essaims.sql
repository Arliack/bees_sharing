-- ═══════════════════════════════════════════════════════════
--  Migration : gestion du statut des essaims par token
--  À exécuter dans Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Ajout du token unique (lien de gestion) et du statut
ALTER TABLE essaims
  ADD COLUMN IF NOT EXISTS token  uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS statut text DEFAULT 'disponible'
    CHECK (statut IN ('disponible', 'parti', 'recupere'));

-- Index pour la recherche par token (page gerer.html)
CREATE UNIQUE INDEX IF NOT EXISTS essaims_token_unique ON essaims (token);

-- ── Fonction RPC : marquer un essaim parti ou récupéré ────────────────────────
-- Appelée depuis gerer.html via supabaseClient.rpc('gerer_essaim', { p_token, p_statut })
-- SECURITY DEFINER : contourne le RLS sans exposer les données des autres

CREATE OR REPLACE FUNCTION gerer_essaim(p_token uuid, p_statut text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  nb int;
BEGIN
  IF p_statut NOT IN ('parti', 'recupere') THEN
    RETURN 'statut_invalide';
  END IF;

  UPDATE essaims
    SET disponible = false,
        statut     = p_statut
    WHERE token     = p_token
      AND disponible = true;

  GET DIAGNOSTICS nb = ROW_COUNT;

  IF nb = 0 THEN
    RETURN 'not_found';  -- déjà clôturé ou token inconnu
  END IF;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION gerer_essaim(uuid, text) TO anon;
