// §5 定稿数据 — 不动

export interface DailyItem {
  loc: string;
  time: string;
  state: string;
  caption: string;
  video?: string; // 定稿日常视频(public/daily/*.mp4);有则前端循环播放,无则占位
}

export interface PairItem {
  orig: { author: string; title: string; icon: string };
  otter: string;
  origVideo?: string; // 原视频(右屏「原视频」);截取的 10s 源片
  otterVideo?: string; // 水獭穿越生成(中屏「水獭穿越后」);有则前端循环播放
}

export const daily: DailyItem[] = [
  { loc: "家", time: "22:34", state: "在跑步机狂奔", caption: "小獭 · 沙滩冲锋中" },
  { loc: "家", time: "14:08", state: "煮泡面煮糊了", caption: "小獭 · 厨房灾难", video: "/daily/noodle.mp4" },
  { loc: "家", time: "09:21", state: "在沙发上发呆", caption: "小獭 · 灵魂出窍" },
  { loc: "家", time: "00:42", state: "对着电脑掉毛", caption: "小獭 · 卷不动了" },
  { loc: "街", time: "08:15", state: "西装挤地铁", caption: "小獭 · 打卡上班", video: "/daily/subway.mp4" },
  { loc: "街", time: "12:33", state: "摆摊卖煎饼", caption: "小獭 · 街角营业中", video: "/daily/jianbing.mp4" },
  { loc: "街", time: "18:47", state: "给城管递烟", caption: "小獭 · 神情自若", video: "/daily/chengguan.mp4" },
  { loc: "街", time: "21:09", state: "ATM 前哭出来", caption: "小獭 · 余额劝退" },
  // 队友补充的生活视频(已成片,放 public/daily/;caption 按片内容拟,可改)
  { loc: "家", time: "23:47", state: "深夜煮面", caption: "小獭 · 深夜放毒", video: "/daily/1d9cf0594bc3c9222cdbf126f398e134.mp4" },
  { loc: "家", time: "02:15", state: "学着学着睡着", caption: "小獭 · 学不动了", video: "/daily/97b02360334868910b0d5367b61fbccb.mp4" },
  { loc: "家", time: "19:30", state: "健身房撸铁", caption: "小獭 · 自律假象", video: "/daily/b043a6fa16b9f795bba04527ec6419bc.mp4" },
  { loc: "海", time: "17:50", state: "扮海盗船长", caption: "小獭 · 加勒比海獭", video: "/daily/b9e05606a178d0f31f9791f832d194f0.mp4" },
  { loc: "家", time: "11:08", state: "蹲洗衣机上洗衣", caption: "小獭 · 家务献祭", video: "/daily/e7e51ff63ab0cc1a525ad974e406ad08.mp4" },
];

export const pairs: PairItem[] = [
  {
    orig: { author: "@战争影像", title: "登陆日纪实", icon: "flag" },
    otter: "扛 AK 冲滩 谁懂啊",
    origVideo: "/crossover/normandy_orig.mp4",
    otterVideo: "/crossover/normandy_otter.mp4",
  },
  // 仅保留有视频的穿越对(无视频占位对已清掉);icon 仅占位,有视频时不显
  {
    orig: { author: "@漫威剪辑", title: "绿巨人大战灭霸", icon: "sparkles" },
    otter: "獭霸 一拳一个",
    origVideo: "/crossover/hulk_orig.mp4",
    otterVideo: "/crossover/hulk_otter.mp4",
  },
  {
    orig: { author: "@经典电影", title: "泰坦尼克号", icon: "sparkles" },
    otter: "我是这片海最獭的獭",
    origVideo: "/crossover/titanic_orig.mp4",
    otterVideo: "/crossover/titanic_otter.mp4",
  },
  {
    orig: { author: "@经典动画", title: "冰雪奇缘", icon: "sparkles" },
    otter: "随它去 反正我獭",
    origVideo: "/crossover/frozen_orig.mp4",
    otterVideo: "/crossover/frozen_otter.mp4",
  },
];
