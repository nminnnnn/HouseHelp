import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const items = [
  { label: 'Home', href: '/(customer)' as const, icon: 'home-outline', activeIcon: 'home' },
  { label: 'Activity', href: '/(customer)/bookings' as const, icon: 'reader-outline', activeIcon: 'reader' },
  { label: 'Book', href: '/(customer)' as const, icon: 'sparkles-outline', activeIcon: 'sparkles', center: true },
  { label: 'Chat', href: '/chat' as const, icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
  { label: 'Account', href: '/profile' as const, icon: 'person-outline', activeIcon: 'person' },
];

export function CustomerBottomNav() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {items.map((item) => {
        const isActive =
          item.href === '/(customer)'
            ? pathname === '/' || pathname === '/(customer)'
            : pathname.startsWith(item.href.replace('/(customer)', ''));

        return (
          <TouchableOpacity
            activeOpacity={0.82}
            key={item.label}
            onPress={() => router.replace(item.href as any)}
            style={[styles.item, item.center && styles.centerItem]}
          >
            <View style={[styles.iconWrap, item.center && styles.centerIconWrap, isActive && !item.center && styles.activeSoft]}>
              <Ionicons
                color={item.center ? '#fff' : isActive ? '#ff8128' : '#8a94a3'}
                name={(isActive ? item.activeIcon : item.icon) as any}
                size={item.center ? 30 : 25}
              />
            </View>
            {!item.center ? (
              <Text numberOfLines={1} style={[styles.label, isActive && styles.activeLabel]}>
                {item.label}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  activeLabel: {
    color: '#ff8128',
  },
  activeSoft: {
    backgroundColor: '#fff1e8',
  },
  centerIconWrap: {
    backgroundColor: '#ff8128',
    borderColor: '#fff',
    borderRadius: 34,
    borderWidth: 8,
    elevation: 8,
    height: 68,
    marginTop: -38,
    shadowColor: '#ff8128',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    width: 68,
  },
  centerItem: {
    justifyContent: 'flex-start',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 42,
  },
  item: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minWidth: 0,
  },
  label: {
    color: '#8a94a3',
    fontSize: 12,
    fontWeight: '800',
    maxWidth: 70,
  },
  nav: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopColor: '#edf0f4',
    borderTopWidth: 1,
    bottom: 0,
    elevation: 16,
    flexDirection: 'row',
    left: 0,
    minHeight: 78,
    paddingHorizontal: 8,
    paddingTop: 8,
    position: 'absolute',
    right: 0,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
});
