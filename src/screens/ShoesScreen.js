// v2.0 — Shoes management screen. Reached from Profile → Settings → Shoes.
// Lists the user's shoes with live mileage, lets them add / edit / retire.

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import useColors from '../lib/useColors';
import {
  listShoes, createShoe, updateShoe, deleteShoe, fetchShoesMileage,
} from '../lib/shoes';

export default function ShoesScreen() {
  const colors = useColors();
  const navigation = useNavigation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [shoes, setShoes]       = useState([]);
  const [mileage, setMileage]   = useState({});
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [showRetired, setShowRetired] = useState(false);

  const [editingShoe, setEditingShoe] = useState(null);   // shoe being edited, or {} for new
  const [draft, setDraft]             = useState({ name: '', brand: '', model: '', startKm: '0' });
  const [saving, setSaving]           = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listShoes({ includeRetired: true });
      setShoes(list);
      const mile = await fetchShoesMileage(list);
      setMileage(mile);
    } catch (e) {
      // ignore — empty state will render
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openCreate = () => {
    setEditingShoe({});
    setDraft({ name: '', brand: '', model: '', startKm: '0' });
  };

  const openEdit = (shoe) => {
    setEditingShoe(shoe);
    setDraft({
      name:    shoe.name    || '',
      brand:   shoe.brand   || '',
      model:   shoe.model   || '',
      startKm: String(shoe.startKm || 0),
    });
  };

  const handleSave = async () => {
    if (saving || !draft.name.trim()) return;
    setSaving(true);
    try {
      if (editingShoe?.id) {
        await updateShoe(editingShoe.id, {
          name:    draft.name.trim(),
          brand:   draft.brand.trim(),
          model:   draft.model.trim(),
          startKm: Number(draft.startKm) || 0,
        });
      } else {
        await createShoe({
          name:    draft.name.trim(),
          brand:   draft.brand.trim(),
          model:   draft.model.trim(),
          startKm: Number(draft.startKm) || 0,
        });
      }
      setEditingShoe(null);
      load();
    } catch (e) {
      Alert.alert('Could not save', e?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const handleRetire = (shoe) => {
    Alert.alert(
      shoe.retired ? 'Bring back this shoe?' : 'Retire this shoe?',
      shoe.retired
        ? 'It will appear in the picker for new runs again.'
        : 'Past runs keep their record. New runs won\'t list it in the picker.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: shoe.retired ? 'Restore' : 'Retire',
          onPress: async () => {
            try { await updateShoe(shoe.id, { retired: !shoe.retired }); load(); }
            catch (e) { Alert.alert('Could not update', e?.message || 'Try again'); }
          },
        },
      ]
    );
  };

  const handleDelete = (shoe) => {
    Alert.alert(
      'Delete this shoe?',
      'This permanently removes the shoe record. Past runs keep their distance but lose the shoe association.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteShoe(shoe.id); load(); }
          catch (e) { Alert.alert('Could not delete', e?.message || 'Try again'); }
        }},
      ]
    );
  };

  const visible = showRetired ? shoes : shoes.filter(s => !s.retired);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.text }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Shoes</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
          <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 22 }}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefresh(true); load(); }}
            tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
        {visible.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No shoes yet</Text>
            <Text style={[styles.emptySub, { color: colors.text3 }]}>
              Add a pair to start tracking mileage across your runs.
            </Text>
            <TouchableOpacity onPress={openCreate} style={[styles.emptyBtn, { backgroundColor: colors.accent }]} activeOpacity={0.85}>
              <Text style={styles.emptyBtnText}>+ Add your first pair</Text>
            </TouchableOpacity>
          </View>
        ) : (
          visible.map(shoe => (
            <TouchableOpacity
              key={shoe.id}
              onPress={() => openEdit(shoe)}
              onLongPress={() => handleRetire(shoe)}
              activeOpacity={0.85}
              style={[styles.shoeCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: shoe.retired ? 0.5 : 1 }]}
            >
              <Text style={styles.shoeIcon}>👟</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.shoeName, { color: colors.text }]}>{shoe.name}</Text>
                {(shoe.brand || shoe.model) ? (
                  <Text style={[styles.shoeMeta, { color: colors.text3 }]}>
                    {[shoe.brand, shoe.model].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                <Text style={[styles.shoeMile, { color: colors.accent }]}>
                  {(mileage[shoe.id] || 0).toFixed(1)} km
                  {shoe.retired ? '  ·  RETIRED' : ''}
                </Text>
              </View>
              <Text style={{ color: colors.text3, fontSize: 22 }}>›</Text>
            </TouchableOpacity>
          ))
        )}

        {shoes.some(s => s.retired) && (
          <TouchableOpacity onPress={() => setShowRetired(s => !s)} style={{ alignSelf: 'center', padding: 14 }}>
            <Text style={{ color: colors.text3, fontSize: 13, fontWeight: '600' }}>
              {showRetired ? 'Hide retired' : 'Show retired'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Editor modal */}
      <Modal
        visible={!!editingShoe}
        animationType="slide"
        transparent
        onRequestClose={() => !saving && setEditingShoe(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 36 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingShoe?.id ? 'Edit shoe' : 'Add shoe'}
            </Text>

            <Text style={[styles.label, { color: colors.text3 }]}>Name *</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }]}
              value={draft.name}
              onChangeText={t => setDraft(d => ({ ...d, name: t }))}
              placeholder="e.g. Daily trainer"
              placeholderTextColor={colors.text3}
              maxLength={50}
            />

            <Text style={[styles.label, { color: colors.text3 }]}>Brand</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }]}
              value={draft.brand}
              onChangeText={t => setDraft(d => ({ ...d, brand: t }))}
              placeholder="e.g. Nike"
              placeholderTextColor={colors.text3}
              maxLength={40}
            />

            <Text style={[styles.label, { color: colors.text3 }]}>Model</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }]}
              value={draft.model}
              onChangeText={t => setDraft(d => ({ ...d, model: t }))}
              placeholder="e.g. Pegasus 40"
              placeholderTextColor={colors.text3}
              maxLength={60}
            />

            <Text style={[styles.label, { color: colors.text3 }]}>Starting mileage (km)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }]}
              value={draft.startKm}
              onChangeText={t => setDraft(d => ({ ...d, startKm: t.replace(/[^0-9.]/g, '') }))}
              placeholder="0"
              placeholderTextColor={colors.text3}
              keyboardType="decimal-pad"
              maxLength={6}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                onPress={() => setEditingShoe(null)}
                style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              {editingShoe?.id && (
                <TouchableOpacity
                  onPress={() => { setEditingShoe(null); handleDelete(editingShoe); }}
                  style={[styles.modalBtn, { borderColor: '#ef4444', borderWidth: 1 }]}
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalBtnText, { color: '#ef4444' }]}>Delete</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleSave}
                style={[styles.modalBtn, { backgroundColor: colors.accent, opacity: (!draft.name.trim() || saving) ? 0.4 : 1 }]}
                disabled={!draft.name.trim() || saving}
                activeOpacity={0.85}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  backBtn: { padding: 6 },
  backBtnText: { fontSize: 15, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  addBtn: { padding: 6, width: 40, alignItems: 'flex-end' },

  emptyWrap: { alignItems: 'center', padding: 32, paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  emptySub: { fontSize: 14, textAlign: 'center', marginBottom: 18 },
  emptyBtn: { paddingVertical: 14, paddingHorizontal: 22, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  shoeCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 14, marginHorizontal: 14, marginBottom: 10 },
  shoeIcon: { fontSize: 32, marginRight: 14 },
  shoeName: { fontSize: 16, fontWeight: '800' },
  shoeMeta: { fontSize: 12, marginTop: 2 },
  shoeMile: { fontSize: 13, fontWeight: '700', marginTop: 4 },

  modalTitle: { fontSize: 19, fontWeight: '800', marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginTop: 12, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { fontWeight: '800', fontSize: 15 },
});
