import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { MediaDto } from '@/lib/api/types';
import { Button } from '@/ui/Button';
import { colors, radius, spacing } from '@/ui/theme';

import { CameraSheet } from './CameraSheet';
import type { FilterId } from './filters';

export type PhotoItem =
  | { key: string; kind: 'remote'; media: MediaDto }
  | { key: string; kind: 'local'; uri: string; filter: FilterId };

let localCounter = 0;
const newKey = () => `local-${Date.now()}-${localCounter++}`;

type Props = { items: PhotoItem[]; onChange: (items: PhotoItem[]) => void; max?: number };

export function PhotoStrip({ items, onChange, max = 30 }: Props) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const remaining = max - items.length;

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1,
    });
    if (result.canceled) return;
    const added: PhotoItem[] = result.assets.map((a) => ({ key: newKey(), kind: 'local', uri: a.uri, filter: 'ORIGINAL' }));
    onChange([...items, ...added].slice(0, max));
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {items.map((item) => (
          <View key={item.key} style={styles.thumbWrap}>
            <Image source={{ uri: item.kind === 'remote' ? item.media.url : item.uri }} style={styles.thumb} contentFit="cover" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bỏ ảnh"
              onPress={() => onChange(items.filter((x) => x.key !== item.key))}
              style={styles.remove}>
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      {remaining > 0 && (
        <View style={styles.buttons}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Button title="Chọn từ thư viện" variant="secondary" onPress={pickFromLibrary} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Chụp ảnh" variant="secondary" onPress={() => setCameraOpen(true)} />
          </View>
        </View>
      )}
      <CameraSheet
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onDone={(uri, filter) => {
          setCameraOpen(false);
          onChange([...items, { key: newKey(), kind: 'local', uri, filter }]);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  thumbWrap: { marginRight: spacing.sm, marginBottom: spacing.sm },
  thumb: { width: 88, height: 88, borderRadius: radius.sm, backgroundColor: colors.border },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: 12 },
  buttons: { flexDirection: 'row' },
});
