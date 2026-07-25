"use client";

import { useEffect } from "react";

export default function InactivityPreventer() {
  useEffect(() => {
    // Ping/touch interval to reset any idle timer detectors
    // Dispatches a small, harmless DOM event every 45 seconds to keep the session active and tab awake
    const keepAliveInterval = setInterval(() => {
      window.dispatchEvent(new Event("activityping"));
    }, 45000);

    return () => clearInterval(keepAliveInterval);
  }, []);

  return null;
}