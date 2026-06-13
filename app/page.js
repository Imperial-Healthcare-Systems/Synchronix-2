"use client";

import { useEffect, useRef } from "react";
import { BODY_HTML } from "./content";

export default function Home() {
  const ran = useRef(false);

  useEffect(() => {
    // Guard against React Strict Mode's double-invoke in dev so the original
    // IIFE (event listeners, scroll-progress bar, etc.) only initializes once.
    if (ran.current) return;
    ran.current = true;

    const s = document.createElement("script");
    s.src = "/site.js";
    s.async = false;
    document.body.appendChild(s);
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: BODY_HTML }} />;
}
