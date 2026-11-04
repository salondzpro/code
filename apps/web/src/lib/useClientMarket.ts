/**
 * Marché affiché (hommes / femmes). Un compte le garde sur son profil ; un visiteur sans compte le
 * garde sur l'appareil, et il le retrouve sur son profil à l'inscription (`ProfileSetup`).
 */
import { useSyncExternalStore } from 'react';
import { useMe, useUpdateProfile } from '@salondz/api-client';
import type { Market } from '@salondz/constants';
import { useAuth } from './auth';

const KEY = 'salondz:market';
const listeners = new Set<() => void>();

export function guestMarket(): Market | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'men' || v === 'women' ? v : null;
  } catch {
    return null;
  }
}

export function setGuestMarket(market: Market): void {
  try {
    localStorage.setItem(KEY, market);
  } catch {
    /* navigation privée : le choix vaut pour cet écran seulement */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useClientMarket(): {
  market: Market;
  setMarket: (market: Market) => void;
  /** Faux tant que le profil d'un compte connecté n'est pas chargé. */
  ready: boolean;
} {
  const { session } = useAuth();
  const me = useMe(!!session);
  const update = useUpdateProfile();
  const guest = useSyncExternalStore(subscribe, guestMarket, () => null);
  return {
    market: (session ? me.data?.profile.market : guest) ?? 'women',
    setMarket: (market) => (session ? update.mutate({ market }) : setGuestMarket(market)),
    ready: !session || !!me.data,
  };
}
