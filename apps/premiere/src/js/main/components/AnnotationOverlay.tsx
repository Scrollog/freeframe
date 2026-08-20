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
import { useEffect, useRef, useState } from "react";

export const AnnotationOverlay = ({
  drawing,
}: {
  drawing: Record<string, unknown> | null;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [boxSize, setBoxSize] = useState("");

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
    <div className="annotation-overlay" ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  );
};
