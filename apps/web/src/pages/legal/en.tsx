/**
 * Legal pages and help IN ENGLISH (27 Nov. 2026) — faithful translation of `pages/Legal.tsx`.
 * The French version prevails (notice at the top of each document). Any change to the French text
 * must be carried over here and in `ar.tsx`.
 */
import { Link } from 'react-router';
import { CONTACT, EDITOR, Mailto, SUPPORT } from './commun';

export const TITRES = {
  terms: 'Terms of use',
  privacy: 'Privacy policy',
  notice: 'Legal notice',
  delete: 'Delete my account',
  help: 'Help and contact',
  updated: 'Last updated:',
  foi: 'This is a translation. In case of any difference, the French version prevails.',
};

export function Terms() {
  return (
    <>
      <h2>1. Purpose and acceptance</h2>
      <p>
        These terms of use (the “Terms”) govern access to and use of the Salon DZ platform, available at salondz.com and, where applicable,
        through its mobile apps (the “Platform”), published by {EDITOR.name} (the “Publisher”). By creating an account or using the Platform,
        you accept these Terms without reservation. If you do not accept them, do not use the Platform.
      </p>
      <h2>2. Definitions</h2>
      <ul>
        <li>“Client”: anyone who browses salons or books a service through the Platform.</li>
        <li>“Professional”: any hair salon, barber, beauty institute or similar provider that presents its services and manages its appointments on the Platform.</li>
        <li>“Booking”: an appointment request sent by a Client to a Professional through the Platform, confirmed automatically or manually according to the Professional’s rules.</li>
      </ul>
      <h2>3. Nature of the service</h2>
      <p>
        Salon DZ is a matchmaking service. The Platform lets Clients find a Professional, view their services, prices and availability, and
        book an appointment; it lets Professionals manage their calendar, their clients and their public page. The service itself (haircut,
        treatment, etc.) is performed by the Professional, on their premises, under their sole responsibility: the service contract is formed
        between the Client and the Professional, and the Publisher is not a party to it.
      </p>
      <p>
        The Platform collects no payment. Prices are displayed by Professionals in Algerian dinars, all taxes included, in accordance with Law
        No. 04-02 on commercial practices, and are paid directly to the Professional, on site. The price displayed at the time of Booking
        applies, except for any additional service requested on site and accepted by the Client.
      </p>
      <h2>4. Account</h2>
      <ul>
        <li>An account is required to book or to offer services. It is personal: one person, one account.</li>
        <li>You provide accurate, up-to-date information: name, a valid email address and an Algerian phone number. The number identifies the Client to the Professional and can no longer be changed freely once an appointment exists (contact support).</li>
        <li>You keep your login details confidential and are responsible for any use of your account. Notify support without delay of any unauthorised use.</li>
        <li>A Client account may be created from the age of 16, with the consent of a legal guardian for minors. A Professional account is reserved for adults acting for a business legally established in Algeria.</li>
      </ul>
      <h2>5. Bookings</h2>
      <ul>
        <li>A Booking is a commitment: the Client shows up at the agreed time or cancels within the deadline set by the Professional. Each salon’s rules (cancellation deadline, rescheduling, manual approval, booking horizon) are displayed before confirmation.</li>
        <li>When a Professional approves requests manually, the Booking remains “pending” until they answer; the slot is held for the Client in the meantime. Without an answer within the stated deadline, the request expires and the Client is informed.</li>
        <li>The Client can cancel or move an appointment from the Platform within the limits set by the Professional. The Professional may, for their part, cancel an appointment if prevented; the Client is informed immediately.</li>
        <li>Repeated late cancellations and no-shows harm Professionals. They may lead to a temporary suspension of online booking; a Professional may also refuse a Client. Thresholds and durations are shown in the app.</li>
        <li>Booking for someone else makes you responsible: you must have their consent, pass on the appointment details and inform them of this policy. The appointment belongs to the person concerned.</li>
        <li>Appointment reminders are sent by notification (app or browser) as a convenience; their absence does not release the Client from their commitment.</li>
      </ul>
      <h2>6. Professionals’ obligations</h2>
      <ul>
        <li>You run a legally established business (trade register or craftsman card, as applicable) and comply with the regulations of your profession, in particular regarding hygiene, safety and price display.</li>
        <li>You guarantee that your page is accurate and up to date: name, address, services, durations, prices in dinars, opening hours, team. Misleading information engages your liability towards Clients (Law No. 09-03 on consumer protection).</li>
        <li>You honour confirmed appointments or inform the Client without delay if prevented, and you handle pending requests within the stated deadline.</li>
        <li>You hold the rights to the photos and texts you publish and obtain the consent of recognisable people. No unlawful, misleading or indecent content.</li>
        <li>Your Clients’ data available on the Platform (names, numbers, history, notes) may only be used to manage your appointments and your client relationship. Any unsolicited marketing, transfer or use outside this purpose is prohibited and engages your liability under Law No. 18-07.</li>
        <li>You are solely responsible for the services performed, their quality, their price and any disputes with your Clients.</li>
      </ul>
      <h2>7. Reviews</h2>
      <p>
        Only the person who attended the appointment can leave a review, once the appointment is over. Reviews reflect a real experience and
        remain factual and respectful; they are published under the first name and the initial of the last name. The Publisher may remove a
        review that is clearly abusive, insulting, discriminatory or unrelated to the service, and suspend the author of fraudulent reviews.
      </p>
      <h2>8. Intellectual property</h2>
      <p>
        The Salon DZ brand, name, logo, interface and own content are protected by Ordinance No. 03-05 on copyright and related rights and by
        trademark law. Any unauthorised reproduction or extraction is prohibited. Content published by Professionals (photos, descriptions)
        remains their property; they grant the Publisher the right to display it on the Platform and in its share previews for as long as it
        is on the Platform.
      </p>
      <h2>9. Availability and liability</h2>
      <ul>
        <li>The Publisher does its best to ensure continuous access to the Platform, without guaranteeing that there will be no interruption (maintenance, incident, network). Access may be suspended for maintenance.</li>
        <li>The Publisher is not responsible for the quality, compliance or result of the services performed by Professionals, nor for damage resulting from an appointment missed, cancelled or moved by either party.</li>
        <li>The Publisher is not responsible for information published by Professionals or reviews published by Clients; it removes unlawful content reported to <Mailto to={SUPPORT} />.</li>
        <li>Clients and Professionals refrain from any abusive use of the Platform: fake bookings, circumventing the rules, automated data collection, security breaches.</li>
      </ul>
      <h2>10. Suspension and termination</h2>
      <p>
        You can delete your account at any time from Settings. The Publisher may suspend or close an account, or remove a page, in the event of
        a breach of these Terms, unlawful content, fraud or repeated complaints, after informing the person concerned except in an emergency.
        Ongoing appointments are then cancelled and the people concerned are notified.
      </p>
      <p>
        Credit with a Professional: when a Professional records an amount owed by a client (credit), the client is notified and sees it in
        their account. As long as a balance remains due, their name, number and other profile details cannot be changed and the account cannot
        be deleted, to prevent unpaid debts and fraud; the email address and password remain editable for account security. The restriction is
        lifted as soon as the Professional records the payment.
      </p>
      <h2>11. Personal data</h2>
      <p>
        The processing of personal data is described in the <Link to="/confidentialite">privacy policy</Link>, which forms part of these Terms.
      </p>
      <h2>12. Changes</h2>
      <p>
        The Terms may change to follow the service or the regulations; the update date appears at the top and significant changes are announced
        in the app. Using the Platform after a change constitutes acceptance.
      </p>
      <h2>13. Governing law and disputes</h2>
      <p>
        These Terms are governed by Algerian law, in particular Law No. 18-05 on e-commerce, Law No. 09-03 on consumer protection and fraud
        prevention, and the Civil Code. In case of difficulty, first contact support (<Mailto to={SUPPORT} />): we seek an amicable solution
        within 30 days. Failing that, the dispute falls under the competent Algerian courts; consumers may also contact the consumer protection
        services of their wilaya or an approved association.
      </p>
    </>
  );
}

export function Privacy() {
  return (
    <>
      <p>
        This policy explains what data Salon DZ collects, why, with whom it is shared and what your rights are, pursuant to Law No. 18-07 of
        10 June 2018 on the protection of natural persons in the processing of personal data.
      </p>
      <h2>Data controller</h2>
      <p>
        {EDITOR.name} ({EDITOR.legalEn}), {EDITOR.addressEn}. For any question about your data: <Mailto to={SUPPORT} />.
      </p>
      <h2>Data collected</h2>
      <ul>
        <li>Account: email address, first and last name, phone number, language, preferred catalogue, profile photo if you add one.</li>
        <li>Appointments: salon, service, team member, date and time, status, notes you leave for the salon, the person concerned if you book for someone else.</li>
        <li>Reviews: rating and comment, published under your first name and the initial of your last name.</li>
        <li>Location: only if you allow it, to show nearby salons or locate a salon; it is not stored by our servers.</li>
        <li>Professionals: business information (name, address, contact details, services, prices, opening hours, team, photos) and management data (clients, appointments, revenue calculated from appointments).</li>
        <li>Technical: your device’s notification identifiers, operating logs and error reports, without personal content.</li>
      </ul>
      <h2>Purposes and legal bases</h2>
      <ul>
        <li>Providing the service you request: creating your account, booking, confirming, reminding, moving and cancelling your appointments, managing Professionals’ calendars and clients.</li>
        <li>Allowing the Professional to recognise you and contact you about an appointment.</li>
        <li>Enforcing the rules of use (late cancellations, no-shows, abusive bookings) — legitimate interest of the Platform and of Professionals.</li>
        <li>Sending you emails and notifications related to your account and appointments. No marketing without your prior consent.</li>
        <li>Ensuring the security and proper functioning of the Platform and complying with our legal obligations.</li>
      </ul>
      <h2>Recipients</h2>
      <ul>
        <li>The Professional you book with sees your name, phone number, notes and the history of your appointments at their business — never your appointments elsewhere.</li>
        <li>Our technical providers (hosting and database, email delivery, notifications, map tiles) process data only on our behalf and according to our instructions. Some servers are located outside Algeria, in the European Union, with an adequate level of protection; this transfer is governed by Law No. 18-07.</li>
        <li>The authorities, when required by law.</li>
        <li>Your data is never sold or rented, to anyone.</li>
      </ul>
      <h2>Retention</h2>
      <ul>
        <li>Account data: as long as the account exists.</li>
        <li>Appointments: kept in your history and the Professional’s as long as the account exists; when the account is deleted, past appointments are anonymised in the salons’ history (the accounting record remains without your identity) and the rest is erased.</li>
        <li>Notifications: automatically erased after 30 days.</li>
        <li>Technical logs: a few weeks at most.</li>
      </ul>
      <h2>Your rights</h2>
      <p>
        Under Articles 32 to 36 of Law No. 18-07, you have the right to information, access, rectification, objection and erasure, as well as
        the right to withdraw your consent. From the app: Settings → My data (download a copy) and Delete my account. By email:{' '}
        <Mailto to={SUPPORT} />, answered within 30 days. You may contact the National Authority for the Protection of Personal Data (ANPDP)
        if you believe your rights are not respected.
      </p>
      <h2>Security</h2>
      <p>
        Encrypted connections, data access limited to what is strictly necessary, passwords never stored in plain text, logs without personal
        data, regular access reviews. No system is infallible: report any incident to <Mailto to={SUPPORT} />.
      </p>
      <h2>Cookies and local storage</h2>
      <p>
        The Platform uses no advertising cookies or third-party trackers. Your browser only keeps what makes the service work: your session,
        your language and your display preferences.
      </p>
      <h2>Minors</h2>
      <p>
        The service is intended for people aged 16 and over; for a minor, the legal guardian consents to the processing. An account created in
        breach of this rule is deleted on request.
      </p>
      <h2>Changes</h2>
      <p>This policy may change; the update date appears at the top and any significant change is flagged in the app.</p>
    </>
  );
}

export function LegalNotice() {
  return (
    <>
      <h2>Publisher</h2>
      <p>
        {EDITOR.name} — operated by {EDITOR.legalEn}. National register of self-employed entrepreneurs: {EDITOR.registrationNumber}. Registered
        office: {EDITOR.addressEn}. Contact: <Mailto to={CONTACT} />.
      </p>
      <h2>Publication director</h2>
      <p>{EDITOR.owner}.</p>
      <h2>Hosting</h2>
      <p>
        The Platform and its data are hosted by professional hosting providers on secure servers located in the European Union. Their contact
        details are available on request at <Mailto to={CONTACT} />.
      </p>
      <h2>Intellectual property</h2>
      <p>
        The Salon DZ name, brand, logo and interface are protected (Ordinance No. 03-05 on copyright and related rights). Salon photos and
        descriptions belong to the Professionals who publish them. Map data © OpenStreetMap contributors, under the ODbL licence.
      </p>
      <h2>Report content</h2>
      <p>
        To report unlawful content or an infringement of your rights: <Mailto to={SUPPORT} />, stating the page address and the reason. We
        acknowledge receipt and handle the report as soon as possible.
      </p>
      <h2>E-commerce</h2>
      <p>
        In accordance with Law No. 18-05 on e-commerce, the Publisher acts as a matchmaking intermediary; no sale and no payment takes place on
        the Platform. Services are sold and paid for at each Professional’s business, at the prices displayed in Algerian dinars.
      </p>
    </>
  );
}

export function DeleteAccount() {
  return (
    <>
      <p>You can delete your Salon DZ account (client or professional) at any time, directly from the app or the website, without contacting support.</p>
      <h2>From the app or the website</h2>
      <ul>
        <li>
          <strong>Client:</strong> Settings → “Delete my account”, at the bottom of the screen.
        </li>
        <li>
          <strong>Professional:</strong> Account → “Delete my account and my salon”, at the bottom of the screen.
        </li>
      </ul>
      <p>Deletion is immediate and permanent: it cannot be undone.</p>
      <h2>Without the app</h2>
      <p>
        You can also request deletion by email at <Mailto to={SUPPORT} />, from the address linked to your account. It is processed within 30
        days at the latest.
      </p>
      <h2>What is deleted</h2>
      <ul>
        <li>Your account: name, email, phone number, profile photo, preferences.</li>
        <li>For a professional who also deletes their salon: the salon page, its services, its team and its photos.</li>
        <li>Your upcoming appointments are cancelled and the people concerned are notified before deletion.</li>
        <li>Your notifications, favourites and personal notes.</li>
      </ul>
      <h2>What is kept</h2>
      <p>
        Your past appointments remain in the salon’s history, but anonymised: your name, email and number are removed, and only the record of
        the service (date, duration, amount) remains for accounting purposes. No other personal data is kept after deletion.
      </p>
      <p>
        See also the full <Link to="/confidentialite">privacy policy</Link>.
      </p>
    </>
  );
}

export const AIDE = {
  support: 'Support',
  supportSub: 'answer within 48 h',
  pro: 'Are you a professional?',
  proSub: 'opening a salon, guidance',
  autre: 'Other request',
  faq: 'Frequently asked questions',
  questions: [
    ['I didn’t receive the confirmation email.', 'Check your spam folder; the link stays valid for one hour. Otherwise, request a new one from the sign-in screen.'],
    ['How do I cancel or move an appointment?', 'From Appointments → the appointment → Cancel or Reschedule, within the deadline set by the salon.'],
    ['I don’t receive reminders.', 'They arrive on the Salon DZ app if it is installed, otherwise through the browser: accept notifications when Salon DZ asks on opening. They always remain visible in the app.'],
    ['My online booking is suspended.', 'Several late cancellations or no-shows trigger a temporary suspension, whose end date is displayed. You can always contact the salon directly.'],
    ['Changing my phone number.', 'It identifies your appointments with salons: write to support to change it once an appointment has been booked.'],
    ['Deleting my account.', 'Settings → Delete my account. Your past appointments are anonymised, the rest is erased.'],
    ['Professional: my page doesn’t appear.', 'It must be published (Account → Page published) with at least one service, opening hours and an active member.'],
    ['Professional: I don’t receive new requests.', 'Turn on notifications on this device, or install the Salon DZ Pro app: it is notified first.'],
  ] as [string, string][],
};
