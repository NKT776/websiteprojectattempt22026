const Commanders = {
  pool: [],
  unavailableIds: new Set(),

  async load() {
    const data = await CSVLoader.load(ScenarioLoader.getScenarioPath("commanders.csv"));

    this.pool = data.map(c => Commander.createCommander(c));
    this.unavailableIds = new Set();

    console.log("Loaded commander pool:", this.pool);
  },

  markUnavailable(commanderId) {
    this.unavailableIds.add(Number(commanderId));
  },

  markAvailable(commanderId) {
  this.unavailableIds.delete(Number(commanderId));
  },

  isAvailable(commanderId) {
    return !this.unavailableIds.has(Number(commanderId));
  },

  getAvailableCommanders() {
    return this.pool.filter(c => this.isAvailable(c.id));
  },

  getRandomAffordable(maxCost) {
    const filtered = this.pool.filter(c => {
      return c.cost <= maxCost && this.isAvailable(c.id);
    });

    if (filtered.length === 0) {
      return null;
    }

    const picked = randomChoice(filtered);
    this.markUnavailable(picked.id);

    return Commander.cloneCommander(picked);
  },

  getById(id) {
    return this.pool.find(c => Number(c.id) === Number(id)) || null;
  }
};

const Commander = {
  number(value, fallback = 1) {
    const parsed = Number.parseInt(String(value).trim(), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  },

  createDisplayStat(baseValue) {
  const base = this.number(baseValue, 1);
  const secondDigit = Math.floor(Math.random() * 10);

  return Number(`${base}${secondDigit}`);
  },

  getBaseStat(displayValue) {
  return Math.floor(this.number(displayValue, 1) / 10);
  },

createCommander(row) {
  const maxTroop = this.number(row.maxtroop, 1);

  const attackBase = this.number(row.attack, 1);
  const defenseBase = this.number(row.defense, 1);
  const speedBase = this.number(row.speed, 1);

  return {
    id: this.number(row.id, -1),
    first: row.first || "Unknown",
    last: row.last || "Commander",

    cost: this.number(row.cost, 1),

    attackBase,
    defenseBase,
    speedBase,

    attack: this.createDisplayStat(attackBase),
    defense: this.createDisplayStat(defenseBase),
    speed: this.createDisplayStat(speedBase),

    maxtroop: maxTroop,
    currentTroops: maxTroop,
    status: "Active",

    isLeader: false
  };
},

createLeader(factionRow) {
  const maxTroop = this.number(factionRow.maxtroop, 1);

  const attackBase = this.number(factionRow.attack, 1);
  const defenseBase = this.number(factionRow.defense, 1);
  const speedBase = this.number(factionRow.speed, 1);

  return {
    id: "L" + factionRow.id,
    first: factionRow.leadfirst || `Fact ${factionRow.id}`,
    last: factionRow.leadlast || "Leader",

    cost: this.number(factionRow.cost, 1),

    attackBase,
    defenseBase,
    speedBase,

    attack: this.createDisplayStat(attackBase),
    defense: this.createDisplayStat(defenseBase),
    speed: this.createDisplayStat(speedBase),

    maxtroop: maxTroop,
    currentTroops: maxTroop,
    status: "Active",

    isLeader: true
  };
},

cloneCommander(commander) {
  const maxTroop = this.number(commander.maxtroop, 1);

  return {
    id: commander.id,
    first: commander.first,
    last: commander.last,

    cost: this.number(commander.cost, 1),

    attackBase: this.number(commander.attackBase, this.getBaseStat(commander.attack)),
    defenseBase: this.number(commander.defenseBase, this.getBaseStat(commander.defense)),
    speedBase: this.number(commander.speedBase, this.getBaseStat(commander.speed)),

    attack: commander.attack,
    defense: commander.defense,
    speed: commander.speed,

    maxtroop: maxTroop,
    currentTroops: maxTroop,
    status: "Active",

    isLeader: false
  };
},

  setActive(commander) {
    commander.status = "Active";
  },

  setTired(commander) {
    commander.status = "Tired";
  }
};