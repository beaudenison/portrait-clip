use regex::Regex;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

pub struct ExportLock(pub Mutex<Option<Child>>);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RectNorm {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerSpec {
    pub input: RectNorm,
    pub output: RectNorm,
    pub visible: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeSegment {
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportClipArgs {
    pub source_path: String,
    pub output_path: String,
    pub thumbnail_path: String,
    pub segments: Vec<TimeSegment>,
    pub output_width: i64,
    pub output_height: i64,
    pub fps: i64,
    pub blur_background: bool,
    pub layers: Vec<LayerSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub quality: String,
    pub fps: i64,
    pub export_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportMontageArgs {
    pub clip_paths: Vec<String>,
    pub output_path: String,
    pub thumbnail_path: String,
    pub transition: String,
    pub transition_duration: f64,
    pub output_width: i64,
    pub output_height: i64,
    pub fps: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeResult {
    pub duration: f64,
    pub width: i64,
    pub height: i64,
    pub fps: f64,
    pub has_audio: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EncoderInfo {
    pub encoder: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgress {
    pub percent: f64,
    pub time: String,
    pub message: String,
}

fn even(v: i64) -> i64 {
    let n = if v < 2 { 2 } else { v };
    n & !1
}

fn tool(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(p) = app.path().resolve(name, BaseDirectory::Resource) {
        candidates.push(p);
    }
    if let Ok(p) = app.path().resolve(format!("resources/{name}"), BaseDirectory::Resource) {
        candidates.push(p);
    }
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join(name),
    );
    for c in candidates {
        if c.exists() {
            return Ok(c);
        }
    }
    Err(format!("{name} was not bundled with Portrait Clip"))
}

fn ffmpeg(app: &AppHandle) -> Result<PathBuf, String> {
    tool(app, "ffmpeg.exe")
}

fn ffprobe(app: &AppHandle) -> Result<PathBuf, String> {
    tool(app, "ffprobe.exe")
}

fn command(bin: &Path) -> Command {
    let mut cmd = Command::new(bin);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    cmd
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
fn default_export_dir(app: AppHandle) -> Result<String, String> {
    let docs = app.path().document_dir().map_err(|e| e.to_string())?;
    let dir = docs.join("Portrait Clip").join("Exports");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn join_path(parts: Vec<String>) -> String {
    let mut p = PathBuf::new();
    for part in parts {
        p.push(part);
    }
    p.to_string_lossy().to_string()
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    PathBuf::from(path).exists()
}

#[tauri::command]
fn load_library(app: AppHandle) -> Result<serde_json::Value, String> {
    let path = data_dir(&app)?.join("library.json");
    let export = default_export_dir(app.clone())?;
    if !path.exists() {
        return Ok(serde_json::json!({
            "clips": [],
            "montages": [],
            "layouts": [],
            "libraryDir": export
        }));
    }
    let text = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut value: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| e.to_string())?;
    if let Some(obj) = value.as_object_mut() {
        obj.insert("libraryDir".into(), serde_json::Value::String(export));
    }
    Ok(value)
}

#[tauri::command]
fn save_library(app: AppHandle, state: serde_json::Value) -> Result<(), String> {
    let path = data_dir(&app)?.join("library.json");
    let text = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    std::fs::write(path, text).map_err(|e| e.to_string())
}

#[tauri::command]
fn pick_video(app: AppHandle) -> Result<Option<String>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("Video", &["mp4", "mov", "mkv", "webm", "avi", "m4v"])
        .blocking_pick_file();
    Ok(file.and_then(|f| f.into_path().ok()).map(|p| p.display().to_string()))
}

#[tauri::command]
fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    let folder = app.dialog().file().blocking_pick_folder();
    Ok(folder.and_then(|f| f.into_path().ok()).map(|p| p.display().to_string()))
}

#[tauri::command]
fn load_settings(app: AppHandle) -> Result<AppSettings, String> {
    let path = data_dir(&app)?.join("settings.json");
    if !path.exists() {
        return Ok(AppSettings {
            quality: "1080p".into(),
            fps: 30,
            export_dir: String::new(),
        });
    }
    let text = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = data_dir(&app)?.join("settings.json");
    let text = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(path, text).map_err(|e| e.to_string())
}

#[tauri::command]
fn pick_save_path(app: AppHandle, default_name: String) -> Result<Option<String>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("MP4", &["mp4"])
        .set_file_name(&default_name)
        .blocking_save_file();
    Ok(file.and_then(|f| f.into_path().ok()).map(|p| p.display().to_string()))
}

#[tauri::command]
fn open_path(app: AppHandle, path: String) -> Result<(), String> {
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn reveal_path(path: String) -> Result<(), String> {
    Command::new("explorer")
        .arg("/select,")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn parse_rate(raw: &str) -> f64 {
    if let Some((a, b)) = raw.split_once('/') {
        let n: f64 = a.parse().unwrap_or(0.0);
        let d: f64 = b.parse().unwrap_or(1.0);
        if d != 0.0 {
            return n / d;
        }
    }
    raw.parse().unwrap_or(30.0)
}

#[tauri::command]
fn probe_video(app: AppHandle, path: String) -> Result<ProbeResult, String> {
    let out = command(&ffprobe(&app)?)
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            &path,
        ])
        .output()
        .map_err(|e| format!("ffprobe failed: {e}"))?;
    if !out.status.success() {
        return Err("Could not read that video file".into());
    }
    let json: serde_json::Value =
        serde_json::from_slice(&out.stdout).map_err(|e| e.to_string())?;
    let mut result = ProbeResult {
        duration: json["format"]["duration"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0.0),
        width: 1920,
        height: 1080,
        fps: 30.0,
        has_audio: false,
    };
    if let Some(streams) = json["streams"].as_array() {
        for stream in streams {
            match stream["codec_type"].as_str() {
                Some("video") => {
                    result.width = stream["width"].as_i64().unwrap_or(1920);
                    result.height = stream["height"].as_i64().unwrap_or(1080);
                    if let Some(rate) = stream["avg_frame_rate"].as_str() {
                        let fps = parse_rate(rate);
                        if fps > 0.0 {
                            result.fps = fps;
                        }
                    }
                }
                Some("audio") => result.has_audio = true,
                _ => {}
            }
        }
    }
    Ok(result)
}

#[tauri::command]
fn detect_encoder(app: AppHandle) -> Result<EncoderInfo, String> {
    Ok(choose_encoder(&app))
}

fn choose_encoder(app: &AppHandle) -> EncoderInfo {
    let Ok(bin) = ffmpeg(app) else {
        return EncoderInfo {
            encoder: "libx264".into(),
            label: "Software H.264".into(),
        };
    };
    let out = command(&bin)
        .args(["-hide_banner", "-encoders"])
        .output()
        .ok();
    let text = out
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default();
    if text.contains("h264_nvenc") {
        EncoderInfo {
            encoder: "h264_nvenc".into(),
            label: "NVIDIA NVENC".into(),
        }
    } else if text.contains("h264_amf") {
        EncoderInfo {
            encoder: "h264_amf".into(),
            label: "AMD AMF".into(),
        }
    } else if text.contains("h264_qsv") {
        EncoderInfo {
            encoder: "h264_qsv".into(),
            label: "Intel Quick Sync".into(),
        }
    } else {
        EncoderInfo {
            encoder: "libx264".into(),
            label: "Software H.264".into(),
        }
    }
}

fn encoder_args(encoder: &str) -> Vec<String> {
    match encoder {
        "h264_nvenc" => vec![
            "-c:v", "h264_nvenc", "-preset", "p4", "-rc", "vbr", "-cq", "21", "-b:v", "0",
        ]
        .into_iter()
        .map(String::from)
        .collect(),
        "h264_amf" => vec!["-c:v", "h264_amf", "-quality", "balanced", "-rc", "cqp", "-qp_i", "20"]
            .into_iter()
            .map(String::from)
            .collect(),
        "h264_qsv" => vec!["-c:v", "h264_qsv", "-global_quality", "22"]
            .into_iter()
            .map(String::from)
            .collect(),
        _ => vec!["-c:v", "libx264", "-preset", "veryfast", "-crf", "20"]
            .into_iter()
            .map(String::from)
            .collect(),
    }
}

fn kept_segments(args: &ExportClipArgs) -> Vec<(f64, f64)> {
    if args.segments.is_empty() {
        return vec![(0.0, 0.1)];
    }
    args.segments
        .iter()
        .map(|s| {
            let start = s.start.max(0.0);
            let end = s.end.max(start + 0.05);
            (start, end)
        })
        .collect()
}

fn build_clip_filter(args: &ExportClipArgs, src_w: i64, src_h: i64, has_audio: bool) -> (String, f64) {
    let ow = even(args.output_width);
    let oh = even(args.output_height);
    let segs = kept_segments(args);
    let sn = segs.len();
    let layers: Vec<&LayerSpec> = args.layers.iter().filter(|l| l.visible).collect();
    let n = layers.len().max(1);
    let mut total = 0.0;

    let mut fc = String::new();
    for (i, (start, end)) in segs.iter().enumerate() {
        total += end - start;
        fc.push_str(&format!(
            "[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS[tv{i}];"
        ));
        if has_audio {
            fc.push_str(&format!(
                "[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS[ta{i}];"
            ));
        }
    }
    for i in 0..sn {
        fc.push_str(&format!("[tv{i}]"));
        if has_audio {
            fc.push_str(&format!("[ta{i}]"));
        }
    }
    if has_audio {
        fc.push_str(&format!("concat=n={sn}:v=1:a=1[src][asrc];"));
    } else {
        fc.push_str(&format!("concat=n={sn}:v=1:a=0[src];"));
    }

    if args.blur_background {
        fc.push_str(&format!(
            "[src]split={}[src0]",
            n + 1
        ));
        for i in 1..n {
            fc.push_str(&format!("[src{i}]"));
        }
        fc.push_str("[bgsrc];");
        fc.push_str(&format!(
            "[bgsrc]scale={ow}:{oh}:force_original_aspect_ratio=increase,crop={ow}:{oh},gblur=sigma=18[bg]"
        ));
    } else {
        fc.push_str(&format!("[src]split={n}[src0]"));
        for i in 1..n {
            fc.push_str(&format!("[src{i}]"));
        }
        fc.push_str(&format!(
            ";color=c=black:s={ow}x{oh}:d={total}:r={}[bg]",
            args.fps.max(1)
        ));
    }

    for (i, layer) in layers.iter().enumerate() {
        let cx = even((layer.input.x * src_w as f64).round() as i64).clamp(0, src_w - 2);
        let cy = even((layer.input.y * src_h as f64).round() as i64).clamp(0, src_h - 2);
        let mut cw = even((layer.input.w * src_w as f64).round() as i64);
        let mut ch = even((layer.input.h * src_h as f64).round() as i64);
        if cx + cw > src_w {
            cw = even(src_w - cx);
        }
        if cy + ch > src_h {
            ch = even(src_h - cy);
        }
        cw = cw.max(2);
        ch = ch.max(2);
        let dw = even((layer.output.w * ow as f64).round() as i64).max(2);
        let dh = even((layer.output.h * oh as f64).round() as i64).max(2);
        fc.push_str(&format!(
            ";[src{i}]crop={cw}:{ch}:{cx}:{cy},scale={dw}:{dh}:force_original_aspect_ratio=increase,crop={dw}:{dh},setsar=1[ly{i}]"
        ));
    }

    if layers.is_empty() {
        fc.push_str(";[bg]null[vout]");
    } else {
        let mut last = "bg".to_string();
        for (i, layer) in layers.iter().enumerate() {
            let dx = even((layer.output.x * ow as f64).round() as i64).max(0);
            let dy = even((layer.output.y * oh as f64).round() as i64).max(0);
            let next = if i + 1 == layers.len() {
                "vout".to_string()
            } else {
                format!("o{i}")
            };
            fc.push_str(&format!(
                ";[{last}][ly{i}]overlay={dx}:{dy}:shortest=1[{next}]"
            ));
            last = next;
        }
    }

    if has_audio {
        fc.push_str(";[asrc]anull[aout]");
    }
    (fc, total.max(0.1))
}

fn run_ffmpeg(
    app: &AppHandle,
    lock: &ExportLock,
    args: Vec<String>,
    duration: f64,
    message: &str,
) -> Result<(), String> {
    let bin = ffmpeg(app)?;
    let mut cmd = command(&bin);
    cmd.args(&args).stderr(Stdio::piped()).stdout(Stdio::null());
    let mut child = cmd.spawn().map_err(|e| format!("Could not start FFmpeg: {e}"))?;
    let stderr = child.stderr.take().ok_or("FFmpeg stderr missing")?;
    {
        let mut guard = lock.0.lock().map_err(|e| e.to_string())?;
        *guard = Some(child);
    }

    let time_re = Regex::new(r"time=(\d+):(\d+):(\d+\.\d+)").unwrap();
    let reader = BufReader::new(stderr);
    let _ = app.emit(
        "export-progress",
        ExportProgress {
            percent: 1.0,
            time: "00:00:00".into(),
            message: message.into(),
        },
    );

    for line in reader.lines().flatten() {
        if let Some(c) = time_re.captures(&line) {
            let h: f64 = c[1].parse().unwrap_or(0.0);
            let m: f64 = c[2].parse().unwrap_or(0.0);
            let s: f64 = c[3].parse().unwrap_or(0.0);
            let t = h * 3600.0 + m * 60.0 + s;
            let percent = if duration > 0.0 {
                ((t / duration) * 100.0).clamp(1.0, 99.0)
            } else {
                10.0
            };
            let _ = app.emit(
                "export-progress",
                ExportProgress {
                    percent,
                    time: format!("{h:02.0}:{m:02.0}:{s:05.2}"),
                    message: message.into(),
                },
            );
        }
    }

    let status = {
        let mut guard = lock.0.lock().map_err(|e| e.to_string())?;
        match guard.take() {
            Some(mut child) => child.wait().map_err(|e| e.to_string())?,
            None => return Err("Export cancelled".into()),
        }
    };
    if !status.success() {
        return Err("FFmpeg failed to encode the video".into());
    }
    Ok(())
}

fn write_thumbnail(app: &AppHandle, video: &str, thumb: &str) -> Result<(), String> {
    if thumb.is_empty() {
        return Ok(());
    }
    let _ = command(&ffmpeg(app)?)
        .args([
            "-y",
            "-ss",
            "0.4",
            "-i",
            video,
            "-vframes",
            "1",
            "-vf",
            "scale=480:-1",
            thumb,
        ])
        .status();
    Ok(())
}

#[tauri::command]
fn export_clip(
    app: AppHandle,
    lock: State<ExportLock>,
    args: ExportClipArgs,
) -> Result<(), String> {
    if let Some(parent) = Path::new(&args.output_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let probe = probe_video(app.clone(), args.source_path.clone())?;
    let (filter, duration) = build_clip_filter(&args, probe.width, probe.height, probe.has_audio);
    let encoder = choose_encoder(&app);
    let mut ff = vec![
        "-y".into(),
        "-i".into(),
        args.source_path.clone(),
        "-filter_complex".into(),
        filter,
        "-map".into(),
        "[vout]".into(),
    ];
    if probe.has_audio {
        ff.extend(["-map".into(), "[aout]".into(), "-c:a".into(), "aac".into(), "-b:a".into(), "160k".into()]);
    }
    ff.extend(encoder_args(&encoder.encoder));
    ff.extend(
        [
            "-pix_fmt",
            "yuv420p",
            "-r",
            &args.fps.to_string(),
            "-movflags",
            "+faststart",
            &args.output_path,
        ]
        .into_iter()
        .map(|s| s.to_string()),
    );

    run_ffmpeg(&app, &lock, ff, duration, "Compiling clip")?;
    write_thumbnail(&app, &args.output_path, &args.thumbnail_path)?;
    let _ = app.emit(
        "export-progress",
        ExportProgress {
            percent: 100.0,
            time: String::new(),
            message: "Done".into(),
        },
    );
    Ok(())
}

fn xfade_name(transition: &str) -> &'static str {
    match transition {
        "swipe" => "wipeleft",
        "squeeze" => "squeezev",
        "fade" => "fade",
        _ => "fade",
    }
}

#[tauri::command]
fn export_montage(
    app: AppHandle,
    lock: State<ExportLock>,
    args: ExportMontageArgs,
) -> Result<(), String> {
    if args.clip_paths.len() < 2 {
        return Err("Need at least two clips".into());
    }
    if let Some(parent) = Path::new(&args.output_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let ow = even(args.output_width);
    let oh = even(args.output_height);
    let fps = args.fps.max(1);
    let mut probes = Vec::new();
    for p in &args.clip_paths {
        probes.push(probe_video(app.clone(), p.clone())?);
    }

    let mut ff: Vec<String> = vec!["-y".into()];
    for p in &args.clip_paths {
        ff.push("-i".into());
        ff.push(p.clone());
    }

    let mut filter = String::new();
    for (i, probe) in probes.iter().enumerate() {
        filter.push_str(&format!(
            "[{i}:v]scale={ow}:{oh}:force_original_aspect_ratio=decrease,pad={ow}:{oh}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={fps},format=yuv420p[v{i}];"
        ));
        if probe.has_audio {
            filter.push_str(&format!(
                "[{i}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,aresample=async=1[a{i}];"
            ));
        } else {
            filter.push_str(&format!(
                "anullsrc=r=48000:cl=stereo,atrim=0:{},asetpts=PTS-STARTPTS[a{i}];",
                probe.duration.max(0.1)
            ));
        }
    }

    let n = args.clip_paths.len();
    if args.transition == "cut" {
        for i in 0..n {
            filter.push_str(&format!("[v{i}][a{i}]"));
        }
        filter.push_str(&format!("concat=n={n}:v=1:a=1[vout][aout]"));
    } else {
        let fade = args.transition_duration.clamp(0.05, 2.0);
        let name = xfade_name(&args.transition);
        let mut offset = probes[0].duration - fade;
        if offset < 0.05 {
            offset = 0.05;
        }
        filter.push_str(&format!(
            "[v0][v1]xfade=transition={name}:duration={fade}:offset={offset}[vx1];[a0][a1]acrossfade=d={fade}[ax1]"
        ));
        let mut acc = probes[0].duration + probes[1].duration - fade;
        for i in 2..n {
            let prev = i - 1;
            let mut off = acc - fade;
            if off < 0.05 {
                off = 0.05;
            }
            filter.push_str(&format!(
                ";[vx{prev}][v{i}]xfade=transition={name}:duration={fade}:offset={off}[vx{i}];[ax{prev}][a{i}]acrossfade=d={fade}[ax{i}]"
            ));
            acc = acc + probes[i].duration - fade;
        }
        let last = n - 1;
        filter.push_str(&format!(";[vx{last}]null[vout];[ax{last}]anull[aout]"));
    }

    ff.push("-filter_complex".into());
    ff.push(filter);
    ff.extend(["-map".into(), "[vout]".into(), "-map".into(), "[aout]".into()]);
    let encoder = choose_encoder(&app);
    ff.extend(encoder_args(&encoder.encoder));
    ff.extend(
        [
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            &args.output_path,
        ]
        .into_iter()
        .map(|s| s.to_string()),
    );

    let total: f64 = probes.iter().map(|p| p.duration).sum();
    run_ffmpeg(&app, &lock, ff, total.max(0.1), "Creating montage")?;
    write_thumbnail(&app, &args.output_path, &args.thumbnail_path)?;
    let _ = app.emit(
        "export-progress",
        ExportProgress {
            percent: 100.0,
            time: String::new(),
            message: "Done".into(),
        },
    );
    Ok(())
}

#[tauri::command]
fn cancel_export(lock: State<ExportLock>) -> Result<(), String> {
    let mut guard = lock.0.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(ExportLock(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            default_export_dir,
            join_path,
            file_exists,
            load_library,
            save_library,
            pick_video,
            pick_save_path,
            pick_folder,
            load_settings,
            save_settings,
            open_path,
            reveal_path,
            probe_video,
            detect_encoder,
            export_clip,
            export_montage,
            cancel_export
        ])
        .run(tauri::generate_context!())
        .expect("error while running Portrait Clip");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn even_dims() {
        assert_eq!(even(1080), 1080);
        assert_eq!(even(1081), 1080);
        assert_eq!(even(1), 2);
    }

    #[test]
    fn layer_scale_covers_instead_of_stretching() {
        let args = ExportClipArgs {
            source_path: String::new(),
            output_path: String::new(),
            thumbnail_path: String::new(),
            segments: vec![TimeSegment { start: 0.0, end: 1.0 }],
            output_width: 1080,
            output_height: 1920,
            fps: 30,
            blur_background: false,
            layers: vec![LayerSpec {
                input: RectNorm {
                    x: 0.27,
                    y: 0.0,
                    w: 0.46,
                    h: 1.0,
                },
                output: RectNorm {
                    x: 0.0,
                    y: 0.0,
                    w: 1.0,
                    h: 0.68,
                },
                visible: true,
            }],
        };
        let (filter, _) = build_clip_filter(&args, 1920, 1080, false);
        assert!(
            filter.contains("scale=1080:1306:force_original_aspect_ratio=increase,crop=1080:1306,setsar=1"),
            "{filter}"
        );
    }
}
