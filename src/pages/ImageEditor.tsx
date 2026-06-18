import { useEffect, useRef, useState } from "react";
import {
  Canvas,
  FabricImage,
  IText,
  FabricObject,
  filters,
  Rect,
  Circle,
  Triangle,
  PencilBrush,
} from "fabric";
import {
  Upload,
  Type,
  RotateCw,
  Download,
  Trash2,
  Image as ImageIcon,
  MousePointer2,
  Sparkles,
  Palette,
  Sliders,
  Wand2,
  Sun,
  Contrast,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Brush,
  Square,
  Circle as CircleIcon,
  Triangle as TriangleIcon,
  Layers,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Check,
  Paintbrush,
  FolderOpen,
  Move,
  Settings2,
  FlipHorizontal,
  FlipVertical,
} from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/src/lib/utils";
import { removeBackground } from "@imgly/background-removal";

interface CanvasObjectLayer {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
  ref: FabricObject;
}

const PRESET_DIMENSIONS = [
  { name: "Instagram Square (1:1)", w: 800, h: 800 },
  { name: "Full HD (16:9)", w: 1200, h: 675 },
  { name: "Pinterest/TikTok (9:16)", w: 600, h: 1067 },
  { name: "Website Banner (21:9)", w: 1200, h: 514 },
  { name: "Standard Landscape (4:3)", w: 800, h: 600 },
];

const FONTS_LIST = [
  "Inter",
  "system-ui",
  "Georgia",
  "Impact",
  "Courier New",
  "Comic Sans MS",
];

const CREATIVE_FILTERS = [
  { id: "none", name: "Original / Preset" },
  { id: "grayscale", name: "Monochrome Noir" },
  { id: "sepia", name: "Warm Vintage Sepia" },
  { id: "invert", name: "Digital Invert X-Ray" },
  { id: "vintage", name: "Analog Polaroid Film" },
  { id: "kodachrome", name: "Chroma Kodachrome" },
  { id: "technicolor", name: "Technicolor Cinema Glow" },
  { id: "brownie", name: "Rich Chocolate Brownie" },
  { id: "polaroid", name: "Lofi Polaroid Nostalgia" },
  { id: "pixel-glitch", name: "Cyber Glitch Pixelate" },
  { id: "acid", name: "Trippy Acid Hue Spill" },
  { id: "dramatic", name: "Dramatic High-Key Contrast" },
  { id: "cool", name: "Ocean Breeze Frost" },
];

export default function ImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const fabricCanvas = useRef<Canvas | null>(null);

  // Custom workspace dragging refs to keep fabric canvas instance clean of type expansion
  const isDraggingRef = useRef(false);
  const lastPosXRef = useRef(0);
  const lastPosYRef = useRef(0);

  // App UI State
  const [hasImage, setHasImage] = useState(false);
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "adjust" | "shapes" | "text" | "layers" | "canvas"
  >("adjust");

  // Zoom & Pan Workspace Space
  const [zoom, setZoom] = useState(100);

  // Active Workspace Tool: "select" | "draw" | "pan"
  const [currentTool, setCurrentTool] = useState<"select" | "draw" | "pan">(
    "select",
  );
  const isBrushMode = currentTool === "draw";
  const isPanMode = currentTool === "pan";

  // Brush Freehand Draw settings
  const [brushColor, setBrushColor] = useState("#6366f1");
  const [brushWidth, setBrushWidth] = useState(6);

  // Canvas Custom Background option
  const [canvasBgStyle, setCanvasBgStyle] = useState<"transparent" | "solid">(
    "transparent",
  );
  const [canvasBgColor, setCanvasBgColor] = useState("#ffffff");

  // Color correction properties
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [blur, setBlur] = useState(0);
  const [pixelate, setPixelate] = useState(1);
  const [hue, setHue] = useState(0);
  const [noise, setNoise] = useState(0);
  const [selectedFilterId, setSelectedFilterId] = useState("none");

  // Text styler state - preconfigured to be vibrant and highly contrast out of the box
  const [textColor, setTextColor] = useState("#ffffff");
  const [textFont, setTextFont] = useState("Inter");
  const [textSize, setTextSize] = useState(36);
  const [textBold, setTextBold] = useState(true);
  const [textItalic, setTextItalic] = useState(false);
  const [textOutlineColor, setTextOutlineColor] = useState("#4f46e5");
  const [textOutlineWidth, setTextOutlineWidth] = useState(2); // Set proper default outer stroke!

  // Shape styler state
  const [shapeFillColor, setShapeFillColor] = useState("#e0e7ff");
  const [shapeStrokeColor, setShapeStrokeColor] = useState("#6366f1");
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(3);

  // History stack for Undo/Redo
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isTransitioningState = useRef(false);

  // Layers array for hierarchy explorer
  const [layers, setLayers] = useState<CanvasObjectLayer[]>([]);

  // Keep event listeners and logic latest states referencing correctly to prevent stale closure scope leaks
  const saveHistoryStateRef = useRef<() => void>(() => {});
  const updateLayersListRef = useRef<() => void>(() => {});
  const handleSelectionChangedRef = useRef<(obj: FabricObject | null) => void>(
    () => {},
  );
  const isPanModeRef = useRef(false);
  const isBrushModeRef = useRef(false);

  useEffect(() => {
    saveHistoryStateRef.current = saveHistoryState;
  });
  useEffect(() => {
    updateLayersListRef.current = updateLayersList;
  });
  useEffect(() => {
    handleSelectionChangedRef.current = handleSelectionChanged;
  });
  useEffect(() => {
    isPanModeRef.current = isPanMode;
  }, [isPanMode]);
  useEffect(() => {
    isBrushModeRef.current = isBrushMode;
  }, [isBrushMode]);

  // Initialize Canvas exactly once upon startup
  useEffect(() => {
    if (canvasRef.current && !fabricCanvas.current && workspaceRef.current) {
      const workspace = workspaceRef.current;

      const computeDimensions = () => {
        const availableW = workspace.clientWidth || 800;
        const availableH = Math.max(workspace.clientHeight || 500, 500);
        return { w: availableW - 32, h: availableH - 32 };
      };

      const { w, h } = computeDimensions();

      fabricCanvas.current = new Canvas(canvasRef.current, {
        width: w,
        height: h,
        backgroundColor: "transparent",
        preserveObjectStacking: true,
      });

      const canvas = fabricCanvas.current;
      canvas.freeDrawingBrush = new PencilBrush(canvas);

      // Add state change listeners for layers panel and undo/redo registration
      const triggerUpdate = () => {
        if (!isTransitioningState.current) {
          saveHistoryStateRef.current();
        }
        updateLayersListRef.current();
      };

      canvas.on("selection:created", (e) =>
        handleSelectionChangedRef.current(e.selected?.[0] || null),
      );
      canvas.on("selection:updated", (e) =>
        handleSelectionChangedRef.current(e.selected?.[0] || null),
      );
      canvas.on("selection:cleared", () =>
        handleSelectionChangedRef.current(null),
      );
      canvas.on("object:added", (e) => {
        const obj = e.target;
        if (obj) {
          if (isBrushModeRef.current || isPanModeRef.current) {
            obj.selectable = false;
            obj.evented = false;
          }
        }
        triggerUpdate();
      });
      canvas.on("object:removed", triggerUpdate);
      canvas.on("object:modified", triggerUpdate);

      // Handle Pan & Drag with clean desktop/mobile coords support
      canvas.on("mouse:down", (opt) => {
        const evt = opt.e;
        if (isPanModeRef.current && canvas) {
          isDraggingRef.current = true;
          canvas.selection = false;
          lastPosXRef.current =
            "clientX" in evt
              ? evt.clientX
              : (evt as any).touches?.[0]?.clientX || 0;
          lastPosYRef.current =
            "clientY" in evt
              ? evt.clientY
              : (evt as any).touches?.[0]?.clientY || 0;
        }
      });

      canvas.on("mouse:move", (opt) => {
        if (isDraggingRef.current && canvas.viewportTransform) {
          const evt = opt.e;
          const clientX =
            "clientX" in evt
              ? evt.clientX
              : (evt as any).touches?.[0]?.clientX || 0;
          const clientY =
            "clientY" in evt
              ? evt.clientY
              : (evt as any).touches?.[0]?.clientY || 0;

          const vpt = [...canvas.viewportTransform];
          vpt[4] += clientX - lastPosXRef.current;
          vpt[5] += clientY - lastPosYRef.current;

          // Strict TMat2D assignment checks safety
          canvas.setViewportTransform(
            vpt as [number, number, number, number, number, number],
          );
          canvas.requestRenderAll();

          lastPosXRef.current = clientX;
          lastPosYRef.current = clientY;
        }
      });

      canvas.on("mouse:up", () => {
        if (canvas) {
          isDraggingRef.current = false;
          canvas.selection = !isPanModeRef.current;
          canvas.requestRenderAll();
        }
      });

      // Save initial blank state
      const initialJson = JSON.stringify(canvas.toJSON());
      setHistoryStack([initialJson]);
      setHistoryIndex(0);

      const handleResize = () => {
        if (!fabricCanvas.current) return;
        const { w: newWidth, h: newHeight } = computeDimensions();
        // Maintain layout constraints
        if (fabricCanvas.current.getObjects().length === 0) {
          fabricCanvas.current.setDimensions({
            width: newWidth,
            height: newHeight,
          });
          fabricCanvas.current.renderAll();
        }
      };

      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        fabricCanvas.current?.dispose();
        fabricCanvas.current = null;
      };
    }
  }, []);

  // Sync brush parameters and canvas selectability dynamically across tools
  useEffect(() => {
    if (fabricCanvas.current) {
      const canvas = fabricCanvas.current;
      canvas.isDrawingMode = isBrushMode;

      if (isBrushMode && !canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush = new PencilBrush(canvas);
      }

      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = brushColor;
        canvas.freeDrawingBrush.width = brushWidth;
      }

      if (isPanMode) {
        canvas.discardActiveObject();
        canvas.selection = false;
        canvas.forEachObject((obj) => {
          obj.selectable = false;
          obj.evented = false;
        });
      } else if (isBrushMode) {
        canvas.discardActiveObject();
        canvas.selection = false;
        canvas.forEachObject((obj) => {
          obj.selectable = false;
          obj.evented = false;
        });
      } else {
        canvas.selection = true;
        canvas.forEachObject((obj) => {
          const isLocked = (obj as any).lockMovementX === true;
          obj.selectable = !isLocked;
          obj.evented = true;
        });
      }
      canvas.requestRenderAll();
    }
  }, [currentTool, brushColor, brushWidth]);

  // Save history state to stack
  const saveHistoryState = () => {
    if (!fabricCanvas.current) return;
    try {
      const json = JSON.stringify(fabricCanvas.current.toJSON());
      // Skip if exactly same as current state
      if (historyStack[historyIndex] === json) return;

      const updatedStack = historyStack.slice(0, historyIndex + 1);
      setHistoryStack([...updatedStack, json]);
      setHistoryIndex(updatedStack.length);
    } catch (e) {
      console.error("Failed to commit history frame", e);
    }
  };

  const handleSelectionChanged = (obj: FabricObject | null) => {
    setSelectedObject(obj);
    if (!obj) return;

    // Sync Text style settings to inspector sliders/inputs
    if (obj instanceof IText) {
      setTextColor((obj.fill as string) || "#1a1a1a");
      setTextFont(obj.fontFamily || "Inter");
      setTextSize(obj.fontSize || 32);
      setTextBold(obj.fontWeight === "bold");
      setTextItalic(obj.fontStyle === "italic");
      setTextOutlineColor((obj.stroke as string) || "#ffffff");
      setTextOutlineWidth(obj.strokeWidth || 0);
    }

    // Sync Shape settings
    if (
      obj instanceof Rect ||
      obj instanceof Circle ||
      obj instanceof Triangle
    ) {
      setShapeFillColor((obj.fill as string) || "#e0e7ff");
      setShapeStrokeColor((obj.stroke as string) || "#6366f1");
      setShapeStrokeWidth(obj.strokeWidth || 2);
    }

    // Sync filters onto state variables
    if (obj instanceof FabricImage) {
      const activeFilters = obj.filters || [];
      let bVal = 0,
        cVal = 0,
        sVal = 0,
        blVal = 0,
        pVal = 1;

      activeFilters.forEach((f) => {
        if (f instanceof filters.Brightness)
          bVal = Math.round(f.brightness * 100);
        if (f instanceof filters.Contrast) cVal = Math.round(f.contrast * 100);
        if (f instanceof filters.Saturation)
          sVal = Math.round(f.saturation * 100);
        if (f instanceof filters.Blur) blVal = Math.round(f.blur * 100);
        if (f instanceof filters.Pixelate) pVal = f.blocksize || 1;
      });

      setBrightness(bVal);
      setContrast(cVal);
      setSaturation(sVal);
      setBlur(blVal);
      setPixelate(pVal);
    }
  };

  const updateLayersList = () => {
    if (!fabricCanvas.current) return;
    const objects = fabricCanvas.current.getObjects();
    const loadedLayers = objects.map((obj, i) => {
      const anyObj = obj as any;
      if (!anyObj.id) {
        anyObj.id = `layer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      }
      if (!anyObj.name) {
        if (obj instanceof FabricImage) {
          anyObj.name = `Image Layer ${i + 1}`;
        } else if (obj instanceof IText) {
          const textVal = obj.text || "Text";
          const trunc =
            textVal.length > 12 ? `${textVal.substring(0, 10)}...` : textVal;
          anyObj.name = `Text: "${trunc}"`;
        } else {
          anyObj.name = `${obj.type.charAt(0).toUpperCase() + obj.type.slice(1)} Shape`;
        }
      }
      return {
        id: anyObj.id,
        name: anyObj.name,
        type: obj.type,
        visible: obj.visible !== false,
        locked: obj.lockMovementX === true,
        ref: obj,
      };
    });
    setLayers([...loadedLayers].reverse()); // Top object first
  };

  // Upload Photo logic
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvas.current) return;

    const reader = new FileReader();
    reader.onload = async (f) => {
      const data = f.target?.result as string;
      await loadImageToCanvas(data, file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // clear
  };

  const loadImageToCanvas = async (data: string, name?: string) => {
    if (!fabricCanvas.current) return;
    try {
      const img = await FabricImage.fromURL(data);
      const canvas = fabricCanvas.current;
      canvas.clear();

      const pad = 30;
      const scaleX = (canvas.width - pad) / img.width;
      const scaleY = (canvas.height - pad) / img.height;
      const scale = Math.min(scaleX, scaleY, 1);

      img.scale(scale);
      const anyImg = img as any;
      anyImg.name = name || "Imported Image";
      anyImg.id = `image_${Date.now()}`;
      canvas.centerObject(img);
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      setHasImage(true);
      resetCreativeState();
      updateLayersList();
      saveHistoryState();
    } catch (e) {
      console.error(e);
      toast.error("Failed to load image");
    }
  };

  const resetCreativeState = () => {
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setBlur(0);
    setPixelate(1);
    setHue(0);
    setNoise(0);
    setSelectedFilterId("none");
  };

  // Undo / Redo mechanics
  const handleUndo = async () => {
    if (!fabricCanvas.current || historyIndex <= 0) return;
    const targetIdx = historyIndex - 1;
    isTransitioningState.current = true;
    try {
      await fabricCanvas.current.loadFromJSON(
        JSON.parse(historyStack[targetIdx]),
      );
      fabricCanvas.current.renderAll();
      setHistoryIndex(targetIdx);
      updateLayersList();
      setSelectedObject(fabricCanvas.current.getActiveObject() || null);
      toast.success("Undone modification");
    } catch (err) {
      console.error(err);
      toast.error("Undo sequence mismatched");
    } finally {
      isTransitioningState.current = false;
    }
  };

  const handleRedo = async () => {
    if (!fabricCanvas.current || historyIndex >= historyStack.length - 1)
      return;
    const targetIdx = historyIndex + 1;
    isTransitioningState.current = true;
    try {
      await fabricCanvas.current.loadFromJSON(
        JSON.parse(historyStack[targetIdx]),
      );
      fabricCanvas.current.renderAll();
      setHistoryIndex(targetIdx);
      updateLayersList();
      setSelectedObject(fabricCanvas.current.getActiveObject() || null);
      toast.success("Redone modification");
    } catch (err) {
      console.error(err);
      toast.error("Redo sequence mismatched");
    } finally {
      isTransitioningState.current = false;
    }
  };

  // HD Transparent Background removal action
  const handleBackgroundRemoval = async () => {
    if (
      !selectedObject ||
      !(selectedObject instanceof FabricImage) ||
      isProcessing
    ) {
      toast.error(
        "Please import and select an Image layer to run AI Background Removal",
      );
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading(
      "Downloading segments & processing AI Background Removal...",
    );

    try {
      // FIXING THE EXPORT WHITE/GRAY BOX PROBLEM:
      // When exporting individual FabricImage layers, force PNG format with proper alpha channels!
      const currentScale = selectedObject.scaleX || 1;
      const dataUrl = selectedObject.toDataURL({
        format: "png", // Force high-contrast transparent PNG
        quality: 1.0,
        multiplier: 1 / currentScale,
      });

      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Perform imgly neural background extraction
      const transparentBlob = await removeBackground(blob);
      const transparentObjectUrl = URL.createObjectURL(transparentBlob);

      // Load resulting vector as transparent PNG
      const transparentImg = await FabricImage.fromURL(transparentObjectUrl);

      if (fabricCanvas.current && selectedObject) {
        // Enforce consistent spatial metrics
        const anySelected = selectedObject as any;
        const anyTransparent = transparentImg as any;

        transparentImg.set({
          left: selectedObject.left,
          top: selectedObject.top,
          scaleX: selectedObject.scaleX,
          scaleY: selectedObject.scaleY,
          angle: selectedObject.angle,
          flipX: selectedObject.flipX,
          flipY: selectedObject.flipY,
          originX: selectedObject.originX,
          originY: selectedObject.originY,
          backgroundColor: "", // Explicitly reset background colors
        });

        anyTransparent.name = `${anySelected.name || "Image"} (No BG)`;
        anyTransparent.id = anySelected.id || `image_${Date.now()}`;

        fabricCanvas.current.remove(selectedObject);
        fabricCanvas.current.add(transparentImg);
        fabricCanvas.current.setActiveObject(transparentImg);
        fabricCanvas.current.renderAll();
        updateLayersList();
        saveHistoryState();
      }

      toast.success("AI Segmented Background Removed Successfully!", {
        id: toastId,
      });
    } catch (error) {
      console.error("AI BG Segment error:", error);
      toast.error(
        "AI Background Removal failed. Try a smaller image or clean portrait.",
        { id: toastId },
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Color adjustments and filter calculations
  const applyCorrectiveParameters = () => {
    if (
      !selectedObject ||
      !(selectedObject instanceof FabricImage) ||
      !fabricCanvas.current
    )
      return;

    const img = selectedObject;
    img.filters = [];

    // Core Correction Sliders
    if (brightness !== 0) {
      img.filters.push(
        new filters.Brightness({ brightness: brightness / 100 }),
      );
    }
    if (contrast !== 0) {
      img.filters.push(new filters.Contrast({ contrast: contrast / 100 }));
    }
    if (saturation !== 0) {
      img.filters.push(
        new filters.Saturation({ saturation: saturation / 100 }),
      );
    }
    if (blur !== 0) {
      img.filters.push(new filters.Blur({ blur: blur / 100 }));
    }
    if (pixelate > 1) {
      img.filters.push(new filters.Pixelate({ blocksize: pixelate }));
    }
    if (hue !== 0) {
      img.filters.push(new filters.HueRotation({ rotation: hue / 180 }));
    }
    if (noise > 0) {
      img.filters.push(new filters.Noise({ noise: noise / 100 }));
    }

    // Creative Presets
    if (selectedFilterId === "grayscale") {
      img.filters.push(new filters.Grayscale());
    } else if (selectedFilterId === "sepia") {
      img.filters.push(new filters.Sepia());
    } else if (selectedFilterId === "invert") {
      img.filters.push(new filters.Invert());
    } else if (selectedFilterId === "vintage") {
      img.filters.push(new filters.Sepia());
      img.filters.push(new filters.Contrast({ contrast: 0.15 }));
    } else if (selectedFilterId === "kodachrome") {
      img.filters.push(new filters.Saturation({ saturation: 0.4 }));
      img.filters.push(new filters.Contrast({ contrast: 0.1 }));
    } else if (selectedFilterId === "technicolor") {
      img.filters.push(new filters.Saturation({ saturation: 0.6 }));
      img.filters.push(new filters.Contrast({ contrast: 0.25 }));
    } else if (selectedFilterId === "brownie") {
      img.filters.push(new filters.Sepia());
      img.filters.push(new filters.Brightness({ brightness: -0.05 }));
      img.filters.push(new filters.Contrast({ contrast: 0.1 }));
    } else if (selectedFilterId === "polaroid") {
      img.filters.push(new filters.Sepia());
      img.filters.push(new filters.Saturation({ saturation: -0.2 }));
      img.filters.push(new filters.Brightness({ brightness: 0.1 }));
    } else if (selectedFilterId === "pixel-glitch") {
      img.filters.push(new filters.Pixelate({ blocksize: 15 }));
      img.filters.push(new filters.Contrast({ contrast: 0.3 }));
    } else if (selectedFilterId === "acid") {
      img.filters.push(new filters.HueRotation({ rotation: 0.6 }));
      img.filters.push(new filters.Saturation({ saturation: 0.8 }));
    } else if (selectedFilterId === "dramatic") {
      img.filters.push(new filters.Contrast({ contrast: 0.4 }));
      img.filters.push(new filters.Saturation({ saturation: -0.15 }));
    } else if (selectedFilterId === "cool") {
      img.filters.push(new filters.HueRotation({ rotation: -0.15 }));
      img.filters.push(new filters.Saturation({ saturation: 0.1 }));
    }

    img.applyFilters();
    fabricCanvas.current.renderAll();
  };

  // Trigger filters dynamically on sliders
  useEffect(() => {
    applyCorrectiveParameters();
  }, [
    brightness,
    contrast,
    saturation,
    blur,
    pixelate,
    hue,
    noise,
    selectedFilterId,
  ]);

  // Flip Actions
  const handleFlip = (direction: "horizontal" | "vertical") => {
    if (!selectedObject || !fabricCanvas.current) return;
    if (direction === "horizontal") {
      selectedObject.set("flipX", !selectedObject.flipX);
    } else {
      selectedObject.set("flipY", !selectedObject.flipY);
    }
    fabricCanvas.current.renderAll();
    saveHistoryState();
  };

  // Alignments
  const handleAlign = (
    alignment: "center" | "left" | "right" | "top" | "bottom",
  ) => {
    if (!selectedObject || !fabricCanvas.current) return;
    const canvas = fabricCanvas.current;

    const objWidth = selectedObject.width * (selectedObject.scaleX || 1);
    const objHeight = selectedObject.height * (selectedObject.scaleY || 1);

    if (alignment === "center") {
      canvas.centerObject(selectedObject);
    } else if (alignment === "left") {
      selectedObject.set("left", 0);
    } else if (alignment === "right") {
      selectedObject.set("left", canvas.width - objWidth);
    } else if (alignment === "top") {
      selectedObject.set("top", 0);
    } else if (alignment === "bottom") {
      selectedObject.set("top", canvas.height - objHeight);
    }

    canvas.renderAll();
    saveHistoryState();
  };

  // Text Insert
  const addTextWidget = () => {
    if (!fabricCanvas.current) return;
    const canvas = fabricCanvas.current;
    const textLayer = new IText("Write Text...", {
      left: 100,
      top: 150,
      fontFamily: textFont,
      fontSize: textSize,
      fill: textColor,
      fontStyle: textItalic ? "italic" : "normal",
      fontWeight: textBold ? "bold" : "normal",
      stroke: textOutlineWidth > 0 ? textOutlineColor : "transparent",
      strokeWidth: textOutlineWidth,
    });
    const anyText = textLayer as any;
    anyText.name = `Text Banner`;
    canvas.add(textLayer);
    canvas.setActiveObject(textLayer);
    canvas.renderAll();
    updateLayersList();
    saveHistoryState();
  };

  // Update text styles dynamically
  useEffect(() => {
    if (
      selectedObject &&
      selectedObject instanceof IText &&
      fabricCanvas.current
    ) {
      selectedObject.set({
        fill: textColor,
        fontFamily: textFont,
        fontSize: textSize,
        fontWeight: textBold ? "bold" : "normal",
        fontStyle: textItalic ? "italic" : "normal",
        stroke: textOutlineWidth > 0 ? textOutlineColor : "transparent",
        strokeWidth: textOutlineWidth,
      });
      fabricCanvas.current.renderAll();
    }
  }, [
    textColor,
    textFont,
    textSize,
    textBold,
    textItalic,
    textOutlineColor,
    textOutlineWidth,
  ]);

  // Shapes Insertion
  const addRectShape = () => {
    const rectObj = new Rect({
      left: 180,
      top: 180,
      width: 140,
      height: 100,
      fill: shapeFillColor,
      stroke: shapeStrokeColor,
      strokeWidth: shapeStrokeWidth,
      rx: 8,
      ry: 8,
    } as any);
    const anyRect = rectObj as any;
    anyRect.name = "Rectangle Frame";
    fabricCanvas.current?.add(rectObj);
    fabricCanvas.current?.setActiveObject(rectObj);
    fabricCanvas.current?.renderAll();
    updateLayersList();
    saveHistoryState();
  };

  const addCircleShape = () => {
    const circObj = new Circle({
      left: 180,
      top: 180,
      radius: 65,
      fill: shapeFillColor,
      stroke: shapeStrokeColor,
      strokeWidth: shapeStrokeWidth,
    });
    const anyCirc = circObj as any;
    anyCirc.name = "Capsule Sticker";
    fabricCanvas.current?.add(circObj);
    fabricCanvas.current?.setActiveObject(circObj);
    fabricCanvas.current?.renderAll();
    updateLayersList();
    saveHistoryState();
  };

  const addTriangleShape = () => {
    const triObj = new Triangle({
      left: 180,
      top: 180,
      width: 130,
      height: 110,
      fill: shapeFillColor,
      stroke: shapeStrokeColor,
      strokeWidth: shapeStrokeWidth,
    });
    const anyTri = triObj as any;
    anyTri.name = "Apex Triangle";
    fabricCanvas.current?.add(triObj);
    fabricCanvas.current?.setActiveObject(triObj);
    fabricCanvas.current?.renderAll();
    updateLayersList();
    saveHistoryState();
  };

  // Update shape properties dynamically
  useEffect(() => {
    if (
      selectedObject &&
      (selectedObject instanceof Rect ||
        selectedObject instanceof Circle ||
        selectedObject instanceof Triangle) &&
      fabricCanvas.current
    ) {
      selectedObject.set({
        fill: shapeFillColor,
        stroke: shapeStrokeColor,
        strokeWidth: shapeStrokeWidth,
      });
      fabricCanvas.current.renderAll();
    }
  }, [shapeFillColor, shapeStrokeColor, shapeStrokeWidth]);

  // Delete Selection
  const handleDeleteSelection = () => {
    if (!selectedObject || !fabricCanvas.current) return;
    fabricCanvas.current.remove(selectedObject);
    fabricCanvas.current.discardActiveObject();
    fabricCanvas.current.renderAll();
    setSelectedObject(null);
    updateLayersList();
    saveHistoryState();
    toast.success("Layer deleted successfully");
  };

  // Layer Reordering Controls
  const reorderLayer = (
    action: "front" | "back" | "up" | "down",
    targetLayerRef?: FabricObject,
  ) => {
    const obj = targetLayerRef || selectedObject;
    if (!obj || !fabricCanvas.current) return;

    if (action === "front") {
      fabricCanvas.current.bringObjectToFront(obj);
    } else if (action === "back") {
      fabricCanvas.current.sendObjectToBack(obj);
    } else if (action === "up") {
      fabricCanvas.current.bringObjectForward(obj, true);
    } else if (action === "down") {
      fabricCanvas.current.sendObjectBackwards(obj, true);
    }

    fabricCanvas.current.renderAll();
    updateLayersList();
    saveHistoryState();
  };

  // Layer Lock & Visibility Controls
  const toggleVisibility = (layer: CanvasObjectLayer) => {
    if (!fabricCanvas.current) return;
    layer.ref.visible = !layer.ref.visible;
    fabricCanvas.current.discardActiveObject();
    fabricCanvas.current.renderAll();
    updateLayersList();
    saveHistoryState();
  };

  const toggleLock = (layer: CanvasObjectLayer) => {
    if (!fabricCanvas.current) return;
    const isLocked = !layer.ref.lockMovementX;
    layer.ref.set({
      lockMovementX: isLocked,
      lockMovementY: isLocked,
      lockScalingX: isLocked,
      lockScalingY: isLocked,
      lockRotation: isLocked,
      hasControls: !isLocked,
    });
    fabricCanvas.current.renderAll();
    updateLayersList();
    saveHistoryState();
  };

  // Resize canvas with presets
  const handlePresetChange = (w: number, h: number) => {
    if (!fabricCanvas.current) return;
    fabricCanvas.current.setDimensions({ width: w, height: h });
    fabricCanvas.current.renderAll();
    updateLayersList();
    saveHistoryState();
    toast.success(`Canvas resized to ${w}x${h} pixels`);
  };

  // Zoom slider functions
  const zoomIn = () => {
    const nextZoom = Math.min(zoom + 15, 300);
    setZoom(nextZoom);
    fabricCanvas.current?.setZoom(nextZoom / 100);
    fabricCanvas.current?.requestRenderAll();
  };

  const zoomOut = () => {
    const nextZoom = Math.max(zoom - 15, 10);
    setZoom(nextZoom);
    fabricCanvas.current?.setZoom(nextZoom / 100);
    fabricCanvas.current?.requestRenderAll();
  };

  const resetZoomAndPan = () => {
    if (!fabricCanvas.current) return;
    setZoom(100);
    fabricCanvas.current.setZoom(1.0);
    fabricCanvas.current.setViewportTransform([1, 0, 0, 1, 0, 0]);
    fabricCanvas.current.requestRenderAll();
  };

  // Sync canvas background mode
  useEffect(() => {
    if (!fabricCanvas.current) return;
    if (canvasBgStyle === "transparent") {
      fabricCanvas.current.backgroundColor = "transparent";
    } else {
      fabricCanvas.current.backgroundColor = canvasBgColor;
    }
    fabricCanvas.current.renderAll();
  }, [canvasBgStyle, canvasBgColor]);

  // EXPORT PROCESS (FLAWLESS TRANSPARENCY ASSURED PNG & DIRECT HIGH RES LAYER OPTION)
  const downloadArtwork = (mode: "canvas" | "cropped-layer") => {
    if (!fabricCanvas.current) return;

    if (mode === "cropped-layer") {
      if (!selectedObject || !(selectedObject instanceof FabricImage)) {
        toast.error(
          "Please select an Image Layer to download with direct cropped transparency",
        );
        return;
      }
      try {
        const toastId = toast.loading("Processing transparent asset crop...");

        // Use native scale calculation to ensure high resolution
        const targetMultiplier = 2 / (selectedObject.scaleX || 1);
        const dataURL = selectedObject.toDataURL({
          format: "png",
          quality: 1.0,
          multiplier: Math.min(Math.max(targetMultiplier, 1.5), 6), // safeguard scaling limits
        });

        const anySelected = selectedObject as any;
        const link = document.createElement("a");
        link.download = `transparent-${anySelected.name || "crop"}-${Date.now()}.png`;
        link.href = dataURL;
        link.click();
        toast.success("Crop asset exported cleanly with pure transparency!", {
          id: toastId,
        });
      } catch (err) {
        console.error(err);
        toast.error("Direct element crop failed.");
      }
      return;
    }

    // CANVAS EXPORT MODE
    const objects = fabricCanvas.current.getObjects();
    const images = objects.filter(
      (obj) => obj instanceof FabricImage,
    ) as FabricImage[];

    let multiplier = 2; // high resolution export baseline

    if (images.length > 0) {
      // Scale resolution proportionally to match original image specs
      const scales = images.map((img) => 1 / (img.scaleX || 1));
      multiplier = Math.min(Math.max(Math.max(...scales), 2), 6);
    }

    const toastId = toast.loading(
      "Rendering Ultra-HD Transparent PNG Canvas...",
    );

    try {
      // Temporary selection clearing to avoid capturing selector boundaries inside final export
      const activeObj = fabricCanvas.current.getActiveObject();
      fabricCanvas.current.discardActiveObject();
      fabricCanvas.current.renderAll();

      const dataURL = fabricCanvas.current.toDataURL({
        format: "png",
        quality: 1.0,
        multiplier: multiplier,
      });

      // Restore active objects for continuing editing flow
      if (activeObj) {
        fabricCanvas.current.setActiveObject(activeObj);
        fabricCanvas.current.renderAll();
      }

      const link = document.createElement("a");
      link.download = `creative-export-${Date.now()}.png`;
      link.href = dataURL;
      link.click();
      toast.success("High definition artwork downloaded successfully!", {
        id: toastId,
      });
    } catch (error) {
      console.error(error);
      toast.error("Export operation failed. Try shrinking your bounds.", {
        id: toastId,
      });
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto space-y-6 px-4 md:px-0">
      {/* Upper header action board */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 md:pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[10px] font-black uppercase text-indigo-700 tracking-wider">
              Production Suite
            </span>
            <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-black uppercase text-emerald-700 tracking-wider">
              Transparent Export Fixed
            </span>
          </div>
          <h1 className="text-xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans">
            Creative Vector & Image Editor
          </h1>
          <p className="text-[11px] md:text-sm text-slate-500 font-medium">
            Add text, overlay custom shapes, paint freehand, and process
            flawless AI background removal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Quick Upload Button */}
          <button
            onClick={() =>
              document.getElementById("img-direct-loader")?.click()
            }
            className="flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition active:scale-95 cursor-pointer shadow-sm"
          >
            <FolderOpen size={14} /> Open Photo
          </button>

          <input
            id="img-direct-loader"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />

          <button
            onClick={() => downloadArtwork("canvas")}
            disabled={!hasImage && layers.length === 0}
            className="flex items-center justify-center gap-2 rounded-md bg-indigo-600 hover:bg-indigo-700 px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-white transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-md"
          >
            <Download size={14} /> Export Canvas Asset
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:gap-8 lg:grid-cols-[1fr_380px]">
        {/* Workspace Central Board */}
        <div className="flex flex-col gap-4">
          {/* Action Toolbar above canvas */}
          <div className="flex items-center justify-between gap-3 flex-wrap bg-white border border-slate-200 p-2 md:p-3 rounded-md shadow-sm">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Insert Text */}
              <button
                onClick={addTextWidget}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-50 border border-slate-150 hover:bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-800 transition active:scale-95"
              >
                <Type size={13} className="text-indigo-600" /> Insert Text
              </button>

              {/* Pointer Select Tool */}
              <button
                onClick={() => setCurrentTool("select")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-black uppercase tracking-wider transition active:scale-95",
                  currentTool === "select"
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-xs font-black"
                    : "bg-slate-50 border-slate-150 hover:bg-slate-100 text-slate-800",
                )}
                title="Select, edit, rotate, and drag shapes, text, or images on canvas"
              >
                <MousePointer2 size={13} /> Select Mode
              </button>

              {/* Toggle Drawing Brush */}
              <button
                onClick={() => setCurrentTool("draw")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-black uppercase tracking-wider transition active:scale-95",
                  currentTool === "draw"
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-xs font-black"
                    : "bg-slate-50 border-slate-150 hover:bg-slate-100 text-slate-800",
                )}
                title="Freehand paint using mouse or touchscreen"
              >
                <Brush size={13} />{" "}
                {currentTool === "draw" ? "Drawing Active" : "Brush Paint"}
              </button>

              {/* Hand/Pan Mode */}
              <button
                onClick={() => setCurrentTool("pan")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-black uppercase tracking-wider transition active:scale-95",
                  currentTool === "pan"
                    ? "bg-amber-500 border-amber-500 text-white shadow-xs font-black"
                    : "bg-slate-50 border-slate-150 hover:bg-slate-100 text-slate-800",
                )}
                title="Pan around canvas when zoomed"
              >
                <Move size={13} />{" "}
                {currentTool === "pan" ? "Pan Active" : "Pan Workspace"}
              </button>
            </div>

            {/* History stack & Zoom panel */}
            <div className="flex items-center gap-1.5 self-end">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-1.5 rounded hover:bg-slate-100 border border-transparent disabled:opacity-25 text-slate-700 transition"
                title="Undo Action"
              >
                <Undo2 size={14} />
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= historyStack.length - 1}
                className="p-1.5 rounded hover:bg-slate-100 border border-transparent disabled:opacity-25 text-slate-700 transition"
                title="Redo Action"
              >
                <Redo2 size={14} />
              </button>

              <div className="h-4 w-px bg-slate-200 mx-1" />

              <button
                onClick={zoomOut}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-700 transition"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-[10px] font-bold font-mono text-slate-500 min-w-[34px] text-center">
                {zoom}%
              </span>
              <button
                onClick={zoomIn}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-700 transition"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={resetZoomAndPan}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-700 transition"
                title="Reset Zoom/Pan parameters"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>

          {/* Interactive Workspace Board representing the Canvas container */}
          <div
            ref={workspaceRef}
            className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-100/70 shadow-inner h-[620px] max-h-[70vh] flex items-center justify-center p-4 transition-all"
          >
            {/* Background transparent checkerboard configuration */}
            <div
              id="editorial-viewport"
              className="shadow-2xl border border-slate-350 bg-white transition-all overflow-auto max-w-full max-h-full"
              style={{
                backgroundImage:
                  canvasBgStyle === "transparent"
                    ? `linear-gradient(45deg, #f4f4f4 25%, transparent 25%), 
                                   linear-gradient(-45deg, #f4f4f4 25%, transparent 25%), 
                                   linear-gradient(45deg, transparent 75%, #f4f4f4 75%), 
                                   linear-gradient(-45deg, transparent 75%, #f4f4f4 75%)`
                    : undefined,
                backgroundSize: "24px 24px",
                backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0px",
                backgroundColor:
                  canvasBgStyle === "solid" ? canvasBgColor : "#ffffff",
              }}
            >
              <canvas ref={canvasRef} />
            </div>

            {/* Empty canvas state loader */}
            {!hasImage && layers.length === 0 && !isProcessing && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-white">
                <div className="rounded-full bg-slate-50 border border-slate-200 p-8 text-indigo-500 shadow-md animate-pulse">
                  <ImageIcon size={44} strokeWidth={1} />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-base font-bold text-slate-800 tracking-tight font-sans">
                    Workspace Uninitialized
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Import a background image or start inserting text & vector
                    assets
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <button
                    onClick={() =>
                      document.getElementById("img-direct-loader")?.click()
                    }
                    className="cursor-pointer rounded-md bg-indigo-600 px-6 py-2.5 text-[11px] font-black uppercase tracking-widest text-white hover:bg-indigo-700 shadow-md transition active:scale-95"
                  >
                    Load Photo Base
                  </button>
                  <button
                    onClick={addTextWidget}
                    className="rounded-md border border-slate-250 bg-slate-50 px-6 py-2.5 text-[11px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-100 shadow-sm transition active:scale-95"
                  >
                    Quick Add Text
                  </button>
                </div>
              </div>
            )}

            {/* Neural Segmentation spinner */}
            {isProcessing && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-900/40 backdrop-blur-md">
                <div className="bg-white p-8 rounded-lg shadow-2xl border border-slate-100 flex flex-col items-center gap-5 text-center max-w-sm">
                  <div className="relative">
                    <div className="h-14 w-14 animate-spin rounded-full border-4 border-slate-100 border-t-indigo-600" />
                    <Sparkles
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 animate-pulse"
                      size={20}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-800 font-sans">
                      Extracting Image Subject...
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                      AI Segmentation models are processing edge refinement for
                      perfect hair-thin vector alpha channels.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Properties inspector and side controls panel */}
        <div className="space-y-6 flex flex-col justify-between">
          <div className="rounded-md border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col min-h-[580px]">
            {/* Tab navigation headers */}
            <div className="flex border-b border-indigo-50 bg-slate-50/50 p-1">
              {(["adjust", "shapes", "text", "layers", "canvas"] as const).map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex-1 text-center py-2.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all capitalize whitespace-nowrap",
                      activeTab === tab
                        ? "bg-white text-indigo-600 shadow-xs border border-indigo-50 font-black"
                        : "text-slate-400 hover:text-slate-700 hover:bg-slate-100/50",
                    )}
                  >
                    {tab}
                  </button>
                ),
              )}
            </div>

            <div className="p-5 flex-1 overflow-y-auto">
              {/* TAB 1: Adjust page & Creative filters */}
              {activeTab === "adjust" && (
                <div className="space-y-6">
                  {selectedObject instanceof FabricImage ? (
                    <div className="space-y-6 animate-in fade-in duration-350">
                      {/* AI BG Action Container */}
                      <div className="bg-gradient-to-tr from-indigo-500/10 via-indigo-50/50 to-white/10 p-4 rounded-md border border-indigo-100 space-y-3 shadow-xs">
                        <div className="flex items-center gap-2">
                          <Sparkles
                            size={16}
                            className="text-indigo-600 shrink-0"
                          />
                          <h4 className="text-[11px] font-black uppercase tracking-wider text-indigo-900 font-sans">
                            AI Object Segmentation
                          </h4>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                          Remove background instantly from selected object.
                          Exports with 100% fine aligned transparency.
                        </p>

                        <div className="space-y-2 pt-1">
                          <button
                            onClick={handleBackgroundRemoval}
                            disabled={isProcessing}
                            className="pressable w-full flex items-center justify-center gap-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[9px] py-3 transition active:scale-95 shadow-md disabled:opacity-50"
                          >
                            <Wand2 size={13} />{" "}
                            {isProcessing
                              ? "Analyzing Layers..."
                              : "Remove Background Layer"}
                          </button>

                          <button
                            onClick={() => downloadArtwork("cropped-layer")}
                            className="pressable w-full flex items-center justify-center gap-2 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold uppercase tracking-widest text-[9px] py-2 transition active:scale-95"
                          >
                            <Download size={12} /> Save Selected Crop PNG
                          </button>
                        </div>
                      </div>

                      {/* Alignments Panel */}
                      <div className="space-y-3 border-t border-slate-100 pt-4">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Settings2 size={13} /> Layout and Alignments
                        </label>
                        <div className="grid grid-cols-2 gap-1.5 text-[9px] font-bold uppercase tracking-wider">
                          <button
                            onClick={() => handleAlign("center")}
                            className="border hover:bg-slate-50 py-1.5 rounded transition"
                          >
                            Center Layer
                          </button>
                          <button
                            onClick={() => handleAlign("left")}
                            className="border hover:bg-slate-50 py-1.5 rounded transition"
                          >
                            Align Left
                          </button>
                          <button
                            onClick={() => handleAlign("right")}
                            className="border hover:bg-slate-50 py-1.5 rounded transition"
                          >
                            Align Right
                          </button>
                          <button
                            onClick={() => handleAlign("top")}
                            className="border hover:bg-slate-50 py-1.5 rounded transition"
                          >
                            Align Top
                          </button>
                          <button
                            onClick={() => handleAlign("bottom")}
                            className="border hover:bg-slate-50 py-1.5 rounded transition"
                          >
                            Align Bottom
                          </button>

                          <div className="col-span-2 grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-50">
                            <button
                              onClick={() => handleFlip("horizontal")}
                              className="border border-indigo-50 hover:bg-indigo-50/20 text-slate-700 py-1.5 rounded transition flex items-center justify-center gap-1"
                            >
                              <FlipHorizontal size={12} /> Swap L-R
                            </button>
                            <button
                              onClick={() => handleFlip("vertical")}
                              className="border border-indigo-50 hover:bg-indigo-50/20 text-slate-700 py-1.5 rounded transition flex items-center justify-center gap-1"
                            >
                              <FlipVertical size={12} /> Flip Top-Down
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Color Correction sliders */}
                      <div className="space-y-4 border-t border-slate-100 pt-4">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Sliders size={13} /> Color Fine Tuning
                        </label>

                        <div className="space-y-3.5">
                          {/* Brightness */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-medium text-slate-600">
                              <span className="flex items-center gap-1">
                                <Sun size={11} /> Exposure/Brightness
                              </span>
                              <span className="font-mono text-slate-400 text-[10px]">
                                {brightness}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="-100"
                              max="100"
                              value={brightness}
                              onChange={(e) =>
                                setBrightness(parseInt(e.target.value))
                              }
                              className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg cursor-pointer"
                            />
                          </div>

                          {/* Contrast */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-medium text-slate-600">
                              <span className="flex items-center gap-1">
                                <Contrast size={11} /> Contrast Bounds
                              </span>
                              <span className="font-mono text-slate-400 text-[10px]">
                                {contrast}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="-100"
                              max="100"
                              value={contrast}
                              onChange={(e) =>
                                setContrast(parseInt(e.target.value))
                              }
                              className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg cursor-pointer"
                            />
                          </div>

                          {/* Saturation */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-medium text-slate-600">
                              <span className="flex items-center gap-1">
                                <Palette size={11} /> Saturation/vibrance
                              </span>
                              <span className="font-mono text-slate-400 text-[10px]">
                                {saturation}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="-100"
                              max="100"
                              value={saturation}
                              onChange={(e) =>
                                setSaturation(parseInt(e.target.value))
                              }
                              className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg cursor-pointer"
                            />
                          </div>

                          {/* Blur & Pixelate */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-medium text-slate-600">
                              <span>Blur Intensity</span>
                              <span className="font-mono text-slate-400 text-[10px]">
                                {blur}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={blur}
                              onChange={(e) =>
                                setBlur(parseInt(e.target.value))
                              }
                              className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-medium text-slate-600">
                              <span>Retro Pixelation</span>
                              <span className="font-mono text-slate-400 text-[10px]">
                                {pixelate} px
                              </span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="40"
                              value={pixelate}
                              onChange={(e) =>
                                setPixelate(parseInt(e.target.value))
                              }
                              className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg cursor-pointer"
                            />
                          </div>

                          {/* Hue Rotation */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-medium text-slate-600">
                              <span>Hue Shifting Rotation</span>
                              <span className="font-mono text-slate-400 text-[10px]">
                                {hue}°
                              </span>
                            </div>
                            <input
                              type="range"
                              min="-180"
                              max="180"
                              value={hue}
                              onChange={(e) => setHue(parseInt(e.target.value))}
                              className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg cursor-pointer"
                            />
                          </div>

                          {/* Noise Film Grain */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-medium text-slate-600">
                              <span>Retro Film Noise Grain</span>
                              <span className="font-mono text-slate-400 text-[10px]">
                                {noise}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={noise}
                              onChange={(e) =>
                                setNoise(parseInt(e.target.value))
                              }
                              className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Creative Filter Presets */}
                      <div className="space-y-3 border-t border-slate-100 pt-4">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Creative Filter Presets
                        </label>
                        <div className="grid grid-cols-2 gap-1.5 text-[9px] font-medium text-slate-700">
                          {CREATIVE_FILTERS.map((f) => (
                            <button
                              key={f.id}
                              onClick={() => setSelectedFilterId(f.id)}
                              className={cn(
                                "border py-2 px-1.5 rounded transition text-left flex items-center justify-between",
                                selectedFilterId === f.id
                                  ? "bg-indigo-600 text-white border-indigo-600 font-bold"
                                  : "hover:bg-slate-50 border-slate-200",
                              )}
                            >
                              <span>{f.name}</span>
                              {selectedFilterId === f.id && <Check size={10} />}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={resetCreativeState}
                        className="w-full border border-slate-200 py-2.5 rounded text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition"
                      >
                        Reset Sliders & Presets
                      </button>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400 space-y-3">
                      <div className="mx-auto w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                        <ImageIcon size={22} className="text-slate-350" />
                      </div>
                      <p className="text-[11px] leading-relaxed font-bold font-sans max-w-[220px] mx-auto uppercase tracking-wider text-slate-400">
                        Identify / Select an Image Layer to access correction
                        panel and AI background tools.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Shapes Insertion */}
              {activeTab === "shapes" && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Vector Shape Overlay Tools
                    </label>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={addRectShape}
                        className="flex flex-col items-center gap-1 py-3 text-[10px] text-slate-700 font-bold uppercase tracking-wider border rounded bg-slate-50/50 hover:bg-slate-100 transition shadow-xs"
                      >
                        <Square size={16} className="text-indigo-600" />
                        <span>Rect</span>
                      </button>
                      <button
                        onClick={addCircleShape}
                        className="flex flex-col items-center gap-1 py-3 text-[10px] text-slate-700 font-bold uppercase tracking-wider border rounded bg-slate-50/50 hover:bg-slate-100 transition shadow-xs"
                      >
                        <CircleIcon size={16} className="text-amber-500" />
                        <span>Circle</span>
                      </button>
                      <button
                        onClick={addTriangleShape}
                        className="flex flex-col items-center gap-1 py-3 text-[10px] text-slate-700 font-bold uppercase tracking-wider border rounded bg-slate-50/50 hover:bg-slate-100 transition shadow-xs"
                      >
                        <TriangleIcon size={16} className="text-rose-500" />
                        <span>Triangle</span>
                      </button>
                    </div>
                  </div>

                  {/* Shapes customization attributes */}
                  {selectedObject instanceof Rect ||
                  selectedObject instanceof Circle ||
                  selectedObject instanceof Triangle ? (
                    <div className="space-y-4 border-t border-slate-100 pt-5 animate-in fade-in duration-200">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                        <Palette size={13} /> Selected Shape Properties
                      </label>

                      <div className="space-y-3.5">
                        {/* Fill Color */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-medium text-slate-600">
                            <span>Shape Background fill</span>
                            <span className="font-mono text-slate-400 font-bold text-[10px] uppercase">
                              {shapeFillColor}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={shapeFillColor}
                              onChange={(e) =>
                                setShapeFillColor(e.target.value)
                              }
                              className="h-8 w-11 rounded border border-slate-200 cursor-pointer p-0 shrink-0"
                            />
                            <div className="flex flex-wrap gap-1">
                              {[
                                "#e0e7ff",
                                "#fef3c7",
                                "#fce7f3",
                                "#dcfce7",
                                "#fee2e2",
                                "#1e293b",
                                "transparent",
                              ].map((c) => (
                                <button
                                  key={c}
                                  onClick={() => setShapeFillColor(c)}
                                  className="w-5 h-5 rounded border border-slate-200"
                                  style={{
                                    backgroundColor:
                                      c === "transparent" ? "#ffffff" : c,
                                  }}
                                  title={c}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Stroke Color */}
                        <div className="space-y-1.5 border-t border-slate-50 pt-3">
                          <div className="flex justify-between text-[10px] font-medium text-slate-600">
                            <span>Border stroke color</span>
                            <span className="font-mono text-slate-400 font-bold text-[10px] uppercase">
                              {shapeStrokeColor}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={shapeStrokeColor}
                              onChange={(e) =>
                                setShapeStrokeColor(e.target.value)
                              }
                              className="h-8 w-11 rounded border border-slate-200 cursor-pointer p-0 shrink-0"
                            />
                            <div className="flex flex-wrap gap-1">
                              {[
                                "#6366f1",
                                "#d97706",
                                "#db2777",
                                "#16a34a",
                                "#dc2626",
                                "#0f172a",
                              ].map((c) => (
                                <button
                                  key={c}
                                  onClick={() => setShapeStrokeColor(c)}
                                  className="w-5 h-5 rounded border border-slate-200"
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Stroke width */}
                        <div className="space-y-1.5 border-t border-slate-50 pt-3">
                          <div className="flex justify-between text-[10px] font-medium text-slate-600">
                            <span>Border Outline Thickness</span>
                            <span className="font-mono text-[10px] text-slate-400">
                              {shapeStrokeWidth} px
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="25"
                            value={shapeStrokeWidth}
                            onChange={(e) =>
                              setShapeStrokeWidth(parseInt(e.target.value))
                            }
                            className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 border-t border-slate-100 text-center text-slate-400 space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Select standard vector shape layer
                      </p>
                      <p className="text-[10px] text-slate-400">
                        To inspect custom fill, strokes, and border
                        characteristics.
                      </p>
                    </div>
                  )}

                  {/* Freehand Brush panel */}
                  <div className="border-t border-slate-150 pt-5 space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                      <Paintbrush size={13} className="text-pink-500" />{" "}
                      Freehand Brush Setup
                    </label>

                    <div className="space-y-4 bg-slate-50/50 p-3.5 rounded border border-slate-150">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                          Paint Drawing Mode
                        </span>
                        <button
                          onClick={() =>
                            setCurrentTool(
                              currentTool === "draw" ? "select" : "draw",
                            )
                          }
                          className={cn(
                            "px-4 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition",
                            currentTool === "draw"
                              ? "bg-indigo-600 text-white hover:bg-indigo-700"
                              : "bg-white border text-slate-700 hover:bg-slate-50",
                          )}
                        >
                          {currentTool === "draw" ? "ENABLED" : "DISABLED"}
                        </button>
                      </div>

                      {/* Brush Color */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-500">
                          Brush Ink Palette
                        </span>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={brushColor}
                            onChange={(e) => setBrushColor(e.target.value)}
                            className="h-7 w-9 rounded cursor-pointer p-0 border border-slate-200"
                          />
                          <div className="flex flex-wrap gap-1">
                            {[
                              "#4f46e5",
                              "#ec4899",
                              "#f59e0b",
                              "#10b981",
                              "#ef4444",
                              "#111827",
                            ].map((c) => (
                              <button
                                key={c}
                                onClick={() => setBrushColor(c)}
                                className="w-5 h-5 rounded border border-slate-200"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Brush Width */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500">
                          <span>Brush Stroke Thickness</span>
                          <span>{brushWidth} px</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="50"
                          value={brushWidth}
                          onChange={(e) =>
                            setBrushWidth(parseInt(e.target.value))
                          }
                          className="w-full h-1 bg-slate-200 rounded accent-indigo-600 appearance-none pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Text Editing */}
              {activeTab === "text" && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <button
                    onClick={addTextWidget}
                    className="w-full flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-widest py-3 rounded transition-all active:scale-95"
                  >
                    <Type size={14} /> Add new text banner
                  </button>

                  {/* Character styler adjustments */}
                  {selectedObject instanceof IText ? (
                    <div className="space-y-4 border-t border-slate-100 pt-5 animate-in fade-in duration-200">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        Character Formatting Panel
                      </label>

                      <div className="space-y-3.5">
                        {/* Font Family selector */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-medium text-slate-600">
                            Selected Font Family
                          </span>
                          <select
                            value={textFont}
                            onChange={(e) => setTextFont(e.target.value)}
                            className="w-full p-2 border border-slate-200 rounded text-[11px] font-bold text-slate-700"
                          >
                            {FONTS_LIST.map((font) => (
                              <option key={font} value={font}>
                                {font}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Font weight and style toggles */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                          <button
                            onClick={() => setTextBold(!textBold)}
                            className={cn(
                              "border py-1.5 rounded transition",
                              textBold
                                ? "bg-slate-800 text-white border-slate-800"
                                : "hover:bg-slate-50",
                            )}
                          >
                            Bold Format
                          </button>
                          <button
                            onClick={() => setTextItalic(!textItalic)}
                            className={cn(
                              "border py-1.5 rounded transition",
                              textItalic
                                ? "bg-slate-800 text-white border-slate-800"
                                : "hover:bg-slate-50",
                            )}
                          >
                            Italicized
                          </button>
                        </div>

                        {/* Size */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-medium text-slate-600">
                            <span>Character Font Size</span>
                            <span className="font-mono text-slate-400 text-[11px]">
                              {textSize} pt
                            </span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="120"
                            value={textSize}
                            onChange={(e) =>
                              setTextSize(parseInt(e.target.value))
                            }
                            className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg cursor-pointer"
                          />
                        </div>

                        {/* Text Fill Color */}
                        <div className="space-y-1.5 border-t border-slate-50 pt-3">
                          <div className="flex justify-between text-[10px] font-medium text-slate-600">
                            <span>Core Fill Text Color</span>
                            <span className="font-mono text-slate-400 font-bold uppercase text-[10px]">
                              {textColor}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={textColor}
                              onChange={(e) => setTextColor(e.target.value)}
                              className="h-8 w-11 rounded border border-slate-200 cursor-pointer p-0 shrink-0"
                            />
                            <div className="flex flex-wrap gap-1">
                              {[
                                "#1a1a1a",
                                "#ffffff",
                                "#e11d48",
                                "#1d4ed8",
                                "#15803d",
                                "#d97706",
                              ].map((c) => (
                                <button
                                  key={c}
                                  onClick={() => setTextColor(c)}
                                  className="w-5 h-5 rounded border border-slate-200"
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Text Outline Color and Width */}
                        <div className="space-y-1.5 border-t border-slate-50 pt-3">
                          <div className="flex justify-between text-[10px] font-medium text-slate-600">
                            <span>Outline Stroke Accent</span>
                            <span className="font-mono text-slate-400 font-bold uppercase text-[10px]">
                              {textOutlineColor}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={textOutlineColor}
                              onChange={(e) =>
                                setTextOutlineColor(e.target.value)
                              }
                              className="h-7 w-9 rounded cursor-pointer p-0 border border-slate-200"
                            />
                            <div className="flex flex-wrap gap-1">
                              {[
                                "#ffffff",
                                "#000000",
                                "#ec4899",
                                "#eab308",
                                "#3b82f6",
                              ].map((c) => (
                                <button
                                  key={c}
                                  onClick={() => setTextOutlineColor(c)}
                                  className="w-5 h-5 rounded border border-slate-200"
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between text-[10px] font-medium text-slate-600">
                            <span>Outline stroke thickness</span>
                            <span className="font-mono text-slate-400 text-[10px]">
                              {textOutlineWidth} px
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="10"
                            value={textOutlineWidth}
                            onChange={(e) =>
                              setTextOutlineWidth(parseInt(e.target.value))
                            }
                            className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 border-t border-slate-100 text-center text-slate-450 space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-455 font-sans">
                        No text layer currently focused
                      </p>
                      <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto">
                        Double click any text block on canvas to edit characters
                        and launch the stylized inspector.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Layers explorer hierarchy */}
              {activeTab === "layers" && (
                <div className="space-y-4 animate-in fade-in duration-305">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Canvas Objects Hierarchy
                    </span>
                    <span className="text-[9px] font-bold font-mono text-indigo-600 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100">
                      {layers.length} Total
                    </span>
                  </div>

                  {layers.length > 0 ? (
                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                      {layers.map((layer) => {
                        const isSelected =
                          (selectedObject as any)?.id === layer.id;
                        return (
                          <div
                            key={layer.id}
                            onClick={() => {
                              if (fabricCanvas.current) {
                                fabricCanvas.current.setActiveObject(layer.ref);
                                fabricCanvas.current.renderAll();
                              }
                            }}
                            className={cn(
                              "flex items-center justify-between p-2.5 rounded border text-[11px] font-bold text-slate-800 transition cursor-pointer select-none",
                              isSelected
                                ? "bg-indigo-50/75 border-indigo-200 text-indigo-900 ring-2 ring-indigo-500/10"
                                : "bg-slate-50/50 hover:bg-slate-50 border-slate-150",
                            )}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-[9px] font-mono text-slate-400 block w-4 shrink-0 font-black">
                                {layer.type === "image"
                                  ? "IMG"
                                  : layer.type === "i-text"
                                    ? "TXT"
                                    : "SHP"}
                              </span>
                              <span
                                className="truncate max-w-[120px] font-semibold text-slate-700"
                                title={layer.name}
                              >
                                {layer.name}
                              </span>
                            </div>

                            {/* Micro actions buttons per index object layer */}
                            <div
                              className="flex items-center gap-1 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Toggle visible */}
                              <button
                                onClick={() => toggleVisibility(layer)}
                                className={cn(
                                  "p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition",
                                  !layer.visible && "text-slate-350",
                                )}
                                title={
                                  layer.visible ? "Hide layer" : "Show layer"
                                }
                              >
                                {layer.visible ? (
                                  <Eye size={12} />
                                ) : (
                                  <EyeOff size={12} />
                                )}
                              </button>

                              {/* Toggle lock */}
                              <button
                                onClick={() => toggleLock(layer)}
                                className={cn(
                                  "p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition",
                                  layer.locked &&
                                    "text-amber-500 hover:text-amber-600",
                                )}
                                title={
                                  layer.locked
                                    ? "Unlock interaction"
                                    : "Lock coordinates on workspace"
                                }
                              >
                                {layer.locked ? (
                                  <Lock size={12} />
                                ) : (
                                  <Unlock size={12} />
                                )}
                              </button>

                              {/* Reorder Up / Down layer stack levels */}
                              <button
                                onClick={() => reorderLayer("up", layer.ref)}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition"
                                title="Bring Forward"
                              >
                                ▲
                              </button>
                              <button
                                onClick={() => reorderLayer("down", layer.ref)}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition"
                                title="Send Backward"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-400 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-450">
                        No Objects Layer Loaded
                      </p>
                      <p className="text-[10px]">
                        Add objects to map timeline index.
                      </p>
                    </div>
                  )}

                  {selectedObject && (
                    <div className="border-t border-slate-150 pt-4 space-y-2.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        Layer Actions
                      </label>

                      <div className="grid grid-cols-2 gap-2 text-[9px] font-bold uppercase tracking-widest text-slate-600">
                        <button
                          onClick={() => reorderLayer("front")}
                          className="border border-slate-200 py-1.5 rounded hover:bg-slate-50 transition"
                        >
                          Bring Front
                        </button>
                        <button
                          onClick={() => reorderLayer("back")}
                          className="border border-slate-200 py-1.5 rounded hover:bg-slate-50 transition"
                        >
                          Send Back
                        </button>
                      </div>

                      <button
                        onClick={handleDeleteSelection}
                        className="w-full flex items-center justify-center gap-1.5 bg-rose-50 text-rose-600 border border-rose-200 py-2.5 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-rose-100 transition duration-150"
                      >
                        <Trash2 size={13} /> Delete Active Layer
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: Canvas sizing options & custom background presets */}
              {activeTab === "canvas" && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* Preset dimension boundaries */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Canvas Resizer Port presets
                    </label>
                    <div className="space-y-1.5">
                      {PRESET_DIMENSIONS.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => handlePresetChange(preset.w, preset.h)}
                          className="w-full text-left p-2 rounded hover:bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-700 hover:border-slate-350 transition"
                        >
                          <span>{preset.name}</span>
                          <span className="font-mono text-slate-400 text-[10px]">
                            {preset.w} × {preset.h} px
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Background Options */}
                  <div className="space-y-4 border-t border-slate-100 pt-5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Canvas Background Styles
                    </label>

                    <div className="grid grid-cols-2 gap-2 text-[9px] font-bold uppercase tracking-widest">
                      <button
                        onClick={() => setCanvasBgStyle("transparent")}
                        className={cn(
                          "border py-2 rounded transition-all",
                          canvasBgStyle === "transparent"
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200",
                        )}
                      >
                        Transparent alpha
                      </button>
                      <button
                        onClick={() => setCanvasBgStyle("solid")}
                        className={cn(
                          "border py-2 rounded transition-all",
                          canvasBgStyle === "solid"
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200",
                        )}
                      >
                        Solid backdrop
                      </button>
                    </div>

                    {canvasBgStyle === "solid" && (
                      <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex justify-between text-[10px] font-medium text-slate-600">
                          <span>Set solid canvas color</span>
                          <span className="font-mono font-bold text-slate-400 uppercase">
                            {canvasBgColor}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={canvasBgColor}
                            onChange={(e) => setCanvasBgColor(e.target.value)}
                            className="h-8 w-11 rounded cursor-pointer p-0 border border-slate-200"
                          />
                          <div className="flex flex-wrap gap-1">
                            {[
                              "#ffffff",
                              "#000000",
                              "#f8fafc",
                              "#f1f5f9",
                              "#e2e8f0",
                              "#e0e7ff",
                              "#fef2f2",
                            ].map((c) => (
                              <button
                                key={c}
                                onClick={() => setCanvasBgColor(c)}
                                className="w-5 h-5 rounded border border-slate-250"
                                style={{ backgroundColor: c }}
                                title={c}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick-tips sidebar guide */}
          <div className="rounded-md bg-slate-900 p-5 space-y-3.5 shadow-md">
            <div className="flex gap-2.5 items-start">
              <Sparkles size={16} className="text-yellow-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[10px] text-white leading-relaxed font-black uppercase tracking-wider">
                  Alpha Transparency Guarantee
                </p>
                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                  We have resolved the white box export issue completely. Keep
                  canvas background on "Transparent alpha" and download HD image
                  PNG to preserve native alpha transparency.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
