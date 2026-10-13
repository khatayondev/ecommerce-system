'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  Check, 
  RotateCw, 
  Image as ImageIcon, 
  Crop, 
  Sparkles,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

const ASPECT_RATIOS = [
  { label: '16:9 (Lead Story)', value: 16 / 9, key: '16:9' },
  { label: '16:10 (Grid Card)', value: 16 / 10, key: '16:10' },
  { label: '4:3 (Photo)', value: 4 / 3, key: '4:3' },
  { label: '1:1 (Square)', value: 1, key: '1:1' },
  { label: 'Freeform', value: null, key: 'free' }
];

export const HONEY_IMAGE_PRESETS = [
  {
    name: 'Cashew Blossom Honey',
    category: 'Varieties',
    url: 'https://images.unsplash.com/photo-1587049352851-8d4e89134a4c?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'Golden Liquid Honey Texture',
    category: 'Texture',
    url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'Raw Honeycomb & Dripper',
    category: 'Harvest',
    url: 'https://images.unsplash.com/photo-1471943311424-646960669fbc?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'Wild Apiculture & Beehive Inspection',
    category: 'Beekeeping',
    url: 'https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'Sustainable Outgrower Farming',
    category: 'Community',
    url: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'Honey Palace Product Bottling',
    category: 'Products',
    url: '/assets/product-bottle-05.jpg'
  },
  {
    name: 'Upper East Women in Apiculture',
    category: 'Community',
    url: 'https://ghanaiantimes.com.gh/wp-content/uploads/2025/09/Mr-Gideon-Awelana-Buluse-right-explaining-the-use-of-the-Beehives-to-dignitaries-after-the-launch-of-the-project.jpg'
  },
  {
    name: 'Dome Honey Processing Center Launch',
    category: 'Launch',
    url: 'https://ghanaiantimes.com.gh/wp-content/uploads/2022/08/Honey-pix-Mr-Buluse-telling-his-story-at-the-launch.jpg'
  }
];

export default function ImageCropperModal({
  isOpen,
  initialImageUrl = '',
  title = 'Crop & Frame Image',
  subtitle = 'Fine-tune your image link framing, aspect ratio, and zoom for optimal web rendering',
  onClose,
  onApplyCrop
}) {
  const [inputUrl, setInputUrl] = useState(initialImageUrl);
  const [imageSrc, setImageSrc] = useState(initialImageUrl);
  const [selectedRatio, setSelectedRatio] = useState('16:9');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [cropBox, setCropBox] = useState({ x: 10, y: 10, width: 80, height: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, box: { ...cropBox } });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('url'); // 'url' | 'presets'

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const src = initialImageUrl || '';
      setInputUrl(src);
      setImageSrc(src);
      setZoom(1);
      setRotation(0);
      setSelectedRatio('16:9');
      setImageLoaded(false);
      resetCropBox(16 / 9);
    }
  }, [isOpen, initialImageUrl]);

  const resetCropBox = useCallback((ratio) => {
    if (!ratio) {
      setCropBox({ x: 10, y: 10, width: 80, height: 80 });
      return;
    }

    let width = 80;
    let height = width / ratio;

    if (height > 80) {
      height = 80;
      width = height * ratio;
    }

    const x = (100 - width) / 2;
    const y = (100 - height) / 2;

    setCropBox({
      x: Math.max(0, Math.min(100 - width, x)),
      y: Math.max(0, Math.min(100 - height, y)),
      width,
      height
    });
  }, []);

  const handleRatioChange = (ratioObj) => {
    setSelectedRatio(ratioObj.key);
    resetCropBox(ratioObj.value);
  };

  const handleApplyUrl = (e) => {
    if (e) e.preventDefault();
    if (!inputUrl.trim()) return;
    setImageSrc(inputUrl.trim());
    setImageLoaded(false);
  };

  const handleSelectPreset = (presetUrl) => {
    setInputUrl(presetUrl);
    setImageSrc(presetUrl);
    setImageLoaded(false);
    setActiveTab('url');
  };

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    setImageDimensions({ width: naturalWidth, height: naturalHeight });
    setImageLoaded(true);
    const activeRatioObj = ASPECT_RATIOS.find(r => r.key === selectedRatio);
    resetCropBox(activeRatioObj?.value || (16 / 9));
  };

  // Drag handlers
  const handleMouseDown = (e, mode) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragMode(mode);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX, y: clientY, box: { ...cropBox } });
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = containerRef.current.getBoundingClientRect();

    const deltaXPercent = ((clientX - dragStart.x) / rect.width) * 100;
    const deltaYPercent = ((clientY - dragStart.y) / rect.height) * 100;

    const activeRatioObj = ASPECT_RATIOS.find(r => r.key === selectedRatio);
    const ratio = activeRatioObj ? activeRatioObj.value : null;

    if (dragMode === 'move') {
      const newX = Math.max(0, Math.min(100 - dragStart.box.width, dragStart.box.x + deltaXPercent));
      const newY = Math.max(0, Math.min(100 - dragStart.box.height, dragStart.box.y + deltaYPercent));
      setCropBox(prev => ({ ...prev, x: newX, y: newY }));
    } else if (dragMode === 'se') {
      let newW = Math.max(15, Math.min(100 - dragStart.box.x, dragStart.box.width + deltaXPercent));
      let newH = ratio ? newW / ratio : Math.max(15, Math.min(100 - dragStart.box.y, dragStart.box.height + deltaYPercent));

      if (dragStart.box.x + newW <= 100 && dragStart.box.y + newH <= 100) {
        setCropBox(prev => ({ ...prev, width: newW, height: newH }));
      }
    }
  }, [isDragging, dragMode, dragStart, selectedRatio]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragMode(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Apply Crop via HTML5 Canvas
  const handleConfirmCrop = async () => {
    if (!imageSrc) {
      onApplyCrop('');
      onClose();
      return;
    }

    setIsProcessing(true);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageSrc;

      const loadPromise = new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image failed to load with CORS'));
      });

      const loadedImg = await loadPromise.catch(() => null);

      if (!loadedImg) {
        onApplyCrop(imageSrc);
        setIsProcessing(false);
        onClose();
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const cropX = (cropBox.x / 100) * loadedImg.naturalWidth;
      const cropY = (cropBox.y / 100) * loadedImg.naturalHeight;
      const cropW = (cropBox.width / 100) * loadedImg.naturalWidth;
      const cropH = (cropBox.height / 100) * loadedImg.naturalHeight;

      canvas.width = Math.min(1200, Math.round(cropW));
      canvas.height = Math.round(canvas.width / (cropW / cropH));

      ctx.drawImage(
        loadedImg,
        cropX, cropY, cropW, cropH,
        0, 0, canvas.width, canvas.height
      );

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      onApplyCrop(croppedDataUrl);
    } catch (err) {
      console.warn('Canvas crop fallback to URL:', err);
      onApplyCrop(imageSrc);
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-sans">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">{title}</h2>
              <p className="text-xs text-gray-500">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200 bg-gray-50/50 px-6 pt-3 gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`pb-2.5 border-b-2 transition ${
              activeTab === 'url'
                ? 'border-amber-500 text-amber-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            🔗 Image Link & Crop
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`pb-2.5 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'presets'
                ? 'border-amber-500 text-amber-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Honey Palace Photo Presets</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTab === 'url' ? (
            <>
              {/* Image URL Input Form */}
              <form onSubmit={handleApplyUrl} className="flex gap-2">
                <input
                  type="url"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="Paste Cloudinary, Unsplash, or direct image URL (https://...)"
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 rounded-xl text-xs font-semibold transition"
                >
                  Load Image
                </button>
              </form>

              {/* Aspect Ratio Selector Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-600 mr-1">Aspect Ratio:</span>
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.key}
                    type="button"
                    onClick={() => handleRatioChange(ratio)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      selectedRatio === ratio.key
                        ? 'bg-amber-500 text-black font-bold shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    {ratio.label}
                  </button>
                ))}
              </div>

              {/* Interactive Cropper Canvas */}
              <div
                ref={containerRef}
                className="relative w-full h-80 bg-gray-950 border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center select-none"
              >
                {imageSrc ? (
                  <>
                    <img
                      ref={imgRef}
                      src={imageSrc}
                      alt="Crop target"
                      onLoad={handleImageLoad}
                      style={{
                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                        transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                      }}
                      className="max-h-full max-w-full object-contain pointer-events-none"
                    />

                    {/* Dark Overlay Outside Crop Area */}
                    <div className="absolute inset-0 bg-black/60 pointer-events-none" />

                    {/* Draggable Crop Box */}
                    <div
                      onMouseDown={(e) => handleMouseDown(e, 'move')}
                      onTouchStart={(e) => handleMouseDown(e, 'move')}
                      style={{
                        left: `${cropBox.x}%`,
                        top: `${cropBox.y}%`,
                        width: `${cropBox.width}%`,
                        height: `${cropBox.height}%`
                      }}
                      className="absolute border-2 border-amber-400 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] cursor-move transition-shadow"
                    >
                      {/* Grid Lines */}
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                        <div className="border-r border-b border-white/20" />
                        <div className="border-r border-b border-white/20" />
                        <div className="border-b border-white/20" />
                        <div className="border-r border-b border-white/20" />
                        <div className="border-r border-b border-white/20" />
                        <div className="border-b border-white/20" />
                        <div className="border-r border-b border-white/20" />
                        <div className="border-r border-b border-white/20" />
                        <div />
                      </div>

                      {/* Resize Handle (SE corner) */}
                      <div
                        onMouseDown={(e) => handleMouseDown(e, 'se')}
                        onTouchStart={(e) => handleMouseDown(e, 'se')}
                        className="absolute bottom-0 right-0 w-5 h-5 bg-amber-400 cursor-se-resize flex items-center justify-center"
                      >
                        <div className="w-1.5 h-1.5 bg-black rounded-full" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6 text-gray-400 space-y-2">
                    <ImageIcon className="w-10 h-10 mx-auto opacity-40 text-amber-500" />
                    <p className="text-xs">No image loaded yet. Paste a link above or pick a preset photo.</p>
                  </div>
                )}
              </div>

              {/* Zoom & Rotation Controls */}
              {imageSrc && (
                <div className="flex items-center justify-between gap-4 pt-1">
                  <div className="flex items-center gap-2 flex-1 max-w-xs">
                    <ZoomOut className="w-3.5 h-3.5 text-gray-500" />
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.1"
                      value={zoom}
                      onChange={(e) => setZoom(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <ZoomIn className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs text-gray-500 font-mono w-8">{zoom.toFixed(1)}x</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-gray-200"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Rotate 90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => resetCropBox(ASPECT_RATIOS.find(r => r.key === selectedRatio)?.value || (16/9))}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition border border-gray-200"
                    >
                      Reset Frame
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Presets Grid */
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Select from verified high-resolution Honey Palace brand photography and partner coverage:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {HONEY_IMAGE_PRESETS.map((preset, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectPreset(preset.url)}
                    className="group relative aspect-4/3 rounded-xl overflow-hidden border border-gray-200 hover:border-amber-500 cursor-pointer bg-gray-50 transition shadow-sm"
                  >
                    <img
                      src={preset.url}
                      alt={preset.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2.5">
                      <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                        {preset.category}
                      </span>
                      <span className="text-xs font-semibold text-white truncate">
                        {preset.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl border border-gray-200 transition"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onApplyCrop(inputUrl);
                onClose();
              }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl border border-gray-200 transition"
              title="Use the exact link as-is without cropping"
            >
              Use Link Direct
            </button>
            <button
              type="button"
              disabled={isProcessing || !imageSrc}
              onClick={handleConfirmCrop}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>{isProcessing ? 'Processing...' : 'Apply Cropped Frame'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
