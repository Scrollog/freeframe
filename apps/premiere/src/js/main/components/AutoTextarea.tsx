/**
 * Textarea that grows with its content instead of showing a resize grip —
 * a fixed drag handle looks wrong in a panel this narrow.
 */
import { useEffect, useRef, type TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Tallest the field may grow before it starts scrolling, in pixels. */
  maxHeight?: number;
};

export const AutoTextarea = ({ maxHeight = 110, value, ...props }: Props) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Collapse first so shrinking works, then grow to fit the content.
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, maxHeight)}px`;
    node.style.overflowY = node.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, maxHeight]);

  return <textarea ref={ref} className="auto-textarea" value={value} rows={1} {...props} />;
};
