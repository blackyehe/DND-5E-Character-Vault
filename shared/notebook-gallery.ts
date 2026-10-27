import {isNotebookCover} from './notebook-cover'
export const NOTEBOOK_GALLERY_LIMIT = 6
export const NOTEBOOK_ARTWORK_MAX_LENGTH = 200000
export interface NotebookArtwork {id:string; image:string; title:string; caption:string}
export const isNotebookArtwork = (image:string) => !!image && image.length<=NOTEBOOK_ARTWORK_MAX_LENGTH && isNotebookCover(image)
