import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService } from '../../lib/auth';
import { useLanguage } from '../../lib/language';

const copy = {
  en: {
    backLogin: 'Back to login',
    create: 'Create account',
    createError: 'Could not create account.',
    errorTitle: 'Registration failed',
    fullName: 'Full name',
    password: 'Password',
    phone: 'Phone number',
    services: 'Services, separated by commas',
    title: 'Register housekeeper',
    validation: 'Please enter full name, email, and password.',
    validationTitle: 'Notice',
  },
  vi: {
    backLogin: 'Quay lại đăng nhập',
    create: 'Tạo tài khoản',
    createError: 'Không thể tạo tài khoản.',
    errorTitle: 'Đăng ký thất bại',
    fullName: 'Họ tên',
    password: 'Mật khẩu',
    phone: 'Số điện thoại',
    services: 'Dịch vụ, cách nhau bằng dấu phẩy',
    title: 'Đăng ký người giúp việc',
    validation: 'Vui lòng nhập họ tên, email và mật khẩu.',
    validationTitle: 'Thông báo',
  },
} as const;

function parseServices(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function RegisterHousekeeperScreen() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [services, setServices] = useState('');
  const { language } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const text = copy[language];

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert(text.validationTitle, text.validation);
      return;
    }

    try {
      setIsSubmitting(true);
      await authService.registerHousekeeper({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
        phone: phone.trim() || undefined,
        services: parseServices(services),
      });
      router.replace('/(housekeeper)');
    } catch (error: any) {
      Alert.alert(
        text.errorTitle,
        error.response?.data?.message || error.response?.data?.error || text.createError,
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
        <Text style={styles.title}>{text.title}</Text>

        <TextInput onChangeText={setFullName} placeholder={text.fullName} style={styles.input} value={fullName} />
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          style={styles.input}
          value={email}
        />
        <TextInput keyboardType="phone-pad" onChangeText={setPhone} placeholder={text.phone} style={styles.input} value={phone} />
        <TextInput onChangeText={setPassword} placeholder={text.password} secureTextEntry style={styles.input} value={password} />
        <TextInput
          onChangeText={setServices}
          placeholder={text.services}
          style={styles.input}
          value={services}
        />

        <TouchableOpacity disabled={isSubmitting} onPress={handleRegister} style={styles.button}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{text.create}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>{text.backLogin}</Text>
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
