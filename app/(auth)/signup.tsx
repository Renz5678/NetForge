import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Eye, EyeSlash, ArrowLeft, Lightning } from 'phosphor-react-native'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/useAuthStore'
import { Colors } from '@/constants/colors'

export default function SignupScreen() {
  const router = useRouter()
  const signUp = useAuthStore((s) => s.signUp)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [agreedToTos, setAgreedToTos] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState('')
  const [loading, setLoading] = useState(false)

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    setGeneralError('')

    if (!fullName.trim()) newErrors.fullName = 'Full name is required'
    if (!email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email'
    }
    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    if (!agreedToTos) {
      newErrors.tos = 'You must agree to the Terms of Service'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSignUp = async () => {
    if (!validate()) return
    setLoading(true)
    const error = await signUp(email.trim(), password, fullName.trim())
    setLoading(false)

    if (error) {
      setGeneralError(error)
    } else {
      router.replace('/(tabs)')
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.textPrimary} />
          </Pressable>

          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Join NetForge to start managing your network infrastructure with precision.
          </Text>

          <View style={styles.form}>
            <Input
              label="Full name"
              placeholder="Enter your full name"
              value={fullName}
              onChangeText={setFullName}
              autoComplete="name"
              error={errors.fullName}
            />
            <Input
              label="Email address"
              placeholder="name@company.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email}
            />
            <Input
              label="Password"
              placeholder="Min. 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              error={errors.password}
              rightElement={
                <Pressable onPress={() => setShowPassword((v) => !v)}>
                  {showPassword ? (
                    <Eye size={22} color={Colors.textMuted} />
                  ) : (
                    <EyeSlash size={22} color={Colors.textMuted} />
                  )}
                </Pressable>
              }
            />
            <Input
              label="Confirm password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
              autoComplete="new-password"
              error={errors.confirmPassword}
              rightElement={
                <Pressable onPress={() => setShowConfirm((v) => !v)}>
                  {showConfirm ? (
                    <Eye size={22} color={Colors.textMuted} />
                  ) : (
                    <EyeSlash size={22} color={Colors.textMuted} />
                  )}
                </Pressable>
              }
            />

            {/* ToS checkbox */}
            <Pressable
              style={styles.tosRow}
              onPress={() => setAgreedToTos((v) => !v)}
            >
              <View style={[styles.checkbox, agreedToTos && styles.checkboxChecked]}>
                {agreedToTos && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.tosText}>
                I agree to the{' '}
                <Text style={styles.tosLink}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.tosLink}>Privacy Policy</Text>.
              </Text>
            </Pressable>
            {errors.tos ? <Text style={styles.errorText}>{errors.tos}</Text> : null}

            {generalError ? <Text style={styles.errorText}>{generalError}</Text> : null}

            <Button
              label="Create account"
              variant="primary"
              fullWidth
              loading={loading}
              onPress={handleSignUp}
            />

            {/* Guest Sandbox Mode Option */}
            {__DEV__ && (
              <Pressable
                style={styles.guestButton}
                onPress={async () => {
                  await useAuthStore.getState().signInAsGuest()
                  router.replace('/(tabs)')
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Lightning size={16} color={Colors.primary} weight="fill" />
                  <Text style={styles.guestButtonText}>Continue as Guest (Offline Mode)</Text>
                </View>
              </Pressable>
            )}
          </View>

          {/* Login link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Pressable onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>Log in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: 24,
  },
  backButton: {
    marginBottom: 24,
    width: 40,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 24,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  form: {
    gap: 16,
  },
  tosRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    fontSize: 12,
    color: Colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  tosText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  tosLink: {
    color: Colors.primary,
    fontFamily: 'Inter_500Medium',
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.error,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    paddingBottom: 16,
  },
  footerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
  },
  footerLink: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Colors.primary,
  },
  guestButton: {
    marginTop: 8,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.ice,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.primary,
  },
})
