-- Réservation prise POUR QUELQU'UN D'AUTRE (une cliente réserve pour sa mère, un ami…).
--
-- Le rendez-vous appartient à la PERSONNE CONCERNÉE : `client_id` pointe son compte s'il
-- existe (retrouvé par son numéro), sinon reste nul avec son nom et son numéro en
-- instantané, comme un client de passage. Les règles métier se lisent donc sur elle :
-- plafond de rendez-vous à venir, doublon sur un horaire qui chevauche, suspension pour
-- annulations ou absences, blocage par le salon (déjà vérifié par compte OU par numéro).
--
-- On garde qui a réservé : sans cela, une personne verrait apparaître un rendez-vous sans
-- savoir d'où il vient, et une absence lui serait comptée sans recours possible.
alter table public.bookings
  add column if not exists booked_by uuid references public.profiles (id) on delete set null,
  add column if not exists booked_by_name text;

comment on column public.bookings.booked_by is
  'Compte qui a pris le rendez-vous quand ce n''est pas celui de la personne concernée (nul sinon).';
comment on column public.bookings.booked_by_name is
  'Nom affichable de la personne qui a réservé, en instantané (le compte peut changer de nom ou disparaître).';
