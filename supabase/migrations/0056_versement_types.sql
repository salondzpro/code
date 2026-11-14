-- Réservation avec VERSEMENT (14 nov. 2026) — types de notification, dans leur propre fichier :
-- une valeur d'énumération ajoutée ne peut pas servir dans la transaction qui l'ajoute.
alter type public.notification_type add value if not exists 'deposit_submitted';
alter type public.notification_type add value if not exists 'deposit_rejected';
