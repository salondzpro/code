/**
 * C-H 01 / C-F 01 — Marketplace « Pour Hommes » / « Pour Femmes » : localisation, recherche,
 * catégories (filtres), Liste/Carte, tri, résultats. C-H 05 — feuille « Trier par ». C-H 08 — aucun résultat.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeftRight, Check, ChevronDown, List, Map as MapIcon, MapPin, Search } from 'lucide-react-native';
import { useMe, useSalonSearch, useUpdateProfile } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoriesForMarket, categoryLabel, type CategoryId, type Market } from '@salondz/constants';
import { SORT_OPTIONS, useLocationPrefs, type SortKey } from '@/lib/prefs';
import { Avatar, Button, ErrorText, H1, I, IconButton, ListCard, ModalSheet, P, Pill, Row, Skeleton, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { PillRow } from '@/ui/Pills';
import { SalonListCard } from '@/ui/SalonListCard';
import { C, NAV_PAD, R, SHADOW } from '@/theme/design';

const PLACEHOLDER: Record<Market, string> = { men: 'Barbier, coupe, barbe…', women: 'Coiffure, ongles, cils…' };
const NOUN: Record<Market, [string, string]> = { men: ['barbier', 'barbiers'], women: ['salon', 'salons'] };

export default function Marketplace() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  const me = useMe();
  const update = useUpdateProfile();
  const [prefs, setPrefs] = useLocationPrefs();
  const market: Market = me.data?.profile.market ?? 'women';
  const q = params.q ?? '';
  const [category, setCategory] = useState<string>(params.category ?? '');
  const [sortOpen, setSortOpen] = useState(false);
  const [sortDraft, setSortDraft] = useState<SortKey>(prefs.sort);

  const query = useSalonSearch({
    q: q || undefined,
    gender: market,
    category: category ? (category as CategoryId) : undefined,
    city: prefs.city ?? undefined,
    wilaya: prefs.city ? undefined : prefs.wilaya,
    lat: prefs.lat ?? undefined,
    lng: prefs.lng ?? undefined,
    radiusKm: prefs.lat != null ? prefs.radiusKm : undefined,
    sort: prefs.sort,
    limit: 30,
  });

  const toggleCategory = (id: string) => setCategory((cur) => (cur === id ? '' : id));
  const swapMarket = () => update.mutate({ market: market === 'men' ? 'women' : 'men' });
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? items.length;
  const noun = NOUN[market][total > 1 ? 1 : 0];
  const sortLabel = SORT_OPTIONS.find((o) => o.value === prefs.sort)?.label ?? 'Sans préférence';

  return (
    <Screen gap={14} bottom={NAV_PAD} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {/* En-tête : localisation, titre + bascule, avatar */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/localisation')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <I icon={MapPin} size={18} color={C.muted} />
            <Tx size={17} lh={22} numberOfLines={1} style={{ flexShrink: 1 }}>
              {prefs.label}
            </Tx>
            <Tx size={17} lh={22} color={C.muted}>
              · {prefs.radiusKm} km
            </Tx>
            <I icon={ChevronDown} size={16} color={C.subtle} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <H1 size={34} lh={38} ls={-0.8}>
              {MARKET_LABELS_FR[market]}
            </H1>
            <IconButton accessibilityLabel="Changer de marché" onPress={swapMarket} disabled={update.isPending} style={{ width: 36, height: 36, borderRadius: 12 }}>
              <I icon={ArrowLeftRight} size={16} />
            </IconButton>
          </View>
        </View>
        <Pressable accessibilityRole="link" accessibilityLabel="Profil" onPress={() => router.push('/(client)/(tabs)/profil')} style={{ marginTop: 4 }}>
          <Avatar src={me.data?.profile.avatarUrl} name={me.data?.profile.fullName ?? 'Moi'} size={40} />
        </Pressable>
      </View>

      {/* Recherche */}
      <Pressable accessibilityRole="search" accessibilityLabel="Rechercher" onPress={() => router.push('/recherche')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.fill, borderRadius: R.cardSm, paddingVertical: 15, paddingHorizontal: 16 }}>
        <I icon={Search} size={22} color={C.subtle} />
        <Tx size={16} lh={20} color={q ? C.text : C.subtle} style={{ flex: 1 }} numberOfLines={1}>
          {q || PLACEHOLDER[market]}
        </Tx>
        {!!q && (
          <Pressable accessibilityLabel="Effacer la recherche" onPress={() => router.setParams({ q: '' })} hitSlop={8}>
            <Tx size={15} color={C.muted}>
              ✕
            </Tx>
          </Pressable>
        )}
      </Pressable>

      {/* Catégories = filtres */}
      <PillRow>
        {categoriesForMarket(market).map((c) => (
          <Pill key={c.id} lg on={category === c.id} onPress={() => toggleCategory(c.id)}>
            {c.labelFr}
          </Pill>
        ))}
      </PillRow>

      {/* Liste / Carte + tri */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flexDirection: 'row', backgroundColor: C.fill, borderRadius: 16, padding: 4, gap: 2 }}>
          <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: C.surface }, SHADOW.seg]} accessibilityState={{ selected: true }}>
            <I icon={List} size={17} />
            <Tx size={16} weight={600} lh={20}>
              Liste
            </Tx>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/carte', params: category ? { category } : {} })} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 }}>
            <I icon={MapIcon} size={17} color={C.muted} />
            <Tx size={16} weight={500} lh={20} color={C.muted}>
              Carte
            </Tx>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setSortOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.btn, paddingVertical: 12, paddingHorizontal: 14 }}>
          <Tx size={16} color={C.muted} lh={20}>
            ⇅
          </Tx>
          <Tx size={16} weight={500} lh={20} numberOfLines={1} style={{ flexShrink: 1 }}>
            {sortLabel}
          </Tx>
          <I icon={ChevronDown} size={16} color={C.subtle} />
        </Pressable>
      </View>

      {/* Résultats */}
      {query.isPending ? (
        <View style={{ gap: 12 }}>
          <Skeleton h={20} w={224} />
          <Skeleton h={380} radius={20} />
          <Skeleton h={200} radius={20} />
        </View>
      ) : query.isError ? (
        <ErrorText error={query.error} retry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingTop: 64 }}>
          <View style={{ width: 128, height: 128, borderRadius: 64, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}>
            <I icon={Search} size={44} color={C.subtle} />
          </View>
          <Tx size={24} weight={700} ls={-0.4} lh={28} center style={{ marginTop: 8 }}>
            Aucun professionnel{category ? ` « ${categoryLabel(category as CategoryId)} »` : ''} à {prefs.label}
          </Tx>
          <P center>Essayez d'élargir le rayon ou de retirer un filtre.</P>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 8 }}>
            {prefs.radiusKm < 10 && (
              <Pill lg onPress={() => setPrefs({ radiusKm: 10 })}>
                Rayon 10 km
              </Pill>
            )}
            {!!category && (
              <Pill lg onPress={() => setCategory('')}>
                Retirer « {categoryLabel(category as CategoryId).split(' ')[0]} »
              </Pill>
            )}
            <Pill lg onPress={() => router.push('/localisation')}>
              Autres quartiers
            </Pill>
          </View>
        </View>
      ) : (
        <>
          <Tx size={17} color={C.muted} lh={22}>
            {total} {noun} disponible{total > 1 ? 's' : ''} aujourd'hui
          </Tx>
          <View style={{ gap: 14 }}>
            {items.map((s, i) => (
              <SalonListCard key={s.id} salon={s} large={i === 0} />
            ))}
          </View>
        </>
      )}

      {/* C-H 05 — Trier par */}
      <ModalSheet open={sortOpen} onClose={() => setSortOpen(false)}>
        <Tx size={22} weight={600} ls={-0.3} lh={27} center>
          Trier par
        </Tx>
        <ListCard>
          {SORT_OPTIONS.map((o) => (
            <Row key={o.value} onPress={() => setSortDraft(o.value)} chevron={false} right={sortDraft === o.value ? <I icon={Check} size={20} /> : undefined} accessibilityLabel={o.label}>
              <Tx size={20} weight={600} lh={25}>
                {o.label}
              </Tx>
              <P>{o.hint}</P>
            </Row>
          ))}
        </ListCard>
        <Button
          onPress={() => {
            setPrefs({ sort: sortDraft });
            setSortOpen(false);
          }}
        >
          Appliquer
        </Button>
      </ModalSheet>
    </Screen>
  );
}
