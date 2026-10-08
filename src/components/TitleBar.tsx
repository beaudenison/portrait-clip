import type { View } from "../types";
import { closeWindow, minimizeWindow, toggleMaximize } from "../lib/backend";
import { IconClose, IconGear } from "./icons";

export default function TitleBar({
  view,
  onView,
  canEditor,
  canMontage,
  onSettings,
}: {
  view: View;
  onView: (v: View) => void;
  canEditor: boolean;
  canMontage: boolean;
  onSettings: () => void;
}) {
  return (
    <header className="titlebar">
      <div className="titlebar-drag" data-tauri-drag-region>
        <div className="logo-mark" data-tauri-drag-region aria-hidden />
        <div className="brand" data-tauri-drag-region>
          Portrait Clip
        </div>
        <nav className="nav">
          <button
            className={view === "library" ? "active" : ""}
            onClick={() => onView("library")}
          >
            Library
          </button>
          <button
            className={view === "editor" ? "active" : ""}
            disabled={!canEditor}
            onClick={() => canEditor && onView("editor")}
          >
            Editor
          </button>
          <button
            className={view === "montage" ? "active" : ""}
            disabled={!canMontage}
            onClick={() => canMontage && onView("montage")}
          >
            Montage
          </button>
        </nav>
      </div>
      <button className="icon-btn settings-btn" onClick={onSettings} title="Settings" aria-label="Settings">
        <IconGear />
      </button>
      <div className="window-controls">
        <button onClick={() => void minimizeWindow()} aria-label="Minimize">
          <span className="win-glyph min" />
        </button>
        <button onClick={() => void toggleMaximize()} aria-label="Maximize">
          <span className="win-glyph max" />
        </button>
        <button className="close" onClick={() => void closeWindow()} aria-label="Close">
          <IconClose />
        </button>
      </div>
    </header>
  );
}
