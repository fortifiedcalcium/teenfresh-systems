// @vitest-environment jsdom
import React, { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FormattedText from "../src/components/FormattedText.jsx";
import BoldTextarea from "../src/components/BoldTextarea.jsx";

describe("FormattedText", () => {
  it("shows **text** in bold and everything else as plain text", () => {
    const { container } = render(<p><FormattedText text={"Hello **big** world, **again**"} /></p>);
    expect([...container.querySelectorAll("strong")].map((n) => n.textContent)).toEqual(["big", "again"]);
    expect(container.textContent).toBe("Hello big world, again");
  });
  it("never turns admin text into HTML", () => {
    const { container } = render(<p><FormattedText text={"<img src=x onerror=alert(1)> **ok**"} /></p>);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });
  it("leaves unmatched or empty markers alone", () => {
    const { container } = render(<p><FormattedText text={"a ** b **** c **d"} /></p>);
    expect(container.querySelector("strong")).toBeNull();
    expect(container.textContent).toBe("a ** b **** c **d");
  });
});

function Harness({ start = "make this bold please" }) {
  const [v, setV] = useState(start);
  return <BoldTextarea aria-label="Text" value={v} onChange={setV} maxLength={4000} />;
}
const select = (el, a, b) => { el.focus(); el.setSelectionRange(a, b); };

describe("BoldTextarea", () => {
  it("wraps the selected text in ** with the Bold button, and removes it on a second press", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const box = screen.getByLabelText("Text");
    select(box, 5, 9);                                       // "this"
    await user.click(screen.getByRole("button", { name: "Bold" }));
    expect(box).toHaveValue("make **this** bold please");
    select(box, 7, 11);                                      // "this" again, now inside the markers
    await user.click(screen.getByRole("button", { name: "Bold" }));
    expect(box).toHaveValue("make this bold please");
  });
  it("works with Ctrl+B and wraps each selected line separately", () => {
    render(<Harness start={"one\n\ntwo"} />);
    const box = screen.getByLabelText("Text");
    select(box, 0, 8);
    fireEvent.keyDown(box, { key: "b", ctrlKey: true });
    expect(box).toHaveValue("**one**\n\n**two**");
  });
  it("adds an empty pair of markers when nothing is selected", async () => {
    const user = userEvent.setup();
    render(<Harness start="" />);
    const box = screen.getByLabelText("Text");
    box.focus();
    await user.click(screen.getByRole("button", { name: "Bold" }));
    expect(box).toHaveValue("****");
  });
});
