import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService } from '../../lib/auth';

export default function RegisterCustomerScreen() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert('Thong bao', 'Vui long nhap ho ten, email va mat khau.');
      return;
    }

    try {
      setIsSubmitting(true);
      await authService.registerCustomer({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
        phone: phone.trim() || undefined,
      });
      router.replace('/(customer)');
    } catch (error: any) {
      Alert.alert(
        'Dang ky that bai',
        error.response?.data?.message || error.response?.data?.error || 'Khong the tao tai khoan.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 24) }]}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 30, 44) }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Dang ky khach hang</Text>

        <TextInput onChangeText={setFullName} placeholder="Ho ten" style={styles.input} value={fullName} />
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          style={styles.input}
          value={email}
        />
        <TextInput keyboardType="phone-pad" onChangeText={setPhone} placeholder="So dien thoai" style={styles.input} value={phone} />
        <TextInput onChangeText={setPassword} placeholder="Mat khau" secureTextEntry style={styles.input} value={password} />

        <TouchableOpacity disabled={isSubmitting} onPress={handleRegister} style={styles.button}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Tao tai khoan</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Quay lai dang nhap</Text>
        </TouchableOpacity>
      </ScrollView>
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
    flexGrow: 1,
    justifyContent: 'center',
    padding: 30,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#d8dde3',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 15,
  },
  secondaryButton: {
    alignItems: 'center',
    marginTop: 22,
  },
  secondaryText: {
    color: '#0f766e',
    fontSize: 15,
    fontWeight: '600',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  title: {
    color: '#111827',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 26,
    textAlign: 'center',
  },
});
