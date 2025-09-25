import React, { useRef } from 'react';
import { Animated, PanResponder, Dimensions } from 'react-native';
import { CameraIcon, ConnectionStatus } from './CameraIcon';

interface DraggableIconProps {
  status: ConnectionStatus;
  onPress: () => void;
  disabled?: boolean;
  initialX?: number;
  initialY?: number;
}

export function DraggableIcon({ 
  status, 
  onPress, 
  disabled = false,
  initialX = 20,
  initialY = 60
}: DraggableIconProps) {
  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      
      onPanResponderGrant: () => {
        // Set offset to current position
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value
        });
        pan.setValue({ x: 0, y: 0 });
      },
      
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      
      onPanResponderRelease: () => {
        pan.flattenOffset();
        
        // Get screen dimensions
        const { width, height } = Dimensions.get('window');
        const iconSize = 48; // Match default icon size
        
        // Get current position
        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;
        
        // Clamp position to screen bounds
        const clampedX = Math.min(Math.max(0, currentX), width - iconSize);
        const clampedY = Math.min(Math.max(0, currentY), height - iconSize);
        
        // Animate to clamped position if needed
        if (currentX !== clampedX || currentY !== clampedY) {
          Animated.spring(pan, {
            toValue: { x: clampedX, y: clampedY },
            useNativeDriver: false,
            friction: 7,
            tension: 40,
          }).start();
        }
      }
    })
  ).current;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        transform: [{ translateX: pan.x }, { translateY: pan.y }],
        zIndex: 9999,
        elevation: 999, // For Android
      }}
      {...panResponder.panHandlers}
    >
      <CameraIcon
        status={status}
        onPress={onPress}
        disabled={disabled}
      />
    </Animated.View>
  );
}