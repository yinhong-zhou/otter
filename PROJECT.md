# 神奇水獭 · 产品 & 首页实现文档

> 这份文档既是产品定义,也是首页 (landing page) 的实现说明。
> 目标:在 12 小时内做出一个**两屏**的产品首页 + 内嵌的可交互 demo。

---

## 0. 项目概览

**项目名:** 神奇水獭 (Otter)
**形态:** 抖音黑客松产品 · 此 repo 是产品的官网首页
**技术栈:** Next.js 14 + Tailwind + GSAP + Lenis
**部署:** Vercel
**预期周期:** 12 小时

---

## 1. 产品定义

### 1.1 一句话

一只生活在抖音里的神奇水獭——你看什么,他就去哪。

### 1.2 形态

抖音信息流中**被动插入**的 AI 虚拟宠物卡片。不是独立 APP,是寄生在抖音里的内容。

### 1.3 世界观

水獭是抖音世界的原住民。抖音对他不是 APP,是他的世界。他在里面有自己的家、会发视频、会出门。

"神奇"在于他能**穿越抖音里任何一条视频的平行宇宙**,跳进去客串里面的角色,然后回家继续过日子。

### 1.4 用户的位置

用户**不是水獭的主人**,是邻居 / 路人 / 网友。关系疏离但偶有交集。不在养他,在撞见他。

这一点把产品和"AI 宠物养成类"切割开。

### 1.5 三种相遇姿态

| 姿态 | 你在哪 | 他在哪 | 镜头语言 |
|---|---|---|---|
| 窗边偷窥 | 他家附近 | 自己的日常空间 | 监控视角 (LIVE 标识 + 时间戳) |
| 街头偶遇 | 抖音街头 | 公共空间 | 手机摄像机 (REC 标识 + 取景框) |
| 穿越客串 | 你的刷视频历史 | 被你召唤的场景 | 跟随原视频风格 |

**第三种是产品的灵魂**。机制叫"上下文寄生"——他穿越去哪由你刚刷的视频决定。

### 1.6 互动方向

- **轻互动:** 拍一拍 / 喂食 / 敲窗(即时反馈,零决策)
- **重互动:** 剧情节点的 A/B 选择(影响下次他穿越去哪)

### 1.7 世界观如何吸收所有"工具感"

| 产品机制 | 童话翻译 |
|---|---|
| AI 实时生成画面 | 他在他的世界里活着 |
| 上下文寄生 | 他能穿越平行宇宙 |
| 被动出现 | 你刚好路过 / 撞见 / 刷到 |
| 镜头互动 | 他偶尔会发现你 |

---

## 2. 首页结构

就两屏。**没有 nav,没有 footer。**

```
┌──────────────────────────────────────┐
│  Section 0 · Hero (100vh)             │
│    全屏 CG 视频 + 文字层               │
├──────────────────────────────────────┤
│  Section 1 · 试试看 (auto height)     │
│    嵌入三屏并排 demo                  │
└──────────────────────────────────────┘
```

第一屏震住,第二屏讲清。

---

## 3. Section 0 · Hero

### 3.1 DOM 结构

```tsx
<section className="hero relative h-screen overflow-hidden">
  <video
    className="absolute inset-0 w-full h-full object-cover"
    src="/hero.webm"
    autoPlay
    muted
    playsInline
    poster="/hero-poster.jpg"
  />
  <div className="text-layer absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
    <h1 className="slogan">「 Slogan 占位 · 待定 」</h1>
    <p className="intro">「 角色一句话设定 · 待定 」</p>
    <p className="intro">「 补充说明 · 待定 」</p>
    <div className="scroll-hint">↓ scroll</div>
  </div>
  <button className="audio-toggle absolute top-6 right-6">
    {/* 喇叭图标,点击播放 /hero-music.mp3 */}
  </button>
</section>
```

### 3.2 视频要求

| 项 | 值 |
|---|---|
| 路径 | `/public/hero.webm` (主) · `/public/hero.mp4` (fallback) |
| 时长 | 15-20s |
| 行为 | 自动播放 · 静音 · `onEnded` 暂停在最后一帧(不循环) |
| 海报 | `/public/hero-poster.jpg` (loading 期间显示) |
| 移动端 | `/public/hero-mobile.webm` (竖屏 9:16) |
| 文件大小 | < 3MB,LCP < 2.5s |

### 3.3 CG 视频脚本(占位,内容由用户定稿)

| 时间 | 镜头描述 |
|---|---|
| 0-3s | 暗黑空间。一个发光的小窗户。窗内水獭剪影在日常活动 |
| 3-5s | 水獭转头,发现镜头外有"人"。走近,鼻子按在玻璃上 |
| 5-7s | 玻璃裂开。水獭"啪嗒"穿过去 |
| 7-10s | 落进抖音视频(场景 A,待定) |
| 10-13s | 场景崩塌。落进抖音视频(场景 B,待定) |
| 13-16s | 再崩塌。落进抖音视频(场景 C,待定) |
| 16-18s | 镜头拉远。水獭独自悬空,周围漂浮各种视频缩略图 |
| 18-20s | 他看向镜头,眨一下眼。定格 |

### 3.4 文字层浮现规范

视频结束后,文字逐项浮现。**不要整块 fade**,用 GSAP SplitText 或 Framer Motion 逐字 fade-up。

| 元素 | 字号 (desktop / mobile) | 字体 | 颜色 | 出现时机 |
|---|---|---|---|---|
| Slogan | 100px / 60px | Noto Serif SC Heavy | `#FAFAFA` | 视频结束 +0.5s |
| Intro line 1 | 18px / 14px | HarmonyOS Sans | `rgba(255,255,255,0.7)` | +1.2s |
| Intro line 2 | 18px / 14px | 同上 | 同上 | +1.6s |
| Scroll hint | 11px / 11px | JetBrains Mono | `rgba(255,255,255,0.5)` | +2.2s,呼吸闪烁 |

### 3.5 音乐

- 视频默认静音(浏览器自动播放策略要求)
- 右上角 24×24px 小喇叭按钮,点击切换 `/public/hero-music.mp3` 播放
- 配乐风格:低频电子底噪 + 关键穿越瞬间的滑稽音效(叮咚 / biu / 啪嗒)

### 3.6 滚动

- 用 Lenis 平滑滚动
- 滚一下直接离开 Hero 到 Section 1
- **不要 scroll-snap**,自由滚

---

## 4. Section 1 · 试试看

### 4.1 DOM 结构

```tsx
<section className="demo-section py-20 px-4 bg-[#0A0A0A]">
  <header className="text-center mb-12">
    <p className="text-xs tracking-widest text-white/40 mb-2">DEMO</p>
    <h2 className="text-2xl md:text-3xl font-medium text-white">
      「 引导文案占位 · 待定 」
    </h2>
  </header>
  <div className="max-w-4xl mx-auto">
    <OtterDemo />
  </div>
</section>
```

### 4.2 Widget

直接用 §5 的完整代码。**不要改它的视觉**,它已经定稿。

---

## 5. 三屏 Demo Widget 完整代码

把下面这段封装成 `<OtterDemo />` React 组件。可以用 `dangerouslySetInnerHTML` + `useEffect` 注入 script,或者把 JS 逻辑重写成 React hooks。**视觉和数据不动**。

```html
<style>
.otter-stage{background:#161616;border-radius:16px;padding:28px 24px;}
.otter-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;}
.otter-phone{background:#0a0a0a;border-radius:14px;overflow:hidden;position:relative;aspect-ratio:9/16;border:0.5px solid rgba(255,255,255,0.08);cursor:pointer;-webkit-tap-highlight-color:transparent;width:100%;transition:transform 0.15s;}
.otter-phone:active{transform:scale(0.985);}
.otter-cap{text-align:center;font-size:12px;color:rgba(255,255,255,0.7);margin:8px 0 2px;}
.otter-hint{text-align:center;font-size:11px;color:rgba(255,255,255,0.4);margin:0;}
.cross-pill{position:absolute;top:50%;right:-30px;transform:translate(50%,-50%);z-index:5;display:inline-flex;align-items:center;gap:5px;background:#534AB7;padding:6px 12px;border-radius:99px;font-size:11px;color:#fff;white-space:nowrap;letter-spacing:0.5px;}
</style>

<div class="otter-stage">
  <header style="text-align:center;margin-bottom:22px;">
    <p style="font-size:12px;color:rgba(255,255,255,0.4);letter-spacing:1.5px;margin:0 0 4px;">神奇水獭 · OTTER</p>
    <p style="font-size:18px;color:#fafafa;font-weight:500;margin:0;">你看什么 · 他就去哪</p>
  </header>

  <div class="otter-grid">
    <div>
      <div class="otter-phone" id="otter-p1"></div>
      <p class="otter-cap">水獭日常</p>
      <p class="otter-hint">点屏幕刷一下</p>
    </div>
    <div>
      <div style="position:relative;">
        <div class="otter-phone" id="otter-p2"></div>
        <div class="cross-pill">
          <i class="ti ti-route" style="font-size:11px;"></i>
          <span>穿越</span>
          <i class="ti ti-arrow-right" style="font-size:11px;"></i>
        </div>
      </div>
      <p class="otter-cap">水獭穿越后</p>
      <p class="otter-hint">点中/右屏同步换</p>
    </div>
    <div>
      <div class="otter-phone" id="otter-p3" style="background:#000;"></div>
      <p class="otter-cap">原视频</p>
      <p class="otter-hint">你刚刷到的</p>
    </div>
  </div>
</div>

<script>
(function(){
  const daily = [
    {loc:'家', time:'22:34', state:'在跑步机狂奔', caption:'小獭 · 沙滩冲锋中'},
    {loc:'家', time:'14:08', state:'煮泡面煮糊了', caption:'小獭 · 厨房灾难'},
    {loc:'家', time:'09:21', state:'在沙发上发呆', caption:'小獭 · 灵魂出窍'},
    {loc:'家', time:'00:42', state:'对着电脑掉毛', caption:'小獭 · 卷不动了'},
    {loc:'街', time:'08:15', state:'西装挤地铁', caption:'小獭 · 打卡上班'},
    {loc:'街', time:'12:33', state:'摆摊卖煎饼', caption:'小獭 · 街角营业中'},
    {loc:'街', time:'18:47', state:'给城管递烟', caption:'小獭 · 神情自若'},
    {loc:'街', time:'21:09', state:'ATM 前哭出来', caption:'小獭 · 余额劝退'}
  ];

  const pairs = [
    {orig:{author:'@战争影像', title:'登陆日纪实', icon:'flag'}, otter:'扛 AK 冲滩 谁懂啊'},
    {orig:{author:'@李子柒', title:'柴火炖一只鸡', icon:'tools-kitchen-2'}, otter:'蹲厨房偷吃 别告状'},
    {orig:{author:'@NBA 官方', title:'总决赛 G7 集锦', icon:'ball-basketball'}, otter:'我换下詹姆斯了'},
    {orig:{author:'@考研学姐', title:'400 分上岸经验', icon:'book-2'}, otter:'学不动了 我先睡'},
    {orig:{author:'@富婆日常', title:'我的护肤流程', icon:'sparkles'}, otter:'我的保养品是河水'},
    {orig:{author:'@刘畊宏', title:'本草纲目跳操', icon:'barbell'}, otter:'跟跳三分钟原地去世'}
  ];

  let iDaily = 0, iPair = 0;

  function renderDaily(){
    const it = daily[iDaily];
    document.getElementById('otter-p1').innerHTML = `
      <div style="position:absolute;top:8px;left:10px;right:10px;display:flex;justify-content:space-between;color:rgba(255,255,255,0.85);font-size:11px;font-family:monospace;">
        <div style="display:flex;align-items:center;gap:5px;">
          <span style="width:5px;height:5px;border-radius:50%;background:#E24B4A;"></span>
          <span>LIVE</span>
          <span style="color:rgba(255,255,255,0.5);">· ${it.loc}</span>
        </div>
        <span>${it.time}</span>
      </div>
      <div style="position:absolute;inset:32px 12px 64px;background:#161616;border:0.5px dashed rgba(255,255,255,0.15);border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;">
        <i class="ti ti-paw" style="font-size:34px;color:rgba(255,255,255,0.4);"></i>
        <p style="font-size:11px;color:rgba(255,255,255,0.72);margin:0;text-align:center;padding:0 8px;">${it.state}</p>
      </div>
      <div style="position:absolute;left:10px;right:10px;bottom:30px;color:#fff;font-size:11px;">${it.caption}</div>
      <div style="position:absolute;left:10px;right:10px;bottom:10px;display:flex;gap:4px;">
        <span style="flex:1;background:rgba(255,255,255,0.1);color:#fff;padding:4px;border-radius:6px;text-align:center;font-size:11px;">拍</span>
        <span style="flex:1;background:rgba(255,255,255,0.1);color:#fff;padding:4px;border-radius:6px;text-align:center;font-size:11px;">喂</span>
        <span style="flex:1;background:rgba(255,255,255,0.1);color:#fff;padding:4px;border-radius:6px;text-align:center;font-size:11px;">×</span>
      </div>`;
  }

  function renderPair(){
    const it = pairs[iPair];
    document.getElementById('otter-p2').innerHTML = `
      <div style="position:absolute;top:8px;left:0;right:0;display:flex;justify-content:center;gap:10px;color:rgba(255,255,255,0.5);font-size:11px;">
        <span>关注</span><span style="color:#fff;font-weight:500;">宠物</span>
      </div>
      <div style="position:absolute;top:8px;left:8px;display:inline-flex;align-items:center;gap:3px;padding:2px 7px;background:#534AB7;border-radius:99px;font-size:11px;color:#fff;letter-spacing:0.5px;">
        <i class="ti ti-paw" style="font-size:11px;"></i>水獭版
      </div>
      <div style="position:absolute;top:8px;right:8px;display:inline-flex;align-items:center;gap:3px;padding:2px 7px;background:rgba(255,255,255,0.1);border-radius:99px;font-size:11px;color:rgba(255,255,255,0.85);">
        <i class="ti ti-sparkles" style="font-size:11px;"></i>AI
      </div>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">
        <i class="ti ti-paw" style="font-size:42px;color:rgba(255,255,255,0.3);"></i>
        <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.6);">穿越中…</p>
      </div>
      <div style="position:absolute;right:6px;bottom:50px;display:flex;flex-direction:column;align-items:center;gap:9px;color:#fff;">
        <div style="width:20px;height:20px;border-radius:50%;background:#534AB7;border:1.5px solid #fff;"></div>
        <i class="ti ti-heart" style="font-size:16px;"></i>
        <i class="ti ti-message-circle" style="font-size:16px;"></i>
        <i class="ti ti-share-3" style="font-size:16px;"></i>
      </div>
      <div style="position:absolute;left:8px;right:34px;bottom:10px;color:#fff;font-size:11px;">
        <p style="margin:0;font-weight:500;">@小獭</p>
        <p style="margin:0;color:rgba(255,255,255,0.88);">${it.otter}</p>
      </div>`;

    document.getElementById('otter-p3').innerHTML = `
      <div style="position:absolute;top:8px;left:0;right:0;display:flex;justify-content:center;gap:10px;color:rgba(255,255,255,0.5);font-size:11px;">
        <span style="color:#fff;font-weight:500;">推荐</span><span>关注</span>
      </div>
      <div style="position:absolute;top:8px;left:8px;display:inline-flex;align-items:center;gap:3px;padding:2px 7px;background:rgba(255,255,255,0.12);border-radius:99px;font-size:11px;color:rgba(255,255,255,0.85);letter-spacing:0.5px;">
        <i class="ti ti-link" style="font-size:11px;"></i>原视频
      </div>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
        <i class="ti ti-${it.orig.icon}" style="font-size:38px;color:rgba(255,255,255,0.32);"></i>
      </div>
      <div style="position:absolute;right:6px;bottom:50px;display:flex;flex-direction:column;align-items:center;gap:9px;color:#fff;">
        <div style="width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,0.2);border:1.5px solid #fff;"></div>
        <i class="ti ti-heart" style="font-size:16px;"></i>
        <i class="ti ti-message-circle" style="font-size:16px;"></i>
        <i class="ti ti-share-3" style="font-size:16px;"></i>
      </div>
      <div style="position:absolute;left:8px;right:34px;bottom:10px;color:#fff;font-size:11px;">
        <p style="margin:0;font-weight:500;">${it.orig.author}</p>
        <p style="margin:0;color:rgba(255,255,255,0.85);">${it.orig.title}</p>
      </div>`;
  }

  renderDaily();
  renderPair();

  document.getElementById('otter-p1').addEventListener('click', () => {
    iDaily = (iDaily+1) % daily.length;
    renderDaily();
  });
  const refreshPair = () => {
    iPair = (iPair+1) % pairs.length;
    renderPair();
  };
  document.getElementById('otter-p2').addEventListener('click', refreshPair);
  document.getElementById('otter-p3').addEventListener('click', refreshPair);
})();
</script>
```

### 5.1 React 化注意点

- `ti ti-*` 是 Tabler Icons,需要 `npm i @tabler/icons-webfont` 并在 layout 引入 CSS
- 或者改用 `@tabler/icons-react` 用 React 组件
- 把 `daily` 和 `pairs` 数据抽到 `lib/data.ts`
- innerHTML 模板可以重写成 React JSX,避免 dangerouslySetInnerHTML

### 5.2 移动端

三屏并排在 < 640px 设备上会很挤。需要在 mobile 下:
- `grid-template-columns: 1fr` (改为竖排)
- "穿越"小药丸的位置从 `right:-30px` 改成 `bottom:-30px`(放在两屏之间)
- 字号整体放大一点

---

## 6. 视觉规范

### 6.1 配色

```css
:root {
  --bg-primary: #0A0A0A;
  --bg-secondary: #161616;
  --text-primary: #FAFAFA;
  --text-secondary: rgba(255, 255, 255, 0.55);
  --text-tertiary: rgba(255, 255, 255, 0.40);
  --accent-red: #E24B4A;
  --accent-purple: #534AB7;
}
```

**只这套。** 任何额外颜色从这里调透明度。**禁止**:粉紫渐变、星空粒子、blur glow、neon。

### 6.2 字体

```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;900&family=JetBrains+Mono:wght@400;500&display=swap');
```

| 用途 | 字体 |
|---|---|
| Slogan / H1 | `Noto Serif SC` Heavy (900) |
| 正文 | `HarmonyOS Sans` / 苹方 / 系统默认无衬线 |
| 时间戳 / LIVE / 数字 | `JetBrains Mono` |

国内访问建议本地化部署字体文件,不走 Google Fonts CDN。

### 6.3 动效

- 滚动驱动 > 时间驱动(用 GSAP ScrollTrigger)
- 文字逐字浮现(GSAP SplitText 或 Framer Motion)
- hover 只用在可点击元素
- 鼠标 ±5px 微视差(可选)

---

## 7. 技术栈 & 目录结构

```
otter-landing/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              # 唯一一页 (Hero + DemoSection)
│   └── globals.css           # 字体 + CSS 变量 + Tailwind
├── components/
│   ├── Hero.tsx              # Section 0
│   ├── DemoSection.tsx       # Section 1 容器
│   └── OtterDemo.tsx         # 三屏 widget(React 化)
├── lib/
│   └── data.ts               # daily + pairs 数据
├── public/
│   ├── hero.webm             # 主视频
│   ├── hero.mp4              # fallback
│   ├── hero-mobile.webm      # 竖屏版
│   ├── hero-poster.jpg       # 视频海报
│   └── hero-music.mp3        # 配乐
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

### 依赖

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "@studio-freight/lenis": "^1.0.42",
    "gsap": "^3.12.5",
    "@tabler/icons-react": "^3.0.0"
  }
}
```

### 部署

Vercel,环境变量无。

---

## 8. 实施路径

### 必做 (P0)

- [ ] 项目脚手架(`create-next-app` + tailwind)
- [ ] Hero CG 视频接入 + 自动播放 + 暂停最后一帧
- [ ] 文字层浮现(slogan 占位 + 介绍占位)
- [ ] 滚动 hint
- [ ] Section 1 嵌入三屏 widget(React 化)
- [ ] 移动端基本可看(竖版视频 + widget 竖排)

### 可做 (P1)

- [ ] 喇叭音乐开关
- [ ] 鼠标 ±5px 视差
- [ ] Hero → Section 1 的滚动过渡
- [ ] widget 切换的 0.2s fade 动效

### 不做 (P2,黑客松后再说)

- [ ] 注册 / 登录 / 后端
- [ ] 多语言
- [ ] 复杂 3D / 粒子系统
- [ ] SEO 优化
- [ ] 评论 / 互动后端

### 时间预估

| 任务 | 小时 |
|---|---|
| 项目初始化 + Tailwind 配置 + 字体接入 | 0.5 |
| Hero 视频接入 + 行为控制 | 2 |
| 文字层 + GSAP 动效 | 3 |
| Section 1 + widget React 化 | 2 |
| 移动端适配 | 2 |
| 抛光 + 部署 | 2-4 |
| **总计** | **11.5-13.5** |

---

## 9. CG 视频降本策略

CG 是这个项目里最贵的一块。三个降本路径,任选:

1. **AI 视频生成** (Sora / Runway / Vidu / 即梦)拼接 3-5s 短片。这本来就是产品的核心技术栈,demo 视频用自己产品做,讲故事时还能加一句"这段开场也是我们自己生成的"
2. **AI 静态图序列 + GSAP** 切换 10 张图。10 倍便宜,出 motion graphic 感
3. **2D Lottie / Rive** 扁平动画。更荒诞滑稽,反而契合水獭气质

---

## 10. 待决策清单(执行前等用户拍板)

1. **水獭具体形象** — 写实 3D / 2D 扁平 / 像素风
2. **CG 三个穿越场景** — 用哪三个具体的(诺曼底 / 李子柒 / NBA?)
3. **Slogan 文案** — 待定(代码用占位符)
4. **角色介绍文案** — 待定(两行,代码用占位符)
5. **Section 1 引导文案** — 待定
6. **CG 降本路径** — AI 视频 / 序列帧 / Lottie
7. **域名 + 部署细节** — 待定

**执行时直接用占位符,后期替换即可。**

---

## 11. 给 Claude Code 的提示

- 不要自作主张改 widget 的视觉(§5 的代码已定稿)
- 不要加 nav / footer
- 不要加 SEO meta 之外的"产品介绍 section"
- 文字内容看到 `「 xxx · 待定 」` 直接用占位符,不要自己编
- 中文用半角空格分隔英文/数字(如 `12.4w 赞`)
- 不要用 emoji,用 Tabler Icons
- 暗黑主题,不要 light mode toggle

完成。
