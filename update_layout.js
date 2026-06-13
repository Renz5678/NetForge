const fs = require('fs');

let content = fs.readFileSync('app/(tabs)/_layout.tsx', 'utf8');

// 1. Imports
content = content.replace(
  `import { Colors } from '@/constants/colors'`,
  `import { Colors } from '@/constants/colors'\nimport { Plus } from 'phosphor-react-native'\nimport { useAuthStore } from '@/stores/useAuthStore'\nimport { haptics } from '@/utils/haptics'\nimport { useRouter } from 'expo-router'\nimport { Modal, KeyboardAvoidingView, Platform, Text, TextInput, Pressable } from 'react-native'`
);
content = content.replace(
  `import React from 'react'`,
  `import React, { useState, useRef } from 'react'`
);

// 2. Component Logic
content = content.replace(
  `export default function TabsLayout() {\n  const hasActiveConfig = useConfigStore((s) => !!s.activeConfig)`,
  `export default function TabsLayout() {\n  const hasActiveConfig = useConfigStore((s) => !!s.activeConfig)\n  const isCreateModalOpen = useConfigStore((s) => s.isCreateModalOpen)\n  const setCreateModalOpen = useConfigStore((s) => s.setCreateModalOpen)\n  const createConfig = useConfigStore((s) => s.createConfig)\n  const setActiveConfig = useConfigStore((s) => s.setActiveConfig)\n  const user = useAuthStore((s) => s.user)\n  const router = useRouter()\n\n  const [nameInput, setNameInput] = useState('')\n  const [nameCreating, setNameCreating] = useState(false)\n  const nameInputRef = useRef<TextInput>(null)\n\n  const handleOpenCreateModal = () => {\n    setNameInput('')\n    setCreateModalOpen(true)\n    setTimeout(() => nameInputRef.current?.focus(), 200)\n  }\n\n  const handleConfirmCreate = async () => {\n    if (!user?.id) return\n    const trimmed = nameInput.trim()\n    if (!trimmed) return\n    setNameCreating(true)\n    haptics.light()\n    const newConfig = await createConfig(trimmed, user.id)\n    setNameCreating(false)\n    setCreateModalOpen(false)\n    if (newConfig) {\n      haptics.medium()\n      setActiveConfig(newConfig.id)\n      router.push(\`/config/${newConfig.id}\`)\n    } else {\n      haptics.error()\n    }\n  }`
);

// 3. Add Tab
const createTab = `
      {/* -- Tab 3: Create (FAB) --------------------------------------------- */}
      <Tabs.Screen
        name="create_action"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={styles.fabWrap}>
              <Plus size={24} color={Colors.white} weight="bold" />
            </View>
          ),
          tabBarButton: (props) => (
            <Pressable
              {...props}
              style={[props.style, { marginTop: -15 }]}
              onPress={handleOpenCreateModal}
            />
          ),
        }}
      />
`;
content = content.replace(
  `      {/* -- Tab 3: Subnet --------------------------------------------------- */}`,
  createTab + `      {/* -- Tab 4: Subnet --------------------------------------------------- */}`
);

// 4. Wrap with View to add Modal
content = content.replace(
  `    <Tabs\n      screenOptions={{`,
  `    <View style={{ flex: 1 }}>\n      <Tabs\n        screenOptions={{`
);

const modalStr = `
      </Tabs>

      {/* -- New Network Name Prompt ---------------- */}
      <Modal
        visible={isCreateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalOpen(false)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={namePrompt.overlay}
        >
          <Pressable style={namePrompt.backdrop} onPress={() => setCreateModalOpen(false)} />
          <View style={namePrompt.card}>
            <View style={namePrompt.handle} />

            <Text style={namePrompt.heading}>Name your network</Text>
            <Text style={namePrompt.sub}>You can always rename it later.</Text>

            <TextInput
              ref={nameInputRef}
              style={namePrompt.input}
              placeholder="e.g. Enterprise Campus LAN"
              placeholderTextColor={Colors.textMuted}
              value={nameInput}
              onChangeText={setNameInput}
              onSubmitEditing={handleConfirmCreate}
              returnKeyType="done"
              autoCapitalize="words"
              maxLength={80}
            />

            <View style={namePrompt.actions}>
              <Pressable
                style={({ pressed }) => [
                  namePrompt.confirmBtn,
                  (!nameInput.trim() || nameCreating) && namePrompt.confirmBtnDisabled,
                  pressed && { opacity: 0.88 },
                ]}
                onPress={handleConfirmCreate}
                disabled={!nameInput.trim() || nameCreating}
              >
                <Text style={[
                  namePrompt.confirmText,
                  (!nameInput.trim() || nameCreating) && namePrompt.confirmTextDisabled,
                ]}>
                  {nameCreating ? 'Creating…' : 'Create Network'}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [namePrompt.cancelBtn, pressed && { opacity: 0.6 }]}
                onPress={() => setCreateModalOpen(false)}
                disabled={nameCreating}
              >
                <Text style={namePrompt.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>`;

content = content.replace(
  `      <Tabs.Screen name="profile" options={{ href: null }} />\n    </Tabs>`,
  `      <Tabs.Screen name="profile" options={{ href: null }} />\n` + modalStr
);

// 5. Add Styles
const stylesToAdd = `
  fabWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    // Removed silhouette/shadow as requested
  },
});

const namePrompt = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,26,65,0.45)',
  },
  card: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.10,
        shadowRadius: 18,
      },
      android: { elevation: 20 },
    }),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 22,
  },
  heading: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 22,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
    marginBottom: 20,
  },
  actions: {
    gap: 10,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  confirmBtnDisabled: {
    backgroundColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.white,
  },
  confirmTextDisabled: {
    color: Colors.textMuted,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.textMuted,
  },`;

content = content.replace(`});\n`, stylesToAdd + `\n});\n`);

fs.writeFileSync('app/(tabs)/_layout.tsx', content);
console.log('Update complete');
