// Like/save store. The SaveStore shape is { list, isSaved, add, remove, toggle,
// subscribe }. LocalSaveStore persists to an injected Web Storage (localStorage in
// the browser; the Expo port swaps in an AsyncStorage-backed implementation, and
// the web build can later add a Spotify-playlist-backed one behind the same shape).

const KEY = 'spotify-canvas:liked'

export function createLocalSaveStore(storage) {
  let items = []
  try {
    items = JSON.parse(storage.getItem(KEY) || '[]')
  } catch {
    items = []
  }

  const listeners = new Set()
  const persist = () => storage.setItem(KEY, JSON.stringify(items))
  const emit = () => listeners.forEach((l) => l(items))

  const isSaved = (id) => items.some((i) => i.id === id)

  const add = (song) => {
    if (isSaved(song.id)) return
    items = [...items, { id: song.id, title: song.title, artist: song.artist, album: song.album }]
    persist()
    emit()
  }

  const remove = (id) => {
    if (!isSaved(id)) return
    items = items.filter((i) => i.id !== id)
    persist()
    emit()
  }

  const toggle = (song) => (isSaved(song.id) ? remove(song.id) : add(song))

  return {
    list: () => items,
    isSaved,
    add,
    remove,
    toggle,
    subscribe(fn) {
      listeners.add(fn)
      fn(items)
      return () => listeners.delete(fn)
    },
  }
}
