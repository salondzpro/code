import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBookingSchema, openingHourSchema, phoneDZ, searchSalonsQuerySchema } from './index.ts';

test('phoneDZ normalise en E.164', () => {
  assert.equal(phoneDZ.parse('05 51 23 45 67'), '+213551234567');
  assert.equal(phoneDZ.parse('+213 661 23 45 67'), '+213661234567');
  assert.equal(phoneDZ.parse('00213771234567'), '+213771234567');
  assert.throws(() => phoneDZ.parse('0812345678'));
  assert.throws(() => phoneDZ.parse('+33612345678'));
});

test('openingHourSchema refuse fermeture avant ouverture', () => {
  assert.throws(() => openingHourSchema.parse({ dayOfWeek: 0, opensAt: '19:00', closesAt: '09:00' }));
  assert.ok(openingHourSchema.parse({ dayOfWeek: 0, opensAt: '09:00', closesAt: '19:00' }));
});

test('createBookingSchema exige un ISO avec offset', () => {
  assert.throws(() =>
    createBookingSchema.parse({
      salonId: '2f1e3d1a-1111-4111-8111-111111111111',
      serviceId: '2f1e3d1a-1111-4111-8111-111111111112',
      startsAt: '2026-09-07T10:00:00',
    }),
  );
  assert.ok(
    createBookingSchema.parse({
      salonId: '2f1e3d1a-1111-4111-8111-111111111111',
      serviceId: '2f1e3d1a-1111-4111-8111-111111111112',
      startsAt: '2026-09-07T10:00:00+01:00',
    }),
  );
});

test('searchSalonsQuerySchema coerce les nombres', () => {
  const q = searchSalonsQuerySchema.parse({ wilaya: '16', limit: '5' });
  assert.equal(q.wilaya, 16);
  assert.equal(q.limit, 5);
  assert.equal(q.offset, 0);
});
