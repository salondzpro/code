/**
 * Les trois ronds pour joindre un client : WhatsApp, SMS, appel. Avec `remind`, WhatsApp et SMS partent
 * avec le message de rappel du salon, et le rendez-vous sort de la page Rappels.
 */
import { Phone, Send } from 'lucide-react';
import type { BookingWithStaff, SalonOwnerView } from '@salondz/types';
import { WhatsAppLogo } from './BrandIcons';
import { I } from './ui';
import { fillReminder, markReminded, readReminderMessage } from '@/lib/reminders';
import { t } from '@/i18n';

export function ClientContact({ booking: b, salon, remind = true }: { booking: BookingWithStaff; salon: SalonOwnerView | null; remind?: boolean }) {
  if (!b.clientPhone) return null;
  const text = remind && salon ? encodeURIComponent(fillReminder(readReminderMessage(salon.id), b, salon)) : '';
  const sent = () => {
    if (text) markReminded(b.id);
  };
  const whatsapp = () => {
    // Pas `wa.me` : sa redirection casse les émojis du message.
    const phone = b.clientPhone!.replace(/\D/g, '');
    window.open(`https://api.whatsapp.com/send?phone=${phone}${text ? `&text=${text}` : ''}`, '_blank', 'noopener');
    sent();
  };
  return (
    <span className="rp-a">
      <button type="button" className="rp-i" aria-label={t('WhatsApp')} title={t('WhatsApp')} onClick={whatsapp}>
        <WhatsAppLogo size={20} />
      </button>
      {/* `?&body=` : la seule écriture comprise à la fois par Android et l'iPhone. */}
      <a href={`sms:${b.clientPhone}${text ? `?&body=${text}` : ''}`} className="rp-i sms" aria-label={t('SMS')} title={t('SMS')} onClick={sent}>
        <I icon={Send} size={18} />
        <small>SMS</small>
      </a>
      <a href={`tel:${b.clientPhone}`} className="rp-i" aria-label={t('Appeler')} title={t('Appeler')}>
        <I icon={Phone} size={18} />
      </a>
    </span>
  );
}
