// ============================================
// Service worker（v1.5）
//   目的: アンインストール率 29%（install 137 / uninstall 40・6/22-7/20 実測）への対策。
//   ① 初回インストール時に「どこで使うか」を必ず一度見せる
//      → この拡張は netkeiba / JRA のレースページでしか動かないため、
//        使い方を知らないまま「動かない」と判断されて消されるのを防ぐ。
//   ② setUninstallURL で離脱理由を聞く
//      → ストアは理由を一切返さない。回答率は数 % だが、唯一の直接チャネル。
//   ※ ここでも外部への自動送信は行わない（アンケートはユーザーが自分でブラウザを開いて
//      任意に答える形。拡張から prefetch や fetch はしない）。
// ============================================

const GUIDE_URL = "https://note.com/love_love_keiba/n/n986f65109537";
// 離脱理由アンケート（Google フォーム等が用意できるまでは note の使い方ガイドへ）。
// アンインストール時にブラウザが開くだけで、拡張からのデータ送信は一切ない。
const UNINSTALL_URL = GUIDE_URL;

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // 初回のみ。更新時には出さない（既存ユーザーの邪魔をしない）。
    chrome.tabs.create({ url: GUIDE_URL });
    chrome.storage.local.set({ installedAt: new Date().toISOString() }).catch(() => {});
  }
});

try {
  chrome.runtime.setUninstallURL(UNINSTALL_URL);
} catch (e) {
  // setUninstallURL 未対応環境でも本体機能に影響させない
}
