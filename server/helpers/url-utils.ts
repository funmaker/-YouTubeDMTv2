// From: https://github.com/distubejs/ytdl-core/blob/ff5a2ff23c0bad7a7d29f00fd039a02ef1f76dc1/lib/url-utils.js#L55

const validQueryDomains = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "gaming.youtube.com",
]);

const validPathDomains = /^https?:\/\/(youtu\.be\/|(www\.)?youtube\.com\/(embed|v|shorts|live)\/)/;

function getURLVideoID(link: string) {
  const parsed = new URL(link.trim());
  let id = parsed.searchParams.get("v");
  if(validPathDomains.test(link.trim()) && !id) {
    const paths = parsed.pathname.split("/");
    id = parsed.host === "youtu.be" ? paths[1] : paths[2];
  } else if(parsed.hostname && !validQueryDomains.has(parsed.hostname)) {
    throw Error("Not a YouTube domain");
  }
  if(!id) {
    throw Error(`No video id found: "${link}"`);
  }
  id = id.substring(0, 11);
  if(!validateID(id)) {
    throw TypeError(`Video id (${id}) does not match expected ` + `format (${idRegex.toString()})`);
  }
  return id;
}

const urlRegex = /^https?:\/\//;

export function getVideoID(str: string) {
  if(validateID(str)) {
    return str;
  } else if(urlRegex.test(str.trim())) {
    return getURLVideoID(str);
  } else {
    throw Error(`No video id found: ${str}`);
  }
}

const idRegex = /^[a-zA-Z0-9-_]{11}$/;

function validateID(id: string) {
  return idRegex.test(id.trim());
}

