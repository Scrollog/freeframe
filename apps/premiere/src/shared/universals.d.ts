/**
 * @description Events dispatched from ExtendScript with dispatchTS() and
 * received in the panel with listenTS().
 */
export type EventTS = {
  /** Media Encoder finished a job queued by the panel. */
  encodeComplete: {
    jobID: string;
    outputPath: string;
  };
  encodeError: {
    jobID: string;
    message: string;
  };
  encodeProgress: {
    jobID: string;
    /** 0..1 */
    progress: number;
  };
};
