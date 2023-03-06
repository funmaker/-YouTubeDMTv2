import fs from "fs";
import path from "path";
import chalk from "chalk";
import configs from "../helpers/configs";
import { Track } from "../../types/api";

const libraryPath = path.resolve(process.cwd(), configs.libraryPath);

const library: Track[] = [];

export async function rescan() {
  console.log(chalk.bold.white(`Loading Library from ${libraryPath}...`));
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
  
  for(const valid of valids) {
    try {
      const data = JSON.parse(await fs.promises.readFile(path.join(libraryPath, valid + ".json"), "utf-8"));
      
      library.push({
        id: valid,
        name: data.name ?? "N/A",
        artist: data.artist ?? "N/A",
        source: data.source,
        url: `/library/${valid}.wav`,
        length: data.length ?? 0,
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
