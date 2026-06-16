import express from "express";
import cors from "cors";
import multer from "multer";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

const app = express();

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

      console.log(
        `Converting ${files?.length} images. Orientation: ${orientation}`,
      );

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
  },
);

// Export the Express app for Vercel Serverless Functions
export default app;
