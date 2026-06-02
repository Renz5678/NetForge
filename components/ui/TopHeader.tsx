import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { NetForgeLogo } from '@/components/ui/NetForgeLogo'
import { Colors } from '@/constants/colors'
import { useAuthStore } from '@/stores/useAuthStore'
import { getInitials } from '@/lib/formatters'
import { ProfileSidebar } from '@/components/ui/ProfileSidebar'

type TopHeaderProps = {
  title?: string
  subtitle?: React.ReactNode
  leftIcon?: React.ReactNode
  rightActions?: React.ReactNode
}

export function TopHeader({ title, subtitle, leftIcon, rightActions }: TopHeaderProps) {
  const user = useAuthStore((s) => s.user)
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  
  const fullName = user?.user_metadata?.full_name ?? 'User'
  const initials = getInitials(fullName)
  
  return (
    <>
      <View style={styles.header}>
        <View style={styles.left}>
          {leftIcon ? (
            <View style={styles.iconContainer}>{leftIcon}</View>
          ) : (
            <NetForgeLogo size={22} />
          )}
          <View>
            <Text style={styles.title}>{title || 'NetForge'}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        <View style={styles.right}>
          {rightActions}
          <Pressable onPress={() => setSidebarOpen(true)} style={styles.avatarCircle}>
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
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 24,
    alignItems: 'center',
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
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  avatarText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.white,
  },
})
