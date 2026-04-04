# Action Naming

How to give each action a unique, human-friendly, stable identifier.

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

Consonant-vowel patterns will occasionally produce real words, including potentially offensive ones in various languages. Mitigation options:

1. **Blocklist**: maintain a list of known offensive strings (across major languages) and reject/regenerate on match. Simple and effective for the most common cases, but never complete — there are too many languages and cultural contexts.

2. **Restrict the alphabet**: drop certain consonants to make offensive words less likely. For example, removing `f`, `s`, `c`, `k` eliminates many English profanities, but also shrinks the keyspace significantly and doesn't help for other languages.

3. **Accept and document**: acknowledge that with random generation, occasional unfortunate strings will appear. Provide a `rename` or `regenerate` command so users can replace an ID they find objectionable. This is the pragmatic approach — no blocklist is ever complete across all languages and slang.

4. **Hybrid**: use a small blocklist for the most obvious English/European profanities, combined with a regenerate command as a safety net.

**Recommendation**: option 4 (small blocklist + regenerate command). A short blocklist catches the worst cases with minimal maintenance, and the regenerate escape hatch handles everything else. The blocklist doesn't need to be perfect — it just needs to prevent the most jarring first impressions.

Note: regenerating an ID means all references to the old ID (in scripts, notes, etc.) break. This is an acceptable trade-off since it should be rare and only done deliberately by the user.

## Open Questions

- Exact ID length: start with 5 chars (CVCVC, ~231k) and grow to 7 when needed? Or always 7?
- Should the ID be derived from a random seed stored with the action (reproducible) or purely random?
- How to handle prefix collisions as the action count grows: warn, or auto-extend the display length?
