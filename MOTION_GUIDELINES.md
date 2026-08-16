# Makkari AI — Motion & Animation Guidelines

## 1. Principles
All Makkari AI animations are built using **Framer Motion** and adhere to the following rules:
- **Calm & Fast**: Animations range between 300ms and 1100ms.
- **Organic Easing**: Standard curve `cubic-bezier(0.16, 1, 0.3, 1)` or `easeInOut`.
- **Zero Distraction**: No neon glows, no harsh bounces, no extreme elastic physics.

## 2. Signature Logo Sequence (`components/brand/logo-animation.tsx`)
1. **Dot Emergence**: `0ms - 250ms` (Warm dot appears with gentle scale).
2. **Spark Expansion**: `250ms - 500ms` (8-ray intelligence spark rotates 90°).
3. **Ray Condensation**: `500ms - 750ms` (Rays collapse into focal nodes).
4. **M Ribbon Fold**: `750ms - 950ms` (Path stroke animates into 'M' emblem).
5. **Logo Settlement**: `950ms - 1100ms` (Wordmark fades in smoothly with tagline).

## 3. Micro-Interactions & Loaders
- **`LoadingSpinner`**: Continuous organic 360° rotation (1.5s duration, linear easing).
- **`ThinkingAnimation`**: Pulsing spark mark with 2s repeat cycle during AI stream generation.
