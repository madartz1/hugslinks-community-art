import { triageSubmission } from "../functions/_art-moderation.mjs";

const STORE = "hugs-artists";
const KEY = "artists";
const IMAGE_STORE = "hugs-art-images";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff"
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const clean = (value, max = 500) => typeof value === "string"
  ? value.trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max)
  : "";
const emailOK = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const urlOK = value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};
const makeId = () => "ARTIST-" + new Date().getFullYear() + "-" + crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();

async function read(store) {
  const value = await store.get(KEY, { type: "json", consistency: "strong" });
  return Array.isArray(value?.artists) ? value.artists : Array.isArray(value) ? value : [];
}

function validImageSignature(bytes, type) {
  if (type === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/png") return bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10;
  if (type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export function createArtistSubmissionHandler({getStore,makeArtistId=makeId,makeImageId=()=>crypto.randomUUID(),now=()=>new Date().toISOString()}){
return async request => {
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);

  if(request.headers.get("origin")!==new URL(request.url).origin)return json({ok:false,error:"Submit artwork from the gallery submission page."},403);
  try {
    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ ok: false, error: "Invalid artist submission." }, 400);
    }

    if (clean(form.get("bot_field"), 100)) return json({ ok: true, message: "Received." });

    const artist = clean(form.get("artist_name"), 140);
    const name = clean(form.get("full_name"), 160);
    const email = clean(form.get("email"), 254).toLowerCase();
    const phone = clean(form.get("phone"), 60);
    const city = clean(form.get("city"), 120);
    const region = clean(form.get("region"), 120);
    const medium = clean(form.get("primary_medium"), 120);
    const portfolio = clean(form.get("portfolio_url"), 600);
    const social = clean(form.get("social_url"), 600);
    const experience = clean(form.get("experience_level"), 120);
    const statement = clean(form.get("artist_statement"), 2400);
    const works = clean(form.get("artwork_links"), 2400);
    const artworkTitle = clean(form.get("artwork_title"), 120);
    const artworkYear = clean(form.get("artwork_year"), 4);
    const notes = clean(form.get("notes"), 1600);
    const interests = form.getAll("interests").map(value => clean(value, 100)).filter(Boolean).slice(0, 12);
    const rightsConfirmed = form.get("rights_confirmation") === "yes";
    const confirmed = form.get("confirmation") === "yes" || form.get("confirmation") === "true";
    const file = form.get("artwork");
    const requestId=clean(form.get("submission_request_id"),100);
    if(requestId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))return json({ok:false,error:"Invalid submission request. Refresh the page and try again."},400);

    if (!artist || !name || !email || !city || !medium || !statement || !artworkTitle) {
      return json({ ok: false, error: "Please complete all required artist and artwork fields." }, 400);
    }
    if (!emailOK(email)) return json({ ok: false, error: "Please enter a valid email." }, 400);
    if ((portfolio && !urlOK(portfolio)) || (social && !urlOK(social))) {
      return json({ ok: false, error: "Please enter valid portfolio and social links." }, 400);
    }
    if (artworkYear && !/^\d{4}$/.test(artworkYear)) {
      return json({ ok: false, error: "Enter the artwork year as four digits." }, 400);
    }
    if (!rightsConfirmed) return json({ ok: false, error: "Confirm that you created the artwork or have permission to submit it." }, 400);
    if (!confirmed) return json({ ok: false, error: "Artist confirmation is required." }, 400);
    if (!file || typeof file.arrayBuffer !== "function") {
      return json({ ok: false, error: "Choose an artwork image." }, 400);
    }
    if (!IMAGE_TYPES.has(file.type)) return json({ ok: false, error: "Use a JPEG, PNG or WebP image." }, 415);
    if (!file.size || file.size > MAX_IMAGE_BYTES) {
      return json({ ok: false, error: "Artwork images must be 4 MB or smaller." }, 413);
    }

    const imageBuffer = await file.arrayBuffer();
    const imageBytes = new Uint8Array(imageBuffer);
    if (!validImageSignature(imageBytes, file.type)) {
      return json({ ok: false, error: "The selected file is not a valid artwork image." }, 415);
    }

    const store=getStore(STORE);
    const duplicate=requestId?(await read(store)).find(a=>a.submission_request_id===requestId&&a.email===email):null;
    if(duplicate)return json({ok:true,artist_id:duplicate.id,status:duplicate.status,duplicate:true},201);
    const imageId = makeImageId();
    const imageURL = "/.netlify/functions/art-image?id=" + encodeURIComponent(imageId);
    const timestamp = now();
    const moderation = triageSubmission([artist,statement,artworkTitle,notes,works]);
    const record = {
      id: makeArtistId(), status: moderation.status, moderation, rights_confirmed: true, created_at: timestamp, reviewed_at: null,
      artist_name: artist, full_name: name, email, phone, city, region,
      primary_medium: medium, portfolio_url: portfolio, social_url: social,
      experience_level: experience, artist_statement: statement, artwork_links: works,
      artwork_title: artworkTitle, artwork_year: artworkYear,
      artwork_image_id: imageId, artwork_image_url: imageURL,
      interests, notes, confirmation: true,submission_request_id:requestId||null
    };

    await getStore(IMAGE_STORE).set("image-" + imageId, imageBuffer, { metadata: { mime: file.type } });
    for(let attempt=0;attempt<6;attempt++){
      const snapshot=await store.getWithMetadata(KEY,{type:"json",consistency:"strong"});
      const records=Array.isArray(snapshot?.data?.artists)?snapshot.data.artists:Array.isArray(snapshot?.data)?snapshot.data:[];
      const existing=requestId?records.find(a=>a.submission_request_id===requestId&&a.email===email):null;
      if(existing){if(existing.artwork_image_id!==imageId)await getStore(IMAGE_STORE).delete("image-"+imageId).catch(()=>{});return json({ok:true,artist_id:existing.id,status:existing.status,duplicate:true},201)}
      records.push(record);
      const result=await store.setJSON(KEY,{updated_at:timestamp,artists:records},snapshot?.etag?{onlyIfMatch:snapshot.etag}:{onlyIfNew:true});
      if(result.modified)return json({ok:true,artist_id:record.id,status:record.status},201);
    }
    return json({ok:false,error:"The review queue is busy. Please retry this same submission."},503);
  } catch (error) {
    console.error("Artist submission error:", error);
    return json({ ok: false, error: "We could not submit your artist introduction right now." }, 500);
  }
};

}
