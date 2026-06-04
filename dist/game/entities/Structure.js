                                                                                                                       
import { calculateAttackPeriod, calculateTypedDamage } from "../combat/DamageCalculator.js";
                                                    
import { Entity } from "./Entity.js";

export class Structure extends Entity {
  structureType               ;
  lane               ;
  tier                      ;
  ad        ;
  armor        ;
  mr        ;
  attackSpeed        ;
  attackRange        ;
  attackTimer = 0;
  isInvulnerable = false;

  constructor(definition                     ) {
    super("structure", definition.side, definition.pos, definition.hp, 0, definition.type === "nexus" ? 34 : 24);
    this.id = definition.id;
    this.structureType = definition.type;
    this.lane = definition.lane;
    this.tier = definition.tier;
    this.ad = definition.ad;
    this.armor = definition.armor;
    this.mr = definition.mr;
    this.attackSpeed = definition.attackSpeed;
    this.attackRange = definition.attackRange;
    this.isInvulnerable = definition.type === "tower" && (definition.tier ?? 1) > 1;
  }

  get team()           {
    return this.side            ;
  }

  update(match       , dt        )       {
    if (!this.alive || this.isInvulnerable) {
      return;
    }

    this.attackTimer = Math.max(0, this.attackTimer - dt);
    const target = match.findTargetForStructure(this);
    if (!target || this.attackTimer > 0) {
      return;
    }

    const defenderStats = match.getDefensiveStats(target);
    const damage = calculateTypedDamage(this.ad, "physical", defenderStats);
    this.attackTimer = calculateAttackPeriod(this.attackSpeed);
    match.applyDamage(this, target, damage, "physical", this.structureType === "tower" ? "Tower" : "Nexus");
  }

  takeDamage(amount        )         {
    if (this.isInvulnerable) {
      return 0;
    }
    return super.takeDamage(amount);
  }

  moveTowards(_point       , _dt        , _speedMultiplier = 1)          {
    return true;
  }
}
