export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function mix(current, target, easing) {
  return current + (target - current) * easing;
}
