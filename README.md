# Portrait Clip

**Windows app to reframe stream recordings into TikToks, Shorts, and Reels.**

Crop gameplay and webcam, split and cut on a timeline, compile locally. No account, no watermark, nothing uploaded.

[![Download for Windows](https://img.shields.io/github/v/release/beaudenison/portrait-clip?label=Download%20for%20Windows&color=111111)](https://github.com/beaudenison/portrait-clip/releases/latest)

**[Download the latest installer →](https://github.com/beaudenison/portrait-clip/releases/latest)**

<p align="center">
  <img src="docs/icon.png" width="128" alt="Portrait Clip">
</p>

## Features

- Upload a clip (MP4, MOV, MKV, WEBM, or AVI)
- Drag **Content** and **Camera** crops onto a vertical, square, or landscape canvas
- Presets: Portrait Split, Portrait Crop, Full Blur — or save your own layout
- Split at the playhead, trim each piece, delete the parts you do not want
- Compile on this PC with FFmpeg (720p / 1080p, 30 / 60 fps)
- Defaults in **Settings**: resolution, FPS, export folder
- Stitch compiled clips into a montage

Exports go to `Documents\Portrait Clip\Exports` unless you change the folder.

## Install and update

1. Download **Portrait Clip_x.x.x_x64-setup.exe** from [Releases](https://github.com/beaudenison/portrait-clip/releases/latest).
2. Run the setup. It installs for the current Windows user.

To update, download the newer setup and run it. It **replaces** the existing install. Your clips, layouts, and settings stay on this PC.

Requires **Windows 10 or 11** (64-bit).

## Develop

Needs Node.js, Rust, and Visual Studio 2022 Build Tools (C++).

```powershell
git clone https://github.com/beaudenison/portrait-clip.git
cd portrait-clip
npm.cmd install
powershell -File scripts\download-ffmpeg.ps1
npm.cmd run tauri -- dev
```

Build the installer:

```powershell
npm.cmd run tauri -- build
```

The setup file is written to `src-tauri/target/release/bundle/nsis/`.

## License

MIT
