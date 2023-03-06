import PromiseRouter from "express-promise-router";
import { LibraryImportRequest, LibraryImportResponse, LibraryListResponse, ProcessingEvent, ProcessingEventType } from "../../types/api";
import * as libraryController from "../controllers/library";

export const router = PromiseRouter();

router.delete<JustId, JustOk, never>("/:id", async (req, res) => {
  await libraryController.remove(req.params.id);
  
  res.json({
    ok: true,
  });
});

router.post<never, JustOk, never>("/rescan", async (req, res) => {
  await libraryController.rescan();
  
  res.json({
    ok: true,
  });
});

router.post<never, LibraryImportResponse, LibraryImportRequest>("/", async (req, res) => {
  const track = await libraryController.add(req.body.url);
  
  res.json(track);
});

router.get<JustId, never, never>("/:id/progress", async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // flush the headers to establish SSE with client
  
  const send = (ev: ProcessingEvent) => {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
    res.flush();
  };
  
  function onFinish() {
    send({ type: ProcessingEventType.FINISH });
    end();
  }
  
  let lastProgress = Date.now();
  function onProgress(progress: number) {
    if(Date.now() - lastProgress < 100) return;
    
    send({ type: ProcessingEventType.PROGRESS, progress });
    lastProgress = Date.now();
  }
  
  function onError() {
    send({ type: ProcessingEventType.ERROR });
    end();
  }
  
  const emitter = libraryController.progress(req.params.id);
  if(!emitter) {
    onFinish();
    return;
  }
  
  emitter.on("finish", onFinish);
  emitter.on("progress", onProgress);
  emitter.on("error", onError);
  
  function end() {
    if(emitter) {
      emitter.off("finish", onFinish);
      emitter.off("progress", onProgress);
      emitter.off("error", onError);
    }
    res.end();
  }
  
  res.on('close', () => {
    end();
  });
});

router.get<never, LibraryListResponse, never>("/", async (req, res) => {
  const list = libraryController.list();
  
  res.json(list);
});
