# 2026 資管週｜即時互動頁

學生用手機掃 QR code 加入，不用登入、全程匿名。

- **跟著看簡報**：第一、三節播投影片時，手機上顯示講者正在播的那一頁，可以往回翻、開大圖放大（課程表那種小字的頁特別好用）。第二節用了公司內容，手機上只顯示「這一節請看投影幕」
- **第三節的互動**：暖身投票（單選，投完票手機上看得到即時結果）→ 文字雲（一個詞）→ 討論 01～03（留言）→ Q&A（提問、幫別人的問題按讚）。講者播到那一頁，手機自動切成作答畫面

| 頁面 | 給誰 | 用途 |
| --- | --- | --- |
| `index.html` | 學生（手機） | 跟著看簡報、作答、留言、提問 |
| `host.html` | 講者（投影） | 切換題目、即時看結果、隱藏不適當的留言 |

網頁放在 GitHub Pages，資料存在 Firebase（Firestore），兩個都用免費方案。

## 跟著看簡報

1. 投影片定稿後，在 `im-week-2026` 資料夾執行 `npm run live:slides`：把第一、三節匯出成圖片（`slides/`），並更新 `js/slides.js`（頁數、第三節哪幾頁是互動題）。再把 `live/` 推上 GitHub
2. 講座當天在播放的筆電上執行 `npm run live:bridge`，用 Chrome 打開它印出來的網址 <http://localhost:8790/host.html>，用 Google 登入。網址要用 `localhost`，換成 `127.0.0.1` 的話 Google 登入會失敗（Firebase 只認得 localhost）
3. 照平常一樣用 PowerPoint 放映、換頁。講者頁上方會顯示「同步中：第 N 頁」，學生手機跟著換；播到第三節的投票、文字雲、討論、Q&A 那幾頁，手機自動切成作答畫面
4. 想讓手機停在某一題（例如投影片已經往下播，但還想多收一點回答）：在講者頁手動按那一題；下次 PowerPoint 換頁時才會再跟著走

- 講者頁要一直開著。放映時被 PowerPoint 全螢幕蓋住沒關係，會繼續同步（實測講者頁藏在背景 6 分多鐘後換頁，學生頁不到 1 秒就跟上）。但不要關掉，也不要在講者頁那個 Chrome 視窗切到別的分頁（Chrome 省記憶體時會清掉很久沒看的背景分頁）；筆電接上電源（用電池時 Chrome 的省電模式會更積極地限制背景網頁）
- 投影片圖片放在 GitHub Pages，等於是公開的
- 同步小程式只有這台電腦連得到（127.0.0.1）。從 GitHub Pages 打開的講者頁不會同步，要手動切題
- 用檔名認簡報：放映的檔案要跟匯出時同名（例如 `第一節_職涯與成長.pptx`），放在哪個資料夾都可以；另存成別的名字就認不得

### 講者頁上方的同步狀態

| 顯示 | 怎麼辦 |
| --- | --- |
| 同步中：第 N 頁 | 正常，學生手機跟著換 |
| PowerPoint 沒有在放映 | 開始放映（F5）就會接上；這段時間手機停在最後一頁 |
| 同步程式沒有回應 | 執行 `npm run live:bridge` 的視窗被關掉了：重新執行一次，講者頁會自己接上，不用重新整理 |
| 不認得的簡報檔：… | 放映的檔名跟匯出時不一樣：改回原本的檔名再放映 |
| 同步停止：Firebase 規則還沒發布… | 到 Firebase 主控台發布最新的 `firestore.rules`，再重新整理講者頁 |

## 先試用：示範模式

`js/config.js` 的 `FIREBASE_CONFIG` 還是 `null`，或網址加上 `?demo=1` 時，頁面會用示範模式，資料只存在這台電腦的瀏覽器。用同一個瀏覽器開一個分頁 `host.html?demo=1`、再開幾個分頁 `index.html?demo=1`，就能把整個流程走一遍。從同步小程式打開（<http://localhost:8790/host.html?demo=1>）也能試 PowerPoint 同步。

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

- Firestore 免費方案每天 5 萬次讀取，在台灣時間下午 4 點重置，剛好在第三節中間。一兩百人從第一節跟著看簡報、加上第三節的互動，大約用掉 2～4 萬次
- 手機看投票結果：有人投票或改選時，講者頁最多每 5 秒更新一次統計，每更新一次、每支投過票的手機各算一次讀取。150 人在兩三分鐘內投完，大約多用 2,000～5,000 次；投票開越久、越多人改選，用得越多
- 前一天下午 4 點之後的彩排，會算進講座當天的額度，彩排用幾支手機就好
- 用完的話，所有讀寫都會失敗。想更保險，可以把專案升級成 Blaze（用多少付多少，這種用量大概幾塊錢台幣）並設定預算提醒；這一步要綁信用卡，由你決定

## 彩排

- 講者頁網址後面加 `?s=rehearsal`（例如 `host.html?s=rehearsal`），畫面上的 QR code 會自動帶上同樣的參數，資料跟正式場分開
- 正式場如果先試過：講座前到 Firestore 主控台，把 `sessions/imweek2026` 底下的集合刪掉，就是乾淨的
- 推上 GitHub 之後，等 10 分鐘再用手機測：GitHub Pages 讓瀏覽器把檔案快取 10 分鐘，太早測可能拿到新舊混在一起的程式

## 講座當天

- 13:20 之前：在播放的筆電執行 `npm run live:bridge`，打開 <http://localhost:8790/host.html> 登入，停在「大廳」讓大家掃 QR code；開始放映第一節後就會自動同步。用你設定時登入的同一個 Chrome，並允許這個網站彈出視窗；筆電接上電源，講者頁開著不要關（被 PowerPoint 蓋住沒關係）
- 給大家看結果：播到投票、文字雲、討論、Q&A 那幾頁時，講者頁已經自動換成那一題的即時結果。按 Alt+Tab 從 PowerPoint 切到講者頁（事先按 F11 全螢幕；筆電接投影機用「延伸」模式的話，先把 Chrome 拖到投影機那個螢幕），講完再 Alt+Tab 切回 PowerPoint
- 講者頁在前面時，簡報筆的上下頁換的是講者頁的題目，不是 PowerPoint 的投影片；要換投影片先切回 PowerPoint
- 投票：同學投完票，手機上就看得到即時結果（講者頁開著、停在投票那一題才會更新，最多慢 5 秒；講者頁沒開著的話，手機會顯示「結果請看投影幕」）。統計是講者頁算的，跟 PowerPoint 有沒有在放映無關。講完結果就往下一頁，統計就不再更新，也比較省免費額度
- 程式更新過之後第一次打開講者頁，按 Ctrl+F5（強制重新整理）：Chrome 可能混用快取裡的舊檔案，例如手機一直顯示「結果請看投影幕」
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
- 跟著看簡報：在講座要用的筆電上全螢幕放映第一節，10 分鐘以上不碰講者頁，確認手機還會跟著換頁；放映第三節到投票那一頁，確認手機自動切成投票

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
│   ├── bridge-worker.js    每 0.7 秒問同步小程式 PowerPoint 播到哪（放在 Worker 裡，講者頁被蓋住也不會變慢）
│   ├── store*.js           資料存取：Firebase 或示範模式
│   ├── slides.js           投影片的頁數、第三節的互動題（自動產生）
│   ├── slides-view.js、slide-sync.js   跟著看簡報
│   └── text.js、tally.js、throttle.js、dom.js、qr.js、activities.js
├── slides/                 投影片圖片（npm run live:slides 產生）
├── firestore.rules         資料規則（要貼到 Firebase 主控台）
├── tests/                  npm test
└── vendor/                 wordcloud2.js、qrcode-generator（MIT）
```
