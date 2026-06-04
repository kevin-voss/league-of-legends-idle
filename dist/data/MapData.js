import { BASE_MAX_HP, CANVAS_HEIGHT, CANVAS_WIDTH } from "./Constants.js";
                                                                                      

const MAP_MARGIN = 120;
const BASE_INSET = 100;

/**
 * River endpoints on the isometric centerline (logic x === y).
 * With the 2:1 iso projection and 3D camera, this reads as top-center → bottom-center on screen,
 * not a logic-vertical line at constant x.
 */
const RIVER_TOP        = { x: MAP_MARGIN, y: MAP_MARGIN };
const RIVER_BOT        = { x: CANVAS_WIDTH - MAP_MARGIN, y: CANVAS_HEIGHT - MAP_MARGIN };
const RIVER_MID        = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };

export const RIVER_PATH          = [RIVER_TOP, RIVER_BOT];

function pointOnRiverPath(progress        )        {
  return {
    x: RIVER_TOP.x + (RIVER_BOT.x - RIVER_TOP.x) * progress,
    y: RIVER_TOP.y + (RIVER_BOT.y - RIVER_TOP.y) * progress
  };
}

export const BASE_POSITIONS                          = {
  blue: { x: BASE_INSET, y: CANVAS_HEIGHT - BASE_INSET },
  red: { x: CANVAS_WIDTH - BASE_INSET, y: BASE_INSET }
};

export const MIN_TOWER_SPACING = 300;
export const TOWER_ATTACK_RANGE = 150;

                                                         

export function mirrorPoint(point       )        {
  return {
    x: CANVAS_WIDTH - point.x,
    y: CANVAS_HEIGHT - point.y
  };
}

/** Outer lane corner (100% for turret placement: nexus → edge). */
const BLUE_LANE_EDGES                               = {
  top: { x: MAP_MARGIN, y: MAP_MARGIN },
  bot: { x: CANVAS_WIDTH - MAP_MARGIN, y: BASE_POSITIONS.blue.y }
};

const RED_LANE_EDGES                               = {
  top: { x: MAP_MARGIN, y: BASE_INSET },
  bot: { x: CANVAS_WIDTH - MAP_MARGIN, y: CANVAS_HEIGHT - MAP_MARGIN }
};

const BLUE_HALF_RAILS                          = {
  top: [BASE_POSITIONS.blue, BLUE_LANE_EDGES.top, RIVER_TOP],
  mid: [BASE_POSITIONS.blue, RIVER_MID],
  bot: [BASE_POSITIONS.blue, BLUE_LANE_EDGES.bot, RIVER_BOT]
};

/** Red halves meet blue at the same river clash points. */
const RED_HALF_RAILS                          = {
  top: [BASE_POSITIONS.red, RED_LANE_EDGES.top, RIVER_TOP],
  mid: [BASE_POSITIONS.red, RIVER_MID],
  bot: [BASE_POSITIONS.red, RED_LANE_EDGES.bot, RIVER_BOT]
};

export const MAP_RAILS          = {
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

/** Lane progress from nexus (0) to the outer lane edge (1). T2 inner at 35%, T1 outer at 70%. */
export const TOWER_T2_LANE_PROGRESS = 0.35;
export const TOWER_T1_LANE_PROGRESS = 0.7;

const BLUE_TOWERS                                       = {
  top: placeLaneTowers("top", "blue"),
  mid: placeLaneTowers("mid", "blue"),
  bot: placeLaneTowers("bot", "blue")
};

const RED_TOWERS                                       = {
  top: placeLaneTowers("top", "red"),
  mid: placeLaneTowers("mid", "red"),
  bot: placeLaneTowers("bot", "red")
};


                                       

/** Two camps per pocket: one nearer base/turrets, one nearer the river. */
                                        

/**
 * Blue jungle camp coordinates (logic plane).
 * Placed in the wedge between lanes — not on the mid rail.
 */
const BLUE_JUNGLE_CAMP_SLOTS                                                    = {
  top: {
    inner: { x: 210, y: 450 },
    river: { x: 650, y: 780 }
  },
  bot: {
    inner: { x: 480, y: 1640 },
    river: { x: 780, y: 1480 }
  }
};

function midpoint(a       , b       )        {
  return { x: roundPoint((a.x + b.x) / 2), y: roundPoint((a.y + b.y) / 2) };
}

function redJungleCampSlots()                                                    {
  return {
    top: {
      inner: mirrorPoint(BLUE_JUNGLE_CAMP_SLOTS.bot.river),
      river: mirrorPoint(BLUE_JUNGLE_CAMP_SLOTS.bot.inner)
    },
    bot: {
      inner: mirrorPoint(BLUE_JUNGLE_CAMP_SLOTS.top.river),
      river: mirrorPoint(BLUE_JUNGLE_CAMP_SLOTS.top.inner)
    }
  };
}

const RED_JUNGLE_CAMP_SLOTS = redJungleCampSlots();

function jungleCampSlotsForSide(side          )                                                    {
  return side === "blue" ? BLUE_JUNGLE_CAMP_SLOTS : RED_JUNGLE_CAMP_SLOTS;
}

/** Visual / UI centroid for each jungle pocket (midpoint of its two camps). */
export const JUNGLE_QUADRANT_CENTERS                                              = {
  blue: {
    top: midpoint(BLUE_JUNGLE_CAMP_SLOTS.top.inner, BLUE_JUNGLE_CAMP_SLOTS.top.river),
    bot: midpoint(BLUE_JUNGLE_CAMP_SLOTS.bot.inner, BLUE_JUNGLE_CAMP_SLOTS.bot.river)
  },
  red: {
    top: midpoint(RED_JUNGLE_CAMP_SLOTS.top.inner, RED_JUNGLE_CAMP_SLOTS.top.river),
    bot: midpoint(RED_JUNGLE_CAMP_SLOTS.bot.inner, RED_JUNGLE_CAMP_SLOTS.bot.river)
  }
};

/** Returns the center point of a team's top or bot jungle pocket. */
export function getJungleQuadrantCenter(side          , half            )        {
  return JUNGLE_QUADRANT_CENTERS[side][half];
}

/** Minimum logic-space distance between camps on the same side. */
export const MIN_JUNGLE_CAMP_SPACING = 280;

export const JUNGLE_BLOB_CENTERS                            = {
  blue: [JUNGLE_QUADRANT_CENTERS.blue.top, JUNGLE_QUADRANT_CENTERS.blue.bot],
  red: [JUNGLE_QUADRANT_CENTERS.red.top, JUNGLE_QUADRANT_CENTERS.red.bot]
};

/** Neutral pits along the river between mid and top/bot lane mouths. */
function riverPitBetweenMidAnd(lane               )        {
  return pointOnRiverPath(lane === "top" ? 0.28 : 0.72);
}

export const OBJECTIVE_POSITIONS = {
  baron: riverPitBetweenMidAnd("top"),
  dragon: riverPitBetweenMidAnd("bot")
};

                                    
             
                 
               
                    
            
            
  

function defineSideJungleCamps(side          )                         {
  const slots = jungleCampSlotsForSide(side);

  return [
    { id: `${side}-top-wolves`, side, name: "Top Wolves", shortName: "Wolves", ...slots.top.inner },
    { id: `${side}-top-gromp`, side, name: "Top Gromp", shortName: "Gromp", ...slots.top.river },
    { id: `${side}-bot-raptors`, side, name: "Bot Raptors", shortName: "Raptors", ...slots.bot.inner },
    { id: `${side}-bot-krugs`, side, name: "Bot Krugs", shortName: "Krugs", ...slots.bot.river }
  ];
}

export const JUNGLE_CAMPS                         = [
  ...defineSideJungleCamps("blue"),
  ...defineSideJungleCamps("red")
];

function junglePathForSide(side          )          {
  const camps = JUNGLE_CAMPS.filter((camp) => camp.side === side);
  const botCamps = camps.filter((camp) => camp.id.includes("-bot-"));
  const topCamps = camps.filter((camp) => camp.id.includes("-top-"));
  return [BASE_POSITIONS[side], ...botCamps, ...topCamps];
}

export const JUNGLE_PATHS                            = {
  blue: junglePathForSide("blue"),
  red: junglePathForSide("red")
};

const TOWER_T1_HP = 1150;
const TOWER_T2_HP = 1550;
const TOWER_AD = 135;

export const STRUCTURE_LAYOUT                        = [
  ...createTowerLayout("blue"),
  ...createTowerLayout("red"),
  nexus("blue_nexus", "blue", BASE_POSITIONS.blue),
  nexus("red_nexus", "red", BASE_POSITIONS.red)
];

function createTowerLayout(side          )                        {
  const towers = side === "blue" ? BLUE_TOWERS : RED_TOWERS;
  return (["top", "mid", "bot"]            ).flatMap((lane) =>
    ([1, 2]         ).map((tier) => {
      const pos = towers[lane][tier];
      return tower(`${side}_${lane}_t${tier}`, side, lane, tier, pos);
    })
  );
}

function tower(id        , side          , lane        , tier       , pos       )                      {
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

function nexus(id        , side          , pos       )                      {
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

export function getLanePath(lane        , side          )          {
  return MAP_RAILS[lane][side];
}

export function getRoleLane(role      )         {
  if (role === "top") {
    return "top";
  }
  if (role === "adc" || role === "support") {
    return "bot";
  }
  if (role === "mid") {
    return "mid";
  }
  return "mid";
}

export function getEnemySide(side          )           {
  return side === "blue" ? "red" : "blue";
}

export function getLaneCenter(lane        )        {
  return pointAtRailProgress(MAP_RAILS[lane].blue, 0.5);
}

/** Nexus → lane edge (0–100% turret line). Mid uses nexus → river center. */
export function getNexusToEdgeRail(lane        , side          )          {
  if (lane === "mid") {
    return side === "blue" ? BLUE_HALF_RAILS.mid : RED_HALF_RAILS.mid;
  }

  const edges = side === "blue" ? BLUE_LANE_EDGES : RED_LANE_EDGES;
  return [BASE_POSITIONS[side], edges[lane]];
}

function connectLaneHalves(ownHalf         , enemyHalf         )          {
  return [
    ...ownHalf,
    ...[...enemyHalf].reverse().slice(1)
  ];
}

function placeLaneTowers(lane        , side          )                       {
  const nexusToEdge = getNexusToEdgeRail(lane, side);

  return {
    1: pointAtRailProgress(nexusToEdge, TOWER_T1_LANE_PROGRESS),
    2: pointAtRailProgress(nexusToEdge, TOWER_T2_LANE_PROGRESS)
  };
}

function pointAtRailProgress(path         , progress        )        {
  const totalLength = getPathLength(path);
  return pointAtRailDistance(path, totalLength * progress);
}

function pointAtRailDistance(path         , distance        )        {
  if (path.length === 0) {
    return { x: 0, y: 0 };
  }

  let remaining = Math.max(0, distance);
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1]         ;
    const end = path[index]         ;
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

  const last = path[path.length - 1]         ;
  return { x: last.x, y: last.y };
}

function getPathLength(path         )         {
  let length = 0;
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1]         ;
    const end = path[index]         ;
    length += Math.hypot(end.x - start.x, end.y - start.y);
  }
  return length;
}

function roundPoint(value        )         {
  return Math.round(value * 1000) / 1000;
}
