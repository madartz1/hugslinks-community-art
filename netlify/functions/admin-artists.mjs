import { getStore } from "@netlify/blobs";
import { createArtistReviewHandler } from "../lib/artist-review.mjs";
export default createArtistReviewHandler(getStore);
