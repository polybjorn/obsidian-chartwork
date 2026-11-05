import type { Component } from "obsidian";
import type { ChartConfiguration } from "chart.js";
import type { ChartSpec } from "../engine/spec.ts";
import { shapeOf, unwrapRaw } from "./raw.ts";
import type { ChartInput } from "./raw.ts";
import { specHint, validateSpec } from "./validate.ts";

export interface RenderHandle {
  /** Takes the same shape the chart was made with: a spec for a spec, a config for a config. */
  update(next: ChartInput): void;
  destroy(): void;
}

/** What the engine provides; passed in so the dispatch here can be tested without Obsidian. */
export interface Drawers {
  spec(el: HTMLElement, spec: ChartSpec, owner: Component): { update(next: ChartSpec): void; destroy(): void };
  config(el: HTMLElement, config: ChartConfiguration, owner: Component, width?: string): { update(next: ChartConfiguration): void; destroy(): void };
  /** Shows a line under a drawn spec for fields its kind does not use; destroy removes it. */
  hint?(el: HTMLElement, message: string): { remove(): void };
}

function wrongShape(made: string, got: string): Error {
  return new Error(`chartwork: update needs the same shape the chart was made with, a ${made}, but got ${got}`);
}

export function makeRender(drawers: Drawers, defaultOwner: Component) {
  return (el: HTMLElement, input: ChartInput, owner: Component = defaultOwner): RenderHandle => {
    if (shapeOf(input) === "spec") {
      const spec = validateSpec(input);
      const handle = drawers.spec(el, spec, owner);
      let hintEl: { remove(): void } | undefined;
      const showHint = (shown: ChartSpec): void => {
        hintEl?.remove();
        const hint = specHint(shown);
        hintEl = hint ? drawers.hint?.(el, hint) : undefined;
      };
      showHint(spec);
      return {
        update: (next) => {
          if (shapeOf(next) !== "spec") throw wrongShape("spec", "a Chart.js config");
          const nextSpec = validateSpec(next);
          handle.update(nextSpec);
          showHint(nextSpec);
        },
        destroy: () => {
          hintEl?.remove();
          handle.destroy();
        },
      };
    }
    const raw = unwrapRaw(input);
    const handle = drawers.config(el, raw.config, owner, raw.width);
    return {
      update: (next) => {
        if (shapeOf(next) !== "config") throw wrongShape("Chart.js config", "a spec");
        handle.update(unwrapRaw(next).config);
      },
      destroy: () => handle.destroy(),
    };
  };
}
