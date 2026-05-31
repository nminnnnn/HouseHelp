import { Stack } from 'expo-router';

export default function HousekeeperLayout() {
  return (
     <Stack screenOptions={{ 
      headerShown: false,
      animation: 'slide_from_right', 
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      <Stack.Screen name="verification" />
    </Stack>
  );
}
