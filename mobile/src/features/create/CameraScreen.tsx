import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCouple } from '@/features/couple/api';
import { toIsoDate } from '@/lib/format';
import { AppText } from '@/ui/AppText';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { colors, shadow } from '@/ui/theme';

import { captureStore } from './capture-store';
import { ClassifySheet } from './ClassifySheet';
import { EFFECTS, EffectId } from './effects';

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const size = width - 32;
  const couple = useCouple();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState(false);
  const [effect, setEffect] = useState<EffectId>('ORIGINAL');
  const [classifyOpen, setClassifyOpen] = useState(false);
  const partner = couple.data?.partner;

  function start(uris: string[]) {
    captureStore.reset({ uris, effect, hearts: effect === 'HEARTS', date: captureStore.get().date || toIsoDate(new Date()) });
    router.push('/create/preview');
  }

  async function shoot() {
    const photo = await camera.current?.takePictureAsync({ quality: 0.85 });
    if (photo?.uri) start([photo.uri]);
  }

  async function pickLibrary() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.9 });
    if (!res.canceled && res.assets?.length) start(res.assets.map((a) => a.uri));
  }

  function noPhoto() {
    captureStore.reset({ date: captureStore.get().date || toIsoDate(new Date()) });
    setClassifyOpen(true);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 8 }}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Đèn flash" accessibilityState={{ selected: flash }} onPress={() => setFlash(!flash)} style={styles.round}>
          <Icon name="zap" size={20} color={flash ? colors.roseStrong : colors.text} />
        </Pressable>
        <View style={styles.who}>
          {partner ? <Avatar name={partner.displayName} tone="lavender" size={28} uri={partner.avatarUrl} /> : null}
          <AppText variant="bodyStrong">{partner ? `Chia sẻ với ${partner.displayName}` : 'Lưu vào Nhật ký riêng'}</AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Đổi camera" onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} style={styles.round}>
          <Icon name="flip" size={20} />
        </Pressable>
      </View>

      <View style={[styles.finder, { width: size, height: size }]}>
        {permission?.granted ? (
          <CameraView ref={camera} style={{ flex: 1 }} facing={facing} flash={flash ? 'on' : 'off'} />
        ) : (
          <LinearGradient colors={['#FFD3B8', '#E98BA5']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
            <AppText variant="bodyStrong" color={colors.white} style={{ textAlign: 'center' }}>Cho phép dùng camera để chụp khoảnh khắc</AppText>
            <Button title="Cho phép" compact onPress={requestPermission} style={{ paddingHorizontal: 20 }} />
          </LinearGradient>
        )}
        <View style={styles.effectName}><AppText variant="captionStrong" color={colors.white}>Hiệu ứng: {EFFECTS.find((e) => e.id === effect)?.label}</AppText></View>
      </View>

      <View style={styles.shutterRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Thư viện" onPress={pickLibrary} style={{ alignItems: 'center', gap: 4 }}>
          <View style={styles.libThumb}><Icon name="image" size={22} color={colors.peachInk} /></View>
          <AppText variant="micro" color={colors.textMuted} style={{ letterSpacing: 0 }}>Thư viện</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Chụp ảnh" onPress={shoot} style={styles.shutter}>
          <View style={styles.shutterInner} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Không ảnh" onPress={noPhoto} style={{ alignItems: 'center', gap: 4 }}>
          <View style={styles.noPhoto}><Icon name="pen" size={20} /></View>
          <AppText variant="micro" color={colors.textMuted} style={{ letterSpacing: 0 }}>Không ảnh</AppText>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {EFFECTS.map((e) => {
          const on = e.id === effect;
          return (
            <Pressable key={e.id} accessibilityRole="radio" accessibilityLabel={e.label} accessibilityState={{ checked: on }} onPress={() => setEffect(e.id)} style={{ alignItems: 'center', gap: 4 }}>
              <LinearGradient colors={e.colors} style={[styles.effect, on && { borderWidth: 3, borderColor: colors.roseStrong }]}>
                <Icon name={e.icon} size={22} color={e.id === 'ORIGINAL' ? colors.textMuted : colors.white} />
              </LinearGradient>
              <AppText variant="micro" color={on ? colors.roseStrong : colors.textMuted} style={{ letterSpacing: 0 }}>{e.label}</AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <ClassifySheet visible={classifyOpen} onClose={() => setClassifyOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingLeft: 6, paddingRight: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  finder: { alignSelf: 'center', marginTop: 14, borderRadius: 56, overflow: 'hidden', backgroundColor: colors.roseSoft, ...shadow.raised },
  effectName: { position: 'absolute', bottom: 16, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(43,26,46,0.45)' },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 40, marginVertical: 16 },
  libThumb: { width: 48, height: 48, borderRadius: 14, borderWidth: 3, borderColor: colors.white, backgroundColor: colors.peachSoft, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  shutter: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: colors.rose, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.rose },
  noPhoto: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  effect: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
