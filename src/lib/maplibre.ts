// MapLibre 6 runs its tile work in a separate module worker file. The bundler does not ship that file,
// so `npm run dev` / `npm run build` copy it into public/ (see the map-worker script) and it is loaded from there.
import * as maplibregl from "maplibre-gl";

maplibregl.setWorkerUrl(`/maplibre-gl-worker.mjs?v=${maplibregl.getVersion()}`);
