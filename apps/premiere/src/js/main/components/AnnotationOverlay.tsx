/**
 * Read-only replay of a saved Fabric.js annotation on top of the video, ported
 * from the web viewer's `annotation-overlay.tsx`.
 *
 * The drawing is authored against the canvas size it was made on
 * (`_canvasWidth`/`_canvasHeight`), so every object is rescaled to whatever
 * size the panel's player happens to be. The web app's legacy image-frame
 * correction is not needed here: this only ever draws over video, where the
 * stored coordinates are already in media space.
 */
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

export const AnnotationOverlay = ({
  drawing,
  videoRef,
}: {
  drawing: Record<string, unknown> | null;
  videoRef: RefObject<HTMLVideoElement | null>;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [boxSize, setBoxSize] = useState("");
  const [frame, setFrame] = useState<CSSProperties>({ inset: 0 });

  // `object-fit: contain` leaves bars around portrait, square, and other
  // non-16:9 clips. Annotations are authored against the visible video frame,
  // not against those bars, so mirror the web player's frame constraint here.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const measure = () => {
      const width = video.offsetWidth;
      const height = video.offsetHeight;
      if (!width || !height || !video.videoWidth || !video.videoHeight) {
        setFrame({ inset: 0 });
        return;
      }

      const videoIsWider = video.videoWidth * height > video.videoHeight * width;
      const frameWidth = videoIsWider ? width : (height * video.videoWidth) / video.videoHeight;
      const frameHeight = videoIsWider ? (width * video.videoHeight) / video.videoWidth : height;
      setFrame({
        left: video.offsetLeft + (width - frameWidth) / 2,
        top: video.offsetTop + (height - frameHeight) / 2,
        width: frameWidth,
        height: frameHeight,
      });
    };

    measure();
    video.addEventListener("loadedmetadata", measure);
    video.addEventListener("resize", measure);
    if (typeof ResizeObserver === "undefined") {
      return () => {
        video.removeEventListener("loadedmetadata", measure);
        video.removeEventListener("resize", measure);
      };
    }
    const observer = new ResizeObserver(measure);
    observer.observe(video);
    if (video.parentElement) observer.observe(video.parentElement);
    return () => {
      video.removeEventListener("loadedmetadata", measure);
      video.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [videoRef]);

  // The player's box isn't final on mount, so redraw whenever it settles.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      setBoxSize(`${node.offsetWidth}x${node.offsetHeight}`)
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [drawing]);

  useEffect(() => {
    if (!drawing || !canvasRef.current || !containerRef.current) return;

    let disposed = false;
    let canvas: { dispose: () => void } | null = null;

    // Defer a frame so the layout sizes are readable.
    const frame = requestAnimationFrame(async () => {
      if (disposed || !canvasRef.current || !containerRef.current) return;
      const { Canvas } = await import("fabric");
      if (disposed || !canvasRef.current || !containerRef.current) return;

      const width = containerRef.current.offsetWidth;
      const height = containerRef.current.offsetHeight;
      if (!width || !height) return;

      const fabricCanvas = new Canvas(canvasRef.current, {
        selection: false,
        renderOnAddRemove: false,
        skipTargetFind: true,
        interactive: false,
      });
      canvas = fabricCanvas;
      fabricCanvas.setDimensions({ width, height });

      try {
        const authoredWidth = (drawing._canvasWidth as number) || width;
        const authoredHeight = (drawing._canvasHeight as number) || height;
        const scaleX = width / authoredWidth;
        const scaleY = height / authoredHeight;

        await fabricCanvas.loadFromJSON(drawing);
        if (scaleX !== 1 || scaleY !== 1) {
          fabricCanvas.getObjects().forEach((object) => {
            object.set({
              left: (object.left ?? 0) * scaleX,
              top: (object.top ?? 0) * scaleY,
              scaleX: (object.scaleX ?? 1) * scaleX,
              scaleY: (object.scaleY ?? 1) * scaleY,
            });
            object.setCoords();
          });
        }
        fabricCanvas.renderAll();
      } catch (e) {
        // Stored drawing data can be from an older format; skip it silently.
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      try {
        canvas?.dispose();
      } catch (e) {
        // Disposing an already-torn-down canvas is not worth reporting.
      }
    };
  }, [drawing, boxSize]);

  if (!drawing) return null;

  return (
    <div className="annotation-overlay" ref={containerRef} style={frame}>
      <canvas ref={canvasRef} />
    </div>
  );
};
