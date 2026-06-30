# Chrome Web Store 申請チェックリスト（ v1.3.1 アップデート）

このドキュメントは、 Chrome Web Store のアップデート申請（ v1.3.0 → v1.3.1）で
ダッシュボードに入力・選択する項目をまとめたもの。コピペで使える文面付き。

最終更新: 2026-06-30 / 対象バージョン: **1.3.1**

---

## 0. 申請前チェック（提出ボタンを押す前に）

- [ ] `manifest.json` の `version` が **1.3.1**（前回 1.3.0 から上がっている）
- [ ] 配布用 zip に余計なファイルが入っていない（`docs/`・`.git`・作業ファイル・元データ画像を除外）
- [ ] `node --check popup.js` が通る
- [ ] プライバシーポリシー URL が公開されアクセス可能
      https://bbtc3453.github.io/keiba-race-data-formatter/privacy-policy.html
- [ ] プライバシーポリシーに「ローカル利用カウンタの記録（外部送信なし）」の記載がある（ v1.3.1 で追記済み）
- [ ] ソースに外部送信コードが残っていない（`grep -n "sendBeacon\|fetch(\|XMLHttpRequest" popup.js` が空）

### 配布 zip の作り方（例）

```bash
cd /Users/btc_user/Documents/GitHub/keiba-race-data-formatter
zip -r ../keiba-formatter-v1.3.1.zip . \
  -x "docs/*" -x ".git/*" -x ".gitignore" -x "*.md" \
  -x "icons/src/*" -x "store-assets/*" -x "tests/*" -x "*.zip"
```

> 実際の除外対象はリポジトリ構成に合わせて調整すること。 manifest.json / popup.* /
> content-*.js / styles.css / icons/*.png / _locales/ が含まれていれば動作する。

---

## 1. ストア掲載情報（ Store listing）

掲載テキスト本体は `docs/chrome-web-store-listing.md` を参照（日英とも v1.3.1 反映済み）。

| 項目 | 値 |
|---|---|
| カテゴリ | Productivity |
| 言語 | 日本語（メイン）/ English（サブ）|
| 開発者名 | KeibaLover |
| プライバシーポリシー URL | https://bbtc3453.github.io/keiba-race-data-formatter/privacy-policy.html |

- [ ] タイトル・簡易説明・詳細説明を最新（ v1.3.1）に差し替え
- [ ] スクリーンショット（ 1280x800 または 640x400）が現行 UI と一致しているか確認
      → 「買う/見送り判定」を追加したテンプレ一覧や、コピー時の案内文が旧 UI のままなら撮り直し推奨

---

## 2. プライバシー（ Privacy practices）タブ

審査で最も差し戻されやすいのがここ。 v1.3.1 でローカル利用カウンタを追加したため、
過去の申請内容と矛盾しないよう以下の通り申告する。

### 単一目的（ Single purpose）

```
This extension extracts horse racing race-card and result data from netkeiba.com
(JRA central and NAR local) and the JRA official website, and formats it into
Markdown, CSV, or an AI-analysis prompt that the user can copy to the clipboard.
That is its single purpose.
```

日本語補足（必要な場合）:
> netkeiba.com（中央・地方）および JRA 公式サイトの出馬表・レース結果を抽出し、
> Markdown / CSV / AI 分析プロンプトに整形してクリップボードにコピーする拡張機能です。

### 各権限の正当化（ Permission justification）

| 権限 | 申告文（英語・そのまま貼れる） | 実使用箇所 |
|---|---|---|
| `activeTab` | Used to access the content of the tab the user is actively viewing, only when the user clicks the extension icon, in order to extract race data. | DOM 抽出 |
| `scripting` | Used to run the data-extraction content script on the active race page to read the race-card / result table. | content-*.js 実行 |
| `clipboardWrite` | Used to copy the formatted race data to the clipboard when the user clicks the Copy button. | popup.js コピー処理 |
| `downloads` | Used to save the formatted race data as a CSV file to the location the user chooses. | popup.js:555 `chrome.downloads.download` |
| `storage` | Used to store the Pro license activation state and anonymous local usage counters on the user's device. No data is transmitted. | ライセンス保存 / ファネル計測 |

> host_permissions は使用していない（対象サイトは content_scripts の `matches` で限定）。

### データ使用の開示（ Data usage / これは「収集する」にチェックが必要）

本拡張は外部送信を一切行わないが、 Chrome の開示フォームは
「ローカルで扱うデータ」も申告対象になりうるため、以下の方針で回答する。

- **収集・送信するユーザーデータ**: なし（ No, I am not collecting or using ... の方向で回答）
  - 出馬表データ・ライセンス情報・利用カウンタはすべて端末内 `chrome.storage.local` のみ。
    外部サーバー・第三者への送信はゼロ。
- 3 つの遵守チェックボックス（全て該当・チェックを入れる）:
  - [ ] 第三者への販売・移転を行わない
  - [ ] 承認された用途と無関係な目的に使用・移転しない
  - [ ] 信用調査・融資目的に使用・移転しない

> ポイント: 「 Analytics / usage tracking を行うが、それは端末内ローカル集計のみで
> 外部送信しない」ことがプライバシーポリシーに明記されているため、開示と実装が一致する。
> 万一レビュアーから問い合わせが来た場合は「§ Anonymous Usage Counters を参照」と返す。

---

## 3. 審査者へのメモ（任意・差し戻し予防に推奨）

レビュアー向けの補足欄があれば、以下を記入しておくと誤解による差し戻しを減らせる。

```
Notes for reviewers (v1.3.1):

- This update adds (1) a new Pro AI-prompt template "Buy/Pass Verdict", (2) local-only
  usage counters, and (3) a disclaimer line in the verdict output.

- The extension does NOT perform any AI prediction itself. All "AI" templates only
  build a text prompt ("instructions + extracted race data") and copy it to the
  clipboard. The user pastes it into ChatGPT/Claude themselves. No LLM API is called
  and no network request is made by the extension.

- No gambling transaction is facilitated: there is no betting, no payment, no account
  linking. The extension only formats publicly visible race-card data.

- Usage counters are stored in chrome.storage.local only and are never transmitted.
  There is no remote analytics endpoint in the code. See privacy policy section
  "Anonymous Usage Counters".

- Pro features are unlocked by a license key purchased via Payhip.
```

---

## 4. ギャンブル関連ポリシーについて（自己確認メモ）

Chrome Web Store の Regulated goods (gambling) ポリシーが禁止するのは
「実金銭の賭けを成立・促進する」こと。本拡張は該当しない（決済・馬券購入・口座連携なし、
公開されている出馬表データの整形のみ）。「買う/見送り判定」も実体は LLM 用プロンプト生成で、
出力には「必勝法ではない／的中保証ではない／自己責任」の免責を必ず添える。

- [ ] スクリーンショット・タイトル・説明文に「必勝」「絶対儲かる」等の射幸的表現がないこと（現状なし）

---

## 5. 既知の留意点（審査とは別だが申請前に認識しておく）

- **ライセンス検証はクライアント側の形式チェックのみ**（サーバー照合なし）。
  審査は通るが、 Pro を本番販売するなら回避が容易な点は別途対応が必要
  （ Payhip License API でのサーバー照合）。今回の申請のブロッカーではない。

---

## 提出フロー（要約）

1. version 1.3.1 を確認 → 配布 zip を作成
2. Chrome Web Store Developer Dashboard → 対象アイテム → 新しいパッケージをアップロード
3. Store listing を v1.3.1 内容に更新（`chrome-web-store-listing.md` から反映）
4. Privacy practices タブを本書 § 2 の通り確認・更新
5. 審査者メモ（§ 3）を記入
6. 「審査用に送信」
