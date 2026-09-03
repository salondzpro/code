import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { CATEGORIES, FEATURED_WILAYA_CODES, WILAYAS, wilayaName } from '@salondz/constants';

export function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [wilaya, setWilaya] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (wilaya) params.set('wilaya', wilaya);
    navigate(`/recherche?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-10">
      <section className="card flex flex-col gap-4 p-6 md:p-10">
        <h1 className="text-3xl font-bold md:text-4xl">Réservez votre coiffeur ou barbier en Algérie</h1>
        <p className="text-muted">Trouvez un salon près de chez vous, choisissez un créneau, c'est confirmé en quelques secondes.</p>
        <form onSubmit={submit} className="grid gap-2 md:grid-cols-[1fr_220px_auto]" role="search">
          <input className="input" placeholder="Coupe, barbe, salon…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Recherche" />
          <select className="input" value={wilaya} onChange={(e) => setWilaya(e.target.value)} aria-label="Wilaya">
            <option value="">Toute l'Algérie</option>
            {WILAYAS.map((w) => (
              <option key={w.code} value={w.code}>
                {w.code} – {w.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary">
            Rechercher
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Catégories</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link key={c.id} to={`/recherche?category=${c.id}`} className="card p-4 text-center font-medium hover:shadow-md">
              {c.labelFr}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Villes populaires</h2>
        <div className="flex flex-wrap gap-2">
          {FEATURED_WILAYA_CODES.map((code) => (
            <Link key={code} to={`/recherche?wilaya=${code}`} className="chip hover:border-primary">
              {wilayaName(code)}
            </Link>
          ))}
        </div>
      </section>

      <section className="card flex flex-col items-start gap-2 p-6">
        <h2 className="text-xl font-semibold">Vous êtes coiffeur, barbier ou esthéticienne ?</h2>
        <p className="text-sm text-muted">Agenda en temps réel, réservations en ligne, rappels automatiques. Gratuit pour commencer.</p>
        <Link to="/connexion?role=pro&next=/pro" className="btn-primary">
          Créer mon salon
        </Link>
      </section>
    </div>
  );
}
