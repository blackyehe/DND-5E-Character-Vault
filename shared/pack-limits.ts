// Keep compressed source below the 16 MiB BSON document limit, with room for metadata.
export const MAX_PACK_MIB=128
export const MAX_PACK_BYTES=MAX_PACK_MIB*1024*1024
export const MAX_STORED_PACK_BYTES=14*1024*1024
