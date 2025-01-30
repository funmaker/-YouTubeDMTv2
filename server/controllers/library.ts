import fs from "fs";
import path from "path";
import EventEmitter from "events";
import ffmpeg from "fluent-ffmpeg";
import YTDlpWrap from 'yt-dlp-wrap';
import chalk from "chalk";
import configs from "../helpers/configs";
import { Track } from "../../types/api";
import HTTPError from "../helpers/HTTPError";
import { getVideoID } from "../helpers/url-utils";

const libraryPath = path.resolve(process.cwd(), configs.libraryPath);

const library: Track[] = [];
const progressEmitters: Partial<Record<string, EventEmitter>> = {};

const ytDlpWrap = new YTDlpWrap();

(async () => {
  const binaryPath = path.resolve(libraryPath, 'yt-dlp');
  await YTDlpWrap.downloadFromGithub(binaryPath);
  ytDlpWrap.setBinaryPath(binaryPath);
})().catch(err => console.error("Error while updaing yt-dlp:", err));

export async function rescan() {
  console.log(chalk.bold.whiteBright(`Loading Library from ${libraryPath}...`));
  await fs.promises.mkdir(libraryPath, { recursive: true });
  
  const wavs: string[] = [];
  const jsons: string[] = [];
  
  const dir = await fs.promises.opendir(libraryPath);
  for await (const file of dir) {
    if(file.name.endsWith(".json")) {
      jsons.push(file.name.slice(0, -5));
    } else if(file.name.endsWith(".wav")) {
      wavs.push(file.name.slice(0, -4));
    } else if(file.name !== "yt-dlp") {
      console.log(chalk.yellow(`Unexpected file '${file}' in library, ignoring.`));
    }
  }
  
  const valids = jsons.filter(json => wavs.includes(json));
  
  for(const invalid of wavs.filter(wav => !valids.includes(wav))) console.log(chalk.yellow(`File '${invalid}.wav' is missing audio file, ignoring.`));
  for(const invalid of jsons.filter(json => !valids.includes(json))) console.log(chalk.yellow(`File '${invalid}.json' is missing json file, ignoring.`));
  
  library.splice(0, library.length);
  
  for(const valid of valids) {
    try {
      const data = JSON.parse(await fs.promises.readFile(path.join(libraryPath, valid + ".json"), "utf-8"));
      
      if(data.downloading) {
        console.log(chalk.yellow(`File '${valid}.wav' is has been interrupted during download, ignoring.`));
        continue;
      }
      
      library.push({
        id: valid,
        name: data.name ?? "N/A",
        artist: data.artist ?? "N/A",
        length: data.length ?? 0,
        downloading: data.downloading ?? false,
        url: `/library/${valid}.wav`,
        source: data.source,
        thumbnail: data.thumbnail,
      });
    } catch(e) {
      console.error(e);
      console.error(chalk.red(`File '${valid}.json' can't be loaded, ignoring.`));
    }
  }
}

rescan().catch(err => {
  console.error(err);
  process.exit(-1);
});

export function list() {
  return library;
}

export async function add(url: string): Promise<Track> {
  let id: string;
  try {
    id = getVideoID(url);
  } catch(err) {
    throw new HTTPError(400, `Unable to parse video url: ${(err as Error).message}`);
  }
  
  console.log("Video ID: " + id);
  
  const found = library.find(track => track.id === id);
  if(found) return found;
  
  const eventEmitter = new EventEmitter();
  progressEmitters[id] = eventEmitter;
  
  const wavFile = path.resolve(libraryPath, id + ".wav");
  const jsonFile = path.resolve(libraryPath, id + ".json");
  
  const metadata = await ytDlpWrap.getVideoInfo(id);
  console.log("Downloading: " + metadata.title);
  const track = parseInfo(metadata);
  
  try {
    await fs.promises.writeFile(jsonFile, JSON.stringify(track, null, 4));
    library.push(track);
    
    await new Promise<void>((res, rej) => {
      ytDlpWrap.exec(["-x", id, "--audio-format", "wav", "--output", wavFile])
               .on('progress', (progress) => eventEmitter.emit("progress", (progress.percent || 0) / 100))
               .on('ytDlpEvent', (eventType, eventData) => console.log(eventType, eventData))
               .on('error', (error) => rej(error))
               .on('close', () => res());
    });
    
    track.downloading = false;
    await fs.promises.writeFile(jsonFile, JSON.stringify(track, null, 4));
    
    eventEmitter.emit("finish");
  } catch(e) {
    if(library.includes(track)) library.splice(library.indexOf(track), 1);
    await fs.promises.rm(wavFile, { force: true });
    await fs.promises.rm(jsonFile, { force: true });
    eventEmitter.emit("error");
  }
  
  return track;
}

function parseInfo(videoInfo: any): Track {
  const thumbnails = [...videoInfo.thumbnails].sort((a, b) => a.height - b.height);
  let bestThumbnail: any = null;
  
  for(const thumbnail of thumbnails) {
    bestThumbnail = thumbnail;
    if(bestThumbnail.height > 180) break;
  }
  
  return {
    id: videoInfo.id,
    name: videoInfo.title,
    artist: videoInfo.channel,
    length: videoInfo.duration,
    downloading: true,
    url: `/library/${videoInfo.id}.wav`,
    source: videoInfo.webpage_url,
    thumbnail: bestThumbnail?.url,
  };
}

export async function remove(id: string) {
  const index = library.findIndex(track => track.id === id);
  if(index < 0) throw new HTTPError(404, "Track not found");
  
  const wavFile = path.resolve(libraryPath, id + ".wav");
  const jsonFile = path.resolve(libraryPath, id + ".json");
  
  await fs.promises.rm(wavFile, { force: true });
  await fs.promises.rm(jsonFile, { force: true });
  
  library.splice(index, 1);
}

export function progress(id: string) {
  return progressEmitters[id] ?? null;
}
