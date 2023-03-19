import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { toast } from "react-toastify";
import { IndexPageResponse, LibraryImportRequest, LibraryImportResponse, ProcessingEvent, ProcessingEventType, Track } from "../types/api";
import { classJoin } from "./helpers/utils";
import usePageData from "./hooks/usePageData";
import ExLink from "./components/ExLink";
import FormIterator from "./helpers/FormIterator";
import requestJSON from "./helpers/requestJSON";
import useAsyncCallback from "./hooks/useAsyncCallback";
import AsyncButton from "./components/AsyncButton";
import Visual from "./visuals/Visual";
import Simple from "./visuals/Simple";
import "./IndexPage.scss";

interface FormFields {
  url: string;
}

interface State {
  hideInterval: null | number;
  canvas: null | HTMLCanvasElement;
  audio: null | HTMLAudioElement;
  visual: null | Visual;
}

export default function IndexPage() {
  const [pageData,, refresh] = usePageData<IndexPageResponse>();
  const [selected, setSelect] = useState<null | Track>(null);
  const [hideMouse, setHideMouse] = useState(true);
  const [sideMenu, setSideMenu] = useState(true);
  const [addForm, toggleAddForm] = useReducer(x => !x, false);
  
  const state = useRef<State>({
    hideInterval: null,
    canvas: null,
    audio: null,
    visual: null,
  });
  
  const onDeselect = useCallback(() => setSelect(null), []);
  
  const [onAdd, adding] = useAsyncCallback(async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const data = new FormIterator(ev.currentTarget).serialize<FormFields>();
    
    const track = await requestJSON<LibraryImportResponse, LibraryImportRequest>({
      method: "POST",
      url: "/api/library",
      data,
    });
    
    toggleAddForm();
    refresh();
    
    toast.info(track.name + " is being downloaded...");
  }, [refresh]);
  
  const onRescan = useCallback(async () => {
    await requestJSON<JustOk, Empty>({
      method: "POST",
      url: "/api/library/rescan",
    });
    
    refresh();
    
    toast.success("Library has been rescanned");
  }, [refresh]);
  
  const onPointerMove = useCallback((ev: React.PointerEvent) => {
    setSideMenu(ev.clientX > ev.currentTarget.clientWidth - 16 * 40);
    setHideMouse(false);
    
    if(state.current.hideInterval !== null) {
      clearInterval(state.current.hideInterval);
      state.current.hideInterval = null;
    }
    
    if(ev.target === ev.currentTarget) state.current.hideInterval = setInterval(() => setHideMouse(true), 2000) as any as number;
  }, []);
  
  const updateVisual = useCallback(() => {
    if(state.current.canvas && state.current.audio) {
      if(!state.current.visual) {
        state.current.visual = new Simple(state.current.canvas, state.current.audio);
        state.current.visual.start();
      }
    } else if(state.current.visual) {
      state.current.visual.stop();
      state.current.visual = null;
    }
  }, []);
  
  const canvasRef = useCallback((canvas: null | HTMLCanvasElement) => { state.current.canvas = canvas; updateVisual(); }, [updateVisual]);
  const audioRef = useCallback((audio: null | HTMLAudioElement) => { state.current.audio = audio; updateVisual(); }, [updateVisual]);
  
  useEffect(() => {
    updateVisual();
    
    const onResize = () => state.current.visual?.resize();
    window.addEventListener("resize", onResize);
    
    return () => {
      window.removeEventListener("resize", onResize);
      
      if(state.current.hideInterval !== null) {
        clearInterval(state.current.hideInterval);
        state.current.hideInterval = null;
      }
      
      if(state.current.visual) {
        state.current.visual.stop();
        state.current.visual = null; // eslint-disable-line react-hooks/exhaustive-deps
      }
    };
  }, [updateVisual]);
  
  return (
    // eslint-disable-next-line react/no-unknown-property
    <div className={classJoin("IndexPage", hideMouse && "hideMouse")} onPointerMove={onPointerMove}>
      <canvas className="mainCanvas" ref={canvasRef}></canvas>
      <div className={classJoin("menu", (sideMenu || !selected) && "show")}>
        <div className="header">YouTube DMT v2</div>
        <div className="buttons">
          <button onClick={toggleAddForm}>Add</button>
          <button onClick={refresh}>Refresh</button>
          <AsyncButton onClick={onRescan}>Rescan</AsyncButton>
          <ExLink to="https://github.com/funmaker/YouTubeDMTv2" className="button">GitHub</ExLink>
          <AsyncButton onClick={onFullScreen}>Maximize</AsyncButton>
        </div>
        {addForm &&
          <form className="addForm" onSubmit={adding ? doNothing : onAdd}>
            <input placeholder="https://www.youtube.com/watch?v=..." name="url" defaultValue="https://www.youtube.com/watch?v=MMtlDFoe38Y" />
            <button>Add</button>
          </form>
        }
        <div className="list">
          {pageData?.library.map(track => <TrackItem key={track.id} track={track} selected={selected?.id === track.id} onSelect={setSelect} refresh={refresh} />)}
        </div>
        {selected &&
          <div className="player">
            <div className="metadata">
              {selected.thumbnail && <img src={selected.thumbnail} alt="thumbnail" className="thumbnail" />}
              <button className="closeButton" onClick={onDeselect}>X</button>
              <div className="header">Currently Playing:</div>
              <div className="name">{selected.name}</div>
              <div className="artist">by <span>{selected.artist}</span></div>
            </div>
            <audio controls src={selected.url} autoPlay ref={audioRef} />
          </div>
        }
      </div>
    </div>
  );
}

interface TrackProps {
  track: Track;
  selected: boolean;
  onSelect: (track: Track) => void;
  refresh: () => void;
}

function TrackItem({ track, onSelect, selected, refresh }: TrackProps) {
  const [progress, setProgress] = useState<null | number>(null);
  
  const onClick = useCallback(() => {
    if(track.downloading) return;
    onSelect(track);
  }, [onSelect, track]);
  
  const onDelete = useCallback(async (ev: React.MouseEvent) => {
    ev.stopPropagation();
    
    await requestJSON<JustOk, Empty>({
      method: "DELETE",
      url: `/api/library/${track.id}`,
    });
    
    refresh();
  }, [refresh, track.id]);
  
  useEffect(() => {
    if(track.downloading) {
      const progressEmitter = new EventSource(`/api/library/${track.id}/progress`);
      
      progressEmitter.addEventListener("message", (ev: MessageEvent<string>) => {
        const event: ProcessingEvent = JSON.parse(ev.data);
        console.log(event);
        
        switch(event.type) {
          case ProcessingEventType.FINISH:
            toast.success(track.name + " has been added to the library.");
            setProgress(null);
            refresh();
            break;
          case ProcessingEventType.PROGRESS:
            setProgress(event.progress);
            break;
          case ProcessingEventType.ERROR:
            toast.success(track.name + " couldn't be added to the library. Unexpected error.");
            setProgress(null);
            refresh();
            break;
        }
      });
      
      return () => {
        progressEmitter.close();
        setProgress(null);
      };
    } else return () => {};
  }, [refresh, track.downloading, track.id, track.name]);
  
  return (
    <div className={classJoin("TrackItem metadata", selected && "selected", track.downloading && "downloading")} onClick={onClick}>
      {track.thumbnail && <img src={track.thumbnail} alt="thumbnail" className="thumbnail" />}
      <div className="name">{track.name}</div>
      <div className="artist">by <span>{track.artist}</span></div>
      {!track.downloading &&
        <div className="buttons">
          <button>Play</button>
          {track.source && <ExLink className="button" to={track.source} onClick={stopPropagation}>Source</ExLink>}
          <AsyncButton onClick={onDelete}>Remove</AsyncButton>
        </div>
      }
      {typeof progress === "number" &&
        <div className="progress">
          <span className="bar" style={{ width: `${progress * 100}%` }} />
        </div>
      }
    </div>
  );
}

async function onFullScreen() {
  if(document.fullscreenElement) {
    await document.exitFullscreen();
  } else {
    await document.documentElement.requestFullscreen();
  }
}

const doNothing = (ev: React.SyntheticEvent) => ev.preventDefault();
const stopPropagation = (ev: React.SyntheticEvent) => ev.stopPropagation();
