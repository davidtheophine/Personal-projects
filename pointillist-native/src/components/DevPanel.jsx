import { StyleSheet, Text, View } from 'react-native'

import { Glass, GlassButton } from './Glass'
import { ORIENTATIONS } from '../lib/camera-transform'

const ASPECTS = [
  { label: '3:4', value: 3 / 4 },
  { label: '9:16', value: 9 / 16 },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
]

const Chip = ({ label, onPress }) => (
  <GlassButton onPress={onPress} style={styles.chip} accessibilityLabel={label}>
    <Text style={styles.chipText}>{label}</Text>
  </GlassButton>
)

/**
 * On-device calibration. The camera texture's rotation differs between iOS and
 * Android and cannot be queried from GL, so rather than guess we expose the
 * knobs and print the config line to paste back into `src/config.js`.
 */
export default function DevPanel({ state, set, stats, onClose }) {
  const aspect = ASPECTS.find((a) => Math.abs(a.value - state.texAspect) < 0.001)

  return (
    <Glass radius={20} style={styles.root}>
      <View style={styles.row}>
        <Chip
          label={`Orientation ${state.orientationIndex}`}
          onPress={() => set({ orientationIndex: (state.orientationIndex + 1) % ORIENTATIONS.length })}
        />
        <Chip label={`Aspect ${aspect ? aspect.label : '?'}`} onPress={() => {
          const i = ASPECTS.findIndex((a) => a === aspect)
          set({ texAspect: ASPECTS[(i + 1) % ASPECTS.length].value })
        }} />
        <Chip label={`Snapshot flip ${state.snapshotFlip ? 'on' : 'off'}`} onPress={() => set({ snapshotFlip: !state.snapshotFlip })} />
        <Chip label={`Stagger ${state.stagger ? 'brick' : 'grid'}`} onPress={() => set({ stagger: state.stagger ? 0 : 0.5 })} />
        <Chip
          label={`Canvas test ${state.canvasTest ? 'ON' : 'off'}`}
          onPress={() => set({ canvasTest: !state.canvasTest })}
        />
        <Chip label="Close" onPress={onClose} />
      </View>
      <Text style={styles.note}>
        DEFAULT_ORIENTATION = {state.orientationIndex} · CAMERA_TEXTURE_ASPECT ={' '}
        {state.texAspect.toFixed(4)} · SNAPSHOT_FLIP = {String(state.snapshotFlip)}
      </Text>
      <Text style={styles.note}>
        {stats.cols}×{stats.rows} dots · {stats.fps} fps
      </Text>
    </Glass>
  )
}

const styles = StyleSheet.create({
  root: { gap: 7, paddingHorizontal: 16, paddingVertical: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingVertical: 7, paddingHorizontal: 12 },
  chipText: { color: '#fff', fontSize: 11, letterSpacing: 0.3 },
  note: { color: '#fff', opacity: 0.5, fontSize: 10, fontVariant: ['tabular-nums'] },
})
