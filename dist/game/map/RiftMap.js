import { getLanePath, getRoleLane, JUNGLE_PATHS } from "../../data/MapData.js";
                                                                  

export class RiftMap {
  getPathForRole(role      , side          )          {
    if (role === "jungle") {
      return JUNGLE_PATHS[side];
    }
    return getLanePath(getRoleLane(role), side);
  }
}
