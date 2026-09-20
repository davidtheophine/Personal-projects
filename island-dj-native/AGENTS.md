# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

Stack is matched to **Expo Go SDK 57** (Skia is bundled in Expo Go — no dev build):
`expo ~57`, `@shopify/react-native-skia 2.6.2`, `react-native-reanimated 4.5.1`
+ `react-native-worklets 0.10.1` (babel plugin, must be LAST), `react-native-gesture-handler`.
Install packages with `npx expo install <pkg>` so versions stay matched to Expo Go.

Skia 2.x requires shader uniforms + animation to run on the UI thread via reanimated
(`useClock` + `useDerivedValue`). Verify bundling with `npm run export`; visuals are
verified on-device (`npx expo start`, scan the QR — add `--tunnel` off-Wi-Fi).

The polished web original lives in the sibling `island-dj/` (Vite + React + WebGL + DialKit).
