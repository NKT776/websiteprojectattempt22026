const CSVLoader = {
  async load(path) {
    try {
      const res = await fetch(path);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} while loading ${path}`);
      }

      const text = await res.text();

      if (!text.trim()) {
        throw new Error(`${path} is empty`);
      }

      return this.parse(text);
    } catch (e) {
      console.error("CSV load failed:", path, e);
      log(`CSV load failed: ${path}`);
      log(`Reason: ${e.message}`);
      return [];
    }
  },

  parse(text) {
    const lines = text
      .replace(/^\uFEFF/, "")
      .trim()
      .split(/\r?\n/)
      .filter(line => line.trim().length > 0);

    const headers = lines[0]
      .split(",")
      .map(h => h.replace(/^\uFEFF/, "").trim().toLowerCase());

    return lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim());
      const obj = {};

      headers.forEach((h, i) => {
        obj[h] = values[i] ?? "";
      });

      return obj;
    });
  }
};

function log(msg) {
  const logElement = document.getElementById("log");
  if (logElement) {
    logElement.innerText += msg + "\n";
  }
}