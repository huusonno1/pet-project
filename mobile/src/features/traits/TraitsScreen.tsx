import { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useMe } from '@/features/account/api';
import { useCouple } from '@/features/couple/api';
import type { Preference, SizeEntry } from '@/lib/api/types';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { colors, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

import { useCatalog, useTraits } from './api';
import { canEdit, catalogLabel } from './editing';
import { PreferenceForm } from './PreferenceForm';
import { SizeForm } from './SizeForm';

type Editing = { kind: 'size'; item?: SizeEntry } | { kind: 'preference'; item?: Preference } | null;

function formatPrice(price: number) {
  return `${String(price).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;
}

export default function TraitsScreen() {
  const me = useMe();
  const couple = useCouple();
  const catalog = useCatalog();
  const [who, setWho] = useState<'partner' | 'me'>('partner');
  const [editing, setEditing] = useState<Editing>(null);
  const meId = me.data?.id;
  const subjectId = who === 'me' ? meId : couple.data?.partner.id;
  const traits = useTraits(subjectId);
  const sizeKinds = catalog.data?.sizeKinds ?? [];
  const categories = catalog.data?.preferenceCategories ?? [];

  if (!meId || !subjectId) return <Screen>{null}</Screen>;

  return (
    <Screen>
      <View style={styles.chips}>
        <Chip label={couple.data?.partner.displayName ?? 'Người ấy'} selected={who === 'partner'} onPress={() => setWho('partner')} />
        <Chip label="Tôi" selected={who === 'me'} onPress={() => setWho('me')} />
      </View>

      <Title>Size</Title>
      {(traits.data?.sizes ?? []).map((s) => (
        <Pressable key={s.id} disabled={!canEdit(s, meId)} onPress={() => setEditing({ kind: 'size', item: s })}>
          <Card>
            <Text style={styles.item}>
              {catalogLabel(sizeKinds, s.kind)}: {s.value}
            </Text>
            {s.note ? <Text style={styles.muted}>{s.note}</Text> : null}
            {s.visibility === 'AUTHOR_ONLY' && <Text style={styles.secret}>🔒 Bí mật</Text>}
          </Card>
        </Pressable>
      ))}
      <Button title="+ Thêm size" variant="secondary" onPress={() => setEditing({ kind: 'size' })} />

      <Title>Sở thích</Title>
      {(traits.data?.preferences ?? []).map((p) => (
        <Pressable key={p.id} disabled={!canEdit(p, meId)} onPress={() => setEditing({ kind: 'preference', item: p })}>
          <Card>
            <Text style={styles.item}>{catalogLabel(categories, p.category)}</Text>
            <Text style={styles.text}>{[p.brand, p.name, p.color].filter(Boolean).join(' · ')}</Text>
            {p.note ? <Text style={styles.muted}>{p.note}</Text> : null}
            {p.visibility === 'AUTHOR_ONLY' && <Text style={styles.secret}>🔒 Bí mật</Text>}
            {p.links.map((l) => (
              <Pressable
                key={l.id}
                accessibilityRole="button"
                accessibilityLabel={`Mở ${l.label ?? 'link'}`}
                onPress={() => Linking.openURL(l.url)}>
                <Text style={styles.link}>
                  🛒 {l.label ?? l.url}
                  {l.price ? ` — ${formatPrice(l.price)}` : ''}
                </Text>
              </Pressable>
            ))}
          </Card>
        </Pressable>
      ))}
      <Button title="+ Thêm sở thích" variant="secondary" onPress={() => setEditing({ kind: 'preference' })} />

      <Modal visible={editing !== null} animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing?.kind === 'size' && (
          <SizeForm subjectUserId={subjectId} meId={meId} kinds={sizeKinds} initial={editing.item} onClose={() => setEditing(null)} />
        )}
        {editing?.kind === 'preference' && (
          <PreferenceForm
            subjectUserId={subjectId}
            meId={meId}
            categories={categories}
            initial={editing.item}
            onClose={() => setEditing(null)}
          />
        )}
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', marginBottom: spacing.md },
  item: { fontWeight: '600', color: colors.text },
  text: { color: colors.text },
  muted: { color: colors.muted },
  secret: { color: colors.primaryDark, marginTop: spacing.xs },
  link: { color: colors.primary, marginTop: spacing.xs },
});
