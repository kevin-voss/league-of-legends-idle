import { ROLE_LABELS } from "../../data/Constants.js";
                                                              

                                      
                     
                       
                     
                     
                   
                                   
                                     
                                 
 

export function createChampionCard(selection                   , options                      = {})              {
  const card = document.createElement("article");
  card.className = "champion-card";
  if (options.selectable) {
    card.classList.add("selectable");
  }
  if (options.disabled) {
    card.classList.add("disabled");
    card.setAttribute("aria-disabled", "true");
  }
  if (options.selected) {
    card.classList.add("selected");
  }
  if (options.selectable) {
    card.setAttribute("role", "button");
    card.tabIndex = options.disabled ? -1 : 0;
    card.addEventListener("click", (event) => {
      if (options.disabled || (event.target instanceof HTMLElement && event.target.closest("button"))) {
        return;
      }
      options.onSelect?.(selection.owned.uid);
    });
    card.addEventListener("keydown", (event) => {
      if (options.disabled || (event.target instanceof HTMLElement && event.target.closest("button"))) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        options.onSelect?.(selection.owned.uid);
      }
    });
  }

  const tierClass = selection.template.tier === "S+" ? "tier-S-plus" : `tier-${selection.template.tier}`;
  const row = document.createElement("div");
  row.className = "name-row";

  const name = document.createElement("h3");
  name.textContent = selection.template.name;

  const tier = document.createElement("strong");
  tier.className = tierClass;
  tier.textContent = selection.template.tier;

  const tools = document.createElement("div");
  tools.className = "card-tools";
  if (options.onFavorite) {
    tools.append(createCardTool(options.favorite ? "Fav" : "Fav", options.favorite ? "Unfavorite" : "Favorite", Boolean(options.favorite), () => {
      options.onFavorite?.(selection.owned.uid);
    }));
  }
  if (options.onLock) {
    tools.append(createCardTool(options.locked ? "Lock" : "Lock", options.locked ? "Unlock slot" : "Lock slot", Boolean(options.locked), () => {
      options.onLock?.(selection.owned.uid);
    }));
  }

  if (tools.childElementCount > 0) {
    row.append(name, tools, tier);
  } else {
    row.append(name, tier);
  }

  const badges = document.createElement("div");
  badges.className = "badge-row";
  badges.append(
    createBadge(ROLE_LABELS[selection.template.role]),
    createBadge(`Lvl ${selection.owned.level}`),
    createBadge(`${selection.template.baseStats.hp} HP`)
  );
  if (options.favorite) {
    badges.append(createBadge("Favorite"));
  }
  if (options.locked) {
    badges.append(createBadge("Locked"));
  }

  const miniStats = document.createElement("div");
  miniStats.className = "mini-stats muted";
  miniStats.append(
    createBadge(`AD ${selection.template.baseStats.ad}`),
    createBadge(`AP ${selection.template.baseStats.ap}`),
    createBadge(`AS ${selection.template.baseStats.as}`)
  );

  card.append(row, badges, miniStats);
  return card;
}

function createCardTool(text        , label        , active         , onClick            )                    {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `card-tool${active ? " active" : ""}`;
  button.textContent = text;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", active ? "true" : "false");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function createBadge(text        )              {
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = text;
  return badge;
}
