// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { FullPageSpinner, Loading } from "../src/components/Spinner.jsx";

describe("loading screen", () => {
  it("the full-page loading screen shows the Teenfresh logo, and the status text is its accessible name", async () => {
    const { container } = render(<FullPageSpinner label="Loading events…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading events…");
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img).toHaveAttribute("alt", "");                                   // decorative: the text already says what is happening
    expect(img.className).toContain("motion-safe:animate-pulse");             // still for people who ask for less motion
    expect(await axe(container)).toHaveNoViolations();
  });
  it("small inline loaders stay a plain spinner without the logo", () => {
    const { container } = render(<Loading label="Loading receipt…" className="p-4" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Loading receipt…");
  });
});
