/** PRO-F 18 — feuille « Partagez votre page » (WhatsApp, Instagram, Facebook, TikTok, Messages, QR, Plus). */
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Lock, MessageCircle, QrCode, Share2 } from 'lucide-react-native';
import { publicHost, publicUrl } from '@/lib/salon';
import { C, R } from '@/theme/design';
import { Button, I, ModalSheet, Tx } from './index';

export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    void Clipboard.setStringAsync(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };
  return [copied, copy];
}

export function shareSalon(name: string, url: string) {
  const text = `Prenez rendez-vous chez ${name} en ligne, 24 h/24 : ${url}`;
  return Share.share({ title: name, message: text, url }).catch(() => undefined);
}

const openOr = (url: string, fallback?: string) => Linking.openURL(url).catch(() => (fallback ? Linking.openURL(fallback).catch(() => undefined) : undefined));

export function ShareSheet({ open, onClose, name, slug }: { open: boolean; onClose: () => void; name: string; slug: string }) {
  const router = useRouter();
  const [copied, copy] = useCopy();
  const url = publicUrl(slug);
  const short = `${publicHost()}/s/${slug}`;
  const text = encodeURIComponent(`Prenez rendez-vous chez ${name} en ligne, 24 h/24 : ${url}`);
  const items: { label: string; icon: ReactNode; onPress: () => void }[] = [
    { label: 'WhatsApp', icon: <I icon={MessageCircle} size={27} />, onPress: () => void openOr(`whatsapp://send?text=${text}`, `https://wa.me/?text=${text}`) },
    { label: 'Instagram', icon: <Tx size={19} weight={700}>◎</Tx>, onPress: () => copy(url) },
    { label: 'Facebook', icon: <Tx size={21} weight={700}>f</Tx>, onPress: () => void openOr(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`) },
    { label: 'TikTok', icon: <Tx size={19} weight={700}>♪</Tx>, onPress: () => copy(url) },
    { label: 'Messages', icon: <Tx size={19}>✆</Tx>, onPress: () => void openOr(`sms:?body=${text}`) },
    {
      label: 'QR Code',
      icon: <I icon={QrCode} size={27} />,
      onPress: () => {
        onClose();
        router.push('/qr');
      },
    },
    { label: 'Plus', icon: <I icon={Share2} size={27} />, onPress: () => void shareSalon(name, url) },
  ];
  return (
    <ModalSheet open={open} onClose={onClose}>
      <Tx size={18} weight={700} ls={-0.7} lh={21}>
        Partagez votre page
      </Tx>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: R.cardSm, backgroundColor: C.fill, paddingHorizontal: 13, paddingVertical: 13 }}>
        <I icon={Lock} size={16} color={C.muted} />
        <Tx size={12} lh={16} numberOfLines={1} style={{ flex: 1 }}>
          {short}
        </Tx>
        <Pressable accessibilityRole="button" onPress={() => copy(url)}>
          <Tx size={12} weight={600} lh={16}>
            {copied ? 'Copié' : 'Copier'}
          </Tx>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {items.map((it) => (
          <Pressable key={it.label} accessibilityRole="button" accessibilityLabel={it.label} onPress={it.onPress} style={{ width: '22%', flexGrow: 1, alignItems: 'center', gap: 6 }}>
            <View style={{ width: 62, height: 62, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>{it.icon}</View>
            <Tx size={12} color={C.muted} lh={16}>
              {it.label}
            </Tx>
          </Pressable>
        ))}
      </View>
      <Button onPress={() => copy(url)}>{copied ? 'Lien copié' : 'Copier le lien'}</Button>
    </ModalSheet>
  );
}
