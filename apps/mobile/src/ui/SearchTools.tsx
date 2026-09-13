/**
 * Recherche et filtres de la marketplace — jumelles des composants web
 * (apps/web/src/components/SearchTools.tsx) : un champ de recherche et TROIS touches
 * (Prestations, la vue opposée, Filtres). Tout ce qui est un choix vit dans un panneau.
 *
 * Le champ s'ouvre SUR PLACE sur DEUX saisies et rien d'autre — le nom du professionnel (ou
 * un mot-clé) et le lieu. L'ancien écran de recherche reposait les catégories et les filtres
 * déjà présents ici ; ne restent que les deux choses qu'on ne peut faire ailleurs : trouver
 * un professionnel par son nom, et changer de quartier pour en découvrir d'autres.
 *
 * Une seule requête de suggestions sert les deux saisies : celle qui a le focus décide des
 * rubriques montrées (prestations et salons pour la recherche, quartiers pour le lieu).
 *
 * Les filtres se règlent dans un BROUILLON et ne s'appliquent qu'à « Enregistrer » : sur
 * une liste servie par le serveur, chaque touche appliquée immédiatement relance une
 * requête et fait sauter les résultats sous le doigt.
 *
 * Un seul `Modal` à la fois : empiler deux `Modal` React Native n'est pas fiable sur iOS
 * (même raison que `ReasonField`).
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Crosshair,
  List,
  Map as MapIcon,
  MapPin,
  Scissors,
  Search,
  SlidersHorizontal,
  Tag,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useSalonSuggest } from '@salondz/api-client';
import { categoriesForMarket, type Market } from '@salondz/constants';
import {
  SORT_OPTIONS,
  pushRecentPlace,
  useLocationPrefs,
  type LocationPrefs,
  type SortKey,
} from '@/lib/prefs';
import { formatDA, formatRating, wilayaName } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';
import { C, R, SHADOW } from '@/theme/design';
import { Avatar, Button, Card, I, ListCard, Pill, Row, Tx } from './index';

const PLACEHOLDER: Record<Market, string> = {
  men: 'Barbier, coupe, barbe…',
  women: 'Coiffure, ongles, cils…',
};
/** Notes proposées : en dessous de 4, le filtre ne retire plus rien d'utile. */
const RATINGS = [4, 4.5] as const;

/** Champ de recherche : carte refermée, deux saisies ouvertes (professionnel, lieu). */
export function SearchField({
  market,
  q,
  place,
  radiusKm,
  wilaya,
  onQuery,
  shadow,
  style,
}: {
  market: Market;
  q: string;
  place: string;
  radiusKm: number;
  wilaya: number;
  /** Lancer une recherche par nom ou mot-clé (l'écran décide où elle s'affiche). */
  onQuery: (v: string) => void;
  /** Posé sur la carte, un champ blanc se perd dans les rues : l'ombre le décolle. */
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const [, setPrefs] = useLocationPrefs();
  const [open, setOpen] = useState(false);
  const [qDraft, setQDraft] = useState(q);
  const [placeDraft, setPlaceDraft] = useState('');
  const [focus, setFocus] = useState<'q' | 'place'>('q');
  useEffect(() => setQDraft(q), [q]);

  const dq = useDebounced((focus === 'q' ? qDraft : placeDraft).trim(), 250);
  const active = open && dq.length >= 2;
  const suggest = useSalonSuggest({ q: dq, gender: market, wilaya }, active);
  const data = active ? suggest.data : undefined;
  const noun = market === 'men' ? 'barbier' : 'salon';

  const field: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.cardSm,
    paddingVertical: 10,
    paddingHorizontal: 13,
  };
  const input = { flex: 1, minWidth: 0, fontSize: 14, color: C.text, padding: 0 } as const;

  const close = () => {
    setOpen(false);
    setPlaceDraft('');
    setFocus('q');
  };
  const submit = (v: string) => {
    onQuery(v.trim());
    close();
  };
  const pickPlace = (city: string, parentCity: string | null, wilayaCode: number) => {
    const label = parentCity ? `${city}, ${parentCity}` : city;
    setPrefs({ city, wilaya: wilayaCode, lat: null, lng: null, label });
    pushRecentPlace({ label, city, wilaya: wilayaCode, lat: null, lng: null });
    close();
  };

  if (!open)
    return (
      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Modifier la recherche"
        onPress={() => setOpen(true)}
        style={[field, shadow ? SHADOW.card : null, style]}
      >
        <I icon={Search} size={16} color={C.muted} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx
            size={14}
            weight={600}
            ls={-0.3}
            lh={18}
            color={q ? C.text : C.subtle}
            numberOfLines={1}
          >
            {q || PLACEHOLDER[market]}
          </Tx>
          <Tx size={12} lh={16} color={C.muted} numberOfLines={1}>
            {`${place} · ${radiusKm} km`}
          </Tx>
        </View>
      </Pressable>
    );

  return (
    <View style={[{ gap: 8 }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer"
        onPress={close}
        hitSlop={10}
        style={{ alignSelf: 'flex-start' }}
      >
        <I icon={X} size={22} />
      </Pressable>

      <View style={[field, shadow ? SHADOW.card : null]}>
        <I icon={Search} size={16} color={C.muted} />
        <TextInput
          value={qDraft}
          onChangeText={setQDraft}
          onFocus={() => setFocus('q')}
          placeholder={PLACEHOLDER[market]}
          placeholderTextColor={C.subtle}
          accessibilityLabel="Recherche"
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => submit(qDraft)}
          style={input}
        />
        {!!qDraft && (
          <Pressable
            accessibilityLabel="Effacer la recherche"
            onPress={() => setQDraft('')}
            hitSlop={8}
          >
            <Tx size={12} color={C.muted}>
              ✕
            </Tx>
          </Pressable>
        )}
      </View>

      <View style={[field, shadow ? SHADOW.card : null]}>
        <I icon={MapPin} size={16} color={C.muted} />
        <TextInput
          value={placeDraft}
          onChangeText={setPlaceDraft}
          onFocus={() => setFocus('place')}
          placeholder={place}
          placeholderTextColor={C.text}
          accessibilityLabel="Lieu"
          returnKeyType="search"
          style={input}
        />
      </View>

      {/* Suggestions de la saisie qui a le focus. */}
      {focus === 'q' && !!data && (
        <ListCard>
          {data.services.map((h) => (
            <Row key={`svc-${h.name}`} onPress={() => submit(h.name)} accessibilityLabel={h.name}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Bubble icon={Scissors} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx size={14} weight={600} lh={18} numberOfLines={1}>
                    {h.name}
                  </Tx>
                  <Tx size={12} color={C.muted} lh={16} numberOfLines={1}>
                    {`${h.salonCount} ${noun}${h.salonCount > 1 ? 's' : ''}${h.minPriceDa != null ? ` · dès ${formatDA(h.minPriceDa)}` : ''}`}
                  </Tx>
                </View>
              </View>
            </Row>
          ))}
          {data.salons.map((s) => (
            <Row key={s.id} to={`/s/${s.slug}`} accessibilityLabel={s.name}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx size={14} weight={600} lh={18} numberOfLines={1}>
                    {s.name}
                  </Tx>
                  <Tx size={12} color={C.muted} lh={16} numberOfLines={1}>
                    {[
                      s.zone ?? s.city,
                      s.ratingCount > 0 ? `★ ${formatRating(Number(s.ratingAvg))}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Tx>
                </View>
              </View>
            </Row>
          ))}
          {data.services.length === 0 && data.salons.length === 0 && (
            <Row onPress={() => submit(qDraft)} accessibilityLabel="Lancer la recherche">
              <Tx size={14} weight={600} lh={18} numberOfLines={1}>
                {`Rechercher « ${qDraft.trim()} »`}
              </Tx>
            </Row>
          )}
        </ListCard>
      )}

      {focus === 'place' && (
        <ListCard>
          {(data?.places ?? []).map((p) => (
            <Row
              key={`pl-${p.city}-${p.wilayaCode}`}
              onPress={() => pickPlace(p.city, p.parentCity, p.wilayaCode)}
              accessibilityLabel={p.city}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Bubble icon={MapPin} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx size={14} weight={600} lh={18} numberOfLines={1}>
                    {p.parentCity ? `${p.city}, ${p.parentCity}` : p.city}
                  </Tx>
                  <Tx size={12} color={C.muted} lh={16} numberOfLines={1}>
                    {`${p.salonCount} ${noun}${p.salonCount > 1 ? 's' : ''} · ${wilayaName(p.wilayaCode)}`}
                  </Tx>
                </View>
              </View>
            </Row>
          ))}
          {/* Position de l'appareil et rayon : le seul réglage de lieu qu'une saisie ne sait
              pas exprimer. */}
          <Row
            onPress={() => {
              close();
              router.push('/localisation');
            }}
            accessibilityLabel="Autour de moi"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Bubble icon={Crosshair} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx size={14} weight={600} lh={18} numberOfLines={1}>
                  Autour de moi
                </Tx>
                <Tx size={12} color={C.muted} lh={16} numberOfLines={1}>
                  {`Ma position · rayon ${radiusKm} km`}
                </Tx>
              </View>
            </View>
          </Row>
        </ListCard>
      )}
    </View>
  );
}

/** Rond gris d'une ligne de suggestion. */
function Bubble({ icon }: { icon: LucideIcon }) {
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: C.fill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <I icon={icon} size={16} />
    </View>
  );
}

/** Panneau plein écran : fermeture, titre, réinitialisation, puis « Enregistrer ». */
function Panel({
  open,
  title,
  onClose,
  onReset,
  onSave,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onReset: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={open}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 6 }}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 4 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            onPress={onClose}
            hitSlop={10}
            style={{ alignSelf: 'flex-start' }}
          >
            <I icon={X} size={22} />
          </Pressable>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <Tx size={24} weight={600} ls={-0.8} lh={28}>
              {title}
            </Tx>
            <Pressable accessibilityRole="button" onPress={onReset} hitSlop={8}>
              <Tx size={14} color={C.muted} lh={18} style={{ textDecorationLine: 'underline' }}>
                Réinitialiser
              </Tx>
            </Pressable>
          </View>
        </View>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 9 }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 12 + insets.bottom,
            backgroundColor: C.surface,
            borderTopWidth: 1,
            borderTopColor: C.line,
          }}
        >
          <Button onPress={onSave}>Enregistrer</Button>
        </View>
      </View>
    </Modal>
  );
}

/** Section repliable du panneau Filtres (le mobile n'a pas d'accordéon partagé). */
function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Card gap={0} pad={0}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          paddingVertical: 13,
          paddingHorizontal: 14,
        }}
      >
        <Tx size={16} weight={600} ls={-0.3} lh={20}>
          {title}
        </Tx>
        <I icon={open ? ChevronUp : ChevronDown} size={18} color={C.muted} />
      </Pressable>
      {open && (
        <View style={{ borderTopWidth: 1, borderTopColor: C.lineSoft, paddingHorizontal: 14 }}>
          {children}
        </View>
      )}
    </Card>
  );
}

type Draft = Pick<LocationPrefs, 'availableToday' | 'openNow' | 'ratingMin' | 'sort'>;

export function SearchTools({
  market,
  category,
  onCategory,
  view,
  onView,
  withSort = true,
  shadow,
  style,
}: {
  market: Market;
  category: string;
  onCategory: (id: string) => void;
  /** Vue affichée ; la touche du milieu mène toujours à l'AUTRE vue. */
  view: 'list' | 'map';
  onView: () => void;
  /** Le tri n'a pas de sens sur une carte : il n'y a pas de premier résultat. */
  withSort?: boolean;
  /** Posée sur la carte, une touche blanche se perd dans les rues : l'ombre la décolle. */
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [prefs, setPrefs] = useLocationPrefs();
  const [open, setOpen] = useState<'cat' | 'filters' | null>(null);
  const [catDraft, setCatDraft] = useState(category);
  const [draft, setDraft] = useState<Draft>(prefs);
  const [section, setSection] = useState<string | null>(null);

  const filterCount =
    (prefs.availableToday ? 1 : 0) +
    (prefs.openNow ? 1 : 0) +
    (prefs.ratingMin != null ? 1 : 0) +
    (withSort && prefs.sort !== 'relevance' ? 1 : 0);

  const tool = (on: boolean): StyleProp<ViewStyle> => [
    {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 9,
      paddingHorizontal: 6,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: on ? C.ink : C.line,
      borderRadius: R.pill,
    },
    shadow ? SHADOW.card : null,
  ];

  return (
    <>
      <View style={[{ flexDirection: 'row', gap: 7 }, style]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Prestations"
          onPress={() => {
            setCatDraft(category);
            setOpen('cat');
          }}
          style={tool(!!category)}
        >
          <I icon={Tag} size={14} color={C.muted} />
          <Tx size={13} weight={600} ls={-0.2} lh={16}>
            Prestations
          </Tx>
          {!!category && <Count n={1} />}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={view === 'list' ? 'Carte' : 'Liste'}
          onPress={onView}
          style={tool(false)}
        >
          <I icon={view === 'list' ? MapIcon : List} size={14} color={C.muted} />
          <Tx size={13} weight={600} ls={-0.2} lh={16}>
            {view === 'list' ? 'Carte' : 'Liste'}
          </Tx>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filtres"
          onPress={() => {
            setDraft(prefs);
            setSection(null);
            setOpen('filters');
          }}
          style={tool(filterCount > 0)}
        >
          <I icon={SlidersHorizontal} size={14} color={C.muted} />
          <Tx size={13} weight={600} ls={-0.2} lh={16}>
            Filtres
          </Tx>
          {filterCount > 0 && <Count n={filterCount} />}
        </Pressable>
      </View>

      <Panel
        open={open === 'cat'}
        title="Prestations"
        onClose={() => setOpen(null)}
        onReset={() => setCatDraft('')}
        onSave={() => {
          onCategory(catDraft);
          setOpen(null);
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {categoriesForMarket(market).map((c) => (
            <Pill
              key={c.id}
              lg
              on={catDraft === c.id}
              onPress={() => setCatDraft(catDraft === c.id ? '' : c.id)}
            >
              {c.labelFr}
            </Pill>
          ))}
        </View>
      </Panel>

      <Panel
        open={open === 'filters'}
        title="Filtres"
        onClose={() => setOpen(null)}
        onReset={() =>
          setDraft({ availableToday: false, openNow: false, ratingMin: null, sort: 'relevance' })
        }
        onSave={() => {
          setPrefs(draft);
          setOpen(null);
        }}
      >
        <Section
          title="Disponibilités"
          open={section === 'dispo'}
          onToggle={() => setSection(section === 'dispo' ? null : 'dispo')}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 12 }}>
            <Pill
              lg
              on={draft.availableToday}
              onPress={() => setDraft({ ...draft, availableToday: !draft.availableToday })}
            >
              Disponible aujourd&apos;hui
            </Pill>
            <Pill
              lg
              on={draft.openNow}
              onPress={() => setDraft({ ...draft, openNow: !draft.openNow })}
            >
              Ouvert maintenant
            </Pill>
          </View>
        </Section>

        <Section
          title="Note"
          open={section === 'note'}
          onToggle={() => setSection(section === 'note' ? null : 'note')}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 12 }}>
            {RATINGS.map((r) => (
              <Pill
                key={r}
                lg
                on={draft.ratingMin === r}
                onPress={() => setDraft({ ...draft, ratingMin: draft.ratingMin === r ? null : r })}
              >
                {`${r.toFixed(1).replace('.', ',')} et plus`}
              </Pill>
            ))}
          </View>
        </Section>

        {withSort && (
          <Section
            title="Trier par"
            open={section === 'sort'}
            onToggle={() => setSection(section === 'sort' ? null : 'sort')}
          >
            <View>
              {SORT_OPTIONS.map((o, i) => (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: draft.sort === o.value }}
                  accessibilityLabel={o.label}
                  onPress={() => setDraft({ ...draft, sort: o.value as SortKey })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    paddingVertical: 12,
                    borderBottomWidth: i === SORT_OPTIONS.length - 1 ? 0 : 1,
                    borderBottomColor: C.lineSoft,
                  }}
                >
                  <Tx size={14} weight={600} lh={18}>
                    {o.label}
                  </Tx>
                  {draft.sort === o.value && <I icon={Check} size={16} />}
                </Pressable>
              ))}
            </View>
          </Section>
        )}
      </Panel>
    </>
  );
}

/** Compteur de filtres actifs : sans lui, un réglage rangé dans un panneau devient invisible. */
function Count({ n }: { n: number }) {
  return (
    <View
      style={{
        minWidth: 16,
        height: 16,
        paddingHorizontal: 4,
        borderRadius: R.pill,
        backgroundColor: C.ink,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Tx size={12} weight={700} color={C.onInk} lh={14}>
        {String(n)}
      </Tx>
    </View>
  );
}
