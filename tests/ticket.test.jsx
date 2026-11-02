// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Ticket, TicketBarcode, TicketStub } from "../src/components/Ticket.jsx";

describe("Ticket", () => {
  it("is one article named by the title, with the stub after the details, and a decorative VOID stamp only when rejected", async () => {
    const { container, rerender } = render(<Ticket status="rejected" labelledBy="t" image={<div>image</div>} stub={<TicketStub label="Action needed"><button>Upload</button></TicketStub>}><h2 id="t">Event</h2><p>details</p></Ticket>);
    expect(screen.getByRole("article", { name: "Event" })).toBeInTheDocument();
    const stamp = container.querySelector(".ticket__stamp");
    expect(stamp).toHaveTextContent("VOID"); expect(stamp).toHaveAttribute("aria-hidden", "true");
    const text = container.textContent;
    expect(text.indexOf("Event")).toBeLessThan(text.indexOf("details")); expect(text.indexOf("details")).toBeLessThan(text.indexOf("Action needed"));
    rerender(<Ticket status="confirmed" labelledBy="t" stub={<TicketStub label="Ticket no." />}><h2 id="t">Event</h2></Ticket>);
    expect(container.querySelector(".ticket__stamp")).toBeNull();
  });
  it("the barcode is decorative, hidden from assistive tech, and different for different numbers", () => {
    const a = render(<TicketBarcode value="IVEMONOP-000008" />).container.innerHTML;
    const b = render(<TicketBarcode value="IVEMONOP-000009" />).container.innerHTML;
    expect(a).toContain('aria-hidden="true"'); expect(a).toContain('focusable="false"');
    expect(a).not.toEqual(b);
    expect(render(<TicketBarcode value="IVEMONOP-000008" />).container.innerHTML).toEqual(a);   // the same number always draws the same bars
  });
});
