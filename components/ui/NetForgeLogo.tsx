import React from 'react'
import Svg, { Circle, Line } from 'react-native-svg'
import { Colors } from '@/constants/colors'

type NetForgeLogoProps = {
  size?: number
  color?: string
}

export function NetForgeLogo({ size = 48, color = Colors.primary }: NetForgeLogoProps) {
  // We use a viewBox of 0 0 24 24 for clean scaling
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Edges */}
      <Line
        x1="6"
        y1="18"
        x2="12"
        y2="6"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <Line
        x1="12"
        y1="6"
        x2="18"
        y2="18"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <Line
        x1="6"
        y1="18"
        x2="18"
        y2="18"
        stroke={color}
        strokeWidth="2"
        strokeDasharray="2,2"
        strokeLinecap="round"
      />
      
      {/* Nodes */}
      <Circle cx="12" cy="6" r="3.5" fill={Colors.white} stroke={color} strokeWidth="3" />
      <Circle cx="6" cy="18" r="3" fill={color} />
      <Circle cx="18" cy="18" r="3" fill={color} />
    </Svg>
  )
}
