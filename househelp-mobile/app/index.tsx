import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { authService, type AuthUser } from '@/lib/auth';

function routeForUser(user: AuthUser | null) {
  if (user?.role === 'customer') {
    return '/(customer)';
  }

  if (user?.role === 'housekeeper') {
    return '/(housekeeper)';
  }

  return '/(auth)/login';
}

export default function IndexScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    authService
      .checkAuthStatus()
      .then((storedUser) => {
        if (isMounted) {
          setUser(storedUser);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={routeForUser(user)} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    flex: 1,
    justifyContent: 'center',
  },
});
