import "./style.css";
import { renderJoin } from "./screens/join";
import { renderPermission } from "./screens/permission";
import { renderHiderWalking } from "./screens/hiderWalking";
import { renderHiderWait } from "./screens/hiderWait";
import { renderNavigate } from "./screens/navigate";
import { session } from "./lib/state";
import { FunsieTrail } from "./lib/funsieTrail";

const app = document.querySelector<HTMLDivElement>("#app")!;

function onReady(): void {
  renderPermission(app, (opts) => {
    if (session.role === "hider") {
      const trail = new FunsieTrail(session.channel!);
      renderHiderWalking(app, trail, () => renderHiderWait(app));
    } else {
      renderNavigate(app, opts);
    }
  });
}

renderJoin(app, onReady);
