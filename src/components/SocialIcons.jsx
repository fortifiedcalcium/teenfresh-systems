import React from "react";

// Brand glyphs (Simple Icons, CC0). They use currentColor, so they take the link colour from the design tokens,
// and they are decorative (aria-hidden): the link carries the accessible name (aria-label).
const Svg = ({ d, size = 20 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" fill="currentColor" className="shrink-0"><path d={d} /></svg>
);

export const FacebookIcon = (props) => <Svg {...props} d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />;
export const XIcon = (props) => <Svg {...props} d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />;
export const MailIcon = (props) => <Svg {...props} d="M1.5 4.5h21A1.5 1.5 0 0 1 24 6v12a1.5 1.5 0 0 1-1.5 1.5h-21A1.5 1.5 0 0 1 0 18V6a1.5 1.5 0 0 1 1.5-1.5Zm.9 2.1v.35L12 13.1l9.6-6.15V6.6Zm19.2 3L12 15.7 2.4 9.6v7.8h19.2Z" />;
