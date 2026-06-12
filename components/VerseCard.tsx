import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface VerseCardProps {
  isDark?: boolean;
  delay?: number;
}

export default function VerseCard({ isDark = true, delay = 0 }: VerseCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.card,
        isDark ? styles.cardDark : styles.cardLight,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Subtle inner glow */}
      <View style={[styles.innerGlow, isDark ? styles.innerGlowDark : styles.innerGlowLight]} pointerEvents="none" />

      {/* Left decorative line */}
      <View style={[styles.accentLine, isDark ? styles.accentLineDark : styles.accentLineLight]} />

      <View style={styles.content}>
        <Text style={[styles.verseText, isDark ? styles.verseTextDark : styles.verseTextLight]}>
          ﴿ وَأَحْسِنُوا ۛ إِنَّ اللَّهَ يُحِبُّ الْمُحْسِنِينَ ﴾
        </Text>
        <Text style={[styles.verseRef, isDark ? styles.verseRefDark : styles.verseRefLight]}>
          سورة البقرة — ١٩٥
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    overflow: 'hidden',
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  cardDark: {
    backgroundColor: 'rgba(0,30,14,0.75)',
    borderColor: 'rgba(0,200,83,0.22)',
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4,
  },
  cardLight: {
    backgroundColor: 'rgba(0,80,35,0.07)',
    borderColor: 'rgba(0,120,60,0.20)',
    shadowColor: '#005C28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },

  innerGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    pointerEvents: 'none',
  },
  innerGlowDark: { backgroundColor: 'rgba(0,200,83,0.07)' },
  innerGlowLight: { backgroundColor: 'rgba(0,120,60,0.06)' },

  accentLine: {
    width: 3,
    borderRadius: 2,
    alignSelf: 'stretch',
    minHeight: 36,
  },
  accentLineDark: {
    backgroundColor: 'rgba(0,200,83,0.60)',
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  accentLineLight: {
    backgroundColor: 'rgba(0,100,45,0.50)',
  },

  content: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 6,
  },

  verseText: {
    fontSize: 14.5,
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: 26,
    letterSpacing: 0.3,
    writingDirection: 'rtl',
  },
  verseTextDark: {
    color: 'rgba(255,255,255,0.90)',
  },
  verseTextLight: {
    color: '#064e2a',
  },

  verseRef: {
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'right',
    letterSpacing: 0.4,
  },
  verseRefDark: {
    color: 'rgba(0,200,83,0.72)',
  },
  verseRefLight: {
    color: 'rgba(0,100,45,0.65)',
  },
});
