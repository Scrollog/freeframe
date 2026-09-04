import { Dropdown, MenuRadio } from "../Dropdown";
import {
  IconChevronUp,
  IconLoop,
  IconPause,
  IconPlay,
  IconSkipBack,
  IconSkipForward,
  IconVolume,
  IconVolumeOff,
} from "../Icons";
import {
  PLAYBACK_SPEEDS,
  TIME_MODES,
  type QualityLevel,
  type TimeMode,
} from "./player-types";

interface PlayerControlsProps {
  playing: boolean;
  loop: boolean;
  muted: boolean;
  volume: number;
  speed: number;
  quality: number | null;
  qualityLevels: QualityLevel[];
  timeMode: TimeMode;
  time: number;
  duration: number;
  onStepFrame: (direction: 1 | -1) => void;
  onTogglePlay: () => void;
  onLoopChange: (value: boolean) => void;
  onMuteToggle: () => void;
  onVolumeChange: (value: number) => void;
  onSpeedChange: (value: number) => void;
  onQualityChange: (value: number | null) => void;
  onTimeModeChange: (value: TimeMode) => void;
  formatTime: (seconds: number) => string;
  qualityLabel: (level: QualityLevel) => string;
}

/** Presentation-only transport controls for the review player. */
export const PlayerControls = ({
  playing,
  loop,
  muted,
  volume,
  speed,
  quality,
  qualityLevels,
  timeMode,
  time,
  duration,
  onStepFrame,
  onTogglePlay,
  onLoopChange,
  onMuteToggle,
  onVolumeChange,
  onSpeedChange,
  onQualityChange,
  onTimeModeChange,
  formatTime,
  qualityLabel,
}: PlayerControlsProps) => (
  <div className="player-bar">
    <button className="icon-btn" onClick={() => onStepFrame(-1)} title="Previous frame">
      <IconSkipBack width={14} height={14} />
    </button>
    <button className="icon-btn play" onClick={onTogglePlay} title={playing ? "Pause" : "Play"}>
      {playing ? <IconPause /> : <IconPlay />}
    </button>
    <button className="icon-btn" onClick={() => onStepFrame(1)} title="Next frame">
      <IconSkipForward width={14} height={14} />
    </button>

    <span className="bar-gap" />

    <Dropdown triggerClass="text-btn speed" title="Playback speed" trigger={<>{speed}x</>}>
      {(close) =>
        PLAYBACK_SPEEDS.map((rate) => (
          <MenuRadio
            key={rate}
            label={`${rate}x`}
            checked={speed === rate}
            onSelect={() => {
              onSpeedChange(rate);
              close();
            }}
          />
        ))
      }
    </Dropdown>
    {qualityLevels.length > 1 && (
      <Dropdown
        triggerClass="text-btn quality"
        title="Video quality"
        trigger={<>{quality === null ? "Auto" : qualityLabel(qualityLevels[quality])}</>}
      >
        {(close) => (
          <>
            <MenuRadio
              label="Auto"
              checked={quality === null}
              onSelect={() => {
                onQualityChange(null);
                close();
              }}
            />
            {qualityLevels.map((level) => (
              <MenuRadio
                key={level.index}
                label={qualityLabel(level)}
                checked={quality === level.index}
                onSelect={() => {
                  onQualityChange(level.index);
                  close();
                }}
              />
            ))}
          </>
        )}
      </Dropdown>
    )}
    <button
      className={`icon-btn${loop ? " accented" : ""}`}
      onClick={() => onLoopChange(!loop)}
      title={loop ? "Loop on" : "Loop off"}
    >
      <IconLoop width={15} height={15} />
    </button>
    <span className="volume">
      <button className="icon-btn" onClick={onMuteToggle} title={muted ? "Unmute" : "Mute"}>
        {muted || volume === 0 ? <IconVolumeOff /> : <IconVolume />}
      </button>
      <input
        className="volume-slider"
        type="range"
        min={0}
        max={1}
        step={0.02}
        value={muted ? 0 : volume}
        title="Volume"
        onChange={(event) => onVolumeChange(Number(event.target.value))}
      />
    </span>

    <span className="bar-gap" />

    <Dropdown
      up
      triggerClass="tc-box"
      title="Time display"
      trigger={
        <>
          {formatTime(time)}
          <IconChevronUp width={11} height={11} />
        </>
      }
    >
      {(close) => (
        <>
          {TIME_MODES.map((mode) => (
            <MenuRadio
              key={mode.key}
              label={mode.label}
              checked={timeMode === mode.key}
              onSelect={() => {
                onTimeModeChange(mode.key);
                close();
              }}
            />
          ))}
          <div className="menu-sep">Duration</div>
          <div className="menu-field">{formatTime(duration)}</div>
        </>
      )}
    </Dropdown>
  </div>
);
