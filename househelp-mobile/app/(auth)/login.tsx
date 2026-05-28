import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService, type AuthUser } from '../../lib/auth';

function routeAfterAuth(user: AuthUser) {
  if (user.role === 'customer') {
    return '/(customer)' as const;
  }

  if (user.role === 'housekeeper') {
    return '/(housekeeper)' as const;
  }

  return null;
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Thong bao', 'Vui long nhap day du email va mat khau.');
      return;
    }

    try {
      setIsSubmitting(true);
      const user = await authService.login(email.trim(), password);
      const nextRoute = routeAfterAuth(user);

      if (nextRoute) {
        router.replace(nextRoute);
        return;
      }

      Alert.alert('Khong ho tro', 'Tai khoan nay chua duoc ho tro tren mobile.');
    } catch (error: any) {
      Alert.alert(
        'Dang nhap that bai',
        error.response?.data?.message || error.response?.data?.error || 'Email hoac mat khau khong dung.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      edges={[]}
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 24), paddingTop: Math.max(insets.top, 24) },
      ]}
    >
      <Text style={styles.title}>HouseHelp</Text>
      <Text style={styles.subtitle}>Dang nhap de tiep tuc</Text>

      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email"
        style={styles.input}
        value={email}
      />

      <TextInput
        onChangeText={setPassword}
        placeholder="Mat khau"
        secureTextEntry
        style={styles.input}
        value={password}
      />

      <TouchableOpacity disabled={isSubmitting} onPress={handleLogin} style={styles.button}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Dang nhap</Text>}
      </TouchableOpacity>

      <View style={styles.links}>
        <TouchableOpacity onPress={() => router.push('/(auth)/register-customer')}>
          <Text style={styles.linkText}>Dang ky khach hang</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(auth)/register-housekeeper')}>
          <Text style={styles.linkText}>Dang ky nguoi giup viec</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    marginTop: 10,
    padding: 15,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  container: {
    backgroundColor: '#f7f8fa',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#d8dde3',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 15,
  },
  links: {
    alignItems: 'center',
    gap: 14,
    marginTop: 24,
  },
  linkText: {
    color: '#0f766e',
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 15,
    marginBottom: 32,
    textAlign: 'center',
  },
  title: {
    color: '#111827',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
});
