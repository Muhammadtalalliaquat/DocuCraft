import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import cors from "cors";
import { PDFDocument, degrees } from "pdf-lib";
import sharp from "sharp";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  const storage = multer.memoryStorage();
  const upload = multer({ storage });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Image to PDF Conversion
  app.post("/api/convert/images-to-pdf", upload.array("images"), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      const { orientation = "portrait" } = req.body;
      
      console.log(`Converting ${files?.length} images. Orientation: ${orientation}`);

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No images provided" });
      }

      const pdfDoc = await PDFDocument.create();

      for (const file of files) {
        const imageBuffer = await sharp(file.buffer)
          .resize({ width: 2000, withoutEnlargement: true }) // Higher quality
          .jpeg({ quality: 90 }) // Explicit quality control
          .toBuffer();
        
        let image;
        if (file.mimetype === "image/png") {
          image = await pdfDoc.embedPng(imageBuffer);
        } else {
          image = await pdfDoc.embedJpg(imageBuffer);
        }

        // Define standard A4 dimensions (in points)
        const A4_WIDTH = 595.28;
        const A4_HEIGHT = 841.89;

        const pageWidth = orientation === "landscape" ? A4_HEIGHT : A4_WIDTH;
        const pageHeight = orientation === "landscape" ? A4_WIDTH : A4_HEIGHT;
        
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        
        const { width: imgWidth, height: imgHeight } = image.scale(1);
        
        // Calculate scale to fit image within the page boundaries while maintaining aspect ratio
        const scale = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
        
        const drawWidth = imgWidth * scale;
        const drawHeight = imgHeight * scale;
        
        // Center the image on the page
        page.drawImage(image, {
          x: (pageWidth - drawWidth) / 2,
          y: (pageHeight - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
        });
      }

      const pdfBytes = await pdfDoc.save();
      res.contentType("application/pdf");
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      console.error("Conversion error:", error);
      res.status(500).json({ error: "Failed to convert images to PDF" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
