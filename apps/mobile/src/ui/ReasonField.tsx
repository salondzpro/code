/**
 * Choix d'un motif dans une liste, à l'intérieur d'une feuille déjà ouverte.
 *
 * Pourquoi pas `PickerSheet` ici : `ModalSheet` repose sur le `Modal` de React Native, et
 * empiler deux modals est peu fiable sur iOS (le second n'apparaît pas, ou fermer l'un ferme
 * l'autre). On reste donc dans UNE seule feuille, en deux temps : une ligne « Motif » qui
 * affiche le choix courant, et au tap la même feuille montre la liste puis revient.
 *
 * Effet secondaire utile : la feuille garde sa hauteur compacte, la liste ne s'ajoute pas
 * sous le reste du contenu.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { C, R } from '@/theme/design';
import { Card, I, Tx } from './index';

export function ReasonField({
  reasons,
  value,
  onChange,
  title,
  label = 'Motif (optionnel)',
}: {
  reasons: readonly string[];
  value: string;
  onChange: (v: string) => void;
  /** Question affichée au-dessus de la liste, ex. « Pourquoi refuser ? ». */
  title: string;
  label?: string;
}) {
  const [picking, setPicking] = useState(false);

  if (picking)
    return (
      <View style={{ gap: 8 }}>
        <Tx size={14} weight={700} ls={-0.3} lh={17} center>
          {title}
        </Tx>
        <Card gap={0} style={{ paddingVertical: 2 }}>
          {reasons.map((r, i) => {
            const on = r === value;
            return (
              <Pressable
                key={r}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  onChange(r);
                  setPicking(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  paddingVertical: 11,
                  borderBottomWidth: i === reasons.length - 1 ? 0 : 1,
                  borderBottomColor: C.lineSoft,
                }}
              >
                <Tx size={14} weight={600} lh={16}>
                  {r}
                </Tx>
                {on && <I icon={Check} size={16} />}
              </Pressable>
            );
          })}
        </Card>
      </View>
    );

  return (
    <Card row style={{ paddingVertical: 10, justifyContent: 'space-between' }}>
      <Tx size={12} lh={16}>
        {label}
      </Tx>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={() => setPicking(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          borderRadius: R.pill,
        }}
      >
        <Tx size={12} weight={600} color={value ? C.text : C.subtle} lh={16}>
          {value || 'Choisir'}
        </Tx>
        <I icon={ChevronDown} size={14} color={C.muted} />
      </Pressable>
    </Card>
  );
}
