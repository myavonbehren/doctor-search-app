import { google } from "@ai-sdk/google";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

// Validate API key is set (only in non-test environments)
if (!isTestEnvironment) {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn(
      "Warning: GOOGLE_GENERATIVE_AI_API_KEY or GOOGLE_API_KEY not found in environment variables. Google API calls will fail."
    );
  }
}

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "chat-model": google("gemini-2.5-flash"),
        "chat-model-reasoning": wrapLanguageModel({
          model: google("gemini-2.5-pro"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": google("gemini-2.5-flash-lite"),
      },
    });
