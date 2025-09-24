import React from 'react';
import { View } from 'react-native';

interface CameraIconProps {
  size?: number;
  color?: string;
}

export function CameraIcon({ size = 24, color = 'white' }: CameraIconProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size * 0.3,
          height: size * 0.3,
          borderRadius: size * 0.15,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
