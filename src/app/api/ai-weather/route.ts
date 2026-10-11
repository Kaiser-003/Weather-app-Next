
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { city, weather } = body;

    if (
      typeof city !== "string" ||
      !city.trim() ||
      !weather?.daily ||
      !Array.isArray(weather.daily.time) ||
      !Array.isArray(weather.daily.precipitation_probability_max)
    ) {
      return NextResponse.json(
        { error: "Valid city and daily forecast data are required." },
        { status: 400 }
      );
    }

    const probabilities: number[] =
      weather.daily.precipitation_probability_max.filter(
        (value: unknown): value is number =>
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= 0 &&
          value <= 100
      );

    if (probabilities.length === 0) {
      return NextResponse.json({
        risk: "Unavailable",
        highestProbability: null,
        prediction: "Rain probability data is unavailable.",
      });
    }

    const highestProbability = Math.max(...probabilities);

    const risk =
      highestProbability < 30
        ? "Low"
        : highestProbability <= 60
          ? "Moderate"
          : "High";

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemma-4-26b-a4b-it",
      contents: `
Write a concise weather insight for ${city} in 1–2 sentences.
The highest supplied daily precipitation probability is ${highestProbability}%.
The calculated rain risk is ${risk}.

Explain the rain outlook using only these supplied values.
Give brief umbrella advice. Do not change the risk label or invent data.
Do not use Markdown formatting.
`,
    });

    return NextResponse.json({
      risk,
      highestProbability,
      prediction:
        response.text?.trim() ||
        `The highest daily rain probability is ${highestProbability}%.`,
    });
  } catch (error) {
    console.error("AI weather prediction error:", error);

    return NextResponse.json(
      { error: "Unable to generate the AI weather summary." },
      { status: 500 }
    );
  }
}
