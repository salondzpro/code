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
  // Compteur honnête : « disponibles aujourd'hui » seulement si des créneaux du jour existent dans la page.
  const todayCount = items.filter((x) => x.nextSlots.length > 0).length;
  const countLabel =
    todayCount > 0
      ? `${todayCount} ${NOUN[market][todayCount > 1 ? 1 : 0]} disponible${todayCount > 1 ? 's' : ''} aujourd'hui`
      : `${total} ${noun} · prochaines disponibilités ci-dessous`;
  const sortLabel = SORT_OPTIONS.find((o) => o.value === prefs.sort)?.label ?? 'Sans préférence';

  return (
    <Screen gap={11} bottom={NAV_PAD} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {/* En-tête : localisation, titre + bascule, avatar */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/localisation')} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <I icon={MapPin} size={14.5} color={C.muted} />
            <Tx size={10.5} lh={14.5} numberOfLines={1} style={{ flexShrink: 1 }}>
              {prefs.label}
            </Tx>
            <Tx size={10.5} lh={14.5} color={C.muted}>
              · {prefs.radiusKm} km
            </Tx>
            <I icon={ChevronDown} size={13} color={C.subtle} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <H1 size={23} lh={26} ls={-0.8}>
              {MARKET_LABELS_FR[market]}
            </H1>
            <IconButton accessibilityLabel="Changer de marché" onPress={swapMarket} disabled={update.isPending} style={{ width: 29, height: 29, borderRadius: 10 }}>
              <I icon={ArrowLeftRight} size={13} />
            </IconButton>
          </View>
        </View>
        <Pressable accessibilityRole="link" accessibilityLabel="Profil" onPress={() => router.push('/(client)/(tabs)/profil')} style={{ marginTop: 3 }}>
          <Avatar src={me.data?.profile.avatarUrl} name={me.data?.profile.fullName ?? 'Moi'} size={32.5} />
        </Pressable>
      </View>

      {/* Recherche */}
      <Pressable accessibilityRole="search" accessibilityLabel="Rechercher" onPress={() => router.push('/recherche')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.fill, borderRadius: R.cardSm, paddingVertical: 12, paddingHorizontal: 13 }}>
        <I icon={Search} size={18} color={C.subtle} />
        <Tx size={10.5} lh={14} color={q ? C.text : C.subtle} style={{ flex: 1 }} numberOfLines={1}>
          {q || PLACEHOLDER[market]}
        </Tx>
        {!!q && (
          <Pressable accessibilityLabel="Effacer la recherche" onPress={() => router.setParams({ q: '' })} hitSlop={8}>
            <Tx size={12} color={C.muted}>
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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', backgroundColor: C.fill, borderRadius: 13, padding: 3, gap: 2 }}>
          <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11, backgroundColor: C.surface }, SHADOW.seg]} accessibilityState={{ selected: true }}>
            <I icon={List} size={14} />
            <Tx size={10.5} weight={600} lh={14}>
              Liste
            </Tx>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/carte', params: category ? { category } : {} })} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11 }}>
            <I icon={MapIcon} size={14} color={C.muted} />
            <Tx size={10.5} weight={500} lh={14} color={C.muted}>
              Carte
            </Tx>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setSortOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, minWidth: 0, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.btn, paddingVertical: 10, paddingHorizontal: 11 }}>
          <Tx size={10.5} color={C.muted} lh={14}>
            ⇅
          </Tx>
          <Tx size={10.5} weight={500} lh={14} numberOfLines={1} style={{ flexShrink: 1 }}>
            {sortLabel}
          </Tx>
          <I icon={ChevronDown} size={13} color={C.subtle} />
        </Pressable>
      </View>

      {/* Résultats */}
      {query.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton h={16} w={182} />
          <Skeleton h={309} radius={16} />
          <Skeleton h={162} radius={16} />
        </View>
      ) : query.isError ? (
        <ErrorText error={query.error} retry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 10, paddingHorizontal: 6, paddingTop: 52 }}>
          <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}>
            <I icon={Search} size={36} color={C.subtle} />
          </View>
          <Tx size={16} weight={700} ls={-0.4} lh={19.5} center style={{ marginTop: 6 }}>
            Aucun professionnel{category ? ` « ${categoryLabel(category as CategoryId)} »` : ''} à {prefs.label}
          </Tx>
          <P center>Essayez d'élargir le rayon ou de retirer un filtre.</P>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 6 }}>
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
          <Tx size={10.5} color={C.muted} lh={14.5}>
            {countLabel}
          </Tx>
          <View style={{ gap: 11 }}>
            {items.map((s, i) => (
              <SalonListCard key={s.id} salon={s} large={i === 0} />
            ))}
          </View>
        </>
      )}

      {/* C-H 05 — Trier par */}
      <ModalSheet open={sortOpen} onClose={() => setSortOpen(false)}>
        <Tx size={14.5} weight={600} ls={-0.3} lh={18.5} center>
          Trier par
        </Tx>
        <ListCard>
          {SORT_OPTIONS.map((o) => (
            <Row key={o.value} onPress={() => setSortDraft(o.value)} chevron={false} right={sortDraft === o.value ? <I icon={Check} size={16} /> : undefined} accessibilityLabel={o.label}>
              <Tx size={13} weight={600} lh={17}>
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
