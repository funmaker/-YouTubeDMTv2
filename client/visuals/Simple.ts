import { hsv, rgb } from "../helpers/utils";
import Visual from "./Visual";

export default class Simple extends Visual {
  protected async run() {
    const ctx = this.canvas({
      size: "max",
      padding: 0.1,
    });
    
    while(this.running) {
      const umpf = this.afterBeat(0,  4, 16);
      
      this.crop(ctx, "absolute");
      if(umpf <= 0.2) {
        ctx.fillStyle = rgb(0, 0, 0, 10 / 255);
        ctx.fillRect(-1, -1, 2, 2);
      }
      
      ctx.rotate(
        (this.aroundBeat(0, 0.5, 0.5, 2) ** 2 - this.aroundBeat(1, 0.5, 0.5, 2) ** 2) * 0.075
        + umpf * 2,
      );
      ctx.scale(
        0.95 - this.afterBeat(0, 0.5, 2) * 0.1,
        0.95 - this.afterBeat(1, 0.5, 2) * 0.1,
      );
      ctx.drawImage(ctx.canvas, -1, -1, 2, 2);
      
      if(this.onBeat()) {
        console.log(this.beat());
        
        const ratio = this.crop(ctx, "absolute", "height");
        ctx.strokeStyle = hsv(0, 0, 0.5);
        ctx.lineWidth = 0.02 + umpf * 0.03;
        ctx.strokeRect(-ratio, -1, ratio * 2, 2);
      }
      
      this.crop(ctx, "contain", "min");
      for(let i = 0; i < 4; i++) {
        ctx.strokeStyle = hsv(i / 4, 1, 1.0, this.afterBeat(i / 4, 0.25));
        ctx.lineWidth = 0.03;
        ctx.beginPath();
        ctx.arc(0.0, 0.0, (20 - i) / 20, 0, 2 * Math.PI);
        ctx.stroke();
      }
      
      this.crop(ctx, "contain");
      this.crop(this.outputCtx, "inner");
      this.drawCanvas(this.outputCtx, ctx);
      
      await this.nextFrame();
    }
  }
}
