import { Canvas, ColorMatrix, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { colors, spacing } from '@/ui/theme';

import { applyFilter } from './apply-filter';
import { FilterId, FILTERS, matrixOf } from './filters';
import { prepareImage } from './upload';

type Props = { visible: boolean; onClose: () => void; onDone: (uri: string, filter: FilterId) => void };

export function CameraSheet({ visible, onClose, onDone }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [captured, setCaptured] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>('ORIGINAL');
  const [busy, setBusy] = useState(false);
  const preview = useImage(captured);
  const { width } = useWindowDimensions();
  const previewHeight = width * (4 / 3);

  function reset() {
    setCaptured(null);
    setFilter('ORIGINAL');
    setBusy(false);
  }

  async function capture() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
    if (photo) setCaptured(photo.uri);
  }

  async function usePhoto() {
    if (!captured) return;
    setBusy(true);
    try {
      const prepared = await prepareImage(captured);
      const out = await applyFilter(prepared.uri, filter);
      onDone(out, filter);
      reset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {!permission ? null : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.text}>Cần quyền camera để chụp ảnh kỷ niệm.</Text>
            <Button title="Cho phép camera" onPress={requestPermission} />
            <Button title="Đóng" variant="secondary" onPress={onClose} />
          </View>
        ) : captured ? (
          <>
            <Canvas style={{ width, height: previewHeight }}>
              {preview && (
                <SkiaImage image={preview} x={0} y={0} width={width} height={previewHeight} fit="contain">
                  <ColorMatrix matrix={matrixOf(filter)} />
                </SkiaImage>
              )}
            </Canvas>
            <ScrollView horizontal style={styles.filters} contentContainerStyle={{ padding: spacing.md }}>
              {FILTERS.map((f) => (
                <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
              ))}
            </ScrollView>
            <View style={styles.actions}>
              <Button title="Dùng ảnh này" onPress={usePhoto} loading={busy} />
              <Button title="Chụp lại" variant="secondary" onPress={reset} />
            </View>
          </>
        ) : (
          <>
            <CameraView ref={cameraRef} style={{ width, height: previewHeight }} facing={facing} />
            <View style={styles.actions}>
              <Button title="Chụp" onPress={capture} />
              <Button
                title="Đổi camera"
                variant="secondary"
                onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              />
              <Button title="Đóng" variant="secondary" onPress={onClose} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingTop: spacing.xl },
  center: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.bg },
  text: { color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  filters: { flexGrow: 0 },
  actions: { padding: spacing.lg, backgroundColor: colors.bg, flex: 1 },
});
