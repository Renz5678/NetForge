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

const PasswordRequirements = ({ password }: { password: string }) => {
  if (!password) return null
  const reqs = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
    { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
  ]

  return (
    <View style={styles.reqContainer}>
      {reqs.map((r, i) => (
        <View key={i} style={styles.reqRow}>
          <View style={[styles.reqDot, r.met && styles.reqDotMet]}>
            {r.met && <Text style={styles.reqCheck}>✓</Text>}
          </View>
          <Text style={[styles.reqText, r.met && styles.reqTextMet]}>{r.label}</Text>
        </View>
      ))}
    </View>
  )
}

export default function SignupScreen() {
  const router = useRouter()
  const signUp = useAuthStore((s) => s.signUp)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationPending, setConfirmationPending] = useState(false)

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    setGeneralError('')

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required'
    } else if (!/^[a-zA-Z0-9\s\-\.,']+$/.test(fullName)) {
      newErrors.fullName = 'Name contains invalid characters'
    }
    if (!email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email'
    }
    if (!password) {
      newErrors.password = 'Password is required'
    } else if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      newErrors.password = 'Please meet all password requirements'
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
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
      // Supabase returns session=null when email confirmation is required.
      // In that case show an inline "check your email" screen instead of
      // navigating to tabs (which would just bounce back to intro).
      const session = useAuthStore.getState().session
      if (session) {
        router.replace('/(tabs)')
      } else {
        setConfirmationPending(true)
      }
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        {/* ── Confirmation pending screen ─────────────────────────────── */}
        {confirmationPending ? (
          <View style={styles.confirmContainer}>
            <Text style={styles.confirmIcon}>✉️</Text>
            <Text style={styles.confirmTitle}>Check your inbox</Text>
            <Text style={styles.confirmBody}>
              We sent a confirmation link to{' '}
              <Text style={styles.confirmEmail}>{email.trim()}</Text>.{'\n'}
              Open it to activate your account, then come back and log in.
            </Text>
            <Pressable
              style={styles.confirmBtn}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.confirmBtnText}>Go to Login →</Text>
            </Pressable>
            <Pressable
              style={styles.confirmResend}
              onPress={() => router.push('/(auth)/signup')}
            >
              <Text style={styles.confirmResendText}>Used a wrong email? Start over</Text>
            </Pressable>
          </View>
        ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/login')} style={styles.backButton}>
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
            <PasswordRequirements password={password} />
            <Input
              label="Confirm password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
              autoComplete="new-password"
              error={(confirmPassword && password !== confirmPassword) ? 'Passwords do not match' : errors.confirmPassword}
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

            {/* General Errors */}

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
        )}
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

  reqContainer: {
    marginTop: -8,
    marginBottom: 8,
    gap: 6,
    paddingHorizontal: 4,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reqDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqDotMet: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  reqCheck: {
    color: Colors.white,
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
  },
  reqText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  reqTextMet: {
    color: Colors.success,
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

  // ── Confirmation pending ───────────────────────────────────────────────────
  confirmContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  confirmIcon: {
    fontSize: 56,
    marginBottom: 8,
  },
  confirmTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 24,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  confirmBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  confirmEmail: {
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  confirmBtn: {
    marginTop: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    alignSelf: 'stretch',
  },
  confirmBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.white,
  },
  confirmResend: {
    marginTop: 4,
    padding: 8,
  },
  confirmResendText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
})
