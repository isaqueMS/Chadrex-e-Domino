
import { GoogleGenAI } from "@google/genai";

// Initialize the Google GenAI client correctly with the API Key
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeChessMove(fen: string, history: any[]) {
  try {
    // Correctly call generateContent with both model and contents
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze this chess position (FEN): ${fen}. Recent moves: ${JSON.stringify(history.slice(-5))}. Provide a brief strategic advice in Portuguese.`,
    });
    // Access the text property directly as per the latest SDK guidelines
    return response.text;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return "Erro ao analisar posição.";
  }
}

export async function analyzeDominoMove(board: any[], hand: any[]) {
  try {
    // Correctly call generateContent with both model and contents
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze this domino game state. Board: ${JSON.stringify(board)}. Hand: ${JSON.stringify(hand)}. Provide a brief tactical suggestion in Portuguese.`,
    });
    // Access the text property directly
    return response.text;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return "Erro ao analisar jogo.";
  }
}
