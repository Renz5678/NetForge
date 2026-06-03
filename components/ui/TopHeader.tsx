/**
 * TopHeader.tsx
 *
 * Shared header used across all main tabs.
 * The avatar in the top-right opens the ProfileSidebar.
 * Guest users get a visually distinct muted avatar so they can tell
 * at a glance that they are in offline mode.
 */

import React, { useState } from 'react'
import { View, Text, Image, StyleSheet, Pressable } from 'react-native'
import { Colors } from '@/constants/colors'
import { useAuthStore } from '@/stores/useAuthStore'
import { getInitials } from '@/lib/formatters'
import { ProfileSidebar } from '@/components/ui/ProfileSidebar'

export type TopHeaderProps = {
  title?: string
  subtitle?: React.ReactNode
  leftIcon?: React.ReactNode
  rightActions?: React.ReactNode
}

/** Returns true when the current session is a local/offline guest account. */
function isGuestUser(email: string | undefined): boolean {
  if (!email) return false
  return (
    email.endsWith('.local') ||
    email.endsWith('.guest') ||
    email === 'guest@netforge.com'
  )
}

export function TopHeader({ title, subtitle, leftIcon, rightActions }: TopHeaderProps) {
  const user = useAuthStore((s) => s.user)
  const [isSidebarOpen, setSidebarOpen] = useState(false)

  const fullName = user?.user_metadata?.full_name ?? 'User'
  const initials = getInitials(fullName)
  const isGuest = isGuestUser(user?.email)

  return (
    <>
      <View style={styles.header}>
        {/* Left: logo/icon + title */}
        <View style={styles.left}>
          {leftIcon ? (
            <View style={styles.iconContainer}>{leftIcon}</View>
          ) : (
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.iconImage}
              resizeMode="contain"
            />
          )}
          <View style={styles.titleGroup}>
            <Text style={styles.title} numberOfLines={1}>
              {title || 'NetForge'}
            </Text>
            {subtitle != null ? (
              typeof subtitle === 'string' ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : (
                <View style={styles.subtitleWrapper}>
                  {subtitle}
                </View>
              )
            ) : null}
          </View>
        </View>

        {/* Right: optional actions + avatar */}
        <View style={styles.right}>
          {rightActions}
          <Pressable
            onPress={() => setSidebarOpen(true)}
            style={({ pressed }) => [
              styles.avatarCircle,
              isGuest && styles.avatarCircleGuest,
              pressed && { opacity: 0.75 },
            ]}
            hitSlop={8}
            accessibilityLabel={isGuest ? 'Guest account — tap to open settings' : 'Open profile settings'}
            accessibilityRole="button"
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </Pressable>
        </View>
      </View>

      <ProfileSidebar visible={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0, // allows text to truncate properly
  },
  iconContainer: {
    width: 28,
    alignItems: 'center',
  },
  iconImage: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  titleGroup: {
    flexShrink: 1,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  subtitleWrapper: {
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 8,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.ice,
  },
  // Guests get a muted tone — distinct from the primary blue — so users
  // immediately know they are in local/offline mode.
  avatarCircleGuest: {
    backgroundColor: Colors.textMuted,
    borderColor: Colors.border,
  },
  avatarText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.white,
  },
})
