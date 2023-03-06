import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { toast } from "react-toastify";
import { IndexPageResponse, LibraryImportRequest, LibraryImportResponse, Track } from "../types/api";
import { classJoin } from "./helpers/utils";
import usePageData from "./hooks/usePageData";
import ExLink from "./components/ExLink";
import FormIterator from "./helpers/FormIterator";
import requestJSON from "./helpers/requestJSON";
import useAsyncCallback from "./hooks/useAsyncCallback";
import "./IndexPage.scss";

interface FormFields {
  url: string;
}

export default function IndexPage() {
  const [pageData,, refresh] = usePageData<IndexPageResponse>();
  const [selected, setSelect] = useState<null | Track>(null);
  const [hideMouse, setHideMouse] = useState(true);
  const [sideMenu, setSideMenu] = useState(true);
  const [addForm, toggleAddForm] = useReducer(x => !x, false);
  const hideRef = useRef<null | number>(null);
  
  const onDeselect = useCallback(() => setSelect(null), []);
  
  const [onAdd, loading] = useAsyncCallback(async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const data = new FormIterator(ev.currentTarget).serialize<FormFields>();
    
    const track = await requestJSON<LibraryImportResponse, LibraryImportRequest>({
      method: "POST",
      url: "/api/library",
      data,
    });
    
    toggleAddForm();
    refresh();
    
    toast.success("Added " + track.name);
  }, [refresh]);
  
  const onPointerMove = useCallback((ev: React.PointerEvent) => {
    setSideMenu(ev.clientX > ev.currentTarget.clientWidth - 16 * 40);
    setHideMouse(false);
    
    if(hideRef.current !== null) {
      clearInterval(hideRef.current);
      hideRef.current = null;
    }
    
    if(ev.target === ev.currentTarget) hideRef.current = setInterval(() => setHideMouse(true), 2000) as any as number;
  }, []);
  
  useEffect(() => () => {
    if(hideRef.current !== null) {
      clearInterval(hideRef.current);
      hideRef.current = null;
    }
  }, []);
  
  return (
    // eslint-disable-next-line react/no-unknown-property
    <div className={classJoin("IndexPage", hideMouse && "hideMouse")} onPointerMove={onPointerMove}>
      <canvas className="mainCanvas"></canvas>
      <div className={classJoin("menu", sideMenu && "show")}>
        <div className="header">YouTube DMT v2</div>
        <div className="buttons">
          <button onClick={toggleAddForm}>Add</button>
          <button>Refresh</button>
          <ExLink to="https://github.com/funmaker/YouTubeDMTv2" className="button">GitHub</ExLink>
          <button onClick={onFullScreen}>Fullscreen</button>
        </div>
        {addForm &&
          <form className="addForm" onSubmit={loading ? doNothing : onAdd}>
            <input placeholder="https://www.youtube.com/watch?v=..." name="url" defaultValue="https://youtu.be/qicumWTMkfk" />
            <button>Add</button>
          </form>
        }
        <div className="list">
          {pageData?.library.map(track => <TrackItem key={track.id} track={track} onSelect={setSelect} selected={selected?.id === track.id} />)}
        </div>
        {selected &&
          <div className="player metadata">
            <div className="header">Currently Playing:</div>
            <div className="name">{selected.name}</div>
            <div className="artist">by <span>{selected.artist}</span></div>
            <div className="buttons">
              <button onClick={onDeselect}>Stop</button>
              {selected.source && <ExLink className="button" to={selected.source} onClick={stopPropagation}>Source</ExLink>}
            </div>
            <audio controls src={selected.url} autoPlay />
          </div>
        }
      </div>
    </div>
  );
}

interface TrackProps {
  track: Track;
  onSelect: (track: Track) => void;
  selected: boolean;
}

function TrackItem({ track, onSelect, selected }: TrackProps) {
  const onClick = useCallback(() => onSelect(track), [onSelect, track]);
  
  return (
    <div className={classJoin("TrackItem metadata", selected && "selected")} onClick={onClick}>
      <div className="name">{track.name}</div>
      <div className="artist">by <span>{track.artist}</span></div>
      <div className="buttons">
        <button>Play</button>
        {track.source && <ExLink className="button" to={track.source} onClick={stopPropagation}>Source</ExLink>}
        <button onClick={stopPropagation}>Remove</button>
      </div>
      {track.thumbnail && <img src={track.thumbnail} alt="thumbnail" className="thumbnail" />}
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
