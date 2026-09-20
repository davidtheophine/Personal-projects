// Four genre "families", one per quadrant (à la everynoise.com). Center = broad;
// pushing toward a corner gets progressively more niche (3-4 deeper tiers each).
// Each point carries a representative artist + a real song by them, so the label
// and the now-playing track shift as you move. x,y normalized 0..1 (y DOWN).
// Platform-neutral — ports verbatim to Expo.

// Frank Ocean (alternative R&B, top-right) — the picker + now-playing start here.
export const INITIAL_CURSOR = { x: 0.72, y: 0.27 }

export const GENRE_POINTS = [
  // ── Pop family · top-right · yellow (broad → niche toward the corner) ──
  { name: 'Pop', artist: 'Dua Lipa', song: 'Levitating', x: 0.58, y: 0.42 },
  { name: 'Indie Pop', artist: 'Clairo', song: 'Bags', x: 0.58, y: 0.22 },
  { name: 'Synth-Pop', artist: 'The Weeknd', song: 'Blinding Lights', x: 0.66, y: 0.34 },
  { name: 'Alternative R&B', artist: 'Frank Ocean', song: 'Ivy', x: 0.72, y: 0.27 },
  { name: 'Alt R&B', artist: 'SZA', song: 'Snooze', x: 0.8, y: 0.2 },
  { name: 'Alternative Hip-Hop', artist: 'Tyler, the Creator', song: 'EARFQUAKE', x: 0.86, y: 0.15 },
  { name: 'Neo-Psychedelia', artist: 'Steve Lacy', song: 'Dark Red', x: 0.91, y: 0.1 },
  { name: 'Hyperpop', artist: 'Charli XCX', song: 'Vroom Vroom', x: 0.96, y: 0.05 },

  // ── Jazz family · top-left · green ──
  { name: 'Soul', artist: "D'Angelo", song: 'Untitled (How Does It Feel)', x: 0.42, y: 0.42 },
  { name: 'Neo-Soul', artist: 'Erykah Badu', song: 'On & On', x: 0.33, y: 0.33 },
  { name: 'Funk', artist: 'Vulfpeck', song: 'Dean Town', x: 0.2, y: 0.42 },
  { name: 'Jazz Fusion', artist: 'Robert Glasper', song: 'Afro Blue', x: 0.4, y: 0.18 },
  { name: 'Jazz', artist: 'Miles Davis', song: 'So What', x: 0.26, y: 0.24 },
  { name: 'Spiritual Jazz', artist: 'Kamasi Washington', song: 'Truth', x: 0.15, y: 0.16 },
  { name: 'Bebop', artist: 'Charlie Parker', song: 'Ko-Ko', x: 0.1, y: 0.22 },
  { name: 'Free Jazz', artist: 'John Coltrane', song: 'Ascension', x: 0.05, y: 0.06 },

  // ── Electronic family · bottom-left · cyan ──
  { name: 'Electronic', artist: 'ODESZA', song: 'Say My Name', x: 0.42, y: 0.58 },
  { name: 'Downtempo', artist: 'Tycho', song: 'Awake', x: 0.2, y: 0.58 },
  { name: 'House', artist: 'Disclosure', song: 'Latch', x: 0.33, y: 0.68 },
  { name: 'Deep House', artist: 'Bonobo', song: 'Kerala', x: 0.24, y: 0.75 },
  { name: 'Ambient', artist: 'Jon Hopkins', song: 'Immunity', x: 0.42, y: 0.82 },
  { name: 'Techno', artist: 'Charlotte de Witte', song: 'Formula', x: 0.16, y: 0.83 },
  { name: 'IDM', artist: 'Aphex Twin', song: 'Xtal', cover: '/figma/aphex-twin.png', x: 0.1, y: 0.9 },
  { name: 'Breakcore', artist: 'Venetian Snares', song: 'Hajnal', x: 0.05, y: 0.96 },

  // ── Rock family · bottom-right · purple ──
  { name: 'Rock', artist: 'Foo Fighters', song: 'Everlong', x: 0.58, y: 0.58 },
  { name: 'Psych Rock', artist: 'Tame Impala', song: 'Let It Happen', x: 0.6, y: 0.8 },
  { name: 'Indie Rock', artist: 'Arctic Monkeys', song: 'Do I Wanna Know?', x: 0.68, y: 0.67 },
  { name: 'Alt Rock', artist: 'The Strokes', song: 'Reptilia', x: 0.74, y: 0.74 },
  { name: 'Garage Rock', artist: 'The Black Keys', song: 'Lonely Boy', x: 0.84, y: 0.62 },
  { name: 'Hard Rock', artist: 'Queens of the Stone Age', song: 'No One Knows', x: 0.83, y: 0.83 },
  { name: 'Metal', artist: 'Metallica', song: 'Master of Puppets', x: 0.9, y: 0.9 },
  { name: 'Death Metal', artist: 'Death', song: 'Crystal Mountain', x: 0.96, y: 0.96 },
]
