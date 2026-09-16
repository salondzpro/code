-- Réglages par défaut d'un nouveau salon calés sur la pratique algérienne (16 sept. 2026) :
-- on réserve souvent pour « dans une demi-heure » chez le barbier → délai minimum 30 min (était 60).
-- L'annulation gratuite jusqu'à 1 h avant (migration 0014) et la grille de 15 min restent.
alter table public.salons alter column booking_lead_time_minutes set default 30;
