import "./style.css";
import { renderJoin } from "./screens/join";
import { renderPermission } from "./screens/permission";
import { renderHiderWait } from "./screens/hiderWait";
import { renderNavigate } from "./screens/navigate";
import { session } from "./lib/state";

const app = document.querySelector<HTMLDivElement>("#app")!;

function onReady(): void {
  renderPermission(app, (opts) => {
    if (session.role === "hider") {
      renderHiderWait(app);
    } else {
      renderNavigate(app, opts);
    }
  });
}

renderJoin(app, onReady);
