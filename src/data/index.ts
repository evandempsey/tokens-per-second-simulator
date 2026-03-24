import { simpleQA } from "./simple-qa";
import { codeExplanation } from "./code-explanation";
import { agenticCoding } from "./agentic-coding";
import { creativeWriting } from "./creative-writing";
import { explainKubernetes } from "./explain-kubernetes";
import { rustOwnership } from "./rust-ownership";
import { refactorApi } from "./refactor-api";
import { sciFiStory } from "./sci-fi-story";
import { debugMemoryLeak } from "./debug-memory-leak";
import { explainMlBasics } from "./explain-ml-basics";
import type { SampleConversation } from "../types";

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const conversations: SampleConversation[] = shuffle([
  simpleQA,
  codeExplanation,
  agenticCoding,
  creativeWriting,
  explainKubernetes,
  rustOwnership,
  refactorApi,
  sciFiStory,
  debugMemoryLeak,
  explainMlBasics,
]);
