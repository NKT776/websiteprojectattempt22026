const NameLoader = {
  async loadTerritoryNames(path = null) {
    const finalPath = path || ScenarioLoader.getScenarioPath("territoryNames.txt");

    try {
      const res = await fetch(finalPath);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} while loading ${finalPath}`);
      }

      const text = await res.text();

      return text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
    } catch (e) {
      console.error("Territory name load failed:", finalPath, e);
      log(`Territory name load failed: ${finalPath}`);
      log(`Reason: ${e.message}`);

      return [];
    }
  }
};