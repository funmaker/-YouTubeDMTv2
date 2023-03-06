import fs from "fs";
import path from "path";
import EventEmitter from "events";
import ffmpeg from "fluent-ffmpeg";
import ytdl, { videoInfo as VideoInfo } from 'ytdl-core';
import chalk from "chalk";
import configs from "../helpers/configs";
import { Track } from "../../types/api";
import HTTPError from "../helpers/HTTPError";


const libraryPath = path.resolve(process.cwd(), configs.libraryPath);

const library: Track[] = [];
const progressEmitters: Partial<Record<string, EventEmitter>> = {};

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
    } else {
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
    id = ytdl.getVideoID(url);
  } catch(err) {
    throw new HTTPError(400, `Unable to parse video url: ${(err as Error).message}`);
  }
  
  const found = library.find(track => track.id === id);
  if(found) return found;
  
  let res: (track: Track) => void;
  let rej: (error: Error) => void;
  const promise = new Promise<Track>((resolve, reject) => ([res, rej] = [resolve, reject]));
  
  const eventEmitter = new EventEmitter();
  progressEmitters[id] = eventEmitter;
  
  const wavFile = path.resolve(libraryPath, id + ".wav");
  const jsonFile = path.resolve(libraryPath, id + ".json");
  let track: Track | null = null;
  
  async function panic() {
    stream.destroy();
    command.kill('SIGKILL');
    if(track && library.includes(track)) library.splice(library.indexOf(track), 1);
    
    eventEmitter.emit("error");
    if(progressEmitters[id] === eventEmitter) delete progressEmitters[id];
    
    await new Promise(res => setTimeout(res, 5000));
    
    await fs.promises.rm(wavFile, { force: true });
    await fs.promises.rm(jsonFile, { force: true });
  }
  
  async function updateMetadata(track: Track) {
    fs.promises
      .writeFile(jsonFile, JSON.stringify(track, null, 4))
      .catch(err => {
        console.error(`Cannot save metadata: ${err.message}`);
        panic();
      });
  }
  
  const stream = ytdl(id, { filter: "audio", quality: "highestaudio" })
    .on("info", (videoInfo: VideoInfo) => {
      console.log("Downloading: " + videoInfo.videoDetails.title);
      
      track = parseInfo(videoInfo);
      res(track);
      updateMetadata(track);
      library.push(track);
    })
    .on("progress", (chunk, current, total) => {
      eventEmitter.emit("progress", current / total);
    })
    .on("error", err => {
      console.error(`Cannot download video: ${err.message}`);
      panic();
    });
  
  const command = ffmpeg(stream)
    .on('start', commandLine => console.log(`Spawned Ffmpeg with command: ${commandLine}`))
    .on("end", () => {
      console.log("Download completed");
      
      if(track) {
        track.downloading = false;
        updateMetadata(track);
        
        eventEmitter.emit("finish");
        if(progressEmitters[id] === eventEmitter) delete progressEmitters[id];
      } else {
        console.error(`Ffmpeg finished before ytdl fetched info, something went wrong!`);
        panic();
      }
    })
    .on('error', (err, stdout, stderr) => {
      console.error(`Cannot process video: ${err.message}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`);
      panic();
    })
    .save(wavFile);
  
  return promise;
}

function parseInfo(videoInfo: VideoInfo) {
  const thumbnails = [...videoInfo.videoDetails.thumbnail.thumbnails].sort((a, b) => a.height - b.height);
  let bestThumbnail: null | ytdl.thumbnail = null;
  
  for(const thumbnail of thumbnails) {
    bestThumbnail = thumbnail;
    if(bestThumbnail.height > 180) break;
  }
  
  return {
    id: videoInfo.videoDetails.videoId,
    name: videoInfo.videoDetails.title,
    artist: videoInfo.videoDetails.author.name,
    length: parseFloat(videoInfo.videoDetails.lengthSeconds),
    downloading: true,
    url: `/library/${videoInfo.videoDetails.videoId}.wav`,
    source: videoInfo.videoDetails.video_url,
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
