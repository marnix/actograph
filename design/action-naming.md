# Action Naming

How to give each action a unique, human-friendly, stable identifier.

**Status**: Implemented in `src/domain/action-id.ts` — 7-character CVCVCVC strings with profanity filtering via `cuss`.

## Requirements

- **Stable**: does not change when the action is edited
- **Memorable**: easy to recall after seeing it once
- **Typeable**: lowercase only, no digit/letter mix, short
- **Meaningless**: should not suggest meaning or priority
- **Prefix-matchable**: any unique prefix can be used as shorthand (like jj change IDs)

## Approaches Considered

### 1. Random letter strings (jj-style)

Generate random lowercase letters: `xkqm`, `rvnp`, `zlmt`.

- Pros: simple, compact, prefix-matching is natural
- Cons: not pronounceable, hard to remember beyond ~4 chars, hard to communicate verbally
- Capacity: 4 chars = 26⁴ ≈ 457k; 6 chars = 26⁶ ≈ 309M

### 2. Consonant-vowel syllables (proquint-inspired)

Alternate consonants and vowels: `topanik`, `bafomez`, `kiluzar`.

- Pros: pronounceable, memorable, easy to type, easy to say aloud
- Cons: smaller keyspace per character, occasional real-word collisions
- Capacity (CVCVCVC, 7 chars): ~58M with 18 consonants and 5 vowels
- Capacity (CVCVC, 5 chars): ~231k

### 3. Word pairs

Two short dictionary words: `bold-fox`, `calm-rain`.

- Pros: very memorable, easy to communicate
- Cons: suggests meaning (people read into `angry-bug`), longer to type, prefix-matching is awkward across the hyphen, requires a word list to ship/maintain

### 4. Letters-only base-32

Use an unambiguous letter subset (dropping i/l/o/u): `abcdefghjkmnpqrstvwxyz`.

- Pros: compact, no digit/letter confusion
- Cons: not pronounceable, essentially the same as approach 1 with a smaller alphabet

## Recommendation

**Approach 2: consonant-vowel syllables**, with jj-style prefix matching.

The alternating pattern makes IDs pronounceable and therefore memorable, while staying meaningless and compact. Users typically type just 3–4 characters to uniquely identify an action.

## Offensive Words

Consonant-vowel patterns will occasionally produce real words, including potentially offensive ones in various languages.

### Analysis

Using the [`cuss`](https://www.npmjs.com/package/cuss) package (multi-language profanity lists with sureness ratings, covering English, French, Spanish, Italian, Portuguese, and Arabic — ~5700 words total), combined with [`profane-words`](https://www.npmjs.com/package/profane-words):

- ~490 profane words can appear as substrings of CVCVCVC strings
- Breakdown by length: 4×2-letter, 54×3-letter, 117×4-letter, 137×5-letter, 130×6-letter, 48×7-letter

Rejection rates when filtering generated IDs:

| Filter strategy       | Words checked | Rejection rate | Regenerations per ID |
| --------------------- | ------------- | -------------- | -------------------- |
| All substring matches | 490           | ~23%           | ~1.3                 |
| Only words ≥ 3 chars  | 486           | ~13%           | ~1.15                |
| Only words ≥ 4 chars  | 432           | ~2.7%          | ~1.03                |
| Only words ≥ 5 chars  | 315           | ~0.2%          | ~1.002               |

### Recommendation

Filter on profane substrings ≥ 3 characters. A ~13% rejection rate means regenerating roughly 1 in 8 times — invisible to the user since generation is instant. The 2-letter matches (`fu`, `ho`, `bi`) are borderline, but 3-letter ones like `fag`, `cum`, `nig`, `jap` are important to catch.

Use `cuss` as the primary word list because it is multi-language, has sureness ratings (filter on rating ≥ 1 to reduce false positives from words like `beaver` or `god`), is MIT licensed, and has TypeScript types.

Additionally, a `regenerate` command could be considered in the future, allowing users to replace any ID they find objectionable — since no blocklist is ever complete across all languages and slang.

## Open Questions

- Exact ID length: start with 5 chars (CVCVC, ~231k) and grow to 7 when needed? Or always 7?
- Should the ID be derived from a random seed stored with the action (reproducible) or purely random?
- How to handle prefix collisions as the action count grows: warn, or auto-extend the display length?
