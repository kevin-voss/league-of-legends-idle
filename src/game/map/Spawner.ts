import { getLanePath } from "../../data/MapData.js";
import type { LaneId, Point, TeamSide } from "../../data/models.js";
import { Minion } from "../entities/Minion.js";

export class Spawner {
  spawnWave(side: TeamSide, lane: LaneId, waveNumber: number): Minion[] {
    const path = getLanePath(lane, side);
    const spawn = path[0] ?? { x: 0, y: 0 };
    const offsets: Point[] = [
      { x: -12, y: -12 },
      { x: 10, y: -4 },
      { x: -4, y: 12 },
      { x: 18, y: 16 },
      { x: -20, y: 6 },
      { x: 6, y: 20 },
      { x: 22, y: -10 }
    ];
    const sideOffsets = side === "blue" ? offsets : offsets.map((offset) => ({ x: -offset.x, y: -offset.y }));

    return [
      new Minion(side, lane, "melee", path, waveNumber, { x: spawn.x + sideOffsets[0].x, y: spawn.y + sideOffsets[0].y }),
      new Minion(side, lane, "melee", path, waveNumber, { x: spawn.x + sideOffsets[1].x, y: spawn.y + sideOffsets[1].y }),
      new Minion(side, lane, "melee", path, waveNumber, { x: spawn.x + sideOffsets[2].x, y: spawn.y + sideOffsets[2].y }),
      new Minion(side, lane, "caster", path, waveNumber, { x: spawn.x + sideOffsets[3].x, y: spawn.y + sideOffsets[3].y }),
      new Minion(side, lane, "melee", path, waveNumber, { x: spawn.x + sideOffsets[4].x, y: spawn.y + sideOffsets[4].y }),
      new Minion(side, lane, "melee", path, waveNumber, { x: spawn.x + sideOffsets[5].x, y: spawn.y + sideOffsets[5].y }),
      new Minion(side, lane, "caster", path, waveNumber, { x: spawn.x + sideOffsets[6].x, y: spawn.y + sideOffsets[6].y })
    ];
  }
}
