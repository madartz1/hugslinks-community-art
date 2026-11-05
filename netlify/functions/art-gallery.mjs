import {getStore} from '@netlify/blobs';
import {createPublicGalleryHandler} from '../lib/public-gallery.mjs';
export default createPublicGalleryHandler(getStore);
