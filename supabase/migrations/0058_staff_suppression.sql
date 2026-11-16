-- SUPPRIMER UN MEMBRE DE L'ÉQUIPE (16 nov. 2026, demande du propriétaire).
-- Un membre qui a déjà des rendez-vous ne peut pas être effacé (l'historique pointe vers lui) : il est
-- marqué SUPPRIMÉ. Il disparaît de l'équipe, de l'agenda et de la réservation, mais son nom reste sur
-- ses anciens rendez-vous. À distinguer de `is_active = false` (inactif : encore dans l'équipe, masqué
-- à la réservation, réactivable d'un geste).
alter table public.staff add column if not exists deleted_at timestamptz;
