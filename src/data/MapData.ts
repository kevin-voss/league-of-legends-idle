import { BASE_MAX_HP, CANVAS_HEIGHT, CANVAS_WIDTH } from "./Constants.js";
import type { LaneId, Point, Role, StructureDefinition, TeamSide } from "./models.js";

const MAP_MARGIN = 120;
const BASE_INSET = 100;

const RIVER_TOP: Point = { x: CANVAS_WIDTH / 2, y: MAP_MARGIN };
const RIVER_BOT: Point = { x: CANVAS_WIDTH - MAP_MARGIN, y: CANVAS_HEIGHT / 2 };
const RIVER_MID: Point = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };

export const BASE_POSITIONS: Record<TeamSide, Point> = {
  blue: { x: BASE_INSET, y: CANVAS_HEIGHT - BASE_INSET },
  red: { x: CANVAS_WIDTH - BASE_INSET, y: BASE_INSET }
};

export const MIN_TOWER_SPACING = 348;
export const TOWER_ATTACK_RANGE = 150;

type RailSet = Record<LaneId, Record<TeamSide, Point[]>>;

export function mirrorPoint(point: Point): Point {
  return {
    x: CANVAS_WIDTH - point.x,
    y: CANVAS_HEIGHT - point.y
  };
}

const BLUE_HALF_RAILS: Record<LaneId, Point[]> = {
  top: [
    BASE_POSITIONS.blue,
    { x: MAP_MARGIN, y: MAP_MARGIN },
    RIVER_TOP
  ],
  mid: [BASE_POSITIONS.blue, RIVER_MID],
  bot: [
    BASE_POSITIONS.blue,
    { x: CANVAS_WIDTH - MAP_MARGIN, y: BASE_POSITIONS.blue.y },
    RIVER_BOT
  ]
};

/** Red halves meet blue at the same river points so lanes do not cut diagonally across the rift. */
const RED_HALF_RAILS: Record<LaneId, Point[]> = {
  top: [
    BASE_POSITIONS.red,
    { x: CANVAS_WIDTH - MAP_MARGIN, y: MAP_MARGIN },
    RIVER_TOP
  ],
  mid: [BASE_POSITIONS.red, RIVER_MID],
  bot: [
    BASE_POSITIONS.red,
    { x: CANVAS_WIDTH - MAP_MARGIN, y: BASE_INSET },
    RIVER_BOT
  ]
};

export const MAP_RAILS: RailSet = {
  top: {
    blue: connectLaneHalves(BLUE_HALF_RAILS.top, RED_HALF_RAILS.top),
    red: connectLaneHalves(RED_HALF_RAILS.top, BLUE_HALF_RAILS.top)
  },
  mid: {
    blue: connectLaneHalves(BLUE_HALF_RAILS.mid, RED_HALF_RAILS.mid),
    red: connectLaneHalves(RED_HALF_RAILS.mid, BLUE_HALF_RAILS.mid)
  },
  bot: {
    blue: connectLaneHalves(BLUE_HALF_RAILS.bot, RED_HALF_RAILS.bot),
    red: connectLaneHalves(RED_HALF_RAILS.bot, BLUE_HALF_RAILS.bot)
  }
};

const TOWER_T2_RAIL_FRACTION = 0.26;
const TOWER_GAP = 48;
const MIN_TOWER_SPACING_INTERNAL = TOWER_ATTACK_RANGE * 2 + TOWER_GAP;

/** Shared march progress along the attacker's lane path for outer (T1) turrets. */
const T1_MARCH_PROGRESS: Record<LaneId, number> = {
  top: 0.58,
  mid: 0.54,
  bot: 0.58
};

const BLUE_TOWERS: Record<LaneId, Record<1 | 2, Point>> = {
  top: placeLaneTowers("top", "blue"),
  mid: placeLaneTowers("mid", "blue"),
  bot: placeLaneTowers("bot", "blue")
};

const RED_TOWERS: Record<LaneId, Record<1 | 2, Point>> = {
  top: placeLaneTowers("top", "red"),
  mid: placeLaneTowers("mid", "red"),
  bot: placeLaneTowers("bot", "red")
};


const BLUE_TOP_WOLVES = { x: 360, y: 1147 };
const BLUE_TOP_GROMP = { x: 450, y: 682 };
const BLUE_BOT_RAPTORS = { x: 700, y: 1520 };
const BLUE_BOT_KRUGS = { x: 520, y: 1210 };

const BLUE_JUNGLE_BLOB_CENTERS: Point[] = [
  {
    x: (BLUE_TOP_WOLVES.x + BLUE_TOP_GROMP.x) / 2,
    y: (BLUE_TOP_WOLVES.y + BLUE_TOP_GROMP.y) / 2
  },
  {
    x: (BLUE_BOT_RAPTORS.x + BLUE_BOT_KRUGS.x) / 2,
    y: (BLUE_BOT_RAPTORS.y + BLUE_BOT_KRUGS.y) / 2
  }
];

export const JUNGLE_BLOB_CENTERS: Record<TeamSide, Point[]> = {
  blue: BLUE_JUNGLE_BLOB_CENTERS,
  red: BLUE_JUNGLE_BLOB_CENTERS.map(mirrorPoint)
};

const blueJunglePath = [
  BASE_POSITIONS.blue,
  BLUE_BOT_RAPTORS,
  BLUE_BOT_KRUGS,
  BLUE_TOP_WOLVES,
  BLUE_TOP_GROMP
];

export const JUNGLE_PATHS: Record<TeamSide, Point[]> = {
  blue: blueJunglePath,
  red: blueJunglePath.map(mirrorPoint)
};

export const OBJECTIVE_POSITIONS = {
  dragon: { x: 1140, y: 1210 },
  baron: mirrorPoint({ x: 1140, y: 1210 })
};

const BLUE_JUNGLE_CAMPS = [
  { id: "blue-top-wolves", side: "blue" as TeamSide, name: "Top Wolves", ...BLUE_TOP_WOLVES },
  { id: "blue-top-gromp", side: "blue" as TeamSide, name: "Top Gromp", ...BLUE_TOP_GROMP },
  { id: "blue-bot-raptors", side: "blue" as TeamSide, name: "Bot Raptors", ...BLUE_BOT_RAPTORS },
  { id: "blue-bot-krugs", side: "blue" as TeamSide, name: "Bot Krugs", ...BLUE_BOT_KRUGS }
];

export const JUNGLE_CAMPS = [
  ...BLUE_JUNGLE_CAMPS,
  ...BLUE_JUNGLE_CAMPS.map((camp) => {
    const mirrored = mirrorPoint(camp);
    return {
      id: camp.id.replace("blue", "red"),
      side: "red" as TeamSide,
      name: camp.name,
      x: mirrored.x,
      y: mirrored.y
    };
  })
];

const TOWER_T1_HP = 1150;
const TOWER_T2_HP = 1550;
const TOWER_AD = 135;

export const STRUCTURE_LAYOUT: StructureDefinition[] = [
  ...createTowerLayout("blue"),
  ...createTowerLayout("red"),
  nexus("blue_nexus", "blue", BASE_POSITIONS.blue),
  nexus("red_nexus", "red", BASE_POSITIONS.red)
];

function createTowerLayout(side: TeamSide): StructureDefinition[] {
  const towers = side === "blue" ? BLUE_TOWERS : RED_TOWERS;
  return (["top", "mid", "bot"] as LaneId[]).flatMap((lane) =>
    ([1, 2] as const).map((tier) => {
      const pos = towers[lane][tier];
      return tower(`${side}_${lane}_t${tier}`, side, lane, tier, pos);
    })
  );
}

function tower(id: string, side: TeamSide, lane: LaneId, tier: 1 | 2, pos: Point): StructureDefinition {
  return {
    id,
    type: "tower",
    side,
    lane,
    tier,
    pos,
    hp: tier === 1 ? TOWER_T1_HP : TOWER_T2_HP,
    ad: TOWER_AD,
    armor: tier === 1 ? 58 : 72,
    mr: tier === 1 ? 52 : 64,
    attackSpeed: 0.95,
    attackRange: TOWER_ATTACK_RANGE
  };
}

function nexus(id: string, side: TeamSide, pos: Point): StructureDefinition {
  return {
    id,
    type: "nexus",
    side,
    lane: null,
    tier: null,
    pos,
    hp: BASE_MAX_HP,
    ad: 82,
    armor: 44,
    mr: 44,
    attackSpeed: 0.72,
    attackRange: 125
  };
}

export function getLanePath(lane: LaneId, side: TeamSide): Point[] {
  return MAP_RAILS[lane][side];
}

export function getRoleLane(role: Role): LaneId {
  if (role === "top") {
    return "top";
  }
  if (role === "adc" || role === "support") {
    return "bot";
  }
  return "mid";
}

export function getEnemySide(side: TeamSide): TeamSide {
  return side === "blue" ? "red" : "blue";
}

export function getLaneCenter(lane: LaneId): Point {
  return pointAtRailProgress(MAP_RAILS[lane].blue, 0.5);
}

function connectLaneHalves(ownHalf: Point[], enemyHalf: Point[]): Point[] {
  return [
    ...ownHalf,
    ...[...enemyHalf].reverse().slice(1)
  ];
}

function placeLaneTowers(lane: LaneId, side: TeamSide): Record<1 | 2, Point> {
  const halfRail = side === "blue" ? BLUE_HALF_RAILS[lane] : RED_HALF_RAILS[lane];
  const railLength = getPathLength(halfRail);
  let t2Distance = railLength * TOWER_T2_RAIL_FRACTION;

  const marchPath = MAP_RAILS[lane][getEnemySide(side)];
  const marchLength = getPathLength(marchPath);
  let t1Distance = marchLength * T1_MARCH_PROGRESS[lane];

  const t2Pos = pointAtRailDistance(halfRail, t2Distance);
  let t1Pos = pointAtRailDistance(marchPath, t1Distance);
  let spacing = Math.hypot(t1Pos.x - t2Pos.x, t1Pos.y - t2Pos.y);

  while (spacing < MIN_TOWER_SPACING_INTERNAL && t1Distance < marchLength * 0.85) {
    t1Distance += 24;
    t1Pos = pointAtRailDistance(marchPath, t1Distance);
    spacing = Math.hypot(t1Pos.x - t2Pos.x, t1Pos.y - t2Pos.y);
  }

  return {
    1: t1Pos,
    2: t2Pos
  };
}

function pointAtRailProgress(path: Point[], progress: number): Point {
  const totalLength = getPathLength(path);
  return pointAtRailDistance(path, totalLength * progress);
}

function pointAtRailDistance(path: Point[], distance: number): Point {
  if (path.length === 0) {
    return { x: 0, y: 0 };
  }

  let remaining = Math.max(0, distance);
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1] as Point;
    const end = path[index] as Point;
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
    if (remaining <= segmentLength) {
      const t = segmentLength === 0 ? 0 : remaining / segmentLength;
      return {
        x: roundPoint(start.x + (end.x - start.x) * t),
        y: roundPoint(start.y + (end.y - start.y) * t)
      };
    }
    remaining -= segmentLength;
  }

  const last = path[path.length - 1] as Point;
  return { x: last.x, y: last.y };
}

function getPathLength(path: Point[]): number {
  let length = 0;
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1] as Point;
    const end = path[index] as Point;
    length += Math.hypot(end.x - start.x, end.y - start.y);
  }
  return length;
}

function roundPoint(value: number): number {
  return Math.round(value * 1000) / 1000;
}
