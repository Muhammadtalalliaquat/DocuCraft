import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not defined in environment variables.");
}

export const genAI = new GoogleGenAI({
  apiKey: apiKey || "",
});

export async function analyzeFile(fileData: string, mimeType: string, prompt: string) {
  const model = "gemini-3-flash-preview";
  
  try {
    const response = await genAI.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: fileData,
                mimeType,
              },
            },
          ],
        },
      ],
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
}
