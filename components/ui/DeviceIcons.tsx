import React from 'react'
import Svg, {
  Circle,
  Rect,
  Path,
  Line,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg'

type IconProps = {
  size?: number
  color?: string
}

export function RouterIcon({ size = 48, color }: IconProps) {
  const primaryColor = color || '#3B82F6'
  const secondaryColor = color || '#1D4ED8'

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="router-grad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={primaryColor} />
          <Stop offset="100%" stopColor={secondaryColor} />
        </LinearGradient>
      </Defs>
      <Circle cx="24" cy="24" r="18" fill="url(#router-grad)" stroke={color || '#60A5FA'} strokeWidth="2" />
      <Circle cx="24" cy="24" r="8" fill="none" stroke={color || '#93C5FD'} strokeWidth="1.5" strokeDasharray="3,3" />
      <Circle cx="24" cy="24" r="3" fill="#FFFFFF" />
      <Path d="M 24,14 L 24,6 M 24,6 L 21,9 M 24,6 L 27,9" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M 24,34 L 24,42 M 24,42 L 21,39 M 24,42 L 27,39" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M 14,24 L 6,24 M 6,24 L 9,21 M 6,24 L 9,27" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M 34,24 L 42,24 M 42,24 L 39,21 M 42,24 L 39,27" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function SwitchIcon({ size = 48, color }: IconProps) {
  const primaryColor = color || '#0D9488'
  const secondaryColor = color || '#115E59'

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="switch-grad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={primaryColor} />
          <Stop offset="100%" stopColor={secondaryColor} />
        </LinearGradient>
      </Defs>
      <Rect x="4" y="10" width="40" height="28" rx="6" fill="url(#switch-grad)" stroke={color || '#2DD4BF'} strokeWidth="2" />
      <Rect x="8" y="28" width="5" height="4" rx="1" fill={color || '#14B8A6'} />
      <Rect x="16" y="28" width="5" height="4" rx="1" fill={color || '#14B8A6'} />
      <Rect x="24" y="28" width="5" height="4" rx="1" fill={color || '#14B8A6'} />
      <Rect x="32" y="28" width="5" height="4" rx="1" fill={color || '#14B8A6'} />
      <Path d="M 12,18 L 36,18 M 12,18 L 16,14 M 12,18 L 16,22" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M 36,23 L 12,23 M 36,23 L 32,19 M 36,23 L 32,27" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function FirewallIcon({ size = 48, color }: IconProps) {
  const primaryColor = color || '#EA580C'
  const secondaryColor = color || '#9A3412'

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="fw-grad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={primaryColor} />
          <Stop offset="100%" stopColor={secondaryColor} />
        </LinearGradient>
      </Defs>
      <Rect x="6" y="6" width="36" height="36" rx="6" fill="url(#fw-grad)" stroke={color || '#FB923C'} strokeWidth="2" />
      <Line x1="6" y1="18" x2="42" y2="18" stroke={color || '#FB923C'} strokeWidth="1.5" />
      <Line x1="6" y1="30" x2="42" y2="30" stroke={color || '#FB923C'} strokeWidth="1.5" />
      <Line x1="18" y1="6" x2="18" y2="18" stroke={color || '#FB923C'} strokeWidth="1.5" />
      <Line x1="30" y1="6" x2="30" y2="18" stroke={color || '#FB923C'} strokeWidth="1.5" />
      <Line x1="12" y1="18" x2="12" y2="30" stroke={color || '#FB923C'} strokeWidth="1.5" />
      <Line x1="24" y1="18" x2="24" y2="30" stroke={color || '#FB923C'} strokeWidth="1.5" />
      <Line x1="36" y1="18" x2="36" y2="30" stroke={color || '#FB923C'} strokeWidth="1.5" />
      <Line x1="18" y1="30" x2="18" y2="42" stroke={color || '#FB923C'} strokeWidth="1.5" />
      <Line x1="30" y1="30" x2="30" y2="42" stroke={color || '#FB923C'} strokeWidth="1.5" />
      <Path d="M 24,14 L 32,17 L 32,24 C 32,29.5 28.5,33.5 24,35 C 19.5,33.5 16,29.5 16,24 L 16,17 Z" fill="#FFFFFF" opacity={0.9} />
      <Path d="M 24,17 L 30,19.5 L 30,24 C 30,28.5 27.5,31.8 24,33 C 20.5,31.8 18,28.5 18,24 L 18,19.5 Z" fill={primaryColor} />
      <Circle cx="24" cy="24" r="2.5" fill="#FFFFFF" />
      <Path d="M 22.5,24 L 25.5,24 L 26,29 L 22,29 Z" fill="#FFFFFF" />
    </Svg>
  )
}

export function WanIcon({ size = 48, color }: IconProps) {
  const primaryColor = color || '#059669'
  const secondaryColor = color || '#047857'

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="wan-grad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={primaryColor} />
          <Stop offset="100%" stopColor={secondaryColor} />
        </LinearGradient>
      </Defs>
      <Path d="M 16,36 C 11.5,36 8,32.5 8,28 C 8,23.8 11.2,20.5 15.3,20.1 C 17,15.3 21.6,12 27,12 C 33.6,12 39,17.4 39,24 C 39,24.3 38.9,24.7 38.9,25 C 41.8,25.8 44,28.4 44,31.5 C 44,35 41.2,37.8 37.7,37.8 L 16,37.8 Z" fill="url(#wan-grad)" stroke={color || '#34D399'} strokeWidth="2" />
      <Path d="M 20,20 C 23,24 28,24 31,20" fill="none" stroke={color || '#A7F3D0'} strokeWidth="1.5" strokeDasharray="2,2" />
      <Path d="M 18,29 C 22,33 27,33 32,29" fill="none" stroke={color || '#A7F3D0'} strokeWidth="1.5" strokeDasharray="2,2" />
      <Circle cx="21" cy="25" r="2.5" fill="#FFFFFF" />
      <Circle cx="31" cy="27" r="2.5" fill="#FFFFFF" />
      <Circle cx="27" cy="31" r="2" fill="#FFFFFF" />
      <Line x1="21" y1="25" x2="31" y2="27" stroke="#FFFFFF" strokeWidth="1.5" />
      <Line x1="21" y1="25" x2="27" y2="31" stroke="#FFFFFF" strokeWidth="1.5" />
      <Line x1="31" y1="27" x2="27" y2="31" stroke="#FFFFFF" strokeWidth="1.5" />
    </Svg>
  )
}

export function DepartmentIcon({ size = 48, color }: IconProps) {
  const primaryColor = color || '#2563EB'
  const secondaryColor = color || '#1E40AF'

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="dept-grad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={primaryColor} />
          <Stop offset="100%" stopColor={secondaryColor} />
        </LinearGradient>
      </Defs>
      <Rect x="6" y="8" width="36" height="24" rx="3" fill="url(#dept-grad)" stroke={color || '#60A5FA'} strokeWidth="2" />
      <Rect x="8" y="10" width="32" height="17" rx="1" fill="#1E3A8A" opacity={0.4} />
      <Path d="M 20,32 L 28,32 L 30,39 L 18,39 Z" fill={secondaryColor} stroke={color || '#60A5FA'} strokeWidth="2" />
      <Rect x="14" y="38" width="20" height="3" rx="1.5" fill="#3B82F6" />
      <Path d="M 12,14 L 15,17 L 12,20" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="17" y1="20" x2="23" y2="20" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  )
}

export function getDeviceIconComponent(type: string | undefined) {
  switch (type) {
    case 'router':
      return RouterIcon
    case 'switch':
      return SwitchIcon
    case 'firewall':
      return FirewallIcon
    case 'wan':
      return WanIcon
    default:
      return DepartmentIcon
  }
}
