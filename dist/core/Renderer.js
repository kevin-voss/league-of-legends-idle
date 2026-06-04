import { CANVAS_HEIGHT, CANVAS_WIDTH, TIER_COLOR } from "../data/Constants.js";
import { BASE_POSITIONS, getLanePath, JUNGLE_CAMPS, JUNGLE_PATHS, JUNGLE_QUADRANT_CENTERS, OBJECTIVE_POSITIONS } from "../data/MapData.js";
                                                                 
import { Iso } from "./Isometric.js";
import { Champion } from "../game/entities/Champion.js";
import { Entity } from "../game/entities/Entity.js";
import { Minion } from "../game/entities/Minion.js";
import { Monster } from "../game/entities/Monster.js";
import { Structure } from "../game/entities/Structure.js";
                                                         

// Headroom (screen px) reserved around the projected map so tower stems and
// floating labels do not clip the canvas edges.
const MARGIN_X = 64;
const TOP_ROOM = 100;
const BOTTOM_ROOM = 54;

const BACK_CHANNEL_SECONDS = 3;

export class Renderer {
          canvas                   ;
          ctx                          ;

  // Isometric camera: screen = origin + Iso.toScreen(logic) * scale.
          scale        ;
          originX        ;
          originY        ;

  constructor(canvas                   ) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context is unavailable.");
    }
    this.canvas = canvas;
    this.ctx = context;
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;

    const camera = Renderer.fitCamera();
    this.scale = camera.scale;
    this.originX = camera.originX;
    this.originY = camera.originY;
  }

  // Derives the camera so the projected rift diamond is centred and fully visible.
          static fitCamera()                                                      {
    const corners = [
      Iso.toScreen(0, 0),
      Iso.toScreen(CANVAS_WIDTH, 0),
      Iso.toScreen(0, CANVAS_HEIGHT),
      Iso.toScreen(CANVAS_WIDTH, CANVAS_HEIGHT)
    ];
    const minX = Math.min(...corners.map((corner) => corner.x));
    const maxX = Math.max(...corners.map((corner) => corner.x));
    const minY = Math.min(...corners.map((corner) => corner.y));
    const maxY = Math.max(...corners.map((corner) => corner.y));

    const isoWidth = maxX - minX;
    const isoHeight = maxY - minY;
    const availWidth = CANVAS_WIDTH - MARGIN_X * 2;
    const availHeight = CANVAS_HEIGHT - TOP_ROOM - BOTTOM_ROOM;
    const scale = Math.min(availWidth / isoWidth, availHeight / isoHeight);

    const originX = MARGIN_X + (availWidth - isoWidth * scale) / 2 - minX * scale;
    const originY = TOP_ROOM + (availHeight - isoHeight * scale) / 2 - minY * scale;
    return { scale, originX, originY };
  }

          projectXY(x        , y        )        {
    const iso = Iso.toScreen(x, y);
    return { x: this.originX + iso.x * this.scale, y: this.originY + iso.y * this.scale };
  }

          project(point       )        {
    return this.projectXY(point.x, point.y);
  }

  // Raises a projected ground position by a logic-space height.
          lift(screen       , height        )        {
    return Iso.withHeight(screen, height * this.scale);
  }

  render(match       )       {
    this.drawBackground();
    this.drawGround();
    this.drawEntities(match);
    this.drawRespawnMarkers(match);
    this.drawVFX(match);
  }

          drawBackground()       {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, "#0a0f0c");
    gradient.addColorStop(1, "#05080a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

          drawGround()       {
    const ctx = this.ctx;

    // The rift floor as an isometric diamond (projection of the logic rectangle).
    const diamond = [
      this.projectXY(0, 0),
      this.projectXY(CANVAS_WIDTH, 0),
      this.projectXY(CANVAS_WIDTH, CANVAS_HEIGHT),
      this.projectXY(0, CANVAS_HEIGHT)
    ];

    ctx.save();
    const grass = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    grass.addColorStop(0, "#21351f");
    grass.addColorStop(0.5, "#27412b");
    grass.addColorStop(1, "#1d2b1c");
    ctx.beginPath();
    diamond.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
    ctx.closePath();
    ctx.fillStyle = grass;
    ctx.fill();
    ctx.strokeStyle = "rgba(11, 18, 12, 0.9)";
    ctx.lineWidth = 4;
    ctx.stroke();

    // A faint isometric grid for depth.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    const step = 160;
    for (let x = step; x < CANVAS_WIDTH; x += step) {
      const a = this.projectXY(x, 0);
      const b = this.projectXY(x, CANVAS_HEIGHT);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (let y = step; y < CANVAS_HEIGHT; y += step) {
      const a = this.projectXY(0, y);
      const b = this.projectXY(CANVAS_WIDTH, y);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();

    this.drawJungleBlob("blue");
    this.drawJungleBlob("red");

    for (const lane of ["top", "mid", "bot"]            ) {
      this.drawLane(getLanePath(lane, "blue"), lane === "mid" ? "#cdb978" : "#8ea36d", lane === "mid" ? 14 : 11);
    }

    this.drawLane(JUNGLE_PATHS.blue, "#4f7d62", 5);
    this.drawLane(JUNGLE_PATHS.red, "#8a5f59", 5);

    for (const camp of JUNGLE_CAMPS) {
      this.drawCampMarker(camp, camp.side === "blue" ? "#6fc090" : "#cf8a7e");
    }

    this.drawObjectiveMarker(OBJECTIVE_POSITIONS.dragon, "Dragon", "#77b9ff");
    this.drawObjectiveMarker(OBJECTIVE_POSITIONS.baron, "Baron", "#c99aff");
  }

          drawJungleBlob(side          )       {
    const ctx = this.ctx;
    const centers = [JUNGLE_QUADRANT_CENTERS[side].top, JUNGLE_QUADRANT_CENTERS[side].bot];
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = side === "blue" ? "#2d6a47" : "#70413a";
    for (const center of centers) {
      const screen = this.project(center);
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 88 * this.scale, 44 * this.scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Draws a path as an isometric ribbon by projecting each rail point.
          drawLane(points         , color        , width        )       {
    if (points.length === 0) {
      return;
    }
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width * this.scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    points.forEach((point, index) => {
      const screen = this.project(point);
      if (index === 0) {
        ctx.moveTo(screen.x, screen.y);
      } else {
        ctx.lineTo(screen.x, screen.y);
      }
    });
    ctx.stroke();
    ctx.restore();
  }

          drawCampMarker(camp                                             , color        )       {
    const ctx = this.ctx;
    const screen = this.project(camp);
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, 44 * this.scale, 22 * this.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, 44 * this.scale, 22 * this.scale, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "#f6f1df";
    ctx.font = `bold ${11 * this.scale}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(camp.shortName, screen.x, screen.y);
    ctx.restore();
  }

          drawObjectiveMarker(point       , label        , color        )       {
    const ctx = this.ctx;
    const screen = this.project(point);
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.14;
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, 52 * this.scale, 26 * this.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, 52 * this.scale, 26 * this.scale, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, screen.x, screen.y + 34 * this.scale);
    ctx.restore();
  }

          drawEntities(match       )       {
    const entities           = [
      ...match.structures,
      ...match.monsters,
      ...match.minions.filter((minion) => minion.alive || minion.deathTimer > 0),
      ...match.champions.filter((champion) => champion.alive)
    ];

    // Painter's algorithm in isometric depth: smaller (x + y) is further back.
    entities.sort((a, b) => Iso.depth(a.pos) - Iso.depth(b.pos));

    for (const entity of entities) {
      if (entity instanceof Structure) {
        this.drawStructure(entity);
      } else if (entity instanceof Monster) {
        this.drawMonster(entity);
      } else if (entity instanceof Minion) {
        this.drawMinion(entity);
      } else if (entity instanceof Champion) {
        this.drawChampion(entity);
      }
    }
  }

          drawShadow(pos       , radius        , alpha = 0.32)       {
    const ctx = this.ctx;
    const screen = this.project(pos);
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, radius * this.scale, radius * this.scale * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

          drawGroundRing(
    pos       ,
    radius        ,
    tone                                                  ,
    filled         ,
    dashed = false
  )       {
    const ctx = this.ctx;
    const screen = this.project(pos);
    const palette = {
      blue: { fill: "rgba(74, 163, 223, 0.07)", stroke: "rgba(119, 185, 255, 0.26)" },
      red: { fill: "rgba(223, 109, 95, 0.07)", stroke: "rgba(255, 139, 125, 0.26)" },
      neutralBlue: { fill: "rgba(119, 185, 255, 0.06)", stroke: "rgba(119, 185, 255, 0.22)" },
      neutralPurple: { fill: "rgba(168, 132, 232, 0.06)", stroke: "rgba(201, 154, 255, 0.22)" }
    }[tone];
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, radius * this.scale, radius * this.scale * 0.5, 0, 0, Math.PI * 2);
    if (filled) {
      ctx.fillStyle = palette.fill;
      ctx.fill();
    }
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = dashed ? 1.5 : 1;
    if (dashed) {
      ctx.setLineDash([6, 5]);
    }
    ctx.stroke();
    if (dashed) {
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

          drawToken(pos       , radius        , height        , fill        , stroke        , squash = 0.92)                           {
    const ctx = this.ctx;
    const feet = this.project(pos);
    const body = this.lift(feet, height);
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(body.x, body.y, radius * this.scale, radius * this.scale * squash, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return body;
  }

          drawStructure(structure           )       {
    if (structure.structureType === "nexus") {
      this.drawNexus(structure);
      return;
    }
    this.drawTower(structure);
  }

          drawTower(tower           )       {
    const ctx = this.ctx;
    const color = tower.side === "blue" ? "#4aa3df" : "#df6d5f";
    const base = this.project(tower.pos);
    const stemHeight = 52;
    const top = this.lift(base, stemHeight);

    ctx.save();
    if (tower.alive) {
      this.drawGroundRing(tower.pos, tower.attackRange, tower.side === "blue" ? "blue" : "red", true, true);
    }
    this.drawShadow(tower.pos, 26, 0.34);

    ctx.globalAlpha = tower.alive ? 1 : 0.28;

    // Base plate.
    ctx.fillStyle = "#3a3a3a";
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, 22 * this.scale, 11 * this.scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Vertical stem with two shaded faces for a chunky 3D read.
    const halfWidth = 12 * this.scale;
    ctx.fillStyle = tower.side === "blue" ? "#1a3f57" : "#5a2722";
    ctx.fillRect(base.x - halfWidth, top.y, halfWidth, base.y - top.y);
    ctx.fillStyle = tower.side === "blue" ? "#235a7c" : "#7d352f";
    ctx.fillRect(base.x, top.y, halfWidth, base.y - top.y);

    // Cap / turret head.
    ctx.fillStyle = tower.tier === 1 ? color : "#d7c489";
    ctx.beginPath();
    ctx.ellipse(top.x, top.y, 15 * this.scale, 8 * this.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (tower.alive) {
      this.drawBar(top.x - 32, top.y - 22 * this.scale, 64, 6, tower.hpPercent, color);
      if (tower.isInvulnerable) {
        ctx.strokeStyle = "#f4d27b";
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, 30 * this.scale, 15 * this.scale, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

          drawNexus(nexus           )       {
    const ctx = this.ctx;
    const color = nexus.side === "blue" ? "#4aa3df" : "#df6d5f";
    const base = this.project(nexus.pos);
    const top = this.lift(base, 70);

    ctx.save();
    if (nexus.alive) {
      this.drawGroundRing(nexus.pos, nexus.attackRange, nexus.side === "blue" ? "blue" : "red", true);
    }
    this.drawShadow(nexus.pos, 42, 0.36);

    ctx.globalAlpha = nexus.alive ? 1 : 0.28;
    const halfWidth = 26 * this.scale;
    ctx.fillStyle = nexus.side === "blue" ? "#1d4a66" : "#642b25";
    ctx.fillRect(base.x - halfWidth, top.y, halfWidth, base.y - top.y);
    ctx.fillStyle = nexus.side === "blue" ? "#2a6c92" : "#8a3a32";
    ctx.fillRect(base.x, top.y, halfWidth, base.y - top.y);

    // Glowing crystal cap.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - 26 * this.scale);
    ctx.lineTo(top.x + halfWidth, top.y);
    ctx.lineTo(top.x, top.y + 14 * this.scale);
    ctx.lineTo(top.x - halfWidth, top.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#f7edd2";
    ctx.globalAlpha = nexus.alive ? 0.8 : 0.3;
    ctx.lineWidth = 2;
    ctx.stroke();

    this.drawBar(base.x - 48, base.y + 14 * this.scale, 96, 8, nexus.hpPercent, color);
    ctx.restore();
  }

          drawMonster(monster         )       {
    const ctx = this.ctx;
    if (monster.alive && (monster.monsterType === "dragon" || monster.monsterType === "baron")) {
      this.drawGroundRing(monster.pos, 155, monster.monsterType === "dragon" ? "neutralBlue" : "neutralPurple", false);
    }
    this.drawShadow(monster.pos, monster.radius, monster.alive ? 0.3 : 0.16);
    const fill = monster.monsterType === "baron" ? "#a884e8" : monster.monsterType === "dragon" ? "#4aa3df" : "#d29b5f";
    ctx.save();
    ctx.globalAlpha = monster.alive ? 1 : 0.24;
    const body = this.drawToken(monster.pos, monster.radius, monster.radius * 0.7, fill, "#f2f4e9", 0.85);
    if (monster.alive) {
      this.drawBar(body.x - 28, body.y - monster.radius * this.scale - 14, 56, 6, monster.hpPercent, "#d29b5f");
    }
    ctx.restore();
  }

          drawMinion(minion        )       {
    const color = minion.side === "blue" ? "#77b9ff" : "#ff8b7d";
    this.drawShadow(minion.pos, minion.radius, minion.alive ? 0.28 : 0.12);
    const body = this.drawToken(minion.pos, minion.radius, minion.radius * 0.8, color, minion.type === "caster" ? "#f2f4e9" : "#1f241f");
    if (minion.alive) {
      this.drawBar(body.x - 16, body.y - minion.radius * this.scale - 8, 32, 4, minion.hpPercent, color);
    }
  }

          drawChampion(champion          )       {
    const sideColor = champion.side === "blue" ? "#4aa3df" : "#df6d5f";
    const tierColor = TIER_COLOR[champion.template.tier];
    const lift = champion.radius + champion.heightOffset;

    this.drawGroundRing(champion.pos, champion.stats.range, champion.side === "blue" ? "blue" : "red", false);
    this.drawShadow(champion.pos, champion.radius, 0.34);

    this.drawToken(champion.pos, champion.radius + 5, lift, tierColor, sideColor);
    const body = this.drawToken(champion.pos, champion.radius, lift, sideColor, "#101311");

    this.drawBar(body.x - 28, body.y - champion.radius * this.scale - 18, 56, 6, champion.hpPercent, sideColor);
    this.drawLevelBadge(champion, body);
    this.drawChampionLabel(champion);

    if (champion.buffs.length > 0) {
      this.drawBuffRing(champion, body);
    }
    if (champion.state === "backing") {
      this.drawRecall(champion);
    }
  }

          drawLevelBadge(champion          , body       )       {
    const ctx = this.ctx;
    const x = body.x - champion.radius * this.scale - 6;
    const y = body.y - champion.radius * this.scale - 4;
    ctx.save();
    ctx.fillStyle = "#11151a";
    ctx.strokeStyle = "#f4d27b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f4d27b";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(champion.matchLevel), x, y + 0.5);
    ctx.restore();
  }

          drawBuffRing(champion          , body       )       {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = "#ffd866";
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(body.x, body.y, (champion.radius + 8) * this.scale, (champion.radius + 8) * this.scale * 0.92, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

          drawChampionLabel(champion          )       {
    const ctx = this.ctx;
    const screen = this.project(champion.pos);
    ctx.save();
    ctx.fillStyle = "#f2f4e9";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 4;
    ctx.fillText(champion.template.name.split(" ")[0] ?? "", screen.x, screen.y + 16);
    ctx.restore();
  }

  // Channel ring drawn flat on the ground, filling clockwise with progress.
          drawRecall(champion          )       {
    const ctx = this.ctx;
    const screen = this.project(champion.pos);
    const progress = Math.max(0, Math.min(1, 1 - champion.backTimer / BACK_CHANNEL_SECONDS));
    const rx = (champion.radius + 12) * this.scale;
    const ry = rx * 0.5;

    ctx.save();
    ctx.strokeStyle = "rgba(244, 210, 123, 0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "#f4d27b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
    ctx.restore();
  }

          drawRespawnMarkers(match       )       {
    const deadBySide                               = {
      blue: match.champions.filter((champion) => champion.side === "blue" && !champion.alive),
      red: match.champions.filter((champion) => champion.side === "red" && !champion.alive)
    };

    for (const side of ["blue", "red"]              ) {
      deadBySide[side].forEach((champion, index) => this.drawRespawnMarker(champion, index, deadBySide[side].length));
    }
  }

          drawRespawnMarker(champion          , index        , count        )       {
    const base = this.project(BASE_POSITIONS[champion.side            ]);
    const color = champion.side === "blue" ? "#4aa3df" : "#df6d5f";
    const orbit = 16 + (champion.respawnTimer % 1) * 9;
    const spread = (index - (count - 1) / 2) * 26;
    const x = base.x + spread;
    const y = base.y - 64;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, orbit, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = color;
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.ceil(champion.respawnTimer)}s`, x, y + 4);
    ctx.restore();
  }

          drawVFX(match       )       {
    const ctx = this.ctx;
    for (const projectile of match.projectiles) {
      const screen = this.project(projectile.pos);
      ctx.save();
      ctx.fillStyle = projectile.color;
      ctx.globalAlpha = Math.max(0, projectile.life / projectile.maxLife);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 10 * this.scale, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const text of match.floatingTexts) {
      const screen = this.project(text.pos);
      ctx.save();
      ctx.fillStyle = text.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, text.life / 0.72));
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0, 0, 0, 0.78)";
      ctx.shadowBlur = 4;
      ctx.fillText(text.text, screen.x, screen.y - 16 * this.scale);
      ctx.restore();
    }
  }

  // Health/progress bars are drawn screen-aligned above their (already projected) anchor.
          drawBar(x        , y        , width        , height        , percent        , color        )       {
    const ctx = this.ctx;
    const clamped = Math.max(0, Math.min(1, percent));
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width * clamped, height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
  }
}
