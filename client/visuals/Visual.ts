import { toast } from "react-toastify";

class Interrupted extends Error {
  constructor() { super("Interrupted"); }
}

interface CanvasDesc {
  canvas: HTMLCanvasElement;
  scale: [number, number];
  padding: [number, number, number, number];
  size: "fit" | "max" | "min";
}

interface CanvasOptions {
  scale: number | [number] | [number, number];
  padding: number | [number] | [number, number] | [number, number, number] | [number, number, number, number];
  size: "fit" | "max" | "min";
}

export default abstract class Visual {
  running = false;
  private cancelNextFrame: null | (() => void) = null;
  protected canvases: CanvasDesc[] = [];
  protected outputCtx: CanvasRenderingContext2D;
  private debugBox = document.getElementById("debugBox");
  
  protected state = {
    currentTime: 0,
    lastTime: 0,
    bps: 90 / 60,
    beatOffset: 0.1,
  };
  
  constructor(protected output: HTMLCanvasElement, protected audio: HTMLAudioElement) {
    const ctx = output.getContext("2d");
    if(!ctx) {
      toast.error("2D Canvas is not supported!");
      throw new Error("2D Canvas is not supported!");
    }
    this.outputCtx = ctx;
    
    this.canvases.push({
      canvas: output,
      scale: [1, 1],
      padding: [0, 0, 0, 0],
      size: "fit",
    });
    
    this.resize();
    this.update();
  }
  
  protected async nextFrame() {
    do {
      await new Promise<void>((res, rej) => {
        const requestId = window.requestAnimationFrame(() => {
          this.cancelNextFrame = null;
          res();
        });
        
        this.cancelNextFrame = () => {
          window.cancelAnimationFrame(requestId);
          this.cancelNextFrame = null;
          rej(new Interrupted());
        };
      });
      
      this.update();
    } while(this.audio.paused && this.running);
    
    if(!this.running) throw new Interrupted();
  }
  
  start() {
    this.running = true;
    this.run().catch((err) => {
      if(err instanceof Interrupted) {}
      else throw err;
    }).finally(() => {
      for(const desc of this.canvases) {
        if(desc.canvas !== this.output && desc.canvas.parentNode) desc.canvas.remove();
      }
    });
  }
  
  stop() {
    this.running = false;
    if(this.cancelNextFrame) this.cancelNextFrame();
  }
  
  resize() {
    for(const desc of this.canvases) this.resizeSingle(desc);
  }
  
  protected resizeSingle(desc: CanvasDesc) {
    let width, height;
    switch(desc.size) {
      case "fit":
        width = this.output.clientWidth;
        height = this.output.clientHeight;
        break;
      case "max":
        width = height = Math.max(this.output.clientWidth, this.output.clientHeight);
        break;
      case "min":
        width = height = Math.min(this.output.clientWidth, this.output.clientHeight);
        break;
    }
    
    desc.canvas.width = width * desc.scale[1] * (1 + desc.padding[1] + desc.padding[3]);
    desc.canvas.height = height * desc.scale[0] * (1 + desc.padding[0] + desc.padding[2]);
  }
  
  update() {
    this.state.lastTime = this.state.currentTime;
    this.state.currentTime = this.audio.currentTime;
  }
  
  protected canvas({ scale = 1, padding = 0, size = "fit" }: Partial<CanvasOptions> = {}) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if(!ctx) throw new Error("2D Canvas is not supported!");
    
    scale = Array.isArray(scale) ? scale : [scale];
    padding = Array.isArray(padding) ? padding : [padding];
    
    this.canvases.push({
      canvas,
      scale: [
        scale[0],
        scale[1] ?? scale[0],
      ],
      padding: [
        padding[0],
        padding[1] ?? padding[0],
        padding[2] ?? padding[0],
        padding[3] ?? padding[1] ?? padding[0],
      ],
      size,
    });
    
    this.resizeSingle(this.canvases[this.canvases.length - 1]);
    
    if(this.debugBox) {
      this.debugBox.appendChild(canvas);
      canvas.addEventListener("click", () => canvas.classList.toggle("expand"));
    }
    
    return ctx;
  }
  
  protected crop(ctx: CanvasRenderingContext2D, base: "absolute" | "inner" | "cover" | "contain", modifier: "stretch" | "min" | "max" | "width" | "height" = "stretch") {
    const desc = this.canvases.find(desc => desc.canvas === ctx.canvas);
    if(!desc) throw new Error("Unknown canvas");
    
    ctx.resetTransform();
    
    const outputRatio = this.output.width / this.output.height;
    
    let width, height, cX, cY;
    if(base === "absolute") {
      width = desc.canvas.width;
      height = desc.canvas.height;
      cX = width / 2;
      cY = height / 2;
    } else {
      width = desc.canvas.width / (1 + desc.padding[1] + desc.padding[3]);
      height = desc.canvas.height / (1 + desc.padding[0] + desc.padding[2]);
      cX = (0.5 + desc.padding[3]) * width;
      cY = (0.5 + desc.padding[0]) * height;
      
      if(base === "cover") {
        if(width / height > outputRatio) height = width / outputRatio;
        else width = height * outputRatio;
      } else if(base === "contain") {
        if(width / height < outputRatio) height = width / outputRatio;
        else width = height * outputRatio;
      }
    }
    
    const ratio = width / height;
    
    switch(modifier) {
      case "stretch":
        break;
      case "max":
        height = width = Math.max(width, height);
        break;
      case "min":
        height = width = Math.min(width, height);
        break;
      case "width":
        height = width;
        break;
      case "height":
        width = height;
        break;
    }
    
    ctx.translate(cX, cY);
    ctx.scale(width / 2, height / 2);
    
    return ratio;
  }
  
  protected drawCanvas(dest: CanvasRenderingContext2D, src: CanvasRenderingContext2D) {
    const srcTransform = src.getTransform();
    const destTransform = dest.getTransform();
    console.log(srcTransform, destTransform);
    
    dest.setTransform(destTransform.multiply(srcTransform.inverse()));
    dest.drawImage(src.canvas, 0, 0);
    dest.setTransform(destTransform);
  }
  
  private beatFracImpl(time: number, offset: number, every: number) {
    const { bps, beatOffset } = this.state;
    return ((time - beatOffset) * bps - offset) / every;
  }
  
  beatFrac(offset: number, every: number) {
    return this.beatFracImpl(this.state.currentTime, offset, every);
  }
  
  beat(offset = 0, every = 1) {
    return Math.floor(this.beatFrac(offset, every));
  }
  
  onBeat(offset = 0, every = 1) {
    const previous = Math.floor(this.beatFracImpl(this.state.lastTime, offset, every));
    const current = Math.floor(this.beatFracImpl(this.state.currentTime, offset, every));
    return previous !== current;
  }
  
  untilBeat(offset = 0, len = 1, every = 1) {
    let beat = this.beatFrac(offset, every);
    beat -= Math.floor(beat);
    
    len /= every;
    
    return Math.max(beat / len - (1 / len - 1), 0);
  }
  
  afterBeat(offset = 0, len = 1, every = 1) {
    let beat = this.beatFrac(offset, every);
    beat -= Math.floor(beat);
    beat = 1 - beat;
    
    len /= every;
    
    return Math.max(beat / len - (1 / len - 1), 0);
  }
  
  aroundBeat(offset = 0, attack = 0.5, decay = attack, every = 1) {
    return Math.max(this.untilBeat(offset, attack, every), this.afterBeat(offset, decay, every));
  }
  
  protected abstract run(): Promise<void>;
}
