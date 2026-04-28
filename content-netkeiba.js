// ============================================
// JRA/NAR Data Extractor - netkeiba.com Parser
// ============================================
// Supported pages:
//   - 出馬表: https://race.netkeiba.com/race/shutuba.html?race_id=*
//   - 結果:   https://race.netkeiba.com/race/result.html?race_id=*
//   - 出馬表: https://nar.netkeiba.com/race/shutuba.html?race_id=*  (地方競馬)
//   - 結果:   https://nar.netkeiba.com/race/result.html?race_id=*   (地方競馬)
// ============================================

(function () {
  "use strict";

  const isNar = location.hostname === "nar.netkeiba.com";

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

    // 結果 (result)
    // 中央: tr.HorseList / NAR: クラスなし（td.Result_Num を持つ tr で判定）
    resultTable: "table.RaceTable01",
    resultRow: "tr.HorseList",

    // --- 出馬表セル (実サイト検証済み) ---
    // 中央: Waku(0), Umaban(1), CheckMark(2), HorseInfo(3), Barei(4), 斤量 (5), Jockey(6), Trainer(7), Weight(8), Popular[odds](9), Popular_Ninki(10)
    // NAR:  Waku(0), Umaban(1), CheckMark(2), HorseInfo(3), 性齢 (4, クラスなし), 斤量 (5), Jockey(6), Trainer(7), Weight(8), Popular Txt_R[odds](9), Popular Txt_C[ninki](10)
    shutuba: {
      bracket: "td[class*='Waku']",
      number: "td[class*='Umaban']",
      horseName: "td.HorseInfo",
      sexAge: "td.Barei",           // 中央のみ; NAR はインデックスで取得
      jockey: "td.Jockey",
      trainer: "td.Trainer",
      weight: "td.Weight",
      odds: "td.Txt_R.Popular",
      ninki: "td.Popular_Ninki",    // 中央のみ; NAR は td.Popular.Txt_C
    },

    // --- 結果セル (実サイト検証済み) ---
    // 中央: Result_Num(0), Num Waku*(1), Num Txt_C(2), Horse_Info(3), Horse_Info Txt_C(4), Jockey_Info[斤量](5), Jockey(6), Time(7), Time[着差](8), Odds Txt_C[人気](9), Odds Txt_R[オッズ](10), Time BgYellow[上がり](11), PassageRate(12), Trainer(13), Weight(14)
    // NAR:  Result_Num(0), Num Waku*(1), Num Waku(2), Horse_Info(3), Horse_Info(4)[性齢], Jockey_Info[斤量](5), Jockey(6), Time(7), Time[着差](8), Odds BgYellow Txt_C[人気](9), Odds Txt_R[オッズ](10), Time BgYellow[上がり](11), Trainer(12), Weight(13)
    result: {
      rank: "td.Result_Num",
      bracket: "td.Num[class*='Waku']:first-of-type",
      number: "td.Num.Txt_C",           // 中央のみ; NAR は 2 番目の td.Num.Waku
      horseName: "td.Horse_Info",
      sexAge: "td.Horse_Info.Txt_C",    // 中央のみ; NAR は 2 番目の td.Horse_Info
      carryWeight: "td.Jockey_Info",
      jockey: "td.Jockey",
      time: "td.Time",
      ninki: "td.Odds.Txt_C",           // 中央のみ; NAR は td.Odds.BgYellow.Txt_C
      odds: "td.Odds.Txt_R",
      lastThreeF: "td.Time.BgYellow",
      passage: "td.PassageRate",        // 中央のみ; NAR にはなし
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
      const horse = parseShutuba(row);
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

    let rows;
    if (isNar) {
      // NAR: tr.HorseList がないので td.Result_Num を含む tr を対象にする
      rows = Array.from(table.querySelectorAll("tr")).filter(
        (tr) => tr.querySelector("td.Result_Num")
      );
    } else {
      rows = table.querySelectorAll(SEL.resultRow);
    }

    rows.forEach((row) => {
      const horse = parseResult(row);
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
      raceNumber: "",
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

    // Race number (.RaceNum — 中央のみ)
    const raceNumEl = document.querySelector(SEL.raceNum);
    if (raceNumEl) {
      const raceNumText = cleanText(raceNumEl.textContent);
      const raceNumMatch = raceNumText.match(/(\d+)\s*R/);
      if (raceNumMatch) info.raceNumber = raceNumMatch[1] + "R";
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

      // Track name (中央 + 地方競馬場)
      const trackMatch = text.match(
        /(東京|中山|阪神|京都|小倉|新潟|福島|札幌|函館|中京|大井|川崎|船橋|浦和|園田|姫路|金沢|笠松|名古屋|高知|佐賀|荒尾|福山|帯広|門別|盛岡|水沢)/
      );
      if (trackMatch) {
        info.track = trackMatch[1];
      }

      // Date (中央: "2026 年 4 月 13 日" 形式)
      const dateMatch = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
      if (dateMatch) {
        info.date = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
      }

      // Class
      const classPatterns = [
        /Jpn\s*[123]/,
        /G[IⅠ１1]{3}/,
        /G[IⅠ１1]{2}/,
        /G[IⅠ１1](?![IⅠ１1])/,
        /(オープン|OP|L|リステッド|Listed)/,
        /(\d)\s*勝クラス/,
        /(\d+)\s*万下/,
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

    // NAR: ページタイトルから日付・ R 番号・競馬場を補完
    if (isNar) {
      parseNarInfoFromTitle(info);
    }

    return info;
  }

  // NAR ページタイトルから日付・ R 番号・競馬場を取得
  // 例: "東京スプリント競走 (Jpn3) 出馬表 | 2026 年 4 月 15 日 大井 11R 地方競馬レース情報 - netkeiba"
  function parseNarInfoFromTitle(info) {
    const title = document.title;

    // 日付: "2026 年 4 月 15 日"
    if (!info.date) {
      const dateMatch = title.match(/(\d{4}) 年 (\d{1,2}) 月 (\d{1,2}) 日/);
      if (dateMatch) {
        info.date = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
      }
    }

    // R 番号: "大井 11R" → "11R"
    if (!info.raceNumber) {
      const rMatch = title.match(/(\d+) R/);
      if (rMatch) info.raceNumber = rMatch[1] + "R";
    }

    // 競馬場: RaceData02 で取れなかった場合のフォールバック
    if (!info.track) {
      const trackMatch = title.match(
        /(大井|川崎|船橋|浦和|園田|姫路|金沢|笠松|名古屋|高知|佐賀|荒尾|福山|帯広|門別|盛岡|水沢|東京|中山|阪神|京都|小倉|新潟|福島|札幌|函館|中京)/
      );
      if (trackMatch) info.track = trackMatch[1];
    }
  }

  // ---------------------------------------------------
  // Parse: 出馬表 1 行
  // ---------------------------------------------------
  function parseShutuba(row) {
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 6) return null;

    const q = (sel) => row.querySelector(sel);
    const txt = (sel) => { const el = q(sel); return el ? cleanText(el.textContent) : ""; };
    const linkTxt = (sel) => {
      const el = q(sel);
      if (!el) return "";
      const link = el.querySelector("a");
      return cleanText(link ? link.textContent : el.textContent);
    };

    const s = SEL.shutuba;
    const horse = {
      bracketNumber: txt(s.bracket),
      horseNumber:   txt(s.number),
      horseName:     linkTxt(s.horseName),
      sexAge:        "",
      weight:        "",
      jockey:        linkTxt(s.jockey),
      trainer:       linkTxt(s.trainer),
      bodyWeight:    txt(s.weight),
      odds:          txt(s.odds),
      popularity:    "",
      sire: "", dam: "", damSire: "",
    };

    if (isNar) {
      // NAR: 性齢はクラスなし (HorseInfo の次)、斤量はその次、人気は td.Popular.Txt_C
      const horseInfoEl = q(s.horseName);
      const horseInfoIdx = horseInfoEl ? cells.indexOf(horseInfoEl) : 3;
      if (cells[horseInfoIdx + 1]) horse.sexAge = cleanText(cells[horseInfoIdx + 1].textContent);
      if (cells[horseInfoIdx + 2]) horse.weight = cleanText(cells[horseInfoIdx + 2].textContent);
      const ninkiEl = row.querySelector("td.Popular.Txt_C");
      horse.popularity = ninkiEl ? cleanText(ninkiEl.textContent) : "";
    } else {
      // 中央: td.Barei で性齢、次セルで斤量、td.Popular_Ninki で人気
      horse.sexAge = txt(s.sexAge);
      horse.popularity = txt(s.ninki);
      const sexAgeEl = q(s.sexAge);
      if (sexAgeEl) {
        const bareiIdx = cells.indexOf(sexAgeEl);
        if (bareiIdx >= 0 && cells[bareiIdx + 1]) {
          horse.weight = cleanText(cells[bareiIdx + 1].textContent);
        }
      }
    }

    // Fallback: odds from decimal pattern
    if (!horse.odds) {
      for (let i = cells.length - 1; i >= 6; i--) {
        const t = cleanText(cells[i].textContent);
        if (/^\d+\.\d+$/.test(t)) { horse.odds = t; break; }
      }
    }

    // Pedigree
    const pedigreeEl = row.querySelector("[class*='Pedigree'], [class*='pedigree']");
    if (pedigreeEl) {
      const links = pedigreeEl.querySelectorAll("a");
      if (links[0]) horse.sire = cleanText(links[0].textContent);
      if (links[1]) horse.dam = cleanText(links[1].textContent);
      if (links[2]) horse.damSire = cleanText(links[2].textContent);
    }

    return horse;
  }

  // ---------------------------------------------------
  // Parse: 結果 1 行
  // ---------------------------------------------------
  function parseResult(row) {
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 6) return null;

    const q = (sel) => row.querySelector(sel);
    const txt = (sel) => { const el = q(sel); return el ? cleanText(el.textContent) : ""; };
    const linkTxt = (sel) => {
      const el = q(sel);
      if (!el) return "";
      const link = el.querySelector("a");
      return cleanText(link ? link.textContent : el.textContent);
    };

    const s = SEL.result;
    const horse = {
      finishPosition: txt(s.rank),
      bracketNumber:  "",
      horseNumber:    "",
      horseName:      "",
      sexAge:         "",
      weight:         txt(s.carryWeight),
      jockey:         linkTxt(s.jockey),
      trainer:        linkTxt(s.trainer),
      bodyWeight:     txt(s.weight),
      odds:           txt(s.odds),
      popularity:     "",
      time:           "",
      margin:         "",
      lastThreeF:     txt(s.lastThreeF),
      passage:        "",
      sire: "", dam: "", damSire: "",
    };

    // タイム / 着差
    const timeEls = row.querySelectorAll("td.Time:not(.BgYellow)");
    if (timeEls[0]) horse.time = cleanText(timeEls[0].textContent);
    if (timeEls[1]) horse.margin = cleanText(timeEls[1].textContent);

    if (isNar) {
      // NAR 固有の取得
      // 枠番: 最初の td[class*="Waku"] (Num Waku2 など)
      const wakuEl = row.querySelector("td[class*='Waku']");
      horse.bracketNumber = wakuEl ? cleanText(wakuEl.textContent) : "";

      // 馬番: 2 番目の td.Num (クラスに Waku を含む, index 2)
      const numEls = row.querySelectorAll("td.Num");
      horse.horseNumber = numEls[1] ? cleanText(numEls[1].textContent) : "";

      // 馬名・性齢: td.Horse_Info が 2 つある (1 つ目=馬名, 2 つ目=性齢)
      const horseInfoEls = row.querySelectorAll("td.Horse_Info");
      horse.horseName = horseInfoEls[0] ? cleanText(horseInfoEls[0].querySelector("a")?.textContent || horseInfoEls[0].textContent) : "";
      horse.sexAge    = horseInfoEls[1] ? cleanText(horseInfoEls[1].textContent) : "";

      // 人気: td.Odds.BgYellow.Txt_C
      const ninkiEl = row.querySelector("td.Odds.BgYellow.Txt_C");
      horse.popularity = ninkiEl ? cleanText(ninkiEl.textContent) : "";
    } else {
      // 中央
      horse.bracketNumber = txt(s.bracket);
      horse.horseNumber   = txt(s.number);
      horse.horseName     = linkTxt(s.horseName);
      horse.sexAge        = txt(s.sexAge);
      horse.popularity    = txt(s.ninki);
      horse.passage       = txt(s.passage);
    }

    // Pedigree
    const pedigreeEl = row.querySelector("[class*='Pedigree'], [class*='pedigree']");
    if (pedigreeEl) {
      const links = pedigreeEl.querySelectorAll("a");
      if (links[0]) horse.sire = cleanText(links[0].textContent);
      if (links[1]) horse.dam = cleanText(links[1].textContent);
      if (links[2]) horse.damSire = cleanText(links[2].textContent);
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
