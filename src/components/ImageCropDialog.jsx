/**
 * ImageCropDialog — a crop step shown after a photo is selected or taken for an item image,
 * before upload. The image is shown fitted; a crop box can be moved and resized by its corners.
 * Defaults to a square (to match the grid thumbnails) and can switch to free-form.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import styles from './ImageCropDialog.module.css';

const MIN_SIDE = 40;
const CORNERS = ['nw', 'ne', 'sw', 'se'];

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

const cornerPoint = (r, corner) => ({
  x: corner === 'ne' || corner === 'se' ? r.x + r.w : r.x,
  y: corner === 'sw' || corner === 'se' ? r.y + r.h : r.y,
});

const oppositePoint = (r, corner) => cornerPoint(r, { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' }[corner]);

/** Moves the whole crop box, clamped inside the image. */
const moveRect = (start, dx, dy, bounds) => ({
  x: clamp(start.x + dx, 0, bounds.w - start.w),
  y: clamp(start.y + dy, 0, bounds.h - start.h),
  w: start.w,
  h: start.h,
});

/** Free-form resize: the dragged corner follows the pointer, the opposite corner stays put. */
const freeResize = (start, corner, dx, dy, bounds) => {
  let minX = start.x;
  let minY = start.y;
  let maxX = start.x + start.w;
  let maxY = start.y + start.h;
  if (corner === 'nw') { minX += dx; minY += dy; }
  if (corner === 'ne') { maxX += dx; minY += dy; }
  if (corner === 'sw') { minX += dx; maxY += dy; }
  if (corner === 'se') { maxX += dx; maxY += dy; }
  minX = clamp(minX, 0, maxX - MIN_SIDE);
  maxX = clamp(maxX, minX + MIN_SIDE, bounds.w);
  minY = clamp(minY, 0, maxY - MIN_SIDE);
  maxY = clamp(maxY, minY + MIN_SIDE, bounds.h);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

/** Square resize: anchored at the opposite corner, the side follows the pointer, clamped to fit. */
const squareResize = (start, corner, dx, dy, bounds) => {
  const anchor = oppositePoint(start, corner);
  const moved = cornerPoint(start, corner);
  let side = Math.max(Math.abs(moved.x + dx - anchor.x), Math.abs(moved.y + dy - anchor.y), MIN_SIDE);
  const limits = {
    nw: [anchor.x, anchor.y],
    ne: [bounds.w - anchor.x, anchor.y],
    sw: [anchor.x, bounds.h - anchor.y],
    se: [bounds.w - anchor.x, bounds.h - anchor.y],
  }[corner];
  side = Math.max(Math.min(side, limits[0], limits[1]), MIN_SIDE);
  const x = corner === 'nw' || corner === 'sw' ? anchor.x - side : anchor.x;
  const y = corner === 'nw' || corner === 'ne' ? anchor.y - side : anchor.y;
  return { x, y, w: side, h: side };
};

/**
 * @param {Object} props
 * @param {File} props.file - The image file to crop
 * @param {Function} props.onCrop - Called with a cropped Blob (or null if cropping failed)
 * @param {Function} props.onCancel - Called to dismiss without cropping
 */
export const ImageCropDialog = ({ file, onCrop, onCancel }) => {
  const [src] = useState(() => URL.createObjectURL(file));
  const [natural, setNatural] = useState(null);
  const [display, setDisplay] = useState(null);
  const [crop, setCrop] = useState(null);
  const [mode, setMode] = useState('square');
  const [busy, setBusy] = useState(false);
  const imgRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Absolute (start + delta) updates during a drag, so there's no drift.
  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d || !display) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (d.type === 'move') {
        setCrop(moveRect(d.startRect, dx, dy, display));
      } else {
        setCrop((mode === 'square' ? squareResize : freeResize)(d.startRect, d.corner, dx, dy, display));
      }
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [display, mode]);

  const handleImgLoad = (e) => {
    const natW = e.target.naturalWidth;
    const natH = e.target.naturalHeight;
    if (!natW || !natH) return;
    const boxW = Math.min(360, window.innerWidth - 64);
    const boxH = Math.min(window.innerHeight * 0.6, 460);
    const scale = Math.min(boxW / natW, boxH / natH);
    const dW = Math.round(natW * scale);
    const dH = Math.round(natH * scale);
    const side = Math.min(dW, dH);
    setNatural({ w: natW, h: natH });
    setDisplay({ w: dW, h: dH });
    setCrop({ x: Math.round((dW - side) / 2), y: Math.round((dH - side) / 2), w: side, h: side });
  };

  const beginMove = (e) => {
    e.preventDefault();
    dragRef.current = { type: 'move', startRect: crop, startX: e.clientX, startY: e.clientY };
  };

  const beginResize = (corner) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { type: 'resize', corner, startRect: crop, startX: e.clientX, startY: e.clientY };
  };

  const selectSquare = useCallback(() => {
    setMode('square');
    setCrop((c) => {
      if (!c || !display) return c;
      const side = Math.max(Math.min(c.w, c.h), MIN_SIDE);
      return {
        x: clamp(c.x + c.w / 2 - side / 2, 0, display.w - side),
        y: clamp(c.y + c.h / 2 - side / 2, 0, display.h - side),
        w: side,
        h: side,
      };
    });
  }, [display]);

  const handleUse = () => {
    if (!crop || !natural || !display || !imgRef.current) return;
    setBusy(true);
    const sx = (crop.x * natural.w) / display.w;
    const sy = (crop.y * natural.h) / display.h;
    const sw = (crop.w * natural.w) / display.w;
    const sh = (crop.h * natural.h) / display.h;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw));
    canvas.height = Math.max(1, Math.round(sh));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => { setBusy(false); onCrop(blob); }, 'image/jpeg', 0.9);
  };

  return createPortal(
    <div className={styles.backdrop}>
      <div className={styles.dialog}>
        <div className={styles.toolbar}>
          <button type="button" className={styles.textBtn} onClick={onCancel}>Cancel</button>
          <div className={styles.modeToggle} role="group" aria-label="Crop shape">
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === 'square' ? styles.modeBtnActive : ''}`}
              onClick={selectSquare}
            >
              Square
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === 'free' ? styles.modeBtnActive : ''}`}
              onClick={() => setMode('free')}
            >
              Free-form
            </button>
          </div>
          <button type="button" className={styles.primaryBtn} onClick={handleUse} disabled={busy || !crop}>
            {busy ? 'Saving…' : 'Use photo'}
          </button>
        </div>

        <div className={styles.stageWrap}>
          <div
            className={styles.stage}
            style={display ? { width: display.w, height: display.h } : { position: 'absolute', visibility: 'hidden' }}
          >
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={handleImgLoad}
              className={styles.img}
              style={display ? { width: display.w, height: display.h } : undefined}
            />
            {crop && display && (
              <div
                className={styles.cropBox}
                style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
                onPointerDown={beginMove}
              >
                {CORNERS.map((c) => (
                  <span
                    key={c}
                    className={`${styles.handle} ${styles[`handle_${c}`]}`}
                    onPointerDown={beginResize(c)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <p className={styles.hint}>
          {mode === 'square' ? 'Drag to reposition · pull a corner to resize' : 'Drag any corner to set a free shape'}
        </p>
      </div>
    </div>,
    document.body,
  );
};

ImageCropDialog.propTypes = {
  file: PropTypes.instanceOf(File).isRequired,
  onCrop: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
