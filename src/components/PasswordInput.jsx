import React, { forwardRef, useState } from "react";
import { IconEye, IconEyeOff } from "./NavIcons.jsx";

/** 3.3.8: paste and password managers work (nothing is blocked); a show/hide toggle helps people who cannot easily retype. */
const PasswordInput = forwardRef(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex gap-2">
      <input ref={ref} {...props} type={show ? "text" : "password"} className="input" />
      <button type="button" className="btn-secondary shrink-0" aria-pressed={show} onClick={() => setShow(!show)}>{show ? <IconEyeOff /> : <IconEye />}{show ? "Hide" : "Show"}{" "}<span className="sr-only">password</span></button>
    </div>
  );
});
export default PasswordInput;
