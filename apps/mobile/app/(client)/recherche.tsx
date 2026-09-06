/** C-H 07 — Recherche : contexte conservé (marché, catégorie, quartier), suggestions, recherches récentes. */
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Clock, Scissors } from 'lucide-react-native';
import { useMe, useSalonSearch } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoryLabel } from '@salondz/constants';
import { clearRecentSearches, pushRecentSearch, useLocationPrefs, useRecentSearches } from '@/lib/prefs';
import { formatRating } from '@/lib/format';
import { Avatar, I, ListCard, P, Pill, Row, S, SearchBox, SectionLabel, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { PillRow } from '@/ui/Pills';
import { C } from '@/theme/design';

export default function SearchPage() {
  const router = useRouter();
  const me = useMe();
  const market = me.data?.profile.market ?? 'women';
  const [prefs] = useLocationPrefs();
  const [q, setQ] = useState('');
  const recent = useRecentSearches();
  const results = useSalonSearch({ q: q.trim() || undefined, gender: market, city: prefs.city ?? undefined, wilaya: prefs.city ? undefined : prefs.wilaya, lat: prefs.lat ?? undefined, lng: prefs.lng ?? undefined, limit: 8 }, q.trim().length >= 2);
  const items = results.data?.items ?? [];

  /** Suggestions « Prestation · N salons » : prestations phares dont le nom contient la saisie. */
  const serviceHits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [] as { name: string; count: number }[];
    const map = new Map<string, number>();
    for (const s of items) for (const t of s.topServices) if (t.name.toLowerCase().includes(needle)) map.set(t.name, (map.get(t.name) ?? 0) + 1);
    return [...map.entries()].map(([name, count]) => ({ name, count })).slice(0, 4);
  }, [items, q]);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v) return;
    pushRecentSearch(v);
    router.replace({ pathname: '/(client)/(tabs)', params: { q: v } });
  };

  return (
    <Screen gap={14}>
      <TopBar backTo="/(client)/(tabs)" right={MARKET_LABELS_FR[market]} />
      <SearchBox value={q} onChange={setQ} placeholder={market === 'men' ? 'Barbier, coupe, barbe…' : 'Coiffure, ongles, cils…'} onSubmit={() => submit(q)} autoFocus />
      <PillRow>
        <Pill soft>{MARKET_LABELS_FR[market].replace('Pour ', '')}</Pill>
        <Pill soft>{prefs.label}</Pill>
        <Pill soft>Note 4,5+</Pill>
        <Pill soft>Aujourd'hui</Pill>
      </PillRow>

      {q.trim().length >= 2 ? (
        <>
          <SectionLabel right={<S>{results.data?.total ?? 0} résultats</S>}>Suggestions</SectionLabel>
          <ListCard>
            {serviceHits.map((h) => (
              <Row key={h.name} onPress={() => submit(h.name)} chevron={false} right={<I icon={ChevronRight} size={18} color={C.disabled} />}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}>
                    <I icon={Scissors} size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Tx size={17} weight={500} lh={22}>
                      {h.name}
                    </Tx>
                    <S>
                      Prestation · {h.count} {market === 'men' ? 'barbier' : 'salon'}
                      {h.count > 1 ? 's' : ''}
                    </S>
                  </View>
                </View>
              </Row>
            ))}
            {items.map((s) => (
              <Row key={s.id} to={`/s/${s.slug}`} chevron={false} right={<I icon={ChevronRight} size={18} color={C.disabled} />}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Tx size={17} weight={500} lh={22}>
                      {s.name}
                    </Tx>
                    <S>
                      {s.zone ?? s.city}
                      {s.ratingCount > 0 ? ` · ${formatRating(s.ratingAvg)}` : ''}
                      {s.categoryIds[0] ? ` · ${categoryLabel(s.categoryIds[0])}` : ''}
                    </S>
                  </View>
                </View>
              </Row>
            ))}
            {!results.isPending && items.length === 0 && serviceHits.length === 0 && (
              <View style={{ paddingVertical: 12 }}>
                <P>Aucune suggestion.</P>
              </View>
            )}
          </ListCard>
        </>
      ) : (
        recent.length > 0 && (
          <>
            <SectionLabel
              right={
                <Pressable accessibilityRole="button" onPress={clearRecentSearches}>
                  <Tx size={15} color={C.muted}>
                    Effacer
                  </Tx>
                </Pressable>
              }
            >
              Recherches récentes
            </SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {recent.map((r) => (
                <Pill key={r} lg onPress={() => submit(r)}>
                  <I icon={Clock} size={16} color={C.subtle} />
                  <Tx size={16} weight={500} lh={20}>
                    {r}
                  </Tx>
                </Pill>
              ))}
            </View>
          </>
        )
      )}
    </Screen>
  );
}
