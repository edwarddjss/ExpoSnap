import { useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';
import type { SessionStatus } from './session.js';

const SIZE = 44;
/** Movement under this many points is a tap, not a drag. */
const TAP_SLOP = 6;

const STATUS_LABEL: Record<SessionStatus, string> = {
  searching: 'ExpoSnap: looking for the server',
  connected: 'ExpoSnap: take a screenshot',
  capturing: 'ExpoSnap: capturing',
};

interface Props {
  status: SessionStatus;
  onPress: () => void;
  initial?: { x: number; y: number };
}

/**
 * A small camera that floats over the app, outside the captured area, and
 * can be dragged out of the way. A tap sends a screenshot to the agent; the
 * dot says whether the server has been found.
 */
export function CaptureButton({
  status,
  onPress,
  initial = { x: 16, y: 72 },
}: Props) {
  const position = useRef(new Animated.ValueXY(initial)).current;
  const resting = useRef(initial);
  const press = useRef(onPress);
  press.current = onPress;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_event, gesture) => {
          position.setValue({
            x: resting.current.x + gesture.dx,
            y: resting.current.y + gesture.dy,
          });
        },
        onPanResponderRelease: (_event, gesture) => {
          if (
            Math.abs(gesture.dx) < TAP_SLOP &&
            Math.abs(gesture.dy) < TAP_SLOP
          ) {
            position.setValue(resting.current);
            press.current();
            return;
          }
          const { width, height } = Dimensions.get('window');
          const next = {
            x: Math.min(
              Math.max(0, resting.current.x + gesture.dx),
              width - SIZE
            ),
            y: Math.min(
              Math.max(0, resting.current.y + gesture.dy),
              height - SIZE
            ),
          };
          resting.current = next;
          Animated.spring(position, {
            toValue: next,
            useNativeDriver: false,
            friction: 7,
          }).start();
        },
        onPanResponderTerminate: () => position.setValue(resting.current),
      }),
    [position]
  );

  return (
    <Animated.View
      accessibilityRole="button"
      accessibilityLabel={STATUS_LABEL[status]}
      accessibilityState={{
        disabled: status !== 'connected',
        busy: status === 'capturing',
      }}
      style={[styles.button, { transform: position.getTranslateTransform() }]}
      {...responder.panHandlers}
    >
      {status === 'capturing' ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <View style={styles.body}>
          <View style={styles.lens} />
        </View>
      )}
      <View
        style={[
          styles.dot,
          status === 'searching' ? styles.dotSearching : styles.dotConnected,
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: 'rgba(17, 17, 17, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 12,
  },
  body: {
    width: 22,
    height: 16,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lens: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(17, 17, 17, 0.82)',
  },
  dotConnected: { backgroundColor: '#34C759' },
  dotSearching: { backgroundColor: '#8E8E93' },
});
