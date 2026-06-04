import { getLanePath, getRoleLane, JUNGLE_PATHS } from "../../data/MapData.js";
import type { Point, Role, TeamSide } from "../../data/models.js";

export class RiftMap {
  getPathForRole(role: Role, side: TeamSide): Point[] {
    if (role === "jungle") {
      return JUNGLE_PATHS[side];
    }
    return getLanePath(getRoleLane(role), side);
  }
}
