
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
    this.run();
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
  
  private beatFrac(time: number, bias: number, every: number, off: number) {
    const { bps, beatOffset } = this.state;
    return ((time - beatOffset) / every - off) * bps - bias;
  }
  
  beat(bias = 0, every = 1, off = 0) {
    return Math.floor(this.beatFrac(this.state.currentTime, bias, every, off));
  }
  
  onBeat(bias = 0, every = 1, off = 0) {
    const previous = Math.floor(this.beatFrac(this.state.lastTime, bias, every, off));
    const current = Math.floor(this.beatFrac(this.state.currentTime, bias, every, off));
    return previous !== current;
  }
  
  untilBeat(bias = 0, frac = 1, every = 1, off = 0) {
    const beat = this.beatFrac(this.state.currentTime, bias, every, off) % 1;
    return Math.max(beat / frac - (1 / frac - 1), 0);
  }
  
  afterBeat(bias = 0, frac = 1, every = 1, off = 0) {
    const beat = 1 - this.beatFrac(this.state.currentTime, bias, every, off) % 1;
    return Math.max(beat / frac - (1 / frac - 1), 0);
  }
  
  aroundBeat(bias = 0, attack = 0.5, decay = attack, every = 1, off = 0) {
    return Math.max(this.untilBeat(bias, attack, every, off), this.afterBeat(bias, decay, every, off));
  }
  
  protected abstract run(): Promise<void>;
}
