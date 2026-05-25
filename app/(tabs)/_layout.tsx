import { Tabs } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { House, Folders, ShieldCheck, UserCircle } from 'phosphor-react-native'
import { Colors } from '@/constants/colors'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.pale,
        tabBarLabelStyle: styles.label,
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View>
              {focused && <View style={styles.indicator} />}
              <House size={24} color={color as string} weight={focused ? 'fill' : 'regular'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="configs"
        options={{
          title: 'Configs',
          tabBarIcon: ({ color, focused }) => (
            <View>
              {focused && <View style={styles.indicator} />}
              <Folders size={24} color={color as string} weight={focused ? 'fill' : 'regular'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="validate"
        options={{
          title: 'Validate',
          tabBarIcon: ({ color, focused }) => (
            <View>
              {focused && <View style={styles.indicator} />}
              <ShieldCheck size={24} color={color as string} weight={focused ? 'fill' : 'regular'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View>
              {focused && <View style={styles.indicator} />}
              <UserCircle size={24} color={color as string} weight={focused ? 'fill' : 'regular'} />
            </View>
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 4,
    height: 60,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  indicator: {
    position: 'absolute',
    top: -8,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },
})
