// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playChime, setSoundEnabled, soundEnabled, unlockChime } from "../lib/chime.js";

// A tiny stand-in for the browser's audio: it records the notes that start.
const notes = [];
function FakeAudio() {
  this.state = FakeAudio.state; this.currentTime = 0; this.destination = {};
  this.createOscillator = () => ({ type: "", frequency: { value: 0 }, connect() {}, start() { notes.push(this.frequency.value); }, stop() {} });
  this.createGain = () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} });
  this.resume = () => { this.state = "running"; FakeAudio.state = "running"; return Promise.resolve(); };
}
FakeAudio.state = "suspended";

describe("notification chime", () => {
  beforeEach(() => { localStorage.clear(); notes.length = 0; FakeAudio.state = "suspended"; window.AudioContext = FakeAudio; vi.resetModules(); });
  afterEach(() => { delete window.AudioContext; });

  it("is on by default, and the switch is remembered", () => {
    expect(soundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(soundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(soundEnabled()).toBe(true);
  });
  it("stays silent until the person has clicked or pressed a key once, then plays two notes", async () => {
    const mod = await import("../lib/chime.js");
    const stop = mod.unlockChime();
    expect(mod.playChime()).toBe(false);                      // the browser has not allowed sound yet
    expect(notes).toEqual([]);
    window.dispatchEvent(new Event("pointerdown"));            // the first click unlocks it
    await Promise.resolve();
    expect(mod.playChime()).toBe(true);
    expect(notes).toHaveLength(2);
    expect(notes[1]).toBeGreaterThan(notes[0]);                // a rising two-note chime
    stop();
  });
  it("plays nothing when sound is switched off, and never throws when the browser has no audio", async () => {
    const mod = await import("../lib/chime.js");
    mod.unlockChime(); window.dispatchEvent(new Event("keydown")); await Promise.resolve();
    mod.setSoundEnabled(false);
    expect(mod.playChime()).toBe(false);
    expect(notes).toEqual([]);
    delete window.AudioContext; vi.resetModules();
    const none = await import("../lib/chime.js");
    expect(() => none.playChime()).not.toThrow();
    expect(none.playChime()).toBe(false);
  });
  it("shoppers and admins have their own sound switch", () => {
    setSoundEnabled(false, "shopper");
    expect(soundEnabled("shopper")).toBe(false);
    expect(soundEnabled("admin")).toBe(true);                    // switching one off leaves the other on
    setSoundEnabled(false);
    expect(soundEnabled("admin")).toBe(false);
    setSoundEnabled(true, "shopper");
    expect(soundEnabled("shopper")).toBe(true);
    expect(soundEnabled("admin")).toBe(false);
  });
  it("plays for the audience whose switch is on", async () => {
    const mod = await import("../lib/chime.js");
    mod.unlockChime(); window.dispatchEvent(new Event("pointerdown")); await Promise.resolve();
    mod.setSoundEnabled(false, "admin");
    expect(mod.playChime("admin")).toBe(false);
    expect(mod.playChime("shopper")).toBe(true);
    mod.setSoundEnabled(false, "shopper");
    expect(mod.playChime("shopper")).toBe(false);
  });
});
