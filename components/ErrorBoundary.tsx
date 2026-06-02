/**
 * ErrorBoundary.tsx
 *
 * Root-level React class error boundary.
 * Catches any render/lifecycle error, logs it via the AppLogger utility,
 * and renders a user-friendly fallback screen with a "Restart App" button.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <RootLayoutNav />
 *   </ErrorBoundary>
 */

import React, { Component, type ReactNode } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native'
import * as Updates from 'expo-updates'
import { Colors } from '@/constants/colors'
import { AppLogger } from '@/lib/logger'

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  children: ReactNode
  /** When true, renders an inline error card instead of a full-screen fallback */
  inline?: boolean
  /** Optional label shown in the inline card header */
  inlineLabel?: string
}

type State = {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

// ─── Component ───────────────────────────────────────────────────────────────

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    AppLogger.error('ErrorBoundary caught an error', { error, errorInfo })
  }

  private handleRestart = async () => {
    try {
      await Updates.reloadAsync()
    } catch {
      // If Updates.reloadAsync is unavailable (e.g. Expo Go dev mode), reset state
      this.setState({ hasError: false, error: null, errorInfo: null })
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const { inline, inlineLabel } = this.props

    if (inline) {
      return (
        <View style={styles.inlineContainer}>
          <View style={styles.inlineHeader}>
            <View style={styles.inlineDot} />
            <Text style={styles.inlineTitle}>
              {inlineLabel ?? 'Component Error'}
            </Text>
          </View>
          <Text style={styles.inlineMessage}>
            This section encountered an error and could not render. The rest of
            the app remains functional.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.inlineButton, pressed && styles.pressed]}
            onPress={this.handleReset}
            accessibilityRole="button"
            accessibilityLabel="Retry loading this section"
          >
            <Text style={styles.inlineButtonText}>Retry</Text>
          </Pressable>
        </View>
      )
    }

    // Full-screen fallback
    return (
      <View style={styles.fullScreen}>
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>⚡</Text>
        </View>

        <Text style={styles.heading}>Something went wrong</Text>
        <Text style={styles.subheading}>
          NetForge hit an unexpected error. Restarting usually fixes this.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.restartButton, pressed && styles.pressed]}
          onPress={this.handleRestart}
          accessibilityRole="button"
          accessibilityLabel="Restart the app"
        >
          <Text style={styles.restartButtonText}>Restart App</Text>
        </Pressable>

        {__DEV__ && this.state.error && (
          <ScrollView style={styles.devDetails}>
            <Text style={styles.devErrorTitle}>
              {this.state.error.name}: {this.state.error.message}
            </Text>
            <Text style={styles.devStack}>
              {this.state.errorInfo?.componentStack ?? this.state.error.stack}
            </Text>
          </ScrollView>
        )}
      </View>
    )
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Full-screen
  fullScreen: {
    flex: 1,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 32,
  },
  heading: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  subheading: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  restartButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  restartButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.white,
  },
  pressed: {
    opacity: 0.75,
  },

  // Dev error details
  devDetails: {
    marginTop: 28,
    maxHeight: 220,
    width: '100%',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
  },
  devErrorTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 11,
    color: Colors.error,
    marginBottom: 8,
  },
  devStack: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 10,
    color: Colors.textMuted,
  },

  // Inline card
  inlineContainer: {
    margin: 16,
    backgroundColor: Colors.errorContainer,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: `${Colors.error}30`,
  },
  inlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  inlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  inlineTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.error,
  },
  inlineMessage: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  inlineButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.error,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inlineButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.white,
  },
})
