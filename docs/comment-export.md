# Export comments to an NLE

FreeFrame exports a selected version's timecoded review comments as timeline
markers for DaVinci Resolve, Final Cut Pro, and Adobe Premiere Pro. CSV is also
available for spreadsheets, archives, image reviews, and audio reviews.

## Export a version

1. Open the asset and select the version that matches the edit in your timeline.
2. Open the comment panel menu and choose **Export comments**.
3. Choose the destination format.

| Destination | FreeFrame format |
| --- | --- |
| DaVinci Resolve | **DaVinci Resolve (EDL)** |
| Final Cut Pro | **Final Cut Pro (FCPXML)** |
| Adobe Premiere Pro | **Premiere Pro (XML)** |
| Spreadsheet or archive | **CSV** |

4. If prompted for a frame rate, enter the original frame rate of the reviewed
   source. Versions with stored FPS metadata normally skip this prompt.
5. Import the downloaded file into the corresponding NLE.

EDL, FCPXML, and Premiere XML are available only for video assets. Use CSV for
images or audio, or whenever you need all review metadata outside an NLE.

## Keep markers aligned

- Export comments from the same FreeFrame version as the cut in the timeline.
- Use the source frame rate, not a delivery frame rate. A mismatch accumulates
  timing drift over the duration of the edit.
- Resolve EDL exports default to a timeline start timecode of `01:00:00:00`.
  Keep the target timeline aligned with that value, or choose the matching start
  timecode in the export dialog when available.
- Variable-frame-rate material can differ by approximately one frame after it is
  interpreted by an NLE. Transcode to a constant frame rate before editorial
  handoff when frame-exact marker placement is required.

## Troubleshooting

### Frame rate is required

FreeFrame could not read an FPS value for that version. Enter one of the
supported source rates (for example `23.976`, `24`, `25`, `29.97`, `30`, `50`,
`59.94`, or `60`) and export again.

### Markers drift over time

Re-export with the original source frame rate and verify that the selected
FreeFrame version matches the clip in the target timeline.

### An NLE format is unavailable

NLE marker files are video-only. Choose CSV for audio or image assets.
