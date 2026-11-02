import { describe, expect, it } from "vitest";
import { conditionKey, toggleCondition } from "./conditions";

describe("conditions", () => {
  it("maps stored names to message keys and ignores unknown ones", () => {
    expect(conditionKey("Type 2 diabetes")).toBe("diabetes");
    expect(conditionKey("Something rare")).toBeNull();
  });

  it("adds and removes a condition without changing the original list", () => {
    const start = ["Asthma"];
    expect(toggleCondition(start, "Hypertension")).toEqual(["Asthma", "Hypertension"]);
    expect(toggleCondition(start, "Asthma")).toEqual([]);
    expect(start).toEqual(["Asthma"]);
  });
});
