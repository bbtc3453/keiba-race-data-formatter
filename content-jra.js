// ============================================
// Keiba Race Data Formatter - JRA Official Site Parser
// ============================================
// Supported pages:
//   - 出馬表: https://www.jra.go.jp/JRADB/accessD.html?CNAME=pw01dde*
// ============================================
// DOM structure (実サイト検証済み 2026-03-22):
//   table.basic.narrow-xy (出馬表テーブル)
//     td.waku   - 枠番 (img alt="枠 1 白" → 枠番 1)
//     td.num    - 馬番
//     td.horse  - 馬名 + オッズ + 人気 + 戦績 + 馬主 + 調教師 + 血統
//       div.name > a          - 馬名
//       span.num > strong     - オッズ
//       span.pop_rank         - 人気 (e.g. "(1 番人気)")
//       2nd a link            - 調教師
//       text: 父/母/母の父    - 血統
//     td.jockey - 性齢/毛色 + 斤量 + 騎手名
//       text: "牡 5/芦\n58.0kg\n 武 豊"
//       a link                - 騎手名
//     td.past (x4) - 前走〜4 走前
// ============================================

(function () {
  "use strict";

  // ---------------------------------------------------
  // Main extraction function
  // ---------------------------------------------------
  window.__jraExtractData = function () {
    const url = location.href;
    if (url.includes("accessS.html")) {
      return extractJRAResult();
    }
    return extractJRAShumba();
  };

  // ---------------------------------------------------
  // Extract from JRA 出馬表 (accessD.html)
  // ---------------------------------------------------
  function extractJRAShumba() {
    const raceInfo = parseRaceInfo();
    const horses = [];

    const table = document.querySelector("table.basic.narrow-xy");
    if (!table) return { raceInfo, horses };

    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      const horse = parseHorseRow(row);
      if (horse && horse.horseName) {
        horses.push(horse);
      }
    });

    return { raceInfo, horses };
  }

  // ---------------------------------------------------
  // Extract from JRA 結果 (accessS.html)
  // ---------------------------------------------------
  function extractJRAResult() {
    const raceInfo = parseRaceInfo();
    raceInfo.isResult = true;
    const horses = [];

    // Result table: first tbody with race data rows
    const tbodies = document.querySelectorAll("tbody");
    let resultTbody = null;
    for (const tb of tbodies) {
      const firstRow = tb.querySelector("tr");
      if (firstRow && firstRow.querySelectorAll("td").length >= 12) {
        resultTbody = tb;
        break;
      }
    }

    if (!resultTbody) return { raceInfo, horses };

    const rows = resultTbody.querySelectorAll("tr");
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 12) return;

      const horse = {
        finishPosition: cleanText(cells[0]?.textContent),
        bracketNumber: "",
        horseNumber: cleanText(cells[2]?.textContent),
        horseName: "",
        sexAge: cleanText(cells[4]?.textContent),
        weight: cleanText(cells[5]?.textContent),
        jockey: "",
        time: cleanText(cells[7]?.textContent),
        margin: cleanText(cells[8]?.textContent),
        passage: cleanText(cells[9]?.textContent),
        lastThreeF: cleanText(cells[10]?.textContent),
        bodyWeight: cleanText(cells[11]?.textContent),
        trainer: "",
        odds: "",
        popularity: cleanText(cells[13]?.textContent),
      };

      // 枠番: img alt
      const wakuImg = cells[1]?.querySelector("img");
      if (wakuImg) {
        const m = wakuImg.alt.match(/\u67A0(\d+)/);
        if (m) horse.bracketNumber = m[1];
      }

      // 馬名: link
      const nameLink = cells[3]?.querySelector("a");
      horse.horseName = nameLink ? cleanText(nameLink.textContent) : cleanText(cells[3]?.textContent);

      // 騎手: link
      const jockeyLink = cells[6]?.querySelector("a");
      horse.jockey = jockeyLink ? cleanText(jockeyLink.textContent) : cleanText(cells[6]?.textContent);

      // 調教師: link (cell 12)
      if (cells[12]) {
        const trainerLink = cells[12].querySelector("a");
        horse.trainer = trainerLink ? cleanText(trainerLink.textContent) : cleanText(cells[12].textContent);
      }

      if (horse.horseName) horses.push(horse);
    });

    return { raceInfo, horses };
  }

  // ---------------------------------------------------
  // Parse race info from page
  // ---------------------------------------------------
  function parseRaceInfo() {
    const info = {
      raceName: "",
      date: "",
      track: "",
      distance: "",
      surface: "",
      condition: "",
      raceClass: "",
    };

    // Race name from h3 heading (e.g. "第 74 回阪神大賞典")
    const headings = document.querySelectorAll("h2, h3, h4");
    for (const h of headings) {
      const t = cleanText(h.textContent);
      // Skip generic headings
      if (t && !t.startsWith("出馬表") && !t.startsWith("コースレコード") && !t.startsWith("JRA") && !t.startsWith("検索") && t.length > 2 && t.length < 30) {
        info.raceName = t;
        break;
      }
    }

    // Date & track from race header (e.g. "2026 年 3 月 22 日（日曜） 1 回阪神 10 日")
    const dateCell = document.querySelector(".race_header .date, .date_line .date, .cell.date");
    const headerText = dateCell ? dateCell.textContent : "";

    // Date
    const dateMatch = headerText.match(/(\d{4}) 年 (\d{1,2}) 月 (\d{1,2}) 日/);
    if (dateMatch) {
      info.date = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
    }

    // Track from header (e.g. "1 回阪神 10 日")
    const trackMatch = headerText.match(/\d+回\s*(東京|中山|阪神|京都|小倉|新潟|福島|札幌|函館|中京)/);
    if (trackMatch) {
      info.track = trackMatch[1];
    }

    // Distance & surface from page content
    const bodyText = document.body.textContent || "";
    const distMatch = bodyText.match(/(芝|ダート?|障害)\s*[,、]?\s*([\d,]+)\s*メートル/);
    if (distMatch) {
      info.surface = distMatch[1] === "ダ" ? "ダート" : distMatch[1];
      info.distance = distMatch[2].replace(",", "") + "m";
    }

    // Condition (馬場状態)
    const condDls = document.querySelectorAll("dt, .baba");
    condDls.forEach((el) => {
      const t = el.textContent.trim();
      if (t === "芝" || t === "ダート") {
        const dd = el.nextElementSibling;
        if (dd && !info.condition) {
          info.condition = cleanText(dd.textContent);
        }
      }
    });

    // Class — heading text only (bodyText contains footer GI links)
    const raceHeadingText = info.raceName + " " + (document.querySelector("h2")?.textContent || "");
    const classPatterns = [
      { re: /GⅠ|GI(?!I)|G1/, label: "GI" },
      { re: /GⅡ|GII(?!I)|G2/, label: "GII" },
      { re: /GⅢ|GIII|G3/, label: "GIII" },
      { re: /リステッド|Listed/, label: "リステッド" },
      { re: /オープン|OP/, label: "オープン" },
      { re: /(\d)\s*勝クラス/, label: null },
      { re: /新馬/, label: "新馬" },
      { re: /未勝利/, label: "未勝利" },
    ];
    for (const { re, label } of classPatterns) {
      const m = raceHeadingText.match(re);
      if (m) {
        info.raceClass = label || m[0];
        break;
      }
    }

    return info;
  }

  // ---------------------------------------------------
  // Parse a single horse row
  // ---------------------------------------------------
  function parseHorseRow(row) {
    const horse = {
      bracketNumber: "",
      horseNumber: "",
      horseName: "",
      sexAge: "",
      weight: "",
      jockey: "",
      trainer: "",
      bodyWeight: "",
      odds: "",
      popularity: "",
      sire: "",
      dam: "",
      damSire: "",
      prevResults: [],
    };

    // --- 枠番: td.waku > img alt="枠 1 白" ---
    const wakuImg = row.querySelector("td.waku img");
    if (wakuImg) {
      // NOTE: alt text has no space (e.g. "枠 1 白"), do not add spaces in regex
      const altMatch = wakuImg.alt.match(/\u67A0(\d+)/);
      if (altMatch) horse.bracketNumber = altMatch[1];
    }

    // --- 馬番: td.num ---
    const numEl = row.querySelector("td.num");
    if (numEl) horse.horseNumber = cleanText(numEl.textContent);

    // --- 馬情報: td.horse ---
    const horseCell = row.querySelector("td.horse");
    if (horseCell) {
      // 馬名: div.name > a
      const nameLink = horseCell.querySelector("div.name a, .name_line .name a");
      if (nameLink) horse.horseName = cleanText(nameLink.textContent);

      // オッズ: span.num > strong
      const oddsEl = horseCell.querySelector(".odds span.num strong, .odds_line span.num strong");
      if (oddsEl) horse.odds = cleanText(oddsEl.textContent);

      // 人気: span.pop_rank
      const popEl = horseCell.querySelector("span.pop_rank");
      if (popEl) {
        const popMatch = popEl.textContent.match(/(\d+)/);
        if (popMatch) horse.popularity = popMatch[1];
      }

      // 調教師: 2 番目の a リンク
      const links = horseCell.querySelectorAll("a");
      if (links.length >= 2) {
        horse.trainer = cleanText(links[1].textContent);
      }

      // 血統: テキストから抽出
      const cellText = horseCell.textContent;
      const sireMatch = cellText.match(/父[：:]\s*(.+?)(?:\n|$)/);
      if (sireMatch) horse.sire = cleanText(sireMatch[1]);

      const damMatch = cellText.match(/母[：:]\s*(.+?)(?:\(|（|\n|$)/);
      if (damMatch) horse.dam = cleanText(damMatch[1]);

      const damSireMatch = cellText.match(/母の父[：:]\s*(.+?)(?:\)|\）|\n|$)/);
      if (damSireMatch) horse.damSire = cleanText(damSireMatch[1]);
    }

    // --- 騎手情報: td.jockey ---
    const jockeyCell = row.querySelector("td.jockey");
    if (jockeyCell) {
      const jockeyText = jockeyCell.textContent;

      // 性齢: "牡 5", "牝 4", "セ 10", "せん 10" etc.
      const sexAgeMatch = jockeyText.match(/(牡|牝|セ|せん)\s*(\d+)/);
      if (sexAgeMatch) {
        const sex = sexAgeMatch[1] === "せん" ? "セ" : sexAgeMatch[1];
        horse.sexAge = sex + sexAgeMatch[2];
      }

      // 斤量: "58.0kg"
      const weightMatch = jockeyText.match(/(\d+\.?\d*)\s*kg/);
      if (weightMatch) horse.weight = weightMatch[1];

      // 騎手: a リンク
      const jockeyLink = jockeyCell.querySelector("a");
      if (jockeyLink) horse.jockey = cleanText(jockeyLink.textContent);
    }

    // --- 前走成績: td.past (最大 4 走) ---
    const pastCells = row.querySelectorAll("td.past");
    pastCells.forEach((cell) => {
      const text = cell.textContent;
      if (!text.trim()) return;

      const prev = {};

      // 着順
      const rankMatch = text.match(/(\d+) 着/);
      if (rankMatch) prev.rank = rankMatch[1] + "着";

      // レース名
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      // Race name is usually in the 3rd-4th non-empty line
      for (const line of lines) {
        if (
          line.length > 2 &&
          !line.match(/^\d{4}年/) &&
          !line.match(/^\d+着/) &&
          !line.match(/^\d+頭/) &&
          !line.match(/^\d+.*kg/) &&
          !line.match(/^[良稍重不]/) &&
          !line.match(/^\d+:\d+/) &&
          !line.match(/^(東京|中山|阪神|京都|小倉|新潟|福島|札幌|函館|中京)$/) &&
          !line.match(/^\d+番/) &&
          !line.match(/^芝|^ダ/) &&
          !prev.raceName
        ) {
          // Likely the race name
          if (line.length >= 2 && !line.match(/^\d/)) {
            prev.raceName = line;
          }
        }
      }

      // 距離
      const distMatch = text.match(/(\d{3,4})(芝|ダ)/);
      if (distMatch) prev.distance = distMatch[2] + distMatch[1] + "m";

      // タイム
      const timeMatch = text.match(/(\d+:\d+\.\d+)/);
      if (timeMatch) prev.time = timeMatch[1];

      if (prev.rank || prev.raceName) {
        horse.prevResults.push(prev);
      }
    });

    return horse;
  }

  // ---------------------------------------------------
  // Utility
  // ---------------------------------------------------
  function cleanText(str) {
    if (!str) return "";
    return str.replace(/\s+/g, " ").trim();
  }
})();
