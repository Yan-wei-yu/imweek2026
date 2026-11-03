# 2026 資管週｜第三節即時互動頁

學生用手機掃 QR code 加入，不用登入、全程匿名。講者切到哪一題，手機就顯示哪一題：

暖身投票（單選）→ 文字雲（一個詞）→ 討論 01～03（留言）→ Q&A（提問、幫別人的問題按讚）

| 頁面 | 給誰 | 用途 |
| --- | --- | --- |
| `index.html` | 學生（手機） | 作答、留言、提問 |
| `host.html` | 講者（投影） | 切換題目、即時看結果、隱藏不適當的留言 |

網頁放在 GitHub Pages，資料存在 Firebase（Firestore），兩個都用免費方案。

## 先試用：示範模式

`js/config.js` 的 `FIREBASE_CONFIG` 還是 `null` 時，頁面會用示範模式，資料只存在這台電腦的瀏覽器。用同一個瀏覽器開一個分頁 `host.html`、再開幾個分頁 `index.html`，就能把整個流程走一遍。

頁面要用 http 開（直接點兩下 html 檔案不行）。在 `im-week-2026` 資料夾執行：

```bash
python -m http.server 8766 --bind 127.0.0.1 --directory live
```

再打開 <http://localhost:8766/host.html>。

## 設定 Firebase（一次就好，約 10 分鐘）

1. 到 [Firebase 主控台](https://console.firebase.google.com) 建立專案（Google Analytics 可以不開）
2. 專案總覽 → 新增應用程式 → 網頁（`</>`）→ 取個名字 → 把畫面上的 `firebaseConfig` 整段貼到 `js/config.js` 的 `FIREBASE_CONFIG`
   - 這些值本來就會公開在網頁裡，不是密碼；誰能讀寫什麼由 `firestore.rules` 決定
3. 建構 → Firestore Database → 建立資料庫 → 位置選 `asia-east1`（台灣）→ 正式版模式
4. 建構 → Authentication → 開始使用 → 登入方式：啟用「匿名」和「Google」
5. Authentication → 設定 → 授權網域 → 新增網站的網域（例如 `yan-wei-yu.github.io`）
6. Authentication → 設定 → 註冊配額（Sign-up quota）：排定彩排和講座當天（11/26 13:00–17:00）暫時調高每個 IP 每小時能建立的帳號數，例如 500
   - 預設每個 IP 每小時只能建立 100 個匿名帳號。全班連同一個 Wi-Fi 時大家共用一個對外 IP，第 101 位之後會連不上
7. 打開網站上的 `host.html`，用 Google 登入，頁面會顯示你的 UID。把 `firestore.rules` 裡的 `HOST_UID` 換成它
8. Firestore Database → 規則 → 貼上整份 `firestore.rules` → 發布，再重新整理 `host.html`

## 免費額度要注意的地方

- Firestore 免費方案每天 5 萬次讀取，在台灣時間下午 4 點重置，剛好在第三節中間。一場一兩百人的講座大約用掉 1～3 萬次
- 前一天下午 4 點之後的彩排，會算進講座當天的額度，彩排用幾支手機就好
- 用完的話，所有讀寫都會失敗。想更保險，可以把專案升級成 Blaze（用多少付多少，這種用量大概幾塊錢台幣）並設定預算提醒；這一步要綁信用卡，由你決定

## 彩排

- 講者頁網址後面加 `?s=rehearsal`（例如 `host.html?s=rehearsal`），畫面上的 QR code 會自動帶上同樣的參數，資料跟正式場分開
- 正式場如果先試過：講座前到 Firestore 主控台，把 `sessions/imweek2026` 底下的集合刪掉，就是乾淨的

## 講座當天

- 開場前打開 `host.html`、按 F11 全螢幕，停在「大廳」讓大家掃 QR code。用你設定時登入的同一個 Chrome，並允許這個網站彈出視窗
- 切換題目：上方的按鈕、方向鍵 ← →、簡報筆的上下頁（PageUp／PageDown）、數字鍵 1～8
- 不適當的留言或問題：滑鼠移過去按 × 或「隱藏」；文字雲上不適當的詞：直接點那個詞。下方「已隱藏」都可以恢復
- Q&A 讚多的排前面，回答完按「已回答」會移到最下面
- 按 Q 可以顯示或隱藏角落的小 QR code（給晚到的同學；離太遠掃不到的話，念網址就好）
- 只有目前這一題收得到回答；切到下一題之後，上一題就不能再送
- 想自己用手機或電腦試學生頁：用無痕視窗，或網址加 `?s=rehearsal`。在登入講者帳號的瀏覽器開學生頁，作答會算在講者身上（頁面上方也會提醒）
- 萬一講者頁登不進去：到 Firestore 主控台打開 `sessions/imweek2026`，把 `activity` 欄位改成 `poll`、`cloud`、`d1`、`d2`、`d3`、`qa` 或 `end`，學生的手機會跟著換題（只是投影幕上看不到結果圖）

## 正式上線前的檢查

- 規則：Firebase 設好之後，用測試腳本實際送一輪「該擋的」寫入（超過則數、改別人的、題目已經換了還送……），確認都被擋下來
- 彩排：用真的手機、在講座場地的 Wi-Fi，把投票、文字雲、留言、提問、按讚和收回、講者隱藏和已回答都走一次；再從最後一排掃一次大廳的 QR code

## 題目從哪裡來

`js/questions.js` 是從第三節投影片的 `03-discussion/content.js` 產生的，投影片和手機上的題目會一致。改題目時：

```bash
npm run live:sync    # 在 im-week-2026 資料夾：重新產生 js/questions.js
npm run live:test    # 確認 firestore.rules 裡的清單還跟程式一致
```

## 檔案

```
live/
├── index.html、host.html   學生頁、講者頁
├── css/style.css           樣式（跟第三節投影片同一套深色配色）
├── js/
│   ├── config.js           Firebase 設定、場次、每人則數上限
│   ├── questions.js        題目（自動產生）
│   ├── audience.js         學生頁
│   ├── host.js、host-views.js   講者頁
│   ├── store*.js           資料存取：Firebase 或示範模式
│   └── text.js、tally.js、dom.js、qr.js、activities.js
├── firestore.rules         資料規則（要貼到 Firebase 主控台）
├── tests/                  npm test
└── vendor/                 wordcloud2.js、qrcode-generator（MIT）
```
