// Mirror of the fixed look constants in ../src/config.js, without the React
// Native import so the lab can load straight from the browser.
export const LOOK_LAB = {
  fill: 1.02,
  stagger: 0,
  jitter: 0.1,
  lumaSize: 0.22,
  paperTint: 0.0,
}

export const CONTROLS_LAB = {
  dotSize: { label: 'Size', min: 3, max: 60, value: 14, step: 1 },
  colour: { label: 'Colour', min: 0, max: 2, value: 1.15, step: 0.01 },
  palette: { label: 'Palette', min: 2, max: 17, value: 17, step: 1 },
}
