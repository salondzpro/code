/**
 * « Signaler » sous un avis (même geste que sur le site : le bouton, puis UN motif).
 *
 * Un avis est du contenu écrit par un utilisateur et publié à la vue de tous : Apple (1.2) et Google Play
 * attendent qu'on puisse le signaler. Le signalement ne masque rien à lui seul — un opérateur décide — et ne
 * dit jamais à l'auteur qu'on l'a signalé. Sans compte, on est renvoyé à la connexion : un signalement
 * anonyme ne pourrait ni être limité ni être suivi.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle2, Flag } from 'lucide-react-native';
import { useReportReview } from '@salondz/api-client';
import { REPORT_REASONS, REPORT_REASON_LABELS_FR, type ReportReason } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { Alert, Button, H2, I, ListCard, ModalSheet, P, Row, Tx } from './index';
import { C } from '@/theme/design';

export function ReportReviewButton({ reviewId }: { reviewId: string }) {
  const { session } = useAuth();
  const router = useRouter();
  const report = useReportReview();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  const start = () => {
    if (!session) {
      router.push('/connexion');
      return;
    }
    report.reset();
    setDone(false);
    setOpen(true);
  };
  const send = (reason: ReportReason) => report.mutate({ id: reviewId, reason }, { onSuccess: () => setDone(true) });
  const close = () => setOpen(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Signaler cet avis"
        onPress={start}
        hitSlop={8}
        style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 2 }}
      >
        <I icon={Flag} size={13} color={C.muted} />
        <Tx size={12} color={C.muted} lh={14} style={{ textDecorationLine: 'underline' }}>
          Signaler
        </Tx>
      </Pressable>
      <ModalSheet open={open} onClose={close}>
        {done ? (
          <>
            <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: C.okBg }}>
              <I icon={CheckCircle2} size={24} color={C.okFg} />
            </View>
            <H2>Merci, nous examinons cet avis.</H2>
            <P>Vous ne serez pas cité. Si l’avis ne respecte pas nos règles, il sera masqué.</P>
            <Button onPress={close}>Fermer</Button>
          </>
        ) : (
          <>
            <H2>Signaler cet avis</H2>
            <P>Pourquoi signalez-vous cet avis ?</P>
            <ListCard>
              {REPORT_REASONS.map((r) => (
                <Row key={r} py={12} chevron={false} onPress={() => (report.isPending ? undefined : send(r))} accessibilityLabel={REPORT_REASON_LABELS_FR[r].label}>
                  <Tx size={14} weight={600} lh={17}>
                    {REPORT_REASON_LABELS_FR[r].label}
                  </Tx>
                  <Tx size={12} color={C.muted} lh={15.5}>
                    {REPORT_REASON_LABELS_FR[r].hint}
                  </Tx>
                </Row>
              ))}
            </ListCard>
            {report.isError ? <Alert>{errorText(report.error)}</Alert> : null}
            <Button variant="g" onPress={close} disabled={report.isPending}>
              Annuler
            </Button>
          </>
        )}
      </ModalSheet>
    </>
  );
}
