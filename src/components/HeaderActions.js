import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useStore from '../store/useStore';
import useColors from '../lib/useColors';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function HeaderActions() {
  const navigation = useNavigation();
  const { user } = useStore();
  const colors = useColors();

  const fullName = user?.user_metadata?.full_name || user?.name || '';
  const initials = getInitials(fullName);
  const avatarUrl = user?.user_metadata?.avatar_url || null;

  return (
    <View style={styles.row}>
      {/* Messages / Chat icon */}
      <TouchableOpacity
        style={[styles.iconBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
        onPress={() => navigation.navigate('Social')}
        activeOpacity={0.7}
      >
        <Text style={styles.iconBtnText}>💬</Text>
      </TouchableOpacity>

      {/* Profile avatar */}
      <TouchableOpacity
        style={[styles.avatarWrap, { borderColor: colors.accent + '55' }]}
        onPress={() => navigation.navigate('Profile')}
        activeOpacity={0.8}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
        ) : (
          <View style={[styles.avatarInner, { backgroundColor: colors.accent + '22' }]}>
            <Text style={[styles.avatarInitials, { color: colors.accent }]}>{initials}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconBtnText: { fontSize: 18 },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    overflow: 'hidden',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '800',
  },
});
