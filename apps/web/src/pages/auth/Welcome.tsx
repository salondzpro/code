/** AUTH 03 — Choix du compte : « Je réserve » / « Je suis professionnel ». */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { UserRole } from '@salondz/constants';
import { writeAuthFlow } from '@/lib/authFlow';
import { Button, Card } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { t } from '@/i18n';

export function Welcome() {
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>('client');

  const go = () => {
    writeAuthFlow({ role, next: role === 'pro' ? '/pro' : '/' });
    navigate(`/connexion?role=${role}`);
  };

  return (
    <Screen className="min-h-dvh justify-center" gap={16}>
      <div className="mt-[-3.75rem]">
        <div className="h3">{t("Salon DZ · Algérie")}</div>
        <h1 className="h1 mt-2">
          {t("Bienvenue.")}
          <br />
          {t("Qui êtes-vous ?")}
        </h1>
      </div>
      <div className="flex flex-col gap-3" role="radiogroup" aria-label={t("Type de compte")}>
        <Card as="button" sel={role === 'client'} onClick={() => setRole('client')}>
          <span role="radio" aria-checked={role === 'client'} className="h2 text-[1rem]">
            {t("Je réserve")}
          </span>
          <span className="p">{t("Créer mon compte ou me connecter, puis réserver : un compte est nécessaire pour prendre rendez-vous.")}</span>
        </Card>
        <Card as="button" sel={role === 'pro'} onClick={() => setRole('pro')}>
          <span role="radio" aria-checked={role === 'pro'} className="h2 text-[1rem]">
            {t("Je suis professionnel")}
          </span>
          <span className="p">{t("Recevoir des réservations, gérer mon agenda et partager ma page.")}</span>
        </Card>
      </div>
      <Button onClick={go}>{t("Continuer")}</Button>
      <p className="p text-center">{t("Compte par e-mail et mot de passe · session conservée ensuite")}</p>
    </Screen>
  );
}
