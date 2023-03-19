
class Interrupted extends Error {
  constructor() { super("Interrupted"); }
}

export default abstract class Visual {
  running = false;
  private cancelNextFrame: null | (() => void) = null;
  
  protected state = {
    currentTime: 0,
    lastTime: 0,
    bps: 90 / 60,
    beatOffset: 0.1,
  };
  
  constructor(protected mainCanvas: HTMLCanvasElement, protected audio: HTMLAudioElement) {
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
    });
  }
  
  stop() {
    this.running = false;
    if(this.cancelNextFrame) this.cancelNextFrame();
  }
  
  resize() {
    if(this.mainCanvas.width !== this.mainCanvas.clientWidth || this.mainCanvas.height !== this.mainCanvas.clientHeight) {
      this.mainCanvas.width = this.mainCanvas.clientWidth;
      this.mainCanvas.height = this.mainCanvas.clientHeight;
    }
  }
  
  update() {
    this.state.lastTime = this.state.currentTime;
    this.state.currentTime = this.audio.currentTime;
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
