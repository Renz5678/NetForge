import React, { useState } from 'react'
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Eye, EyeSlash, Lightning } from 'phosphor-react-native'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/useAuthStore'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'

export default function LoginScreen() {
  const router = useRouter()
  const signIn = useAuthStore((s) => s.signIn)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [generalError, setGeneralError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)

  const validate = (): boolean => {
    let valid = true
    setEmailError('')
    setPasswordError('')
    setGeneralError('')

    if (!email.trim()) {
      setEmailError('Email is required')
      valid = false
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Please enter a valid email')
      valid = false
    }

    if (!password) {
      setPasswordError('Password is required')
      valid = false
    }

    return valid
  }

  const handleLogin = async () => {
    if (!validate()) return
    setLoading(true)
    const error = await signIn(email.trim(), password)
    setLoading(false)

    if (error) {
      setGeneralError(error)
    } else {
      router.replace('/(tabs)')
    }
  }

  const handleForgotPassword = async () => {
    const trimmed = email.trim()
    if (!trimmed) {
      Alert.alert(
        'Enter your email',
        'Type your email address in the field above, then tap "Forgot password?" again.'
      )
      return
    }
    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      setEmailError('Please enter a valid email first')
      return
    }
    setForgotLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed)
    setForgotLoading(false)
    if (error) {
      if (
        error.message.toLowerCase().includes('user not found') ||
        error.message.toLowerCase().includes('not found') ||
        error.message.toLowerCase().includes('not registered')
      ) {
        Alert.alert(
          'Email not registered',
          'We couldn\'t find an account with that email address. Would you like to create one?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign up', onPress: () => router.push('/(auth)/signup') }
          ]
        )
      } else {
        Alert.alert('Reset Failed', error.message)
      }
    } else {
      setForgotSent(true)
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
          {/* App icon */}
          <View style={styles.iconContainer}>
            <View style={styles.appIcon}>
              <Image
                source={require('../../assets/images/icon.png')}
                style={styles.appIconImage}
                resizeMode="cover"
              />
            </View>
          </View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Access your secure network configuration environment.</Text>

          {/* Form card */}
          <Card style={styles.formCard} padding={24}>
            <Input
              label="Email Address"
              placeholder="admin@netforge.local"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={emailError}
            />

            <View style={styles.fieldGap} />

            <Input
              label="Password"
              placeholder="••••••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              error={passwordError}
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

            {generalError ? <Text style={styles.generalError}>{generalError}</Text> : null}

            <View style={styles.fieldGap} />

            <Button
              label="Log in →"
              variant="primary"
              fullWidth
              loading={loading}
              onPress={handleLogin}
            />

            <Pressable style={styles.forgotContainer} onPress={handleForgotPassword} disabled={forgotLoading || forgotSent}>
              <Text style={styles.forgotText}>
                {forgotSent ? 'Reset link sent' : forgotLoading ? 'Sending...' : 'Forgot password?'}
              </Text>
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* SSH Key / SAML (decorative per design) */}
            <View style={styles.ssoRow}>
              <Pressable style={styles.ssoButton}>
                <Text style={styles.ssoText}>⌥ SSH Key</Text>
              </Pressable>
              <Pressable style={styles.ssoButton}>
                <Text style={styles.ssoText}>⛨ SAML</Text>
              </Pressable>
            </View>

            {/* Guest Sandbox Mode Option */}
            {__DEV__ && (
              <Pressable
                style={styles.guestButton}
                disabled={guestLoading}
                onPress={async () => {
                  setGuestLoading(true)
                  try {
                    await useAuthStore.getState().signInAsGuest()
                    router.replace('/(tabs)')
                  } catch (e: any) {
                    Alert.alert('Guest Sign-in Failed', e?.message ?? 'An unexpected error occurred.')
                  } finally {
                    setGuestLoading(false)
                  }
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Lightning size={16} color={Colors.primary} weight="fill" />
                  <Text style={styles.guestButtonText}>Continue as Guest (Offline Mode)</Text>
                </View>
              </Pressable>
            )}
          </Card>

          {/* Sign up link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Pressable onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.footerLink}>Sign up</Text>
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
    backgroundColor: Colors.surfaceAlt,
  },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
  },
  appIconImage: {
    width: 72,
    height: 72,
  },
  appIconText: {
    fontSize: 36,
    color: Colors.white,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 28,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  formCard: {
    gap: 0,
  },
  fieldGap: { height: 16 },
  generalError: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.error,
    marginTop: 8,
  },
  forgotContainer: {
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  forgotText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.medium,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  ssoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  ssoButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ssoText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
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
    marginTop: 16,
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
