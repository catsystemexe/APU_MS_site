import React from "react";
import { createRoot } from "react-dom/client";
import ApuClient from "../../../app/apu-client";
import { createNotebookStorage } from "../../../app/notebook-storage";

const props = JSON.parse(document.getElementById("bootstrap").textContent);
// Optional, declared BUSINESS fixture only. No telemetry state or API is mocked.
if (new URL(location.href).searchParams.has("seed")) {
  createNotebookStorage(props, { local: localStorage, session: sessionStorage }).write({
    manifestations: [{ id: "fact", text: "Synthetic observation.", origin: "manual" }],
    goals: [{ id: "n", text: "Understand the situation.", origin: "manual", needMapping: { f2Path: "POCHOPIT", f3Target: null } }],
    context: [], course: [], helps: [],
  });
}
createRoot(document.getElementById("root")).render(<ApuClient {...props} />);
