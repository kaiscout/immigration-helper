import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  loadSubscriptionState,
  setSubscriptionPreviewMode,
  useSubscriptionPreviewMode
} from "../data/subscriptionService";

const WIDTH = 140;
const HEIGHT = 62;
const MARGIN = 12;

export default function SubscriptionPreviewButton() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const mode = useSubscriptionPreviewMode();
  const [isPlus, setIsPlus] = useState(false);
  const [position, setPosition] = useState({ x: MARGIN, y: 110 });
  const positionRef = useRef(position);
  const origin = useRef(position);
  const moved = useRef(false);
  const bounds = useMemo(() => ({
    left: insets.left + MARGIN,
    right: Math.max(insets.left + MARGIN, width - insets.right - WIDTH - MARGIN),
    top: insets.top + MARGIN,
    bottom: Math.max(insets.top + MARGIN, height - insets.bottom - HEIGHT - MARGIN)
  }), [width, height, insets.left, insets.right, insets.top, insets.bottom]);
  const clamp = useCallback((x, y) => {
    const b = bounds;
    return { x: Math.max(b.left, Math.min(b.right, x)), y: Math.max(b.top, Math.min(b.bottom, y)) };
  }, [bounds]);
  const moveTo = useCallback((x, y) => {
    const next = clamp(x, y);
    positionRef.current = next;
    setPosition(next);
  }, [clamp]);

  useEffect(() => {
    let active = true;
    loadSubscriptionState().then(state => { if (active) setIsPlus(state.isPlus); }).catch(() => {});
    return () => { active = false; };
  }, [mode]);
  // PanResponder stores these handlers; their refs are read only during gestures.
  // eslint-disable-next-line react-hooks/refs
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 6,
    onPanResponderGrant: () => {
      origin.current = clamp(positionRef.current.x, positionRef.current.y);
      moved.current = true;
    },
    onPanResponderMove: (_, gesture) => moveTo(origin.current.x + gesture.dx, origin.current.y + gesture.dy),
    onPanResponderTerminationRequest: () => false
  }), [clamp, moveTo]);
  const plus = mode ? mode === "plus" : isPlus;
  const visiblePosition = clamp(position.x, position.y);

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View {...responder.panHandlers} style={[styles.position, {left: visiblePosition.x, top: visiblePosition.y}]}>
        <Pressable
          onPressIn={() => { moved.current = false; }}
          onPress={() => { if (!moved.current) setSubscriptionPreviewMode(plus ? "free" : "plus"); }}
          accessibilityRole="button"
          accessibilityLabel={`Testing ${plus ? "Plus" : "Free"} mode. Switch to ${plus ? "Free" : "Plus"}`}
          accessibilityHint="Tap to switch access. Drag to reposition. No purchase is made."
          style={[styles.button, plus && styles.plus]}
        >
          <Text style={styles.label}>{plus ? "PLUS" : "FREE"} · TEST</Text>
          <Text style={styles.hint}>Tap to switch · ⠿ drag</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 9999, pointerEvents: "box-none" },
  position: { position: "absolute", width: WIDTH, height: HEIGHT, elevation: 20 },
  button: { flex: 1, borderRadius: 20, backgroundColor: "#334155", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff", boxShadow: "0px 4px 12px rgba(0,0,0,0.25)" },
  plus: { backgroundColor: "#6D28D9" },
  label: { color: "#fff", fontWeight: "800", fontSize: 14 },
  hint: { color: "#fff", fontSize: 10, marginTop: 4 }
});
