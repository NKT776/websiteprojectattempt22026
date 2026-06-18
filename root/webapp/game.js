const Game = {
selectedTerritory: null,
playerFaction: null,
phase: "setup",

turn: 1,
currentActor: null,

playerRecruitedThisTurn: false,
playerInvadedThisTurn: false,
playerRecruitmentMarket: [],

pendingDefenseBattle: null,
pendingDefenseResolver: null,
lastBattleLog: [],

  async init() {
    log("Initializing...");

this.selectedTerritory = null;
this.playerFaction = null;
this.phase = "chooseFaction";
this.turn = 1;
this.currentActor = null;
this.playerRecruitedThisTurn = false;
this.playerInvadedThisTurn = false;

const turnPanel = document.getElementById("turnPanel");
if (turnPanel) {
  turnPanel.classList.add("hidden");
  turnPanel.innerHTML = `
    <h2>Turn</h2>
    <p>The game has not started.</p>
  `;
}

    const playerPanel = document.getElementById("playerPanel");
    if (playerPanel) {
    playerPanel.classList.add("hidden");
    playerPanel.innerHTML = `
    <h2>Player Faction</h2>
    <p>Choose a faction to begin.</p>
    `;
}

    const scenarioId = ScenarioLoader.getSelectedScenarioId();
    log(`Loading scenario: ${scenarioId}`);

    const territoryNames = await NameLoader.loadTerritoryNames(
      ScenarioLoader.getScenarioPath("territoryNames.txt")
);

    Map.generate(territoryNames);

    await Factions.load();
    await Commanders.load();

    this.assignTerritories();
    this.assignCommanders();

    this.setupMapClick();
    this.updateStatus();

    this.render();
  },

assignTerritories() {
  // Clear existing ownership
  for (const territory of Map.territories) {
    territory.owner = null;
  }

  for (const faction of Factions.list) {
    faction.territories = [];
  }

  // Every active faction already has a randomly assigned tier and territory count
  const factionStarts = Factions.list.map(faction => ({
    faction,
    size: faction.startingTerritoryCount
  }));

  // Shuffle assignment order so supermajors do not always place first
  shuffleArray(factionStarts);

  const occupied = new Set();

  for (const start of factionStarts) {
    const cluster = this.findRandomConnectedCluster(start.size, occupied);

    if (!cluster) {
      throw new Error(
        `Could not find continuous starting territories for ${start.faction.name}`
      );
    }

    start.faction.territories = cluster;

    for (const territory of cluster) {
      territory.owner = start.faction;
      occupied.add(territory.id);
    }

    log(
      `${start.faction.name} (${start.faction.tier}) starts in: ` +
      cluster.map(t => t.name).join(", ")
    );
  }
},

findRandomConnectedCluster(size, occupied) {
  const maxAttempts = 500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const available = Map.territories.filter(t => !occupied.has(t.id));
    if (available.length < size) return null;

    const start = randomChoice(available);
    const cluster = [start];
    const clusterIds = new Set([start.id]);

    while (cluster.length < size) {
      const frontier = [];

      for (const territory of cluster) {
        for (const neighborId of territory.connections) {
          if (occupied.has(neighborId)) continue;
          if (clusterIds.has(neighborId)) continue;

          frontier.push(Map.territories[neighborId]);
        }
      }

      if (frontier.length === 0) break;

      const next = randomChoice(frontier);
      cluster.push(next);
      clusterIds.add(next.id);
    }

    if (cluster.length === size) {
      return cluster;
    }
  }

  return null;
},

assignCommanders() {
  for (const faction of Factions.list) {
    const budget = this.getAvailablePoints(faction);

    faction.commanders = [];

    let remaining = budget;

    faction.commanders.push(faction.leader);
    remaining -= faction.leader.cost;

    let safety = 50;

    while (safety-- > 0) {
      const c = Commanders.getRandomAffordable(remaining);

      if (!c) {
        break;
      }

      faction.commanders.push(c);
      remaining -= c.cost;

      if (faction.commanders.length >= 6) {
        break;
      }
    }

    log(`${faction.name}: ${faction.commanders.length} commanders, budget ${budget}`);
  }
},

render() {
  const canvas = document.getElementById("map");
  const ctx = canvas.getContext("2d");

  let physicsSteps = 0;
  const maxPhysicsSteps = 300;

  const loop = () => {
    if (physicsSteps < maxPhysicsSteps) {
      Map.stepPhysics();
      physicsSteps++;
    }

    Map.draw(ctx);

    if (this.selectedTerritory) {
      Map.highlightTerritory(ctx, this.selectedTerritory);
    }

    requestAnimationFrame(loop);
  };

  loop();
},

setupMapClick() {
  const canvas = document.getElementById("map");

  canvas.onclick = (event) => {
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const territory = Map.getTerritoryAt(x, y);

    if (!territory) {
      return;
    }

    this.selectedTerritory = territory;
    this.showTerritoryInfo(territory);
  };
},

showTerritoryInfo(territory) {
  const panel = document.getElementById("territoryPanel");
  const faction = territory.owner;

  if (!faction) {
    panel.innerHTML = `
      <h2>${territory.name}</h2>

      <div class="stat-grid">
        <div class="stat-label">Territory ID</div>
        <div>${territory.id}</div>

        <div class="stat-label">Defense</div>
        <div>${territory.defense}</div>

        <div class="stat-label">Economy</div>
        <div>${territory.economy} gold / turn</div>

        <div class="stat-label">Points</div>
        <div>${territory.points}</div>

        <div class="stat-label">Controller</div>
        <div>Neutral</div>
      </div>
    `;

    return;
  }

  const leader = faction.leader;
  const leaderName = leader
    ? `${leader.first} ${leader.last}`
    : "Unknown";

  const chooseButton =
    this.phase === "chooseFaction"
      ? `
        <button class="choice-button" onclick="Game.choosePlayerFaction(${faction.id})">
          Play as ${faction.name}
        </button>
      `
      : "";

  const playerLabel =
    this.playerFaction && this.playerFaction.id === faction.id
      ? `<p><strong>This is your faction.</strong></p>`
      : "";

  panel.innerHTML = `
    <h2>${territory.name}</h2>

    <div class="stat-grid">
      <div class="stat-label">Territory ID</div>
      <div>${territory.id}</div>

      <div class="stat-label">Defense</div>
      <div>${territory.defense}</div>

      <div class="stat-label">Economy</div>
      <div>${territory.economy} gold / turn</div>

      <div class="stat-label">Points</div>
      <div>${territory.points}</div>

      <div class="stat-label">Controller</div>
      <div>${faction.name}</div>

      <div class="stat-label">Faction Tier</div>
      <div>${faction.tier}</div>

      <div class="stat-label">Faction Territories</div>
      <div>${faction.territories.length}</div>

      <div class="stat-label">Faction Leader</div>
      <div>${leaderName}</div>
    </div>

    ${playerLabel}
    ${chooseButton}
  `;
},

choosePlayerFaction(factionId) {
  if (this.phase !== "chooseFaction") {
    return;
  }

  const faction = Factions.list.find(f => f.id === factionId);

  if (!faction) {
    console.error("Faction not found:", factionId);
    return;
  }

  this.playerFaction = faction;
  this.phase = "playerTurn";
  this.turn = 1;

  this.playerRecruitedThisTurn = false;
  this.playerInvadedThisTurn = false;

  this.startFactionTurn(faction);
  this.generatePlayerRecruitmentMarket();

  log(`You are now playing as ${faction.name}.`);
  log(`Turn ${this.turn} begins.`);

  this.updateStatus();
  this.updatePlayerPanel();
  this.updateTurnPanel();

  if (this.selectedTerritory) {
    this.showTerritoryInfo(this.selectedTerritory);
  }
},

updateStatus() {
  const status = document.getElementById("gameStatus");

  if (!status) return;

  if (this.phase === "setup") {
    status.innerText = "Initialize the game, then click a territory to choose your faction.";
    return;
  }

  if (this.phase === "chooseFaction") {
    status.innerText = "Choose your faction: click any occupied territory, then press “Play as this faction.”";
    return;
  }

  if (this.phase === "playerTurn" && this.playerFaction) {
    status.innerText = `Turn ${this.turn}: Your turn as ${this.playerFaction.name}.`;
    return;
  }

  if (this.phase === "playerDefense") {
  status.innerText = "Your territory is under attack. Choose up to 3 defending commanders.";
  return;
  }

  if (this.phase === "aiTurn") {
    status.innerText = `Turn ${this.turn}: AI factions are acting.`;
    return;
  }

  if (this.phase === "gameOver") {
  status.innerText = "Game over: your faction has been eliminated.";
  return;

  if (this.phase === "victory") {
  status.innerText = `Victory! ${this.playerFaction.name} controls the entire map.`;
  return;
  }
}
},

startFactionTurn(faction) {
  const income = this.getFactionIncome(faction);

  faction.gold += income;

  for (const commander of faction.commanders) {
    Commander.setActive(commander);
  }

  log(`${faction.name} begins turn. +${income} gold.`);
},

getFactionIncome(faction) {
  return faction.territories.reduce((sum, territory) => {
    return sum + territory.economy;
  }, 0);
},

useCommander(commanderId) {
  if (!this.playerFaction) {
    return;
  }

  const commander = this.playerFaction.commanders.find(c => String(c.id) === String(commanderId));

  if (!commander) {
    console.error("Commander not found:", commanderId);
    return;
  }

  Commander.setTired(commander);

  this.updatePlayerPanel();

  log(`${commander.first} ${commander.last} is now Tired.`);
},

updatePlayerPanel() {
  const panel = document.getElementById("playerPanel");

  if (!panel) {
    return;
  }

  if (!this.playerFaction) {
    panel.classList.add("hidden");
    return;
  }

  const faction = this.playerFaction;
  const leader = faction.leader;
  const leaderName = leader
    ? `${leader.first} ${leader.last}`
    : "Unknown";

  const income = this.getFactionIncome(faction);

  const territoryList = faction.territories
    .map(t => `${t.name} (#${t.id})`)
    .join(", ");

const commanderCards = faction.commanders.map(commander => {
  const statusClass =
    commander.status === "Active"
      ? "commander-status-active"
      : "commander-status-tired";

  const leaderBadge = commander.isLeader ? " — Leader" : "";

  const missingTroops = commander.maxtroop - commander.currentTroops;
  const costPerTroop = this.getCommanderRestoreCostPerTroop(commander);

  const maxAffordableTroops = Math.floor(faction.gold / costPerTroop);

  const maxRestorableTroops = Math.min(
    missingTroops,
    maxAffordableTroops
  );

  const restoreControl =
    missingTroops <= 0
      ? `<p class="small-note">Troops are full.</p>`
      : maxRestorableTroops <= 0
        ? `
          <p class="small-note">
            Missing ${missingTroops} troops. Restore cost is ${costPerTroop} gold per troop.
            You do not have enough gold to restore any troops.
          </p>
        `
        : `
          <div class="restore-control">
            <div class="restore-row">
              <strong>Restore Troops</strong>
              <span id="restorePreview_${commander.id}">
                ${maxRestorableTroops} troops — ${maxRestorableTroops * costPerTroop} gold
              </span>
            </div>

            <input
              id="restoreSlider_${commander.id}"
              class="restore-slider"
              type="range"
              min="1"
              max="${maxRestorableTroops}"
              value="${maxRestorableTroops}"
              oninput="Game.updateRestorePreview('${commander.id}')"
            >

            <button
              class="action-button"
              onclick="
                Game.playerRestoreCommander(
                  '${commander.id}',
                  document.getElementById('restoreSlider_${commander.id}').value
                )
              "
            >
              Restore Selected Troops
            </button>

            <p class="small-note">
              Missing: ${missingTroops}. Cost: ${costPerTroop} gold per troop.
            </p>
          </div>
        `;

  return `
    <div class="commander-card">
      <h3>${commander.first} ${commander.last}${leaderBadge}</h3>

      <div class="stat-grid">
        <div class="stat-label">ID</div>
        <div>${commander.id}</div>

        <div class="stat-label">Cost</div>
        <div>${commander.cost}</div>

        <div class="stat-label">Attack</div>
        <div>${commander.attack}</div>

        <div class="stat-label">Defense</div>
        <div>${commander.defense}</div>

        <div class="stat-label">Speed</div>
        <div>${commander.speed}</div>

        <div class="stat-label">Troops</div>
        <div>${commander.currentTroops} / ${commander.maxtroop}</div>

        <div class="stat-label">Status</div>
        <div class="${statusClass}">${commander.status}</div>
      </div>

      ${restoreControl}
    </div>
  `;
}).join("");

  panel.classList.remove("hidden");

  panel.innerHTML = `
    <h2>${faction.name}</h2>

    <div class="stat-grid">
      <div class="stat-label">Tier</div>
      <div>${faction.tier}</div>

      <div class="stat-label">Leader</div>
      <div>${leaderName}</div>

      <div class="stat-label">Gold</div>
      <div>${faction.gold}</div>

      <div class="stat-label">Income</div>
      <div>${income} gold / turn</div>

      <div class="stat-label">Territories</div>
      <div>${faction.territories.length}</div>

      <div class="stat-label">Territory List</div>
      <div>${territoryList}</div>
    </div>

    <h2>Commanders</h2>
    <p class="small-note">
      Commanders begin each faction turn as Active. Once used for offense or defense,
      they become Tired.
    </p>

    <div class="commander-list">
      ${commanderCards}
    </div>
  `;
},

getAvailablePoints(faction) {
  return faction.territories.reduce((sum, territory) => {
    return sum + territory.points;
  }, 0) + 5;
},

getUsedPoints(faction) {
  return faction.commanders.reduce((sum, commander) => {
    return sum + commander.cost;
  }, 0);
},

getOverPointMultiplier(faction) {
  const available = this.getAvailablePoints(faction);
  const used = this.getUsedPoints(faction);

  if (used <= available) {
    return 1;
  }

  if (used <= 0) {
    return 1;
  }

  return available / used;
},

getFactionIncome(faction) {
  return faction.territories.reduce((sum, territory) => {
    return sum + territory.economy;
  }, 0);
},

startFactionTurn(faction) {
  const income = this.getFactionIncome(faction);
  const multiplier = this.getOverPointMultiplier(faction);

  const adjustedIncome = Math.floor(income * multiplier);
  faction.gold += adjustedIncome;

  for (const commander of faction.commanders) {
    Commander.setActive(commander);

    const baseReplenishment = Math.floor(commander.maxtroop * 0.05);
    const adjustedReplenishment = Math.floor(baseReplenishment * multiplier);

    commander.currentTroops = Math.min(
      commander.maxtroop,
      commander.currentTroops + adjustedReplenishment
    );
  }

  if (multiplier < 1) {
    log(
      `${faction.name} is over commander capacity. Income and replenishment reduced to ${Math.round(multiplier * 100)}%.`
    );
  }

  log(`${faction.name} begins turn. +${adjustedIncome} gold.`);
},

getCommanderRecruitmentCost(commander) {
  const attack = commander.attackBase;
  const defense = commander.defenseBase;
  const speed = commander.speedBase;

  const attackPower = attack * attack;
  const defensePower = defense * defense;
  const speedPower = speed * speed;

  const troopPower = Math.floor(commander.maxtroop / 250);
  const troopCost = troopPower * troopPower * 250;

  const statCost =
    attackPower * 900 +
    defensePower * 900 +
    speedPower * 900 +
    troopCost;

  return 10000 + statCost;
},

canRecruitCommander(faction, commander) {
  const availablePoints = this.getAvailablePoints(faction);
  const usedPoints = this.getUsedPoints(faction);
  const recruitmentCost = this.getCommanderRecruitmentCost(commander);

  return (
    Commanders.isAvailable(commander.id) &&
    usedPoints + commander.cost <= availablePoints &&
    faction.gold >= recruitmentCost
  );
},

recruitCommanderForFaction(faction, commander) {
  const recruitmentCost = this.getCommanderRecruitmentCost(commander);

  if (!this.canRecruitCommander(faction, commander)) {
    return false;
  }

  faction.gold -= recruitmentCost;

  const recruited = Commander.cloneCommander(commander);
  faction.commanders.push(recruited);
  Commanders.markUnavailable(commander.id);

  log(`${faction.name} recruited ${recruited.first} ${recruited.last} for ${recruitmentCost} gold.`);

  return true;
},

playerRecruitCommander(commanderId) {
if (this.phase === "victory" || this.phase === "gameOver") {
  return;
}

  if (this.phase !== "playerTurn") {
    return;
  }

  if (this.playerRecruitedThisTurn) {
    log("You have already recruited a commander this turn.");
    return;
  }

  const commander = this.playerRecruitmentMarket.find(c => {
    return Number(c.id) === Number(commanderId);
  });

  if (!commander) {
    log("That commander is not available in this turn's recruitment market.");
    return;
  }

  const success = this.recruitCommanderForFaction(this.playerFaction, commander);

  if (!success) {
    log("Cannot recruit that commander. Check gold, available points, or availability.");
    return;
  }

  this.playerRecruitedThisTurn = true;

  // Remove recruited commander from this turn's market.
  this.playerRecruitmentMarket = this.playerRecruitmentMarket.filter(c => {
    return Number(c.id) !== Number(commanderId);
  });

  this.updatePlayerPanel();
  this.updateTurnPanel();
},

getCommanderRestoreCostPerTroop(commander) {
  /*
    Stronger commanders cost more per troop.
    This intentionally keeps maxtroop out of the per-troop stat multiplier,
    because maxtroop already affects total restoration volume.
  */

  const statPower =
    commander.attackBase * commander.attackBase +
    commander.defenseBase * commander.defenseBase +
    commander.speedBase * commander.speedBase;

  return 2 + Math.floor(statPower / 3);
},

getCommanderRestoreCost(commander) {
  const missing = commander.maxtroop - commander.currentTroops;
  return missing * this.getCommanderRestoreCostPerTroop(commander);
},

restoreCommanderTroops(faction, commander, requestedTroops = null) {
  const missing = commander.maxtroop - commander.currentTroops;

  if (missing <= 0) {
    return false;
  }

  const costPerTroop = this.getCommanderRestoreCostPerTroop(commander);

  const affordableTroops = Math.floor(faction.gold / costPerTroop);

  if (affordableTroops <= 0) {
    return false;
  }

  const desiredTroops =
    requestedTroops === null
      ? missing
      : Math.max(0, Number.parseInt(requestedTroops, 10));

  const actualTroops = Math.min(
    missing,
    affordableTroops,
    desiredTroops
  );

  if (actualTroops <= 0) {
    return false;
  }

  const cost = actualTroops * costPerTroop;

  faction.gold -= cost;
  commander.currentTroops += actualTroops;

  log(
    `${faction.name} restored ${actualTroops} troops to ` +
    `${commander.first} ${commander.last} for ${cost} gold.`
  );

  return true;
},

playerRestoreCommander(commanderId, requestedTroops = null) {
if (this.phase === "victory" || this.phase === "gameOver") {
  return;
}

  if (this.phase !== "playerTurn") {
    return;
  }

  const commander = this.playerFaction.commanders.find(c => {
    return String(c.id) === String(commanderId);
  });

  if (!commander) {
    log("Commander not found.");
    return;
  }

  const success = this.restoreCommanderTroops(
    this.playerFaction,
    commander,
    requestedTroops
  );

  if (!success) {
    log("Could not restore troops. Either the commander is full, the amount was 0, or you lack gold.");
  }

  this.updatePlayerPanel();
  this.updateTurnPanel();
},

getEnemyNeighborTerritories(faction) {
  const results = [];
  const seen = new Set();

  for (const territory of faction.territories) {
    for (const neighborId of territory.connections) {
      const neighbor = Map.territories[neighborId];

      if (!neighbor.owner) continue;
      if (neighbor.owner.id === faction.id) continue;
      if (seen.has(neighbor.id)) continue;

      seen.add(neighbor.id);
      results.push(neighbor);
    }
  }

  return results;
},

getTopDefenders(faction, maxCount = 3) {
  return [...faction.commanders]
    .filter(c => c.currentTroops > 0 && c.status === "Active")
    .sort((a, b) => b.currentTroops - a.currentTroops)
    .slice(0, maxCount);
},

resolveInvasion(attackingFaction, defendingTerritory, attackingCommanders, defendingCommanders, options = {}) {
  const defendingFaction = defendingTerritory.owner;

  if (!defendingFaction) {
    return false;
  }

  attackingCommanders = attackingCommanders
    .filter(c => c && c.currentTroops > 0)
    .slice(0, 3);

  defendingCommanders = defendingCommanders
    .filter(c => c && c.currentTroops > 0)
    .slice(0, 3);

  const battleResult = this.resolveBattle({
    attackingFaction,
    defendingFaction,
    territory: defendingTerritory,
    attackers: attackingCommanders,
    defenders: defendingCommanders
  });

  this.lastBattleLog = battleResult.log;

  for (const commander of attackingCommanders) {
    Commander.setTired(commander);
  }

  if (!options.defendersStayActive) {
    for (const commander of defendingCommanders) {
      Commander.setTired(commander);
    }
  }

  log(
    `${attackingFaction.name} invaded ${defendingTerritory.name}. ` +
    `${battleResult.attackerWon ? "Attackers won." : "Defenders held."}`
  );

  for (const entry of battleResult.log) {
    log(entry);
  }

  if (battleResult.attackerWon) {
    this.transferTerritory(defendingTerritory, defendingFaction, attackingFaction);
    log(`${attackingFaction.name} captured ${defendingTerritory.name}.`);
    return true;
  }

  log(`${defendingFaction.name} defended ${defendingTerritory.name}.`);
  return false;
},

transferTerritory(territory, oldFaction, newFaction) {
  oldFaction.territories = oldFaction.territories.filter(t => t.id !== territory.id);

  territory.owner = newFaction;
  newFaction.territories.push(territory);

  this.checkFactionElimination(oldFaction);

  if (
    this.playerFaction &&
    newFaction.id === this.playerFaction.id
  ) {
    this.checkPlayerVictory();
  }
},

playerInvade(targetTerritoryId, commanderIds) {
if (this.phase === "victory" || this.phase === "gameOver") {
  return;
}

  if (this.phase !== "playerTurn") {
    return;
  }

  if (this.playerInvadedThisTurn) {
    log("You have already invaded this turn.");
    return;
  }

  const target = Map.territories.find(t => Number(t.id) === Number(targetTerritoryId));

  if (!target || !target.owner || target.owner.id === this.playerFaction.id) {
    log("Invalid invasion target.");
    return;
  }

  const validTargets = this.getEnemyNeighborTerritories(this.playerFaction);

  if (!validTargets.some(t => t.id === target.id)) {
    log("You can only invade neighboring enemy territories.");
    return;
  }

  const selectedCommanders = commanderIds
    .map(id => this.playerFaction.commanders.find(c => String(c.id) === String(id)))
    .filter(Boolean);

  if (selectedCommanders.length < 1 || selectedCommanders.length > 3) {
    log("Choose between 1 and 3 commanders.");
    return;
  }

  if (selectedCommanders.some(c => c.status !== "Active")) {
    log("Only Active commanders can invade.");
    return;
  }

  if (selectedCommanders.some(c => c.currentTroops <= 0)) {
    log("Commanders with no troops cannot invade.");
    return;
  }

const defendingCommanders = this.getTopDefenders(target.owner, 3);

this.resolveInvasion(
  this.playerFaction,
  target,
  selectedCommanders,
  defendingCommanders,
  {
    defendersStayActive: false
  }
);

  this.playerInvadedThisTurn = true;

  this.updatePlayerPanel();
  this.updateTurnPanel();

  if (this.selectedTerritory) {
    this.showTerritoryInfo(this.selectedTerritory);
  }
},

async runAITurns() {
  const aiFactions = Factions.list.filter(f => {
    return (
      this.playerFaction &&
      f.id !== this.playerFaction.id &&
      !f.eliminated &&
      f.territories.length > 0
    );
  });

  shuffleArray(aiFactions);

  for (const faction of aiFactions) {
    await this.runSingleAITurn(faction);
  }
},

async runSingleAITurn(faction) {
  if (!faction || faction.eliminated || faction.territories.length <= 0) {
    return;
  }

  this.startFactionTurn(faction);

  if (Math.random() < 0.20) {
    this.aiTryRecruit(faction);
  }

  this.aiRestoreTroops(faction);

  if (Math.random() < 0.20) {
    await this.aiTryInvade(faction);
  }
},

aiTryRecruit(faction) {
  const available = Commanders.getAvailableCommanders();

  if (available.length === 0) {
    return;
  }

  const candidate = randomChoice(available);

  if (!this.canRecruitCommander(faction, candidate)) {
    log(`${faction.name} considered recruiting ${candidate.first} ${candidate.last}, but could not afford or field them.`);
    return;
  }

  this.recruitCommanderForFaction(faction, candidate);
},

aiRestoreTroops(faction) {
  const damaged = [...faction.commanders]
    .filter(c => c.currentTroops < c.maxtroop)
    .sort((a, b) => {
      const aMissing = a.maxtroop - a.currentTroops;
      const bMissing = b.maxtroop - b.currentTroops;
      return bMissing - aMissing;
    });

  for (const commander of damaged) {
    if (faction.gold <= 0) {
      break;
    }

    this.restoreCommanderTroops(faction, commander);
  }
},

async aiTryInvade(faction) {
  if (faction.territories.length <= 1) {
    return;
  }

  const fullTroopCommanders = faction.commanders.filter(c => {
    return c.currentTroops >= c.maxtroop && c.currentTroops > 0;
  });

  if (fullTroopCommanders.length < 3) {
    return;
  }

  const targets = this.getEnemyNeighborTerritories(faction);

  if (targets.length === 0) {
    return;
  }

  const target = randomChoice(targets);

  const attackers = [...fullTroopCommanders]
    .sort((a, b) => b.currentTroops - a.currentTroops)
    .slice(0, 3);

  let defenders;

  const targetIsPlayer =
    this.playerFaction &&
    target.owner &&
    target.owner.id === this.playerFaction.id;

  if (targetIsPlayer) {
    this.phase = "playerDefense";
    this.updateStatus();
    this.updateTurnPanel();

    defenders = await this.promptPlayerDefense(faction, target, attackers);

    this.phase = "aiTurn";
    this.updateStatus();
  } else {
    defenders = this.getTopDefenders(target.owner, 3);
  }

this.resolveInvasion(faction, target, attackers, defenders, {
  defendersStayActive: !targetIsPlayer
});

  this.updatePlayerPanel();
  this.updateTurnPanel();

  if (this.selectedTerritory) {
    this.showTerritoryInfo(this.selectedTerritory);
  }
},

async endPlayerTurn() {
if (this.phase === "victory" || this.phase === "gameOver") {
  return;
}

  if (this.phase !== "playerTurn") {
    return;
  }

  log(`Ending player turn ${this.turn}.`);

  this.phase = "aiTurn";
  this.updateStatus();
  this.updateTurnPanel();

  await this.runAITurns();

  if (this.checkPlayerVictory()) {
    return;
  }

  if (this.playerFaction.eliminated || this.playerFaction.territories.length <= 0) {
    this.phase = "gameOver";
    log(`${this.playerFaction.name} has been eliminated. Game over.`);

    this.updateStatus();
    this.updatePlayerPanel();
    this.updateTurnPanel();

    return;
  }

  this.turn++;
  this.phase = "playerTurn";

  this.playerRecruitedThisTurn = false;
  this.playerInvadedThisTurn = false;

  this.startFactionTurn(this.playerFaction);
  this.generatePlayerRecruitmentMarket();

  log(`Turn ${this.turn} begins.`);

  this.updateStatus();
  this.updatePlayerPanel();
  this.updateTurnPanel();

  if (this.selectedTerritory) {
    this.showTerritoryInfo(this.selectedTerritory);
  }
},

updateTurnPanel() {
  const panel = document.getElementById("turnPanel");

  if (!panel) return;

  if (!this.playerFaction) {
    panel.classList.add("hidden");
    return;
  }

  if (this.phase === "gameOver") {
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <h2>Game Over</h2>
    <p>Your faction has been eliminated.</p>
  `;
  return;
}

if (this.phase === "victory") {
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <h2>Victory</h2>
    <p class="success-text">
      ${this.playerFaction.name} controls all ${Map.territories.length} territories.
    </p>
  `;
  return;
}

if (this.phase === "playerDefense") {
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <h2>Turn ${this.turn}</h2>
    <p class="danger-text">
      Your territory is under attack. Select defenders in the defense panel.
    </p>
  `;
  return;
}

  panel.classList.remove("hidden");

  const faction = this.playerFaction;

  const availablePoints = this.getAvailablePoints(faction);
  const usedPoints = this.getUsedPoints(faction);
  const multiplier = this.getOverPointMultiplier(faction);

  const recruitDisabled = this.playerRecruitedThisTurn ? "disabled" : "";
  const invadeDisabled = this.playerInvadedThisTurn ? "disabled" : "";

  const recruitOptions = this.playerRecruitmentMarket
    .filter(c => Commanders.isAvailable(c.id))
    .map(c => {
      const recruitCost = this.getCommanderRecruitmentCost(c);
      const affordable = this.canRecruitCommander(faction, c);

      return `
        <option value="${c.id}">
          ${c.first} ${c.last} — Cost ${recruitCost}g, Points ${c.cost}, ` +
          `A${c.attack}/D${c.defense}/S${c.speed}/T${c.maxtroop}${affordable ? "" : " — unavailable"}
        </option>
      `;
    })
    .join("");

  const invadeTargets = this.getEnemyNeighborTerritories(faction)
    .map(t => {
      return `<option value="${t.id}">${t.name} — ${t.owner.name}</option>`;
    })
    .join("");

  const activeCommanders = faction.commanders
    .filter(c => c.status === "Active" && c.currentTroops > 0)
    .map(c => {
      return `
        <label>
          <input type="checkbox" class="invadeCommanderCheck" value="${c.id}">
          ${c.first} ${c.last} — ${c.currentTroops}/${c.maxtroop}
        </label><br>
      `;
    })
    .join("");

  const penaltyText =
    multiplier < 1
      ? `<p class="warning-text">Over commander capacity: income and replenishment are reduced to ${Math.round(multiplier * 100)}%.</p>`
      : `<p class="success-text">Commander capacity is within limits.</p>`;

  panel.innerHTML = `
    <h2>Turn ${this.turn}</h2>

    <div class="stat-grid">
      <div class="stat-label">Phase</div>
      <div>${this.phase}</div>

      <div class="stat-label">Gold</div>
      <div>${faction.gold}</div>

      <div class="stat-label">Income</div>
      <div>${this.getFactionIncome(faction)} gold / turn</div>

      <div class="stat-label">Available Points</div>
      <div>${availablePoints}</div>

      <div class="stat-label">Used Points</div>
      <div>${usedPoints}</div>
    </div>

    ${penaltyText}

    <div class="action-section">
      <h3>Recruit Commander</h3>
      <p>Recruitment is limited to one commander per turn. Only 10 random commanders are available each player turn.</p>

      <select id="recruitCommanderSelect" ${recruitDisabled}>
        ${recruitOptions || `<option>No commanders available</option>`}
      </select>

      <br>

      <button class="action-button" ${recruitDisabled} onclick="
        Game.playerRecruitCommander(document.getElementById('recruitCommanderSelect').value)
      ">
        Recruit Commander
      </button>
    </div>

    <div class="action-section">
      <h3>Restore Commander Troops</h3>
      <p>Use the restore buttons in the player faction commander list.</p>
    </div>

    <div class="action-section">
      <h3>Invade Territory</h3>
      <p>Choose one neighboring enemy territory and up to three Active commanders.</p>

      <select id="invadeTargetSelect" ${invadeDisabled}>
        ${invadeTargets || `<option>No neighboring enemy territories</option>`}
      </select>

      <div style="margin-top: 8px;">
        ${activeCommanders || `<p>No Active commanders available.</p>`}
      </div>

      <button class="action-button" ${invadeDisabled} onclick="
        Game.playerInvade(
          document.getElementById('invadeTargetSelect').value,
          Array.from(document.querySelectorAll('.invadeCommanderCheck:checked')).map(x => x.value)
        )
      ">
        Invade
      </button>
    </div>

    <div class="action-section">
      <button class="action-button" onclick="Game.endPlayerTurn()">
        End Turn
      </button>
    </div>
  `;
},

isFactionEliminated(faction) {
  return !faction || faction.territories.length <= 0;
},

checkFactionElimination(faction) {
  if (!faction) return;

  if (faction.territories.length > 0) {
    return;
  }

  if (faction.eliminated) {
    return;
  }

  faction.eliminated = true;

  log(`${faction.name} has been eliminated.`);

  for (const commander of faction.commanders) {
    if (commander.isLeader) {
      continue;
    }

    Commanders.markAvailable(commander.id);
    log(`${commander.first} ${commander.last} has returned to the recruitment pool.`);
  }

  // Remove commanders from the eliminated faction so they cannot act later.
  faction.commanders = faction.commanders.filter(c => c.isLeader);
},

generatePlayerRecruitmentMarket() {
  const available = Commanders.getAvailableCommanders();

  shuffleArray(available);

  this.playerRecruitmentMarket = available.slice(0, 10);
},

resolveBattle({ attackingFaction, defendingFaction, territory, attackers, defenders }) {
  const battleLog = [];

  const startingDefenderTroops = defenders.reduce((sum, c) => {
    return sum + c.currentTroops;
  }, 0);

  if (attackers.length === 0) {
    battleLog.push("The attacker had no valid commanders. The attack failed.");
    return {
      attackerWon: false,
      log: battleLog
    };
  }

  if (defenders.length === 0 || startingDefenderTroops <= 0) {
    battleLog.push("The defender fielded no commanders. The territory was lost automatically.");
    return {
      attackerWon: true,
      log: battleLog
    };
  }

  battleLog.push(
    `Battle for ${territory.name}: ${attackingFaction.name} attacks ${defendingFaction.name}.`
  );

  battleLog.push(
    `Starting troops — Attackers: ${this.getTotalTroops(attackers)}, Defenders: ${startingDefenderTroops}.`
  );

  for (let round = 1; round <= 3; round++) {
    if (!this.sideHasTroops(attackers) || !this.sideHasTroops(defenders)) {
      break;
    }

    battleLog.push(`Round ${round} begins.`);

    const actionOrder = this.getBattleActionOrder(attackers, defenders);

    for (const action of actionOrder) {
      const actingCommander = action.commander;

      if (actingCommander.currentTroops <= 0) {
        continue;
      }

      const enemySide = action.side === "attacker" ? defenders : attackers;

      if (!this.sideHasTroops(enemySide)) {
        break;
      }

      const target = randomChoice(enemySide.filter(c => c.currentTroops > 0));

      const defenderDefenseBonus = action.side === "attacker"
        ? territory.defense
        : 0;

      const damage = this.calculateBattleDamage(
        actingCommander,
        target,
        defenderDefenseBonus
      );

      target.currentTroops = Math.max(0, target.currentTroops - damage);

      battleLog.push(
        `${actingCommander.first} ${actingCommander.last} attacks ` +
        `${target.first} ${target.last} for ${damage} damage. ` +
        `${target.first} now has ${target.currentTroops} troops.`
      );

      if (target.currentTroops > 0 && actingCommander.currentTroops > 0) {
        const counterDefenseBonus = action.side === "defender"
          ? territory.defense
          : 0;

        const counterDamage = this.calculateBattleDamage(
          target,
          actingCommander,
          counterDefenseBonus
        );

        actingCommander.currentTroops = Math.max(
          0,
          actingCommander.currentTroops - counterDamage
        );

        battleLog.push(
          `${target.first} ${target.last} counterattacks ` +
          `${actingCommander.first} ${actingCommander.last} for ${counterDamage} damage. ` +
          `${actingCommander.first} now has ${actingCommander.currentTroops} troops.`
        );
      }

      if (!this.sideHasTroops(attackers) || !this.sideHasTroops(defenders)) {
        break;
      }
    }
  }

  const endingDefenderTroops = this.getTotalTroops(defenders);

  battleLog.push(
    `Ending troops — Attackers: ${this.getTotalTroops(attackers)}, Defenders: ${endingDefenderTroops}.`
  );

  const defenderBelowHalf = endingDefenderTroops < Math.floor(startingDefenderTroops / 2);
  const defenderDestroyed = endingDefenderTroops <= 0;

  const attackerWon = defenderDestroyed || defenderBelowHalf;

  if (attackerWon) {
    battleLog.push("The defender was reduced below half strength or destroyed. The attacker wins.");
  } else {
    battleLog.push("The defender kept at least half of its starting strength. The defender wins.");
  }

  return {
    attackerWon,
    log: battleLog
  };
},

getBattleActionOrder(attackers, defenders) {
  const actions = [];

  for (const commander of attackers) {
    if (commander.currentTroops <= 0) continue;

    actions.push({
      commander,
      side: "attacker",
      initiative: commander.speedBase + randInt(-2, 2) + 1
    });
  }

  for (const commander of defenders) {
    if (commander.currentTroops <= 0) continue;

    actions.push({
      commander,
      side: "defender",
      initiative: commander.speedBase + randInt(-2, 2)
    });
  }

  shuffleArray(actions);
  actions.sort((a, b) => b.initiative - a.initiative);

  return actions;
},

calculateBattleDamage(attacker, defender, defenderTerritoryBonus = 0) {
  const effectiveDefense = defender.defenseBase + defenderTerritoryBonus;

  const percent = Math.max(
    1,
    20 + attacker.attackBase - effectiveDefense
  );

  const randomModifier = randFloat(0.5, 2);

  const rawDamage = attacker.currentTroops * (percent / 100) * randomModifier;

  return Math.max(1, Math.floor(rawDamage));
},

getTotalTroops(commanders) {
  return commanders.reduce((sum, commander) => {
    return sum + Math.max(0, commander.currentTroops);
  }, 0);
},

sideHasTroops(commanders) {
  return commanders.some(c => c.currentTroops > 0);
},

promptPlayerDefense(attackingFaction, defendingTerritory, attackingCommanders) {
  return new Promise(resolve => {
    this.pendingDefenseBattle = {
      attackingFaction,
      defendingTerritory,
      attackingCommanders
    };

    this.pendingDefenseResolver = resolve;

    this.showDefensePrompt();
  });
},

showDefensePrompt() {
  const panel = document.getElementById("defensePanel");

  if (!panel || !this.pendingDefenseBattle) {
    return;
  }

  const {
    attackingFaction,
    defendingTerritory,
    attackingCommanders
  } = this.pendingDefenseBattle;

  const playerCommanders = this.playerFaction.commanders
    .filter(c => c.currentTroops > 0 && c.status === "Active");

  const attackingList = attackingCommanders
    .map(c => `${c.first} ${c.last} — ${c.currentTroops}/${c.maxtroop}`)
    .join("<br>");

  const defenderOptions = playerCommanders
    .map(c => {
      return `
        <label>
          <input type="checkbox" class="defenderCommanderCheck" value="${c.id}">
          ${c.first} ${c.last} — ${c.currentTroops}/${c.maxtroop}, Status: ${c.status}
        </label><br>
      `;
    })
    .join("");

  panel.classList.remove("hidden");

  panel.innerHTML = `
    <h2>Defense Required</h2>

    <p>
      <strong>${attackingFaction.name}</strong> is attacking
      <strong>${defendingTerritory.name}</strong>.
    </p>

    <p>
      Territory defense bonus:
      <strong>${defendingTerritory.defense}</strong>
    </p>

    <h3>Enemy Attackers</h3>
    <p>${attackingList}</p>

    <h3>Select up to 3 Defenders</h3>

  <p class="defense-warning">
    Warning: selecting no defenders results in an automatic loss.
    Tired commanders cannot defend.
  </p>

    <div>
      ${defenderOptions || `<p>No commanders with troops available. This will be an automatic loss.</p>`}
    </div>

    <button class="action-button" onclick="
      Game.confirmPlayerDefense(
        Array.from(document.querySelectorAll('.defenderCommanderCheck:checked')).map(x => x.value)
      )
    ">
      Confirm Defenders
    </button>
  `;
},

confirmPlayerDefense(commanderIds) {
  if (!this.pendingDefenseBattle || !this.pendingDefenseResolver) {
    return;
  }

  const selectedDefenders = commanderIds
    .slice(0, 3)
    .map(id => this.playerFaction.commanders.find(c => String(c.id) === String(id)))
    .filter(Boolean)
    .filter(c => c.currentTroops > 0 && c.status === "Active");

  const panel = document.getElementById("defensePanel");

  if (panel) {
    panel.classList.add("hidden");
    panel.innerHTML = `
      <h2>Defense Required</h2>
      <p>No battle pending.</p>
    `;
  }

  const resolve = this.pendingDefenseResolver;

  this.pendingDefenseBattle = null;
  this.pendingDefenseResolver = null;

  resolve(selectedDefenders);
},

updateRestorePreview(commanderId) {
  const slider = document.getElementById(`restoreSlider_${commanderId}`);
  const preview = document.getElementById(`restorePreview_${commanderId}`);

  if (!slider || !preview || !this.playerFaction) {
    return;
  }

  const commander = this.playerFaction.commanders.find(c => {
    return String(c.id) === String(commanderId);
  });

  if (!commander) {
    return;
  }

  const amount = Number.parseInt(slider.value, 10);
  const costPerTroop = this.getCommanderRestoreCostPerTroop(commander);
  const totalCost = amount * costPerTroop;

  preview.innerText = `${amount} troops — ${totalCost} gold`;
},

checkPlayerVictory() {
  if (!this.playerFaction) {
    return false;
  }

  const playerTerritoryCount = this.playerFaction.territories.length;
  const totalTerritoryCount = Map.territories.length;

  if (playerTerritoryCount >= totalTerritoryCount) {
    this.phase = "victory";

    log(`${this.playerFaction.name} controls all territories. Victory!`);

    this.updateStatus();
    this.updatePlayerPanel();
    this.updateTurnPanel();

    return true;
  }

  return false;
},
}

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}
