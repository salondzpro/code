/**
 * C-H 07 — Recherche : contexte conservé (marché, catégorie, quartier), suggestions, recherches récentes.
 * Interactive : dès deux caractères, suggestions typées (catégories, prestations, salons, lieux) servies par
 * l'API en une requête, retardées de 250 ms ; les puces « Aujourd'hui » et « Note 4,5+ » sont de vrais filtres.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Clock, MapPin, Scissors, Search, Tag } from 'lucide-react-native';
import { useMe, useSalonSuggest } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoriesForMarket, categoryLabel, formatDA, wilayaName } from '@salondz/constants';
import { clearRecentSearches, pushRecentPlace, pushRecentSearch, useLocationPrefs, useRecentSearches } from '@/lib/prefs';
import { useDebounced } from '@/lib/useDebounced';
import { formatRating } from '@/lib/format';
import { Avatar, I, ListCard, P, Pill, Row, S, SearchBox, SectionLabel, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { PillRow } from '@/ui/Pills';
import { C } from '@/theme/design';

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function Icon({ icon, ink }: { icon: typeof Scissors; ink?: boolean }) {
  return (
    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: ink ? C.ink : C.fill, alignItems: 'center', justifyContent: 'center' }}>
      <I icon={icon} size={14.5} color={ink ? C.onInk : C.text} />
    </View>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const me = useMe();
  const market = me.data?.profile.market ?? 'women';
  const [prefs, setPrefs] = useLocationPrefs();
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 250);
  const recent = useRecentSearches();
  const active = dq.length >= 2;
  const suggest = useSalonSuggest({ q: dq, gender: market, wilaya: prefs.wilaya }, active);
  const data = suggest.data;
  const categoryHits = useMemo(() => (active ? categoriesForMarket(market).filter((c) => normalize(c.labelFr).includes(normalize(dq))).slice(0, 3) : []), [active, dq, market]);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v) return;
    pushRecentSearch(v);
    router.replace({ pathname: '/(client)/(tabs)', params: { q: v } });
  };
  const goCategory = (id: string) => router.replace({ pathname: '/(client)/(tabs)', params: { category: id } });
  const goPlace = (city: string, parentCity: string | null, wilaya: number) => {
    const label = parentCity ? `${city}, ${parentCity}` : city;
    setPrefs({ city, wilaya, lat: null, lng: null, label });
    pushRecentPlace({ label, city, wilaya, lat: null, lng: null });
    router.replace('/(client)/(tabs)');
  };

  const noun = market === 'men' ? 'barbier' : 'salon';
  const totalHits = (data?.salons.length ?? 0) + (data?.services.length ?? 0) + (data?.places.length ?? 0) + categoryHits.length;
  const nothing = active && !suggest.isPending && totalHits === 0;
  const right = <I icon={ChevronRight} size={14.5} color={C.disabled} />;

  return (
    <Screen gap={11}>
      <TopBar backTo="/(client)/(tabs)" right={MARKET_LABELS_FR[market]} />
      <SearchBox value={q} onChange={setQ} placeholder={market === 'men' ? 'Barbier, coupe, barbe…' : 'Coiffure, ongles, cils…'} onSubmit={() => submit(q)} autoFocus />
      <PillRow>
        <Pill soft>{MARKET_LABELS_FR[market].replace('Pour ', '')}</Pill>
        <Pill soft onPress={() => router.push('/localisation')}>
          <I icon={MapPin} size={12} color={C.text} />
          <Tx size={10.5} weight={500} lh={14}>
            {prefs.label}
          </Tx>
        </Pill>
        <Pill soft on={prefs.ratingMin != null} onPress={() => setPrefs({ ratingMin: prefs.ratingMin ? null : 4.5 })}>
          Note 4,5+
        </Pill>
        <Pill soft on={prefs.availableToday} onPress={() => setPrefs({ availableToday: !prefs.availableToday })}>
          Aujourd'hui
        </Pill>
      </PillRow>

      {active ? (
        <>
          <SectionLabel right={<S>{suggest.isFetching ? 'Recherche…' : `${totalHits} suggestions`}</S>}>Suggestions</SectionLabel>
          <ListCard>
            {categoryHits.map((c) => (
              <Row key={`cat-${c.id}`} onPress={() => goCategory(c.id)} chevron={false} right={right} accessibilityLabel={c.labelFr}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <Icon icon={Tag} ink />
                  <View style={{ flex: 1 }}>
                    <Tx size={10.5} weight={500} lh={14.5}>
                      {c.labelFr}
                    </Tx>
                    <S>Catégorie</S>
                  </View>
                </View>
              </Row>
            ))}
            {(data?.services ?? []).map((h) => (
              <Row key={`svc-${h.name}`} onPress={() => submit(h.name)} chevron={false} right={right} accessibilityLabel={h.name}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <Icon icon={Scissors} />
                  <View style={{ flex: 1 }}>
                    <Tx size={10.5} weight={500} lh={14.5}>
                      {h.name}
                    </Tx>
                    <S>
                      Prestation · {h.salonCount} {noun}
                      {h.salonCount > 1 ? 's' : ''}
                      {h.minPriceDa != null ? ` · dès ${formatDA(h.minPriceDa)}` : ''}
                    </S>
                  </View>
                </View>
              </Row>
            ))}
            {(data?.salons ?? []).map((s) => (
              <Row key={s.id} to={`/s/${s.slug}`} chevron={false} right={right} accessibilityLabel={s.name}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={32.5} />
                  <View style={{ flex: 1 }}>
                    <Tx size={10.5} weight={500} lh={14.5}>
                      {s.name}
                    </Tx>
                    <S>
                      {s.zone ?? s.city}
                      {s.ratingCount > 0 ? ` · ★ ${formatRating(Number(s.ratingAvg))}` : ''}
                      {s.categoryId ? ` · ${categoryLabel(s.categoryId)}` : ''}
                    </S>
                  </View>
                </View>
              </Row>
            ))}
            {(data?.places ?? []).map((p) => (
              <Row key={`pl-${p.city}-${p.wilayaCode}`} onPress={() => goPlace(p.city, p.parentCity, p.wilayaCode)} chevron={false} right={right} accessibilityLabel={p.city}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <Icon icon={MapPin} />
                  <View style={{ flex: 1 }}>
                    <Tx size={10.5} weight={500} lh={14.5}>
                      {p.parentCity ? `${p.city}, ${p.parentCity}` : p.city}
                    </Tx>
                    <S>
                      Lieu · {p.salonCount} {noun}
                      {p.salonCount > 1 ? 's' : ''} · {wilayaName(p.wilayaCode)}
                    </S>
                  </View>
                </View>
              </Row>
            ))}
            {nothing && (
              <Row onPress={() => submit(q)} chevron={false} right={right} accessibilityLabel={`Rechercher ${q.trim()}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <Icon icon={Search} />
                  <View style={{ flex: 1 }}>
                    <Tx size={10.5} weight={500} lh={14.5}>
                      Rechercher « {q.trim()} »
                    </Tx>
                    <S>Aucune suggestion · lancer la recherche dans toute la marketplace</S>
                  </View>
                </View>
              </Row>
            )}
          </ListCard>
        </>
      ) : (
        <>
          {recent.length > 0 && (
            <>
              <SectionLabel
                right={
                  <Pressable accessibilityRole="button" onPress={clearRecentSearches}>
                    <Tx size={12} color={C.muted}>
                      Effacer
                    </Tx>
                  </Pressable>
                }
              >
                Recherches récentes
              </SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {recent.map((r) => (
                  <Pill key={r} lg onPress={() => submit(r)}>
                    <I icon={Clock} size={13} color={C.subtle} />
                    <Tx size={10.5} weight={500} lh={14}>
                      {r}
                    </Tx>
                  </Pill>
                ))}
              </View>
            </>
          )}
          <SectionLabel>Catégories</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {categoriesForMarket(market).map((c) => (
              <Pill key={c.id} lg onPress={() => goCategory(c.id)}>
                {c.labelFr}
              </Pill>
            ))}
          </View>
          {!recent.length && <P>Tapez une prestation, un salon ou un lieu.</P>}
        </>
      )}
    </Screen>
  );
}
