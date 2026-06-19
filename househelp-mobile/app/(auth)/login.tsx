import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService, type AuthUser } from '../../lib/auth';
import { useLanguage } from '../../lib/language';

const copy = {
  en: {
    alertTitle: 'Notice',
    customerRegister: 'Register as customer',
    errorTitle: 'Login failed',
    housekeeperRegister: 'Register as housekeeper',
    login: 'Log in',
    password: 'Password',
    subtitle: 'Log in to continue',
    unsupported: 'Not supported',
    unsupportedText: 'This account is not supported on mobile yet.',
    validation: 'Please enter email and password.',
    wrongCredentials: 'Email or password is incorrect.',
  },
  vi: {
    alertTitle: 'Thông báo',
    customerRegister: 'Đăng ký khách hàng',
    errorTitle: 'Đăng nhập thất bại',
    housekeeperRegister: 'Đăng ký người giúp việc',
    login: 'Đăng nhập',
    password: 'Mật khẩu',
    subtitle: 'Đăng nhập để tiếp tục',
    unsupported: 'Không hỗ trợ',
    unsupportedText: 'Tài khoản này chưa được hỗ trợ trên mobile.',
    validation: 'Vui lòng nhập đầy đủ email và mật khẩu.',
    wrongCredentials: 'Email hoặc mật khẩu không đúng.',
  },
} as const;

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
  const { language } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const text = copy[language];

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert(text.alertTitle, text.validation);
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

      Alert.alert(text.unsupported, text.unsupportedText);
    } catch (error: any) {
      Alert.alert(
        text.errorTitle,
        error.response?.data?.message || error.response?.data?.error || text.wrongCredentials,
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>HouseHelp</Text>
          <Text style={styles.subtitle}>{text.subtitle}</Text>

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
            placeholder={text.password}
            secureTextEntry
            style={styles.input}
            value={password}
          />

          <TouchableOpacity disabled={isSubmitting} onPress={handleLogin} style={styles.button}>
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{text.login}</Text>}
          </TouchableOpacity>

          <View style={styles.links}>
            <TouchableOpacity onPress={() => router.push('/(auth)/register-customer')}>
              <Text style={styles.linkText}>{text.customerRegister}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(auth)/register-housekeeper')}>
              <Text style={styles.linkText}>{text.housekeeperRegister}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
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
    paddingHorizontal: 30,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#d8dde3',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 15,
  },
  keyboardArea: {
    flex: 1,
  },
  links: {
    alignItems: 'center',
    gap: 14,
    marginTop: 24,
  },
  linkText: {
    color: '#ff8128',
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
