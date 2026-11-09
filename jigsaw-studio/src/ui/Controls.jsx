import { PRESETS, PRESET_KEYS } from '../materials/presets.js'

export function Panel({ children, title }) {
  return (
    <section className="panel">
      <header>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  )
}

export function Slider({ label, value, min, max, step = 0.01, onChange, format }) {
  return (
    <label className="slider">
      <span className="slider-label">
        {label}
        <b>{format ? format(value) : value.toFixed(2)}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

export function Toggle({ label, checked, onChange }) {
  return (
    <button type="button" className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="dot" />
      {label}
    </button>
  )
}

export function MaterialPicker({ value, onChange }) {
  return (
    <>
      <div className="materials">
        {PRESET_KEYS.map((key) => (
          <button
            type="button"
            key={key}
            className={`chip ${value === key ? 'on' : ''}`}
            onClick={() => onChange(key)}
            title={PRESETS[key].hint}
          >
            <i style={{ background: PRESETS[key].swatch }} />
            {PRESETS[key].label}
          </button>
        ))}
      </div>
      <p className="hint">{PRESETS[value].hint}</p>
    </>
  )
}

export function ImagePicker({ paintings, value, onPick, onUpload }) {
  return (
    <div className="images">
      {paintings.map((p) => (
        <button
          type="button"
          key={p.file}
          className={`thumb ${value === p.file ? 'on' : ''}`}
          onClick={() => onPick(p)}
          title={`${p.name} - ${p.artist}, ${p.year}`}
        >
          <img src={`paintings/${p.file}`} alt={p.name} />
        </button>
      ))}
      <label className="thumb upload" title="Use your own image">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ''
          }}
        />
        <span>+</span>
      </label>
    </div>
  )
}
