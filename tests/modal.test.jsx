// @vitest-environment jsdom
import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Modal from "../src/components/Modal.jsx";

// The Edit / transfer dialog passes an inline onClose and re-renders on every keystroke.
function EditForm() {
  const [edit, setEdit] = useState({ name: "", email: "" });
  const [open, setOpen] = useState(true);
  return open ? (
    <Modal title="Edit / transfer slot" onClose={() => setOpen(false)}>
      <label>Name<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
      <label>Email<input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></label>
    </Modal>
  ) : <p>closed</p>;
}

describe("Modal keeps focus while you type", () => {
  it("lets you type a whole word in a field (not one character at a time)", async () => {
    const user = userEvent.setup();
    render(<EditForm />);
    const name = screen.getByLabelText("Name");
    await user.click(name);
    await user.keyboard("Maria Santos");
    expect(name).toHaveValue("Maria Santos");
    expect(name).toHaveFocus();
    await user.click(screen.getByLabelText("Email"));
    await user.keyboard("maria@example.com");
    expect(screen.getByLabelText("Email")).toHaveValue("maria@example.com");
    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(screen.getByLabelText("Name")).toHaveValue("Maria Santos");
  });

  it("still closes with Escape using the latest onClose", async () => {
    const user = userEvent.setup();
    render(<EditForm />);
    await user.keyboard("{Escape}");
    expect(screen.getByText("closed")).toBeInTheDocument();
  });
});
