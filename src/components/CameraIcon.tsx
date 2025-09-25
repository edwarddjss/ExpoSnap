import React from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface CameraIconProps {
  size?: number;
  status: ConnectionStatus;
  onPress?: () => void;
  disabled?: boolean;
}

const getStatusColor = (status: ConnectionStatus): string => {
  switch (status) {
    case 'disconnected':
      return '#9CA3AF'; // neutral gray
    case 'connecting':
      return '#6B7280'; // darker gray
    case 'connected':
      return '#1F2937'; // dark charcoal
    default:
      return '#9CA3AF';
  }
};

export function CameraIcon({ 
  size = 48, 
  status, 
  onPress, 
  disabled = false 
}: CameraIconProps) {
  const color = getStatusColor(status);
  const isClickable = status === 'connected' && !disabled && onPress;
  
  const iconContent = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 8,
        borderWidth: 2,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: status === 'connected' ? `${color}08` : 'transparent',
      }}
    >
      {status === 'connecting' ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <>
          <View
            style={{
              width: size * 0.6,
              height: size * 0.4,
              borderWidth: 2,
              borderColor: color,
              borderRadius: size * 0.08,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: size * 0.25,
                height: size * 0.25,
                borderRadius: size * 0.125,
                borderWidth: 2,
                borderColor: color,
              }}
            />
          </View>
          <View
            style={{
              position: 'absolute',
              top: size * 0.15,
              right: size * 0.15,
              width: size * 0.15,
              height: size * 0.08,
              backgroundColor: color,
              borderRadius: size * 0.04,
            }}
          />
        </>
      )}
    </View>
  );

  if (isClickable) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {iconContent}
      </TouchableOpacity>
    );
  }

  return iconContent;
}
