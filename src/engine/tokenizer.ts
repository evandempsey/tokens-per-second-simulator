import { encode, decode } from "gpt-tokenizer/model/gpt-4o";

export function tokenize(text: string): number[] {
  return encode(text);
}

export function detokenize(tokens: number[]): string {
  return decode(tokens);
}
