import { randomInt } from "crypto";
import { cuss } from "cuss";
import { cuss as cussFr } from "cuss/fr";
import { cuss as cussEs } from "cuss/es";
import { cuss as cussIt } from "cuss/it";

const CONSONANTS = "bcdfghjklmnprstvwxz";
const VOWELS = "aeiou";
const ID_LENGTH = 7;

// Profane words (≥3 chars, sureness ≥1) that could appear as substrings of CV strings
const profaneWords = buildProfaneSubstrings();

function buildProfaneSubstrings(): string[] {
  const allWords: Record<string, number> = {
    ...cuss,
    ...cussFr,
    ...cussEs,
    ...cussIt,
  };
  const cSet = new Set(CONSONANTS);
  const vSet = new Set(VOWELS);

  return Object.entries(allWords)
    .filter(([, rating]) => rating >= 1)
    .map(([word]) => word.toLowerCase())
    .filter((word) => word.length >= 3 && word.length <= ID_LENGTH)
    .filter((word) => {
      // Check if word could appear as substring at either CV alignment
      for (let offset = 0; offset < 2; offset++) {
        let fits = true;
        for (let i = 0; i < word.length; i++) {
          const expectConsonant = (i + offset) % 2 === 0;
          const ch = word.charAt(i);
          if (expectConsonant ? !cSet.has(ch) : !vSet.has(ch)) {
            fits = false;
            break;
          }
        }
        if (fits) return true;
      }
      return false;
    });
}

function randomCV(): string {
  let id = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    const chars = i % 2 === 0 ? CONSONANTS : VOWELS;
    id += chars[randomInt(chars.length)];
  }
  return id;
}

function containsProfanity(id: string): boolean {
  return profaneWords.some((word) => id.includes(word));
}

export function generateSlug(existingSlugs?: Set<string>): string {
  let slug: string;
  do {
    slug = randomCV();
  } while (containsProfanity(slug) || existingSlugs?.has(slug));
  return slug;
}
