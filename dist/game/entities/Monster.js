import { Entity } from "./Entity.js";
import { calculateAttackPeriod, calculateTypedDamage } from "../combat/DamageCalculator.js";
                                                    
                                                  

                                                      

export class Monster extends Entity {
  monsterType             ;
  /** MapData camp id for jungle camps; empty for dragon/baron. */
  campId        ;
  name        ;
  attackTimer = 0;
  attackSpeed        ;
  ad        ;
  armor        ;
  mr        ;
  respawnSeconds        ;
  respawnTimer = 0;
  home       ;
  activeAt        ;

  constructor(monsterType             , name        , position       , activeAt        , respawnSeconds        , campId = "") {
    const hp = monsterType === "baron" ? 3200 : monsterType === "dragon" ? 2100 : 760;
    super("monster", "neutral", position, hp, 0, monsterType === "camp" ? 18 : 30);
    this.id = `objective-${monsterType}-${name.toLowerCase().replace(/\s+/g, "-")}`;
    this.monsterType = monsterType;
    this.campId = campId;
    this.name = name;
    this.activeAt = activeAt;
    this.respawnSeconds = respawnSeconds;
    this.home = { x: position.x, y: position.y };
    this.attackSpeed = monsterType === "baron" ? 0.55 : monsterType === "dragon" ? 0.62 : 0.7;
    this.ad = monsterType === "baron" ? 86 : monsterType === "dragon" ? 62 : 38;
    this.armor = monsterType === "baron" ? 58 : monsterType === "dragon" ? 42 : 22;
    this.mr = monsterType === "baron" ? 42 : monsterType === "dragon" ? 38 : 18;
    if (activeAt > 0) {
      this.alive = false;
      this.currentHp = 0;
      this.respawnTimer = activeAt;
    }
  }

  update(match       , dt        )       {
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.healFull();
        this.pos.x = this.home.x;
        this.pos.y = this.home.y;
      }
      return;
    }

    this.attackTimer = Math.max(0, this.attackTimer - dt);
    const target = match.findChampionNear(this.pos, "neutral", 155);
    if (target && this.attackTimer <= 0) {
      const damage = calculateTypedDamage(this.ad, "physical", target.stats);
      this.attackTimer = calculateAttackPeriod(this.attackSpeed);
      match.applyDamage(this, target, damage, "physical", this.name);
    }
  }

  scheduleRespawn()       {
    this.alive = false;
    this.currentHp = 0;
    this.respawnTimer = this.respawnSeconds;
  }
}
