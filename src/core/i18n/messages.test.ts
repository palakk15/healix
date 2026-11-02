import { describe, expect, it } from "vitest";
import enApp from "./messages/en/app.json";
import enCommon from "./messages/en/common.json";
import enHospital from "./messages/en/hospital.json";
import enLanding from "./messages/en/landing.json";
import enStyleguide from "./messages/en/styleguide.json";
import hiApp from "./messages/hi/app.json";
import hiCommon from "./messages/hi/common.json";
import hiHospital from "./messages/hi/hospital.json";
import hiLanding from "./messages/hi/landing.json";
import mrApp from "./messages/mr/app.json";
import mrCommon from "./messages/mr/common.json";
import mrHospital from "./messages/mr/hospital.json";
import mrLanding from "./messages/mr/landing.json";
import hinglishApp from "./messages/hinglish/app.json";
import hinglishCommon from "./messages/hinglish/common.json";
import hinglishHospital from "./messages/hinglish/hospital.json";
import hinglishLanding from "./messages/hinglish/landing.json";

type Tree = { [key: string]: string | boolean | Tree };

const en: Tree = { ...enCommon, ...enLanding, ...enApp, ...enHospital, ...enStyleguide };
const hi: Tree = { ...hiCommon, ...hiLanding, ...hiApp, ...hiHospital };
const mr: Tree = { ...mrCommon, ...mrLanding, ...mrApp, ...mrHospital };
const hinglish: Tree = { ...hinglishCommon, ...hinglishLanding, ...hinglishApp, ...hinglishHospital };

const locales: Record<string, Tree> = { en, hi, mr, hinglish };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    if (key === "_review") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result[path] = value;
    else if (typeof value === "object") Object.assign(result, flatten(value, path));
  }
  return result;
}

const bannedPatterns: Array<[string, RegExp]> = [
  ["you have", /\byou have\b/i],
  ["diagnosis:", /diagnosis\s*:/i],
  ["medicine dose", /\b\d+(\.\d+)?\s?(mg|mcg|ml|tablets?|capsules?)\b/i],
];

describe("locale files", () => {
  const english = flatten(en);

  for (const [name, tree] of Object.entries(locales)) {
    const flat = flatten(tree);

    it(`${name} has no keys missing from English`, () => {
      const unknown = Object.keys(flat).filter((key) => !(key in english));
      expect(unknown).toEqual([]);
    });

    it(`${name} avoids banned wording`, () => {
      for (const [path, text] of Object.entries(flat)) {
        for (const [label, pattern] of bannedPatterns) {
          expect(pattern.test(text), `${name}:${path} contains "${label}"`).toBe(false);
        }
      }
    });

    it(`${name} has no empty strings`, () => {
      for (const [path, text] of Object.entries(flat)) {
        expect(text.trim().length, `${name}:${path} is empty`).toBeGreaterThan(0);
      }
    });
  }

  it("keeps the same keys across hi, mr and hinglish for shared namespaces", () => {
    const shared = Object.keys(flatten(hi));
    expect(Object.keys(flatten(mr)).sort()).toEqual(shared.sort());
    expect(Object.keys(flatten(hinglish)).sort()).toEqual(shared.sort());
  });
});
