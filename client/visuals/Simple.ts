import { hsv, rgb } from "../helpers/utils";
import Visual from "./Visual";

export default class Simple extends Visual {
  protected async run() {
    const canvas = this.mainCanvas;
    const ctx = this.mainCanvas.getContext("2d");
    if(!ctx) return this.stop();
    
    while(this.running) {
      // ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = rgb(0, 0, 0, 5 / 255);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.resetTransform();
      ctx.translate(
        canvas.width / 2,
        canvas.height / 2,
      );
      ctx.rotate(
        (this.aroundBeat(0, 0.5, 0.5, 2) ** 2 - this.aroundBeat(1, 0.5, 0.5, 2) ** 2) * 0.05
        + this.afterBeat(0,  4, 16),
      );
      ctx.scale(
        0.97 - this.afterBeat(0, 0.5, 2) * 0.05,
        0.97 - this.afterBeat(1, 0.5, 2) * 0.05,
      );
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      ctx.resetTransform();
      
      if(this.onBeat()) {
        console.log(this.beat());
        
        ctx.strokeStyle = hsv(0, 0, 0.5);
        ctx.lineWidth = 25;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
      }
      
      for(let i = 0; i < 4; i++) {
        ctx.strokeStyle = hsv(i / 4, 1, 1.0, this.afterBeat(i / 4, 0.25));
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, canvas.height / 20 * (9.5 - i), 0, 2 * Math.PI);
        ctx.stroke();
      }
      
      await this.nextFrame();
    }
  }
}
