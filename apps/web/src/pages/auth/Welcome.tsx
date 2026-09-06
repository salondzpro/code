/** AUTH 03 — Choix du compte : « Je réserve » / « Je suis professionnel ». */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { UserRole } from '@salondz/constants';
import { writeAuthFlow } from '@/lib/authFlow';
import { Button, Card } from '@/components/ui';
import { Screen } from '@/components/AppFrame';

export function Welcome() {
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>('client');

  const go = () => {
    writeAuthFlow({ role, next: role === 'pro' ? '/pro' : '/' });
    navigate(`/connexion?role=${role}`);
  };

  return (
    <Screen className="min-h-dvh justify-center" gap={16}>
      <div className="mt-[-60px]">
        <div className="h3">Beauty · Algérie</div>
        <h1 className="h1 mt-2">
          Bienvenue.
          <br />
          Qui êtes-vous ?
        </h1>
      </div>
      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Type de compte">
        <Card as="button" sel={role === 'client'} onClick={() => setRole('client')}>
          <span role="radio" aria-checked={role === 'client'} className="h2 text-[20px]">
            Je réserve
          </span>
          <span className="p">Créer mon compte ou me connecter, puis réserver : un compte est nécessaire pour prendre rendez-vous.</span>
        </Card>
        <Card as="button" sel={role === 'pro'} onClick={() => setRole('pro')}>
          <span role="radio" aria-checked={role === 'pro'} className="h2 text-[20px]">
            Je suis professionnel
          </span>
          <span className="p">Recevoir des réservations, gérer mon agenda et partager ma page.</span>
        </Card>
      </div>
      <Button onClick={go}>Continuer</Button>
      <p className="p text-center">Une seule vérification WhatsApp · session conservée ensuite</p>
    </Screen>
  );
}
