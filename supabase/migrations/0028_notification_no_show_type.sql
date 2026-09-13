-- Nouveau type de notification : « absence signalée ».
--
-- Le statut `no_show` existait, avec un libellé et un badge, mais AUCUNE notification :
-- une cliente pouvait être déclarée absente sans jamais en être informée, alors que cette
-- absence compte dans les règles anti-abus et peut suspendre sa réservation en ligne.
--
-- `alter type ... add value` ne peut pas être suivi d'un usage de la valeur dans la même
-- transaction, et le lanceur de migrations enveloppe chaque fichier dans une transaction :
-- la valeur est donc ajoutée ici, et la migration suivante s'en sert.
alter type public.notification_type add value if not exists 'booking_no_show';
