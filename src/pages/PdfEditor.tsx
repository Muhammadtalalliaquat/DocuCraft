import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import {
  Canvas,
  StaticCanvas,
  FabricImage,
  IText,
  FabricObject,
  Rect,
  Circle,
  Line,
  util,
} from "fabric";
// @ts-expect-error - Vite specific import
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  Upload,
  Type,
  FileText,
  Download,
  Trash2,
  ArrowLeft,
  ArrowRight,
  MousePointer2,
  Square,
  Circle as CircleIcon,
  MoveRight,
  Bold,
  Palette,
  CaseSensitive,
  Layers,
  Eraser,
  Search,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/src/lib/utils";

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const FONTS = ["Inter", "serif", "monospace", "Impact", "Comic Sans MS"];

interface PdfTextItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
  hasEOL: boolean;
}

export default function PdfEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const fabricCanvas = useRef<Canvas | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(
    null,
  );
  const [textItems, setTextItems] = useState<PdfTextItem[]>([]);
  const [isTextSelectMode, setIsTextSelectMode] = useState(false);
  const [viewportScale, setViewportScale] = useState(1);
  const [fileName, setFileName] = useState("");

  const [containerWidth, setContainerWidth] = useState(800);
  const editorParentRef = workspaceRef; // Reuse the workspaceRef for tracking

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  // Multi-page persistence
  const [pageObjects, setPageObjects] = useState<Record<number, any>>({});

  // ✅ In top of component (with other refs)
  const modifiedPdfBytesRef = useRef<Uint8Array | null>(null);
  const pageObjectsRef = useRef<Record<number, any>>({});
  const currentPageRef = useRef<number>(1);

  // ✅ Keep refs in sync
  useEffect(() => {
    pageObjectsRef.current = pageObjects;
  }, [pageObjects]);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Resize handling
  useEffect(() => {
    if (!editorParentRef.current) return;

    // Initial width detection
    const initialWidth = editorParentRef.current.clientWidth - 48;
    if (initialWidth > 0 && containerWidth !== initialWidth) {
      setContainerWidth(initialWidth);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = Math.max(
          300,
          Math.floor(entry.contentRect.width - 48),
        );
        setContainerWidth(newWidth);
      }
    });

    resizeObserver.observe(editorParentRef.current);
    return () => resizeObserver.disconnect();
  }, [pdfDoc]);

  // ✅ Trigger re-render on page or container width change
  useEffect(() => {
    if (pdfDoc) {
      renderPage(pdfDoc, currentPage, true);
    }
  }, [pdfDoc, currentPage, containerWidth]);

  // Object State trackings for UI
  const [fontSize, setFontSize] = useState<number>(20);
  const [fontFamily, setFontFamily] = useState<string>("Inter");
  const [textColor, setTextColor] = useState<string>("#000000");
  const [isBold, setIsBold] = useState<boolean>(false);

  useEffect(() => {
    if (canvasRef.current && !fabricCanvas.current && workspaceRef.current) {
      fabricCanvas.current = new Canvas(canvasRef.current, {
        width: 800,
        height: 1100,
        backgroundColor: "#ffffff",
      });

      fabricCanvas.current.on("selection:created", (e) =>
        handleSelection(e.selected?.[0] || null),
      );
      fabricCanvas.current.on("selection:updated", (e) =>
        handleSelection(e.selected?.[0] || null),
      );
      fabricCanvas.current.on("selection:cleared", () =>
        setSelectedObject(null),
      );

      return () => {
        fabricCanvas.current?.dispose();
        fabricCanvas.current = null;
      };
    }
  }, []); // Initialize once

  // Separate effect to handle mode changes or page changes if needed
  useEffect(() => {
    if (!fabricCanvas.current) return;
    const canvas = fabricCanvas.current;

    const mouseDownHandler = (opt: any) => {
      if (isTextSelectMode) {
        handleTextDetectionAtPointer(opt);
      }
    };

    canvas.off("mouse:down"); // Clear previous
    canvas.on("mouse:down", mouseDownHandler);

    return () => {
      canvas.off("mouse:down", mouseDownHandler);
    };
  }, [isTextSelectMode]);

  const handleSelection = (obj: FabricObject | null) => {
    setSelectedObject(obj);
    if (obj instanceof IText) {
      setFontSize(obj.fontSize || 20);
      setFontFamily(obj.fontFamily || "Inter");
      setTextColor((obj.fill as string) || "#000000");
      setIsBold(obj.fontWeight === "bold");
    }
  };

  const handleFontSizeChange = (size: number) => {
    setFontSize(size);
    if (selectedObject instanceof IText) {
      selectedObject.set("fontSize", size);
      fabricCanvas.current?.renderAll();
    }
  };

  const handleFontFamilyChange = (family: string) => {
    setFontFamily(family);
    if (selectedObject instanceof IText) {
      selectedObject.set("fontFamily", family);
      fabricCanvas.current?.renderAll();
    }
  };

  const handleTextColorChange = (color: string) => {
    setTextColor(color);
    if (selectedObject) {
      selectedObject.set("fill", color);
      if (selectedObject instanceof Line) {
        selectedObject.set("stroke", color);
      }
      fabricCanvas.current?.renderAll();
    }
  };

  const toggleBold = () => {
    const nextBold = !isBold;
    setIsBold(nextBold);
    if (selectedObject instanceof IText) {
      selectedObject.set("fontWeight", nextBold ? "bold" : "normal");
      fabricCanvas.current?.renderAll();
    }
  };

  const handleTextDetectionAtPointer = (opt: any) => {
    if (!opt.pointer || !fabricCanvas.current) return;
    const { x, y } = opt.pointer;

    // Find text item at this position
    // PDF.js coordinates are origin bottom-left? No, the viewport transforms them.
    // viewport.transform is [scale, 0, 0, -scale, 0, height] usually

    // Simplistic hit test
    const found = textItems.find((item) => {
      // item.transform is [a, b, c, d, e, f]
      // [scale, 0, 0, scale, left, top] is the usual transform for text
      // But pdfjs-dist transform is different.
      // Let's use a simpler approach: text layers in pdfjs are complex.
      // For this demo, we'll implement a robust manual white-out + insert.
      return false;
    });

    if (found) {
      // In a real advanced app, we'd overlay here.
      // For now, I'll provide a high-precision "Erase and Replace" tool.
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      setFileName(file.name);
      const arrayBuffer = await file.arrayBuffer();
      // Store a copy as Uint8Array to avoid detachment issues and ensure persistence
      setPdfBytes(new Uint8Array(arrayBuffer.slice(0)));
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      renderPage(pdf, 1);
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast.error("Failed to load PDF. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const saveCurrentPageObjects = (pageNum?: number) => {
    if (!fabricCanvas.current) return;

    fabricCanvas.current.discardActiveObject();
    fabricCanvas.current.renderAll();

    const objects = fabricCanvas.current
      .getObjects()
      .filter((obj) => !(obj as any).data?.isBackground);

    const serialized = objects.map((obj) => obj.toObject(["data"]));

    // ✅ Use passed pageNum OR fall back to currentPage
    const targetPage = pageNum ?? currentPage;

    setPageObjects((prev) => ({
      ...prev,
      [targetPage]: {
        objects: serialized,
        uiWidth: fabricCanvas.current?.width || 800,
      },
    }));

    // ✅ Return serialized data for immediate use (avoids stale state)
    return { objects: serialized, uiWidth: fabricCanvas.current?.width || 800 };
  };

  const loadPageObjects = (pageNum: number, currentUiWidth: number) => {
    if (!fabricCanvas.current) return;
    const data = pageObjects[pageNum];
    if (!data) return;

    const objectsData = Array.isArray(data) ? data : data?.objects || [];
    const savedUiWidth = Array.isArray(data)
      ? fabricCanvas.current.width || 800
      : data?.uiWidth || 800;

    const resizeModifier = currentUiWidth / savedUiWidth;

    for (const data of objectsData) {
      let obj: FabricObject;
      // Basic scaling options
      const baseOptions = {
        ...data,
        left: (data.left || 0) * resizeModifier,
        top: (data.top || 0) * resizeModifier,
      };

      if (data.type === "i-text" || data.type === "text") {
        obj = new IText(data.text || "", {
          ...baseOptions,
          scaleX: (data.scaleX || 1) * resizeModifier,
          scaleY: (data.scaleY || 1) * resizeModifier,
        });
      } else if (data.type === "rect") {
        obj = new Rect({
          ...baseOptions,
          scaleX: (data.scaleX || 1) * resizeModifier,
          scaleY: (data.scaleY || 1) * resizeModifier,
        });
      } else if (data.type === "circle") {
        obj = new Circle({
          ...baseOptions,
          scaleX: (data.scaleX || 1) * resizeModifier,
          scaleY: (data.scaleY || 1) * resizeModifier,
        });
      } else if (data.type === "line") {
        const lineCoords: [number, number, number, number] = [
          (data.x1 || 0) * resizeModifier,
          (data.y1 || 0) * resizeModifier,
          (data.x2 || 0) * resizeModifier,
          (data.y2 || 0) * resizeModifier,
        ];
        // Lines don't use scaleX/Y for their length by default in our app, they use coords
        obj = new Line(lineCoords, { ...baseOptions, scaleX: 1, scaleY: 1 });
      } else continue;

      fabricCanvas.current.add(obj);
    }
  };

  const renderPage = async (
    pdf: any,
    pageNum: number,
    keepObjects: boolean = false,
  ) => {
    if (!fabricCanvas.current) return;

    try {
      const page = await pdf.getPage(pageNum);
      const fCanvas = fabricCanvas.current;

      const unscaledViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / unscaledViewport.width;
      const viewport = page.getViewport({ scale });
      setViewportScale(scale);

      const offscreenCanvas = document.createElement("canvas");
      const context = offscreenCanvas.getContext("2d");
      if (!context) return;

      offscreenCanvas.height = viewport.height;
      offscreenCanvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;

      // Extract text content
      const textContent = await page.getTextContent();

      if (!fabricCanvas.current) return;
      setTextItems(textContent.items as any);

      const bgImage = offscreenCanvas.toDataURL("image/png");
      const img = await FabricImage.fromURL(bgImage);

      if (!fabricCanvas.current) return;

      fCanvas.clear();
      fCanvas.setDimensions({
        width: Math.floor(viewport.width),
        height: Math.floor(viewport.height),
      });

      img.set({
        selectable: false,
        evented: false,
        data: { isBackground: true },
        left: 0,
        top: 0,
        originX: "left",
        originY: "top",
      });
      fCanvas.add(img);
      fCanvas.sendObjectToBack(img);

      if (keepObjects) {
        loadPageObjects(pageNum, viewport.width);
      }

      fCanvas.renderAll();
    } catch (error) {
      console.error("Error rendering page:", error);
    }
  };

  const changePage = async (offset: number) => {
    if (!pdfDoc) return;
    const newPage = currentPage + offset;
    if (newPage >= 1 && newPage <= numPages) {
      setIsLoading(true);

      // ✅ Pass currentPage explicitly before it changes
      saveCurrentPageObjects(currentPage);

      setCurrentPage(newPage);
      await renderPage(pdfDoc, newPage, true);
      setIsLoading(false);
      toast.success(`Switched to page ${newPage}`);
    }
  };

  const addWhiteOut = () => {
    if (!fabricCanvas.current) return;
    const rect = new Rect({
      left: 100,
      top: 100,
      fill: "#ffffff",
      width: 150,
      height: 30,
      stroke: "#e2e8f0",
      strokeWidth: 1,
      strokeDashArray: [5, 5],
    });
    fabricCanvas.current.add(rect);
    fabricCanvas.current.setActiveObject(rect);
    toast("Position the white-out box over the text you want to hide.");
  };

  const addText = () => {
    if (!fabricCanvas.current) return;
    const text = new IText("Enter New Text", {
      left: 100,
      top: 100,
      fontFamily: fontFamily,
      fontSize: fontSize,
      fill: textColor,
      fontWeight: isBold ? "bold" : "normal",
    });
    fabricCanvas.current.add(text);
    fabricCanvas.current.setActiveObject(text);
  };

  const addReplaceTool = () => {
    if (!fabricCanvas.current) return;

    // Advanced UI: Create a 'Text Patch'
    // A white rect matched to text height + editable text on top
    const text = new IText("Replace Text", {
      left: 105,
      top: 105,
      fontSize: 18,
      fontFamily: fontFamily,
      fill: textColor,
    });

    const rect = new Rect({
      left: 100,
      top: 100,
      fill: "#ffffff",
      width: 150,
      height: 30,
      stroke: "#e2e8f0",
      strokeWidth: 1,
      strokeDashArray: [4, 4],
    });

    fabricCanvas.current.add(rect);
    fabricCanvas.current.add(text);
    fabricCanvas.current.setActiveObject(text);

    toast.success(
      "Text Patch added. Place the white box over PDF text to 'edit' it.",
    );
  };

  const addRect = () => {
    if (!fabricCanvas.current) return;
    const rect = new Rect({
      left: 100,
      top: 100,
      fill: textColor + "44", // 25% opacity
      stroke: textColor,
      strokeWidth: 2,
      width: 100,
      height: 100,
    });
    fabricCanvas.current.add(rect);
    fabricCanvas.current.setActiveObject(rect);
  };

  const addCircle = () => {
    if (!fabricCanvas.current) return;
    const circle = new Circle({
      left: 100,
      top: 100,
      fill: textColor + "44",
      stroke: textColor,
      strokeWidth: 2,
      radius: 50,
    });
    fabricCanvas.current.add(circle);
    fabricCanvas.current.setActiveObject(circle);
  };

  const addArrow = () => {
    if (!fabricCanvas.current) return;
    const line = new Line([50, 50, 150, 50], {
      left: 100,
      top: 100,
      stroke: textColor,
      strokeWidth: 4,
    });
    fabricCanvas.current.add(line);
    fabricCanvas.current.setActiveObject(line);
  };

  const deleteSelected = () => {
    if (!selectedObject || !fabricCanvas.current) return;
    fabricCanvas.current.remove(selectedObject);
    fabricCanvas.current.discardActiveObject();
    fabricCanvas.current.renderAll();
  };

  const downloadPdf = async () => {
    if (!pdfDoc || !fabricCanvas.current || !pdfBytes) {
      toast.error("No PDF loaded");
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading("Exporting edited PDF...");

    // ✅ Fix 1: Anchor pehle banao — browser gesture context preserve hoga
    const a = document.createElement("a");
    a.style.display = "none";
    document.body.appendChild(a);

    try {
      const canvas = fabricCanvas.current;
      canvas.discardActiveObject();
      canvas.renderAll();

      // ✅ Fix 2: Current page canvas se directly read karo — stale state bypass
      const currentObjects = canvas
        .getObjects()
        .filter((obj) => !(obj as any).data?.isBackground)
        .map((obj) => obj.toObject(["data"]));

      // ✅ Fix 3: pageObjectsRef use karo (latest data, no stale closure)
      const updatedPages: Record<number, any> = { ...pageObjectsRef.current };
      updatedPages[currentPageRef.current] = {
        objects: currentObjects,
        uiWidth: canvas.width || 800,
      };

      // ✅ Fix 4: modifiedPdfBytesRef se load karo — original nahi
      const bytesToLoad = modifiedPdfBytesRef.current ?? pdfBytes;
      const finalPdf = await PDFDocument.load(bytesToLoad);

      for (let i = 1; i <= numPages; i++) {
        const pageData = updatedPages[i];
        if (!pageData?.objects?.length) continue;

        const pdfPage = await pdfDoc.getPage(i);

        // ✅ Fix 5: High-res render — export scale 2x
        const exportScale = 2;
        const viewport = pdfPage.getViewport({ scale: exportScale });

        const renderCanvas = document.createElement("canvas");
        renderCanvas.width = Math.ceil(viewport.width);
        renderCanvas.height = Math.ceil(viewport.height);

        const ctx = renderCanvas.getContext("2d");
        if (!ctx) continue;

        await pdfPage.render({ canvasContext: ctx, viewport }).promise;

        // ✅ Fix 6: StaticCanvas — viewport size pe, PDF size nahi
        const tempCanvasEl = document.createElement("canvas");
        const tempCanvas = new StaticCanvas(tempCanvasEl, {
          width: renderCanvas.width,
          height: renderCanvas.height,
          enableRetinaScaling: false,
          renderOnAddRemove: false,
          backgroundColor: "transparent",
        });

        // ✅ Fix 7: Background image bina scale ke add karo — same size hai
        const bgImage = await FabricImage.fromURL(
          renderCanvas.toDataURL("image/png"),
        );
        bgImage.set({
          left: 0,
          top: 0,
          selectable: false,
          evented: false,
          scaleX: 1,
          scaleY: 1, // ✅ no scaling needed — same dimensions
          originX: "left",
          originY: "top",
        });
        tempCanvas.add(bgImage);

        // ✅ Fix 8: Objects ko viewport size ke against scale karo
        const savedUiWidth = pageData.uiWidth || 800;
        const scaleFactor = renderCanvas.width / savedUiWidth;

        const enlivenedObjects = await util.enlivenObjects(pageData.objects);
        enlivenedObjects.forEach((obj: any) => {
          obj.scaleX = (obj.scaleX || 1) * scaleFactor;
          obj.scaleY = (obj.scaleY || 1) * scaleFactor;
          obj.left = (obj.left || 0) * scaleFactor;
          obj.top = (obj.top || 0) * scaleFactor;
          tempCanvas.add(obj);
        });

        tempCanvas.renderAll();
        // Render complete hone ka wait karo
        await new Promise((resolve) => setTimeout(resolve, 50));

        // ✅ Fix 9: Uint8Array banao — embedPng ko string nahi chahiye
        const mergedDataUrl = tempCanvas.toDataURL({
          format: "png",
          multiplier: 1,
        });
        const base64 = mergedDataUrl.replace(/^data:image\/png;base64,/, "");
        const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

        const embeddedImage = await finalPdf.embedPng(pngBytes); // ✅ Uint8Array

        // ✅ Fix 10: PDF page ke actual size pe draw karo
        const page = finalPdf.getPage(i - 1);
        const { width, height } = page.getSize();
        page.drawImage(embeddedImage, { x: 0, y: 0, width, height });

        tempCanvas.dispose();
      }

      const finalBytes = await finalPdf.save();

      // ✅ Fix 11: Modified bytes save karo — agla download original nahi lega
      modifiedPdfBytesRef.current = finalBytes;

      const blob = new Blob([new Uint8Array(finalBytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const safeName = fileName.replace(/\.[^/.]+$/, "");

      a.href = url;
      a.download = `EDITED_${safeName}_${Date.now()}.pdf`;
      a.click();

      setTimeout(() => {
        URL.revokeObjectURL(url);
        if (document.body.contains(a)) document.body.removeChild(a);
      }, 5000);

      toast.success("Edited PDF downloaded", { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Export failed", { id: toastId });
      if (document.body.contains(a)) document.body.removeChild(a);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto space-y-6 md:space-y-8 px-4 md:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 md:pb-6">
        <div className="space-y-1">
          <h1 className="text-xl md:text-3xl font-bold tracking-tight text-slate-900">
            Advanced PDF Editor
          </h1>
          <p className="text-[11px] md:text-sm text-slate-500 font-medium">
            Text reconstruction and architectural document manipulation.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={downloadPdf}
            disabled={!pdfDoc}
            className="w-full md:w-auto flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-2 md:py-3 text-[10px] md:text-[12px] font-bold uppercase tracking-widest text-white transition-all hover:bg-primary-hover disabled:opacity-30 shadow-lg shadow-indigo-100"
          >
            <Download size={14} className="md:w-4 md:h-4" /> Export Document
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 rounded-md border border-slate-200 bg-white p-2 md:p-3 md:px-6 shadow-sm min-h-[64px]">
              <div className="flex items-center gap-1.5 md:gap-2 flex-wrap justify-center md:justify-start">
                <button
                  onClick={addText}
                  disabled={!pdfDoc}
                  className="flex items-center gap-1.5 md:gap-2 rounded-sm px-2 md:px-4 py-2 hover:bg-slate-50 text-slate-700 text-[9px] md:text-[11px] font-bold uppercase tracking-widest disabled:opacity-30 transition-all active:scale-95 whitespace-nowrap"
                  title="Add New Text"
                >
                  <Type size={14} className="md:w-4 md:h-4" />{" "}
                  <span className="sm:inline">Add Text</span>
                </button>
                <button
                  onClick={addReplaceTool}
                  disabled={!pdfDoc}
                  className="flex items-center gap-1.5 md:gap-2 rounded-sm px-2 md:px-4 py-2 hover:bg-indigo-50 text-indigo-600 text-[9px] md:text-[11px] font-bold uppercase tracking-widest disabled:opacity-30 transition-all active:scale-95 whitespace-nowrap"
                  title="Mask & Replace Text"
                >
                  <Layers size={14} className="md:w-4 md:h-4" />{" "}
                  <span className="sm:inline">Replace Text</span>
                </button>
                <button
                  onClick={addWhiteOut}
                  disabled={!pdfDoc}
                  className="flex items-center gap-1.5 md:gap-2 rounded-sm px-2 md:px-4 py-2 hover:bg-slate-50 text-slate-700 text-[9px] md:text-[11px] font-bold uppercase tracking-widest disabled:opacity-30 transition-all active:scale-95 whitespace-nowrap"
                  title="White Out Area"
                >
                  <Eraser size={14} className="md:w-4 md:h-4" />{" "}
                  <span className="sm:inline">White-out</span>
                </button>

                <div className="h-6 w-px bg-slate-200 mx-1 md:mx-2 shrink-0 hidden md:block" />

                <div className="flex items-center gap-1 md:gap-2">
                  <button
                    onClick={addRect}
                    disabled={!pdfDoc}
                    className="p-1.5 md:p-2 hover:bg-slate-50 rounded-md text-slate-600 disabled:opacity-30 transition-all active:scale-95"
                    title="Rectangle"
                  >
                    <Square size={16} className="md:w-[18px] md:h-[18px]" />
                  </button>
                  <button
                    onClick={addCircle}
                    disabled={!pdfDoc}
                    className="p-1.5 md:p-2 hover:bg-slate-50 rounded-md text-slate-600 disabled:opacity-30 transition-all active:scale-95"
                    title="Circle"
                  >
                    <CircleIcon size={16} className="md:w-[18px] md:h-[18px]" />
                  </button>
                  <button
                    onClick={addArrow}
                    disabled={!pdfDoc}
                    className="p-1.5 md:p-2 hover:bg-slate-50 rounded-md text-slate-600 disabled:opacity-30 transition-all active:scale-95"
                    title="Arrow"
                  >
                    <MoveRight size={16} className="md:w-[18px] md:h-[18px]" />
                  </button>
                </div>

                <div className="h-6 w-px bg-slate-200 mx-1 md:mx-2 shrink-0 hidden lg:block" />

                <button
                  onClick={deleteSelected}
                  disabled={!selectedObject}
                  className="flex items-center gap-1.5 md:gap-2 rounded-sm px-2 md:px-4 py-2 hover:bg-red-50 text-red-500 text-[9px] md:text-[11px] font-bold uppercase tracking-widest disabled:opacity-30 transition-all active:scale-95 whitespace-nowrap"
                >
                  <Trash2 size={14} className="md:w-4 md:h-4" />{" "}
                  <span className="sm:inline">Delete</span>
                </button>
              </div>

              {pdfDoc && (
                <div className="flex items-center justify-center gap-3 md:gap-6 bg-slate-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-slate-100 mt-2 md:mt-0">
                  <button
                    onClick={() => changePage(-1)}
                    disabled={currentPage === 1}
                    className="p-1 rounded-full hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all active:scale-90"
                  >
                    <ArrowLeft size={16} className="text-slate-600" />
                  </button>
                  <div className="flex flex-col items-center min-w-[50px] md:min-w-[60px]">
                    <span className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.15em] text-slate-400 leading-none mb-0.5">
                      Page
                    </span>
                    <span className="text-[11px] md:text-[14px] font-bold text-indigo-600 tabular-nums leading-none">
                      {currentPage}{" "}
                      <span className="text-slate-300 font-medium whitespace-pre">
                        /
                      </span>{" "}
                      {numPages}
                    </span>
                  </div>
                  <button
                    onClick={() => changePage(1)}
                    disabled={currentPage === numPages}
                    className="p-1 rounded-full hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all active:scale-90"
                  >
                    <ArrowRight size={16} className="text-slate-600" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div
            ref={workspaceRef}
            className="relative overflow-auto rounded-md border border-slate-200 bg-slate-100/50 flex justify-center shadow-inner h-[calc(100vh-320px)] min-h-[500px] md:min-h-[600px] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent"
          >
            {!pdfDoc && !isLoading && (
              <div
                id="pdf-empty-state"
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-white"
              >
                <div className="rounded-sm bg-indigo-50 border border-indigo-100 p-8 text-primary shadow-sm shadow-indigo-50">
                  <FileText size={48} strokeWidth={1.5} />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-lg font-bold text-slate-900 tracking-tight">
                    System Idle: No Document Active
                  </p>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                    Import a PDF to initialize the rendering engine
                  </p>
                </div>
                <button
                  id="pdf-upload-btn"
                  onClick={() =>
                    document.getElementById("pdf-edit-upload")?.click()
                  }
                  className="rounded-md bg-primary px-12 py-3 text-[12px] font-bold uppercase tracking-widest text-white transition-all hover:bg-primary-hover shadow-lg hover:shadow-indigo-100"
                >
                  Import PDF Document
                </button>
              </div>
            )}

            {isLoading && (
              <div
                id="pdf-loading-state"
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white/80 backdrop-blur-sm"
              >
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 animate-pulse">
                  Scanning Document Structures...
                </p>
              </div>
            )}

            <div
              id="pdf-canvas-container"
              className="shadow-2xl border border-slate-100 bg-white transition-all my-8"
            >
              <canvas ref={canvasRef} />
            </div>
            <input
              id="pdf-edit-upload"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handlePdfUpload}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-md border border-slate-200 bg-white p-6 space-y-6 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
              <MousePointer2 size={14} /> Element Inspector
            </h3>

            {selectedObject ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {selectedObject instanceof IText && (
                  <>
                    {/* Font Selection */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                        <CaseSensitive size={14} /> Typography
                      </label>
                      <select
                        value={fontFamily}
                        onChange={(e) => handleFontFamilyChange(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-primary/30"
                      >
                        {FONTS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Font Size & Weight */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                          Scale & Weight
                        </label>
                        <span className="text-xs font-mono text-slate-500">
                          {fontSize}px
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="8"
                          max="120"
                          value={fontSize}
                          onChange={(e) =>
                            handleFontSizeChange(parseInt(e.target.value))
                          }
                          className="flex-1 accent-primary h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                        />
                        <button
                          onClick={toggleBold}
                          className={cn(
                            "p-2 rounded-md border transition-all",
                            isBold
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                          )}
                        >
                          <Bold size={16} />
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Color Selection */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                    <Palette size={14} /> Color Palette
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 rounded-md bg-slate-50 border border-slate-100">
                    {[
                      "#000000",
                      "#ffffff",
                      "#4338ca",
                      "#ef4444",
                      "#22c55e",
                      "#eab308",
                      "#6366f1",
                      "#ec4899",
                    ].map((c) => (
                      <button
                        key={c}
                        onClick={() => handleTextColorChange(c)}
                        className={cn(
                          "w-6 h-6 rounded-full border border-slate-300 shadow-sm transition-transform hover:scale-110",
                          textColor === c &&
                            "ring-2 ring-primary ring-offset-2 scale-110",
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <div className="relative w-6 h-6 rounded-full border border-slate-300 shadow-sm overflow-hidden group">
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => handleTextColorChange(e.target.value)}
                        className="absolute -inset-1 w-8 h-8 cursor-pointer opacity-0"
                      />
                      <div className="w-full h-full bg-gradient-to-tr from-red-500 via-green-500 to-blue-500" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={deleteSelected}
                    className="w-full py-2.5 rounded-md border border-red-200 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={14} /> Remove Element
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-8 text-center animate-in fade-in duration-500">
                <div className="mx-auto w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-4">
                  <MousePointer2 size={20} className="text-slate-300" />
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500 font-medium max-w-[200px] mx-auto">
                  Select a text or shape layer to modify its global properties
                  and visual descriptors.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
              <Search size={14} /> Intelligence Insights
            </h3>
            <div className="space-y-3">
              <div className="p-4 rounded-md bg-indigo-900 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-indigo-400" />
                  <p className="text-[10px] font-bold uppercase text-white tracking-wider">
                    Modification Engine
                  </p>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300 font-medium font-sans">
                  Use the{" "}
                  <span className="text-white font-bold">Replace Text</span>{" "}
                  tool to overlay high-fidelity text masks on existing document
                  segments.
                </p>
              </div>
              <div className="p-4 rounded-md bg-slate-50 border border-slate-100 space-y-1.5 grayscale opacity-70">
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Detected Metadata
                </p>
                <p className="text-[11px] leading-relaxed text-slate-600 font-medium font-sans">
                  {textItems.length} text fragments identified in current
                  viewport buffer.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
