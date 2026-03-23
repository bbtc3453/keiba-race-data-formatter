// ============================================
// JRA Data Extractor - netkeiba.com Parser
// ============================================
// Supported pages:
//   - 出馬表: https://race.netkeiba.com/race/shutuba.html?race_id=*
//   - 結果:   https://race.netkeiba.com/race/result.html?race_id=*
// ============================================

(function () {
  "use strict";

  // ---------------------------------------------------
  // Selectors (定数分離 — HTML 構造変更時はここだけ修正)
  // ---------------------------------------------------
  const SEL = {
    // Race info
    raceNameArea: ".RaceName",
    raceData01: ".RaceData01",
    raceData02: ".RaceData02",
    raceNum: ".RaceNum",

    // 出馬表 (shutuba)
    shutubaTable: ".Shutuba_Table, .ShutubaTable, table.RaceTable01",
    shutubaRow: "tr.HorseList",

    // 結果 (result) — テーブルは RaceTable01 クラスを共有
    resultTable: "table.RaceTable01",
    resultRow: "tr.HorseList",

    // --- 出馬表セル (実サイト検証済み 2026-03-22) ---
    // Waku(0), Umaban(1), CheckMark(2), HorseInfo(3), Barei(4),
    // 斤量 (5), Jockey(6), Trainer(7), Weight(8), Popular[odds](9),
    // Popular_Ninki(10)
    shutuba: {
      bracket: "td[class*='Waku']",
      number: "td[class*='Umaban']",
      horseName: "td.HorseInfo",
      sexAge: "td.Barei",
      jockey: "td.Jockey",
      trainer: "td.Trainer",
      weight: "td.Weight",
      odds: "td.Txt_R.Popular",
      ninki: "td.Popular_Ninki",
    },

    // --- 結果セル (実サイト検証済み 2026-03-22) ---
    // Result_Num(0), Num Waku*(1), Num Txt_C(2), Horse_Info(3),
    // Horse_Info Txt_C(4), Jockey_Info[斤量](5), Jockey(6),
    // Time(7), Time[着差](8), Odds Txt_C[人気](9), Odds Txt_R[オッズ](10),
    // Time BgYellow[上がり](11), PassageRate(12), Trainer(13), Weight(14)
    result: {
      rank: "td.Result_Num",
      bracket: "td.Num[class*='Waku']",
      number: "td.Num.Txt_C",
      horseName: "td.Horse_Info",
      sexAge: "td.Horse_Info.Txt_C",
      carryWeight: "td.Jockey_Info",
      jockey: "td.Jockey",
      time: "td.Time",
      ninki: "td.Odds.Txt_C",
      odds: "td.Odds.Txt_R",
      lastThreeF: "td.Time.BgYellow",
      passage: "td.PassageRate",
      trainer: "td.Trainer",
      weight: "td.Weight",
    },
  };

  // ---------------------------------------------------
  // Main extraction function (exposed globally)
  // ---------------------------------------------------
  window.__jraExtractData = function () {
    const url = location.href;

    if (url.includes("shutuba.html")) {
      return extractShutuba();
    } else if (url.includes("result.html")) {
      return extractResult();
    }

    return null;
  };

  // ---------------------------------------------------
  // Extract: 出馬表 (Shutuba / Race Card)
  // ---------------------------------------------------
  function extractShutuba() {
    const raceInfo = parseRaceInfo();
    const horses = [];

    const table = document.querySelector(SEL.shutubaTable);
    if (!table) return { raceInfo, horses };

    const rows = table.querySelectorAll(SEL.shutubaRow);
    rows.forEach((row) => {
      const horse = parseHorseRow(row, false);
      if (horse && horse.horseName) {
        horses.push(horse);
      }
    });

    return { raceInfo, horses };
  }

  // ---------------------------------------------------
  // Extract: 結果 (Result)
  // ---------------------------------------------------
  function extractResult() {
    const raceInfo = parseRaceInfo();
    raceInfo.isResult = true;
    const horses = [];

    const table = document.querySelector(SEL.resultTable);
    if (!table) return { raceInfo, horses };

    const rows = table.querySelectorAll(SEL.resultRow);
    rows.forEach((row) => {
      const horse = parseHorseRow(row, true);
      if (horse && horse.horseName) {
        horses.push(horse);
      }
    });

    return { raceInfo, horses };
  }

  // ---------------------------------------------------
  // Parse race header info
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

    // Race name
    const nameEl = document.querySelector(SEL.raceNameArea);
    if (nameEl) {
      info.raceName = cleanText(nameEl.textContent);
    }

    // Race data line 1: "15:45 発走 / 芝 3000m (右 A) / 天候:晴 / 馬場:良"
    const data01 = document.querySelector(SEL.raceData01);
    if (data01) {
      const text = data01.textContent;

      // Distance & surface
      const distMatch = text.match(/(芝|ダ|ダート|障害)\s*(\d+)\s*m/);
      if (distMatch) {
        info.surface = distMatch[1] === "ダ" ? "ダート" : distMatch[1];
        info.distance = distMatch[2] + "m";
      }

      // Weather
      const weatherMatch = text.match(/天候\s*[:：]\s*(\S+)/);
      if (weatherMatch) {
        info.weather = weatherMatch[1];
      }

      // Track condition
      const condMatch = text.match(/馬場\s*[:：]\s*(\S+)/);
      if (condMatch) {
        info.condition = condMatch[1];
      }
    }

    // Race data line 2: "1 回 阪神 10 日目 サラ系４歳以上 オープン ..."
    const data02 = document.querySelector(SEL.raceData02);
    if (data02) {
      const text = data02.textContent;

      // Track name
      const trackMatch = text.match(/(東京|中山|阪神|京都|小倉|新潟|福島|札幌|函館|中京)/);
      if (trackMatch) {
        info.track = trackMatch[1];
      }

      // Date: try RaceData02 spans or text
      const dateMatch = text.match(/(\d{4}) 年 (\d{1,2}) 月 (\d{1,2}) 日/);
      if (dateMatch) {
        info.date = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
      }

      // Class
      const classPatterns = [
        /G[IⅠ１1]{3}/,
        /G[IⅠ１1]{2}/,
        /G[IⅠ１1](?![IⅠ１1])/,
        /(オープン|OP|L|リステッド|Listed)/,
        /(\d)\s*勝クラス/,
        /(\d+) 万下/,
        /(新馬|未勝利)/,
      ];
      for (const pat of classPatterns) {
        const m = text.match(pat);
        if (m) {
          info.raceClass = m[0];
          break;
        }
      }
    }

    return info;
  }

  // ---------------------------------------------------
  // Parse a single horse row (class-based selectors)
  // ---------------------------------------------------
  function parseHorseRow(row, isResult) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 6) return null;

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
    };

    const q = (sel) => row.querySelector(sel);
    const txt = (sel) => {
      const el = q(sel);
      return el ? cleanText(el.textContent) : "";
    };
    const linkTxt = (sel) => {
      const el = q(sel);
      if (!el) return "";
      const link = el.querySelector("a");
      return cleanText(link ? link.textContent : el.textContent);
    };

    if (isResult) {
      // --- 結果ページ ---
      const s = SEL.result;

      horse.finishPosition = txt(s.rank);
      horse.bracketNumber = txt(s.bracket);
      horse.horseNumber = txt(s.number);
      horse.horseName = linkTxt(s.horseName);
      horse.sexAge = txt(s.sexAge);
      horse.weight = txt(s.carryWeight);
      horse.jockey = linkTxt(s.jockey);
      horse.trainer = linkTxt(s.trainer);
      horse.bodyWeight = txt(s.weight);
      horse.odds = txt(s.odds);
      horse.popularity = txt(s.ninki);
      horse.time = txt(s.time);
      horse.lastThreeF = txt(s.lastThreeF);
      horse.passage = txt(s.passage);

      // 着差: 2 番目の td.Time (最初はタイム、2 番目は着差)
      const timeEls = row.querySelectorAll("td.Time:not(.BgYellow)");
      if (timeEls.length >= 2) {
        horse.margin = cleanText(timeEls[1].textContent);
      }
    } else {
      // --- 出馬表 ---
      const s = SEL.shutuba;

      horse.bracketNumber = txt(s.bracket);
      horse.horseNumber = txt(s.number);
      horse.horseName = linkTxt(s.horseName);
      horse.sexAge = txt(s.sexAge);
      horse.jockey = linkTxt(s.jockey);
      horse.trainer = linkTxt(s.trainer);
      horse.bodyWeight = txt(s.weight);
      horse.odds = txt(s.odds);
      horse.popularity = txt(s.ninki);

      // 斤量: Barei の次のセル
      const sexAgeEl = q(s.sexAge);
      if (sexAgeEl) {
        const bareiIdx = Array.from(cells).indexOf(sexAgeEl);
        if (bareiIdx >= 0 && cells[bareiIdx + 1]) {
          horse.weight = cleanText(cells[bareiIdx + 1].textContent);
        }
      }
    }

    // --- Fallback: odds from decimal pattern ---
    if (!horse.odds) {
      for (let i = cells.length - 1; i >= 6; i--) {
        const t = cleanText(cells[i].textContent);
        if (/^\d+\.\d+$/.test(t)) {
          horse.odds = t;
          break;
        }
      }
    }

    // Pedigree info (if available on the page)
    const pedigreeEl = row.querySelector("[class*='Pedigree'], [class*='pedigree']");
    if (pedigreeEl) {
      const pedigreeLinks = pedigreeEl.querySelectorAll("a");
      if (pedigreeLinks.length >= 1) horse.sire = cleanText(pedigreeLinks[0].textContent);
      if (pedigreeLinks.length >= 2) horse.dam = cleanText(pedigreeLinks[1].textContent);
      if (pedigreeLinks.length >= 3) horse.damSire = cleanText(pedigreeLinks[2].textContent);
    }

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
