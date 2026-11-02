import "@testing-library/jest-dom/vitest";
import { loadMessageGroups, messageGroups } from "@core/i18n";
import { i18n } from "./i18n";

await loadMessageGroups(i18n, "en", messageGroups);
