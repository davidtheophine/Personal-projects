import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ORIENTATIONS } from '../lib/camera-transform'

const ASPECTS = [
  { label: '3:4', value: 3 / 4 },
  { label: '9:16', value: 9 / 16 },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
]

const Chip = ({ label, onPress }) => (
  <Pressable onPress={onPress} hitSlop={6} style={styles.chip}>
    <Text style={styles.chipText}>{label}</Text>
  </Pressable>
)

/**
 * On-device calibration. The camera texture's rotation differs between iOS and
 * Android and cannot be queried from GL, so rather than guess we expose the
 * knobs and print the config line to paste back into `src/config.js`.
 */
export default function DevPanel({ state, set, stats, onClose }) {
  const aspect = ASPECTS.find((a) => Math.abs(a.value - state.texAspect) < 0.001)

  return (
    <View style={styles.root}>
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
        <Chip label="Close" onPress={onClose} />
      </View>
      <Text style={styles.note}>
        DEFAULT_ORIENTATION = {state.orientationIndex} · CAMERA_TEXTURE_ASPECT ={' '}
        {state.texAspect.toFixed(4)} · SNAPSHOT_FLIP = {String(state.snapshotFlip)}
      </Text>
      <Text style={styles.note}>
        {stats.cols}×{stats.rows} dots · {stats.fps} fps
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 7, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', paddingVertical: 5, paddingHorizontal: 11 },
  chipText: { color: '#fff', fontSize: 11, letterSpacing: 0.3 },
  note: { color: '#fff', opacity: 0.5, fontSize: 10, fontVariant: ['tabular-nums'] },
})
