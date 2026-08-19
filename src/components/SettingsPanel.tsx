import type { AppSettings, Fps, Quality } from "../types";
import { pickFolder } from "../lib/backend";

export default function SettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
  onClose: () => void;
}) {
  async function browse() {
    const dir = await pickFolder();
    if (dir) onChange({ ...settings, exportDir: dir });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <p>Defaults for new clips. You can still change resolution and FPS per export.</p>
        <div className="form-grid">
          <label className="stack">
            Default resolution
            <select
              className="field"
              value={settings.quality}
              onChange={(e) =>
                onChange({ ...settings, quality: e.target.value as Quality })
              }
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
          </label>
          <label className="stack">
            Default FPS
            <select
              className="field"
              value={settings.fps}
              onChange={(e) =>
                onChange({ ...settings, fps: Number(e.target.value) as Fps })
              }
            >
              <option value={30}>30 fps</option>
              <option value={60}>60 fps</option>
            </select>
          </label>
          <label className="stack full">
            Export folder
            <div className="row">
              <input
                className="title-input"
                readOnly
                value={settings.exportDir || "Documents\\Portrait Clip\\Exports"}
              />
              <button className="btn" type="button" onClick={() => void browse()}>
                Browse
              </button>
            </div>
          </label>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
          <button className="btn-accent" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
