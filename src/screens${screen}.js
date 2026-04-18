import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

export default function CoachScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>CoachScreen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 20, color: colors.text, fontWeight: '700' },
});
