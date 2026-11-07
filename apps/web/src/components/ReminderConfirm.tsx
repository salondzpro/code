/**
 * Au retour de WhatsApp, des messages ou du téléphone, on demande si le rappel est bien parti. L'application
 * n'a aucun moyen de le savoir seule : ni WhatsApp, ni les SMS, ni les appels ne lui répondent. Le rendez-vous
 * n'est marqué « prévenu » qu'après un oui, avec l'heure du geste. Sur la page Rappels, la question est sur la
 * ligne du client, et sur l'accueil sur la carte du prochain rendez-vous : cette fenêtre ne sert que
 * pour les autres (fenêtre d'un rendez-vous, autre écran).
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { answerReminder, askedInline, usePendingReminder } from '@/lib/reminders';
import { BottomSheet, Button, Dim } from './ui';
import { t } from '@/i18n';

/** Sur ordinateur, un appel ou un SMS ne fait pas toujours quitter la page. */
const ASK_ANYWAY_MS = 4000;

export function ReminderConfirm() {
  const pending = usePendingReminder();
  const { pathname } = useLocation();
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (!pending) {
      setAsk(false);
      return;
    }
    // L'application a pu être fermée par le téléphone pendant le message : on repose la question.
    if (Date.now() - pending.at > ASK_ANYWAY_MS) {
      setAsk(true);
      return;
    }
    let left = false;
    const onChange = () => {
      if (document.hidden) left = true;
      else if (left) setAsk(true);
    };
    const id = window.setTimeout(() => {
      if (!document.hidden && !left) setAsk(true);
    }, ASK_ANYWAY_MS);
    document.addEventListener('visibilitychange', onChange);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('visibilitychange', onChange);
    };
  }, [pending]);

  if (!pending || !ask || pathname === '/pro/rappels' || askedInline(pending.id)) return null;
  const call = pending.via === 'call';
  return (
    <>
      <Dim onClose={() => answerReminder(false)} />
      <BottomSheet modal>
        <div>
          <h2 className="h2">{call ? t('Avez-vous joint {name} ?', { name: pending.name }) : t('Message envoyé à {name} ?', { name: pending.name })}</h2>
          <p className="ds-p">{t('Le rendez-vous sera noté comme prévenu, avec l’heure.')}</p>
        </div>
        <div className="g2">
          <Button sm className="ag9-n" onClick={() => answerReminder(false)}>
            {t('Non')}
          </Button>
          <Button sm className="ag9-b" onClick={() => answerReminder(true)}>
            {t('Oui')}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
