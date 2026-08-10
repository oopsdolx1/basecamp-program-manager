import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";

console.info("[ProgramManager Build]", {
  commit: __PROGRAM_MANAGER_COMMIT__,
  builtAt: __PROGRAM_MANAGER_BUILT_AT__,
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
