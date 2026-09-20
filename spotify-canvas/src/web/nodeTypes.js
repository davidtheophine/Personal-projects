import SongCardNode from './SongCardNode.jsx'

// Defined at module scope (NOT inline in render) so React Flow doesn't treat it
// as a new type map every render and thrash the node components.
export const nodeTypes = { songCard: SongCardNode }
