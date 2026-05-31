import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { LanguageProvider } from '../lib/language';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <LanguageProvider>
        <Stack screenOptions={{ 
          headerShown: false,
          animation: 'none', 
        }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(housekeeper)" />
          <Stack.Screen name="addresses" />
          <Stack.Screen name="blocked-housekeepers" />
          <Stack.Screen name="favorite-housekeepers" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="chat/index" />
          <Stack.Screen name="chat/[bookingId]" />
        </Stack>
      </LanguageProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
