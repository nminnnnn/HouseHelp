import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService } from '../../lib/auth';
import { useLanguage } from '../../lib/language';

const serviceOptions = [
  { en: 'Home cleaning', vi: 'D\u1ecdn d\u1eb9p nh\u00e0 c\u1eeda', value: 'D\u1ecdn d\u1eb9p nh\u00e0 c\u1eeda' },
  { en: 'Laundry', vi: 'Gi\u1eb7t \u1ee7i qu\u1ea7n \u00e1o', value: 'Gi\u1eb7t \u1ee7i qu\u1ea7n \u00e1o' },
  { en: 'Cooking', vi: 'N\u1ea5u \u0103n', value: 'N\u1ea5u \u0103n' },
  { en: 'Child care', vi: 'Ch\u0103m s\u00f3c tr\u1ebb em', value: 'Ch\u0103m s\u00f3c tr\u1ebb em' },
  { en: 'Elder care', vi: 'Ch\u0103m s\u00f3c ng\u01b0\u1eddi gi\u00e0', value: 'Ch\u0103m s\u00f3c ng\u01b0\u1eddi gi\u00e0' },
  { en: 'Industrial cleaning', vi: 'V\u1ec7 sinh c\u00f4ng nghi\u1ec7p', value: 'V\u1ec7 sinh c\u00f4ng nghi\u1ec7p' },
  { en: 'Gardening', vi: 'L\u00e0m v\u01b0\u1eddn', value: 'L\u00e0m v\u01b0\u1eddn' },
];

const copy = {
  en: {
    backLogin: 'Back to login',
    create: 'Create account',
    createError: 'Could not create account.',
    errorTitle: 'Registration failed',
    fullName: 'Full name',
    password: 'Password',
    phone: 'Phone number',
    serviceRequired: 'Please choose at least one service.',
    services: 'Choose services',
    title: 'Register housekeeper',
    validation: 'Please enter full name, email, and password.',
    validationTitle: 'Notice',
  },
  vi: {
    backLogin: 'Quay l\u1ea1i \u0111\u0103ng nh\u1eadp',
    create: 'T\u1ea1o t\u00e0i kho\u1ea3n',
    createError: 'Kh\u00f4ng th\u1ec3 t\u1ea1o t\u00e0i kho\u1ea3n.',
    errorTitle: '\u0110\u0103ng k\u00fd th\u1ea5t b\u1ea1i',
    fullName: 'H\u1ecd t\u00ean',
    password: 'M\u1eadt kh\u1ea9u',
    phone: 'S\u1ed1 \u0111i\u1ec7n tho\u1ea1i',
    serviceRequired: 'Vui l\u00f2ng ch\u1ecdn \u00edt nh\u1ea5t m\u1ed9t c\u00f4ng vi\u1ec7c.',
    services: 'Ch\u1ecdn c\u00f4ng vi\u1ec7c',
    title: '\u0110\u0103ng k\u00fd ng\u01b0\u1eddi gi\u00fap vi\u1ec7c',
    validation: 'Vui l\u00f2ng nh\u1eadp h\u1ecd t\u00ean, email v\u00e0 m\u1eadt kh\u1ea9u.',
    validationTitle: 'Th\u00f4ng b\u00e1o',
  },
} as const;

export default function RegisterHousekeeperScreen() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const { language } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const text = copy[language];

  const toggleService = (service: string) => {
    setSelectedServices((current) => (
      current.includes(service)
        ? current.filter((item) => item !== service)
        : [...current, service]
    ));
  };

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert(text.validationTitle, text.validation);
      return;
    }

    if (selectedServices.length === 0) {
      Alert.alert(text.validationTitle, text.serviceRequired);
      return;
    }

    try {
      setIsSubmitting(true);
      await authService.registerHousekeeper({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
        phone: phone.trim() || undefined,
        services: selectedServices,
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

        <Text style={styles.label}>{text.services}</Text>
        <View style={styles.serviceGrid}>
          {serviceOptions.map((service) => {
            const isSelected = selectedServices.includes(service.value);
            return (
              <TouchableOpacity
                activeOpacity={0.84}
                key={service.value}
                onPress={() => toggleService(service.value)}
                style={[styles.serviceChip, isSelected && styles.serviceChipActive]}
              >
                <Text style={[styles.serviceChipText, isSelected && styles.serviceChipTextActive]}>
                  {language === 'vi' ? service.vi : service.en}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
  label: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  secondaryButton: {
    alignItems: 'center',
    marginTop: 22,
  },
  secondaryText: {
    color: '#ff8128',
    fontSize: 15,
    fontWeight: '600',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  serviceChip: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#fed7aa',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  serviceChipActive: {
    backgroundColor: '#ff8128',
    borderColor: '#ff8128',
  },
  serviceChipText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  serviceChipTextActive: {
    color: '#fff',
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  title: {
    color: '#111827',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 26,
    textAlign: 'center',
  },
});
