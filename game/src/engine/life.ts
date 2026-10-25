import type { AmbienceId, Direction, Distance, SfxId, VoiceId } from '../audio/catalog';

// Background life: what goes on around her that the story does not need.
// Not clickable, nothing to learn. Strangers talk, a cup is set down, a scooter passes —
// so a wait is never just a black screen. Steady sounds the ambience already plays
// (rail joints, insects, server hum) are text only; one-off sounds and half-heard voices play too.

/** `src` is the small caption saying what the sound is (defaults to the sfx's SFX_SOURCE). */
export type LifeSound = { text: string; src?: string; sfx?: SfxId; at?: Direction[]; dist?: Distance };
export type LifeLine = { say: string; voice: VoiceId };
/** `reply`: the other side of a small exchange, one line or a few turns (a family on the train, two neighbours). */
export type LifeVoice = { say: string; voice: VoiceId; at?: Direction[]; dist?: Distance; reply?: LifeLine | LifeLine[] };
export type LifeEvent = LifeSound | LifeVoice;
export type Life = { every: [number, number]; events: LifeEvent[] };

const AROUND: Direction[] = ['front-left', 'left', 'back-left', 'back', 'back-right', 'right', 'front-right'];
const SIDES: Direction[] = ['left', 'right', 'back-left', 'back-right'];
const BACK: Direction[] = ['back', 'back-left', 'back-right'];
const FRONT: Direction[] = ['front', 'front-left', 'front-right'];

export const LIFE: Partial<Record<AmbienceId, Life>> = {
  // A morning train home along the coast: families, old people with bags, someone on the phone.
  train_interior: {
    every: [4, 8],
    events: [
      { text: '喀噠、喀噠', src: '鐵軌', at: ['back', 'front'], dist: 'near' },
      { text: '喀啦', src: '行李架', at: SIDES, dist: 'mid' },
      { text: '咳、咳', sfx: 'cough', at: ['back-right', 'right'], dist: 'mid' },
      { text: '沙沙', sfx: 'paper_rustle', src: '報紙', at: ['right', 'front-right'], dist: 'mid' },
      { text: '窸窣', sfx: 'cloth_rustle', src: '外套', at: SIDES, dist: 'mid' },
      { text: '叩、叩', sfx: 'step', src: '走道', at: ['left', 'back-left'], dist: 'mid' },
      { text: '嘶啦', src: '餅乾袋', at: BACK, dist: 'mid' },
      { text: '嘻嘻', sfx: 'kid_laugh', src: '小孩在笑', at: BACK, dist: 'far' },
      { text: '呵呵', sfx: 'laugh_soft_adult', at: ['back-right'], dist: 'far' },
      { text: '嗚——', sfx: 'train_horn', src: '火車鳴笛', at: ['front'], dist: 'far' },
      { say: '……那家的粽子我跟妳說，真的要早點去排……', voice: 'woman', at: ['back-right'], dist: 'far' },
      { say: '媽媽，還有幾站？', voice: 'child', at: BACK, dist: 'far', reply: [
        { say: '還早啦，妳先睡一下。', voice: 'woman' },
        { say: '我不睏。', voice: 'child' },
        { say: '不睏也把眼睛閉起來。', voice: 'woman' },
      ] },
      { say: '便當——飲料——', voice: 'man', at: ['front'], dist: 'far' },
      { say: '借過、借過一下。', voice: 'man', at: ['left'], dist: 'mid' },
      { say: '阿妹，這班有停灰潮嗎？', voice: 'old_woman', at: ['left', 'front-left'], dist: 'mid', reply: [
        { say: '有喔阿嬤，還有好幾站。', voice: 'woman' },
        { say: '好，好，到的時候叫我一下。', voice: 'old_woman' },
      ] },
      { say: '喂？我在車上啦，收訊不太好。', voice: 'man', at: ['right', 'back-right'], dist: 'mid', reply: { say: '對，快到了，不用來載啦。', voice: 'man' } },
      { say: '爸，我可以吃餅乾嗎？', voice: 'child', at: BACK, dist: 'mid', reply: [
        { say: '吃一包就好喔。', voice: 'man' },
        { say: '那兩包。', voice: 'child' },
        { say: '一包。', voice: 'man' },
      ] },
      { say: '……中秋那天烤肉，我婆婆一個人在那邊忙……', voice: 'woman', at: ['back-left'], dist: 'far' },
      { say: '欸，你也回來喔？', voice: 'man', at: ['front-left', 'left'], dist: 'far', reply: [
        { say: '對啊，回去幫我爸收網子。', voice: 'man' },
        { say: '他還在捕魚喔？', voice: 'man' },
        { say: '說要做到七十歲啦。', voice: 'man' },
      ] },
      { say: '……提醒您，下車時請注意月台間隙……', voice: 'announcer', at: ['front'], dist: 'far' },
      { say: '欸妳看，海欸。', voice: 'woman', at: ['right', 'front-right'], dist: 'mid', reply: { say: '每次經過這裡妳都要講一次。', voice: 'woman' } },
      { say: '這一段以前都是稻田啦。', voice: 'old_man', at: ['back-left', 'left'], dist: 'far', reply: { say: '你又來了。', voice: 'old_woman' } },
      { say: '哥哥踢我！', voice: 'child', at: BACK, dist: 'far', reply: [
        { say: '我沒有！', voice: 'child' },
        { say: '你們兩個都給我坐好。', voice: 'woman' },
      ] },
      { say: '不好意思，這是我的位子……', voice: 'woman', at: SIDES, dist: 'mid', reply: { say: '啊，歹勢歹勢，我看錯車廂了。', voice: 'man' } },
      { say: '……那支股票喔，我早就叫你賣了……', voice: 'man', at: ['back-right'], dist: 'far' },
      { say: '要不要吃芭樂？自己種的啦。', voice: 'old_woman', at: ['right', 'back-right'], dist: 'mid', reply: [
        { say: '不用啦阿姨，妳留著吃。', voice: 'woman' },
        { say: '拿去啦，家裡很多。', voice: 'old_woman' },
      ] },
      { say: '……媽媽明天就回去了，你要乖乖的……', voice: 'woman', at: ['left', 'back-left'], dist: 'far' },
    ],
  },
  // A small station at 07:40: people met off the train, the first buses, a taxi driver.
  platform: {
    every: [5, 9],
    events: [
      { text: '呼——', sfx: 'wind_gust', at: AROUND, dist: 'far' },
      { text: '叩、叩', sfx: 'step', at: SIDES, dist: 'mid' },
      { text: '喀、喀、喀', sfx: 'step_heels', src: '高跟鞋', at: SIDES, dist: 'far' },
      { text: '噗嘶——', sfx: 'bus_hiss', at: ['back', 'back-left'], dist: 'far' },
      { text: '嘎——', sfx: 'crow', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '啊、啊', sfx: 'seagull', at: FRONT, dist: 'far' },
      { text: '喀啦喀啦', src: '行李箱', at: SIDES, dist: 'mid' },
      { text: '嗶', src: '刷卡', at: BACK, dist: 'mid' },
      { text: '哐啷', src: '販賣機', at: ['back-left', 'left'], dist: 'mid' },
      { text: '刷、刷', src: '竹掃把', at: ['front-left', 'front-right'], dist: 'far' },
      { say: '阿明！這裡啦！', voice: 'old_man', at: ['right', 'front-right'], dist: 'far' },
      { say: '行李我拿就好，妳走前面。', voice: 'woman', at: ['left', 'back-left'], dist: 'mid' },
      { say: '……往北的旅客，請在二號月台候車……', voice: 'announcer', at: ['front'], dist: 'far' },
      { say: '……旅客您好，車站內請勿吸菸……', voice: 'announcer', at: ['front'], dist: 'far' },
      { say: '阿公——！', voice: 'child', at: SIDES, dist: 'far', reply: { say: '慢慢來，不要用跑的！', voice: 'old_man' } },
      { say: '我到了，你在出口那邊嗎？', voice: 'woman', at: SIDES, dist: 'mid', reply: { say: '……好，我看到你的車了。', voice: 'woman' } },
      { say: '同學，你的悠遊卡掉了。', voice: 'man', at: BACK, dist: 'mid', reply: { say: '啊，謝謝叔叔！', voice: 'child' } },
      { say: '這麼早就回來喔？', voice: 'old_woman', at: ['right', 'back-right'], dist: 'far', reply: [
        { say: '對啊，搭第一班。', voice: 'woman' },
        { say: '有閒就多回來啦。', voice: 'old_woman' },
      ] },
      { say: '一大早就這麼多人。', voice: 'man', at: ['left', 'front-left'], dist: 'far', reply: { say: '都是要去市場的啦。', voice: 'man' } },
      { say: '你拿好，不要邊走邊滑手機。', voice: 'woman', at: BACK, dist: 'mid', reply: { say: '好啦好啦。', voice: 'child' } },
      { say: '計程車！要不要坐計程車？', voice: 'man', at: ['back', 'back-right'], dist: 'far' },
      { say: '妳那袋虱目魚要給誰的？', voice: 'old_man', at: ['front-left', 'left'], dist: 'far', reply: [
        { say: '給我女兒啦，她說台北買的不新鮮。', voice: 'old_woman' },
        { say: '妳每次都帶那麼重。', voice: 'old_man' },
      ] },
      { say: '媽，那隻海鷗好大隻。', voice: 'child', at: BACK, dist: 'far', reply: { say: '不要靠近，牠會搶你的東西。', voice: 'woman' } },
      { say: '外套有沒有帶？海邊很冷喔。', voice: 'woman', at: SIDES, dist: 'mid', reply: { say: '有啦，在包包裡。', voice: 'woman' } },
    ],
  },
  // The old street opening up: a morning market, breakfast shops, kids on their way somewhere.
  street_morning: {
    every: [4, 8],
    events: [
      { text: '叮鈴', sfx: 'bicycle_bell', at: SIDES, dist: 'mid' },
      { text: '噗、噗噗——', sfx: 'car_pass', src: '機車', at: ['left', 'right'], dist: 'far' },
      { text: '嘩啦啦——', src: '鐵捲門', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '刷、刷', src: '竹掃把', at: ['right', 'back-right'], dist: 'mid' },
      { text: '汪', sfx: 'dog_bark', at: AROUND, dist: 'far' },
      { text: '唰', src: '潑水', at: ['left', 'front-left'], dist: 'mid' },
      { text: '咚、咚', src: '剁肉', at: ['front-left', 'left'], dist: 'far' },
      { text: '啾啾', src: '麻雀', at: AROUND, dist: 'far' },
      { text: '叭、叭', src: '喇叭', at: ['left', 'right'], dist: 'far' },
      { text: '滋——', src: '煎台', at: ['right', 'front-right'], dist: 'mid' },
      { say: '菜頭一斤多少？', voice: 'old_woman', at: ['left', 'front-left'], dist: 'far', reply: [
        { say: '算妳三十啦。', voice: 'man' },
        { say: '上禮拜才二十五欸。', voice: 'old_woman' },
        { say: '颱風剛走啦，阿姨。', voice: 'man' },
      ] },
      { say: '早——', voice: 'woman', at: ['right', 'front-right'], dist: 'mid', reply: { say: '早，今天這麼早喔？', voice: 'woman' } },
      { say: '等我啦——', voice: 'child', at: BACK, dist: 'mid', reply: { say: '快點啦，阿嬤在等了！', voice: 'child' } },
      { say: '老闆，起司蛋餅，大冰奶。', voice: 'man', at: ['right', 'front-right'], dist: 'mid', reply: { say: '好，馬上來，坐裡面喔。', voice: 'woman' } },
      { say: '今天的魚怎麼這麼少？', voice: 'old_man', at: ['front-left', 'left'], dist: 'far', reply: { say: '浪太大啦，船都沒出去。', voice: 'man' } },
      { say: '阿伯，你的報紙。', voice: 'man', at: SIDES, dist: 'mid', reply: { say: '好，放門口就好。', voice: 'old_man' } },
      { say: '媽，我要吃那個！', voice: 'child', at: BACK, dist: 'mid', reply: [
        { say: '不行，早餐才剛吃過。', voice: 'woman' },
        { say: '可是我還很餓。', voice: 'child' },
        { say: '你每次經過這裡都很餓。', voice: 'woman' },
      ] },
      { say: '妳今天有去拜拜嗎？', voice: 'old_woman', at: ['left', 'back-left'], dist: 'far', reply: [
        { say: '有啦，一早就去了。', voice: 'old_woman' },
        { say: '廟口那邊有在發麵線欸。', voice: 'old_woman' },
      ] },
      { say: '歹勢，借我停一下就好。', voice: 'man', at: ['right', 'back-right'], dist: 'mid', reply: { say: '好啦，不要停太久喔。', voice: 'man' } },
      { say: '豆漿還有嗎？', voice: 'woman', at: ['front-right', 'right'], dist: 'far', reply: { say: '甜的沒了，剩無糖的。', voice: 'man' } },
      { say: '早啊，運動回來喔？', voice: 'old_man', at: SIDES, dist: 'far', reply: { say: '對啦，走到海邊再走回來。', voice: 'old_man' } },
      { say: '妹妹，妳書包拉鍊沒拉。', voice: 'woman', at: BACK, dist: 'mid', reply: { say: '喔。', voice: 'child' } },
      { say: '……這鐵捲門又卡住了，要叫人來修……', voice: 'man', at: ['front-left', 'front-right'], dist: 'far' },
      { say: '青菜一把二十，兩把三十五喔！', voice: 'old_woman', at: ['left', 'front-left'], dist: 'far' },
      { say: '哇，那隻貓又來了。', voice: 'child', at: BACK, dist: 'far', reply: { say: '牠叫小黑啦，是麵店養的。', voice: 'child' } },
    ],
  },
  // Getting home: work and school letting out, the rubbish truck, dinner on the stove.
  street_evening: {
    every: [4, 8],
    events: [
      { text: '噗噗噗——', sfx: 'car_pass', src: '機車', at: ['left', 'right'], dist: 'far' },
      { text: '鏘、鏘', src: '炒菜', at: ['front-left', 'back-right'], dist: 'far' },
      { text: '滋啦——', src: '煎魚', at: ['left', 'back-left'], dist: 'far' },
      { text: '哈哈', sfx: 'kid_laugh', src: '小孩在笑', at: AROUND, dist: 'far' },
      { text: '汪、汪', sfx: 'dog_bark', at: AROUND, dist: 'far' },
      { text: '叮鈴', sfx: 'bicycle_bell', at: SIDES, dist: 'mid' },
      { text: '嘩啦啦——', src: '鐵捲門', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '咚、咚', sfx: 'ball_bounce', at: BACK, dist: 'far' },
      { text: '噗嘶——', sfx: 'bus_hiss', at: ['left', 'right'], dist: 'far' },
      { text: '叮叮噹噹——', src: '垃圾車', at: ['front-left', 'front-right'], dist: 'far' },
      { say: '回來吃飯了啦！', voice: 'woman', at: ['front-left', 'front-right'], dist: 'far', reply: [
        { say: '再一下下就好！', voice: 'child' },
        { say: '你再一下下看看！', voice: 'woman' },
      ] },
      { say: '明天見。', voice: 'man', at: SIDES, dist: 'mid', reply: { say: '掰掰——', voice: 'woman' } },
      { say: '……明天北部地區，午後有局部陣雨……', voice: 'announcer', at: ['back-left', 'back-right'], dist: 'far' },
      { say: '媽，我今天數學考九十分。', voice: 'child', at: BACK, dist: 'mid', reply: [
        { say: '真的假的？考卷給我看。', voice: 'woman' },
        { say: '……在書包裡啦。', voice: 'child' },
      ] },
      { say: '垃圾車來了，快點！', voice: 'old_woman', at: SIDES, dist: 'far', reply: { say: '來了來了，我拿一下！', voice: 'man' } },
      { say: '老闆，便當還有嗎？', voice: 'man', at: ['right', 'front-right'], dist: 'mid', reply: [
        { say: '只剩排骨的喔。', voice: 'woman' },
        { say: '好，排骨就排骨。', voice: 'man' },
      ] },
      { say: '我下班了，你要吃什麼我順便買？', voice: 'woman', at: SIDES, dist: 'mid', reply: { say: '……又是鹹酥雞？好啦。', voice: 'woman' } },
      { say: '叔叔，那顆球可以還我們嗎？', voice: 'child', at: BACK, dist: 'far', reply: { say: '拿去，不要踢到馬路上。', voice: 'man' } },
      { say: '今天怎麼這麼晚？', voice: 'old_man', at: ['left', 'back-left'], dist: 'far', reply: { say: '加班啦，老闆又在發神經。', voice: 'man' } },
      { say: '……那件事明天再跟主任講啦……', voice: 'man', at: ['right', 'back-right'], dist: 'far' },
      { say: '阿弟，幫阿嬤把這袋提進去。', voice: 'old_woman', at: ['back-left', 'back'], dist: 'mid', reply: [
        { say: '好重喔……', voice: 'child' },
        { say: '少年人，提一下就喊重。', voice: 'old_woman' },
      ] },
      { say: '欸妳的鞋子好好看，哪裡買的？', voice: 'woman', at: SIDES, dist: 'far', reply: { say: '網路上啊，等一下傳給妳。', voice: 'woman' } },
      { say: '走啦，去海邊吹風。', voice: 'man', at: ['front-left', 'left'], dist: 'far', reply: { say: '吹什麼風，回家睡覺啦。', voice: 'man' } },
      { say: '媽，我可以去小美家玩嗎？', voice: 'child', at: BACK, dist: 'mid', reply: [
        { say: '功課寫完了嗎？', voice: 'woman' },
        { say: '……快寫完了。', voice: 'child' },
        { say: '那就是還沒。', voice: 'woman' },
      ] },
      { say: '欸，你機車大燈沒開喔！', voice: 'old_man', at: ['left', 'right'], dist: 'far' },
      { say: '補習班幾點下課？我去載你。', voice: 'woman', at: SIDES, dist: 'far', reply: { say: '九點，在後門等我。', voice: 'child' } },
    ],
  },
  // 若晴's café, late morning to evening: regulars, a laptop, someone's mother with a child.
  cafe: {
    every: [3.5, 7],
    events: [
      { text: '嘶——', sfx: 'steam_hiss', at: ['back-left', 'left'], dist: 'mid' },
      { text: '嘎啦嘎啦', sfx: 'coffee_grind', at: ['back-left', 'front-right'], dist: 'mid' },
      { text: '叩', sfx: 'cup_set', at: SIDES, dist: 'mid' },
      { text: '叮、叮', sfx: 'spoon_stir', at: ['right', 'back-right'], dist: 'mid' },
      { text: '嘎', sfx: 'chair_scrape', at: AROUND, dist: 'mid' },
      { text: '噠噠噠', sfx: 'typing', src: '筆電', at: ['front-left', 'left'], dist: 'far' },
      { text: '咚、咚', src: '敲咖啡渣', at: ['back-left'], dist: 'mid' },
      { text: '嘩啦', src: '洗杯子', at: ['back-left', 'back'], dist: 'mid' },
      { text: '嗡、嗡', sfx: 'phone_buzz', at: SIDES, dist: 'mid' },
      { text: '呵呵', sfx: 'laugh_soft_adult', at: AROUND, dist: 'far' },
      { say: '兩杯熱拿鐵，好的。', voice: 'woman', at: ['back-left'], dist: 'mid' },
      { say: '請慢用。', voice: 'woman', at: ['right', 'back-right'], dist: 'mid' },
      { say: '……那個案子，下禮拜再說啦……', voice: 'man', at: ['back-right', 'right'], dist: 'far' },
      { say: '真的假的？他這樣講喔？', voice: 'woman', at: ['left', 'front-left'], dist: 'far', reply: [
        { say: '對啊，我也嚇一跳。', voice: 'woman' },
        { say: '那妳怎麼回他？', voice: 'woman' },
        { say: '我就已讀啊。', voice: 'woman' },
      ] },
      { say: '這個蛋糕是今天做的嗎？', voice: 'woman', at: ['back-left'], dist: 'mid', reply: { say: '對，早上烤的，檸檬塔。', voice: 'woman' } },
      { say: '有插座嗎？我筆電快沒電了。', voice: 'man', at: ['left', 'back-left'], dist: 'mid', reply: { say: '靠牆那排桌子底下有。', voice: 'woman' } },
      { say: '媽媽，我可以喝一口嗎？', voice: 'child', at: BACK, dist: 'mid', reply: [
        { say: '這是咖啡，小孩不能喝。', voice: 'woman' },
        { say: '那我要喝妳那個白白的。', voice: 'child' },
        { say: '那也是咖啡啦。', voice: 'woman' },
      ] },
      { say: '少年仔，這個有沒有不苦的？', voice: 'old_man', at: ['back-left'], dist: 'mid', reply: { say: '阿伯，那我幫你做拿鐵，多加牛奶。', voice: 'woman' } },
      { say: '……我跟你說，那台車買二手的比較划算……', voice: 'man', at: ['right', 'front-right'], dist: 'far' },
      { say: '妳最近是不是瘦了？', voice: 'woman', at: SIDES, dist: 'far', reply: [
        { say: '哪有，是衣服顏色啦。', voice: 'woman' },
        { say: '好啦，那我也要買黑的。', voice: 'woman' },
      ] },
      { say: '我等一下要面試，幫我看領帶有沒有歪。', voice: 'man', at: ['back-right'], dist: 'mid', reply: { say: '往左一點……好了，很帥。', voice: 'man' } },
      { say: '外帶一杯美式，不要糖。', voice: 'man', at: ['back-left'], dist: 'mid' },
      { say: '這附近哪裡比較好停車？', voice: 'woman', at: ['back-left'], dist: 'mid', reply: { say: '廟口那邊有收費的。', voice: 'woman' } },
      { say: '……我們家那隻貓最近都不吃飯……', voice: 'woman', at: ['front-left', 'left'], dist: 'far' },
      { say: '欸，你的咖啡滴到報告了啦。', voice: 'man', at: SIDES, dist: 'far', reply: { say: '啊完了完了，衛生紙！', voice: 'man' } },
      { say: '這首歌叫什麼？好好聽。', voice: 'woman', at: ['right', 'back-right'], dist: 'far', reply: { say: '不知道欸，等一下問老闆。', voice: 'woman' } },
    ],
  },
  // A small eatery after eight: the wok, the TV, a table of men drinking, a family.
  restaurant: {
    every: [3.5, 7],
    events: [
      { text: '滋啦——', src: '油鍋', at: ['back-left', 'back'], dist: 'mid' },
      { text: '鏘鏘鏘', src: '炒鍋', at: ['back-left', 'back'], dist: 'mid' },
      { text: '咕嘟咕嘟', src: '湯鍋', at: ['back', 'back-right'], dist: 'mid' },
      { text: '轟——', src: '抽油煙機', at: ['back-left'], dist: 'far' },
      { text: '叮', sfx: 'glass_clink', src: '碰杯', at: SIDES, dist: 'mid' },
      { text: '嘎', sfx: 'chair_scrape', at: AROUND, dist: 'mid' },
      { text: '喀啦', src: '碗筷', at: SIDES, dist: 'mid' },
      { text: '哈哈哈', sfx: 'laugh_soft_adult_m', at: AROUND, dist: 'far' },
      { text: '呵呵', sfx: 'laugh_soft_adult', at: AROUND, dist: 'far' },
      { text: '咳', sfx: 'cough', at: AROUND, dist: 'far' },
      { say: '老闆，再一碗！', voice: 'man', at: ['right', 'front-right'], dist: 'mid', reply: { say: '好，馬上來！', voice: 'woman' } },
      { say: '內用還外帶？', voice: 'woman', at: ['back-left', 'back'], dist: 'mid' },
      { say: '……今晚到明天，東北季風逐漸增強……', voice: 'announcer', at: ['back-left'], dist: 'far' },
      { say: '……接下來為您播報體育新聞……', voice: 'announcer', at: ['back-left'], dist: 'far' },
      { say: '來，乾啦！', voice: 'man', at: ['front-left', 'left'], dist: 'mid', reply: [
        { say: '你明天不用上班喔？', voice: 'man' },
        { say: '明天的事明天再說啦！', voice: 'man' },
      ] },
      { say: '我不要吃青菜。', voice: 'child', at: BACK, dist: 'mid', reply: [
        { say: '吃一口就好。', voice: 'woman' },
        { say: '一口很小的喔。', voice: 'child' },
      ] },
      { say: '老闆娘，炒米粉一盤，少油。', voice: 'old_man', at: SIDES, dist: 'mid', reply: [
        { say: '阿伯，一樣不要辣齁？', voice: 'woman' },
        { say: '對對對。', voice: 'old_man' },
      ] },
      { say: '欸，你手機一直響。', voice: 'woman', at: ['right', 'back-right'], dist: 'far', reply: { say: '公司的，不要理它。', voice: 'man' } },
      { say: '老闆娘，買單。', voice: 'man', at: ['front-right', 'right'], dist: 'mid', reply: { say: '總共三百二喔。', voice: 'woman' } },
      { say: '你們家阿弟今年考到哪裡？', voice: 'old_woman', at: ['left', 'back-left'], dist: 'far', reply: { say: '高雄啦，開學就去住宿舍了。', voice: 'old_woman' } },
      { say: '這個蚵仔煎好吃，下次再來。', voice: 'man', at: SIDES, dist: 'far' },
      { say: '小心燙喔。', voice: 'woman', at: SIDES, dist: 'mid' },
      { say: '爸，電視可以轉卡通嗎？', voice: 'child', at: BACK, dist: 'mid', reply: { say: '去問老闆，又不是我們家的。', voice: 'man' } },
      { say: '……我跟你講，那條魚至少有三斤……', voice: 'man', at: ['front-left'], dist: 'far' },
      { say: '老闆，外帶的好了沒？', voice: 'man', at: ['back', 'back-right'], dist: 'mid', reply: { say: '快了快了，再五分鐘。', voice: 'woman' } },
      { say: '颱風是不是又要來了？', voice: 'old_man', at: ['left', 'front-left'], dist: 'far', reply: { say: '新聞說會轉走啦。', voice: 'man' } },
    ],
  },
  // Inside the quiet house in the morning; the life is the lane outside: neighbours, laundry, a dog.
  old_house: {
    every: [7, 13],
    events: [
      { text: '喀', src: '木頭', at: AROUND, dist: 'mid' },
      { text: '滴、滴', src: '水龍頭', at: ['back-left', 'back-right'], dist: 'mid' },
      { text: '咕嚕咕嚕', src: '水管', at: ['back', 'back-left'], dist: 'mid' },
      { text: '咻——', sfx: 'car_pass', at: ['left', 'right'], dist: 'far' },
      { text: '噗噗——', sfx: 'car_pass', src: '機車', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '汪', sfx: 'dog_bark', at: AROUND, dist: 'far' },
      { text: '叮鈴', sfx: 'bicycle_bell', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '刷、刷', src: '鄰居掃地', at: ['front', 'front-right'], dist: 'far' },
      { text: '嘩啦啦——', src: '鐵捲門', at: ['left', 'right'], dist: 'far' },
      { text: '啾啾', src: '麻雀', at: FRONT, dist: 'far' },
      { say: '阿美——今天要曬棉被喔，出大日頭！', voice: 'old_woman', at: ['front-right', 'right'], dist: 'far', reply: { say: '好啦，我等一下拿出來。', voice: 'old_woman' } },
      { say: '阿嬤，我的拖鞋呢？', voice: 'child', at: ['front-left', 'left'], dist: 'far', reply: { say: '在門口啦，你都沒在看。', voice: 'old_woman' } },
      { say: '早，要去哪？', voice: 'old_man', at: ['front', 'front-left'], dist: 'far', reply: { say: '去廟口泡茶啦。', voice: 'old_man' } },
      { say: '弟弟，早餐帶著，路上吃。', voice: 'woman', at: ['front-right', 'right'], dist: 'far', reply: [
        { say: '我要飯糰，不要三明治。', voice: 'child' },
        { say: '有得吃就好了，快走。', voice: 'woman' },
      ] },
      { say: '喂？師傅，你們幾點會到？', voice: 'man', at: ['left', 'front-left'], dist: 'far', reply: { say: '好，那我在門口等。', voice: 'man' } },
      { say: '你家的芒果樹又長過來了啦。', voice: 'old_woman', at: ['right', 'front-right'], dist: 'far', reply: [
        { say: '好啦，我叫我兒子來剪。', voice: 'old_man' },
        { say: '你上個月也這樣講。', voice: 'old_woman' },
      ] },
      { say: '小黑！回來！不要亂跑！', voice: 'woman', at: ['left', 'right'], dist: 'far' },
      { say: '……收購舊冰箱、舊冷氣、舊電視……', voice: 'man', at: ['front-left', 'front-right'], dist: 'far' },
      { say: '妳等一下要去市場嗎？', voice: 'old_woman', at: ['front', 'front-right'], dist: 'far', reply: [
        { say: '要啊，等我換個衣服。', voice: 'old_woman' },
        { say: '那我在門口等妳。', voice: 'old_woman' },
      ] },
      { say: '阿公，我們今天要去海邊嗎？', voice: 'child', at: ['left', 'front-left'], dist: 'far', reply: { say: '下午啦，早上太曬。', voice: 'old_man' } },
      { say: '……廁所的磁磚要全部打掉重貼……', voice: 'man', at: ['right'], dist: 'far' },
      { say: '妳家阿弟什麼時候退伍？', voice: 'old_woman', at: ['front-left'], dist: 'far', reply: { say: '下個月啦，快了。', voice: 'woman' } },
    ],
  },
  // Evening and night: the neighbours' TV through the wall, phone calls, a child who won't bathe.
  house_night: {
    every: [7, 12],
    events: [
      { text: '唧——唧——', src: '蟋蟀', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '嗡——', src: '冰箱', at: ['back-right'], dist: 'mid' },
      { text: '喀', src: '木頭', at: AROUND, dist: 'mid' },
      { text: '咻——', sfx: 'car_pass', at: ['left', 'right'], dist: 'far' },
      { text: '噗噗——', sfx: 'car_pass', src: '機車', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '汪、汪', sfx: 'dog_bark', at: AROUND, dist: 'far' },
      { text: '嘩——', src: '隔壁沖水', at: ['left', 'right'], dist: 'far' },
      { text: '鏗、鏗', src: '隔壁洗碗', at: ['left', 'right'], dist: 'far' },
      { text: '喵——', src: '貓', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '叩、叩', sfx: 'step', src: '巷子腳步', at: FRONT, dist: 'far' },
      { say: '……好，下一位來賓……', voice: 'announcer', at: ['left', 'right'], dist: 'far' },
      { say: '……接下來，我們來看一段影片……', voice: 'announcer', at: ['left', 'right'], dist: 'far' },
      { say: '……這個價錢，只有今天晚上喔……', voice: 'announcer', at: ['left', 'right'], dist: 'far' },
      { say: '……媽，我說過了，過年再回去啦……', voice: 'woman', at: ['left', 'front-left'], dist: 'far', reply: { say: '……好啦好啦，我知道。', voice: 'woman' } },
      { say: '電視小聲一點啦，孩子在睡了。', voice: 'man', at: ['right', 'front-right'], dist: 'far', reply: { say: '你自己去轉啦。', voice: 'woman' } },
      { say: '我不要洗澡！', voice: 'child', at: ['left', 'right'], dist: 'far', reply: [
        { say: '不洗就不要上床。', voice: 'woman' },
        { say: '那我睡地板。', voice: 'child' },
        { say: '好啊，你睡啊。', voice: 'woman' },
      ] },
      { say: '明天幾點要去拜拜？', voice: 'old_man', at: ['front-right', 'right'], dist: 'far', reply: { say: '五點就要起來，你早點睡。', voice: 'old_woman' } },
      { say: '阿弟，衣服收進來了沒？', voice: 'old_woman', at: ['front-left', 'left'], dist: 'far', reply: { say: '收了啦——', voice: 'child' } },
      { say: '……喂？對啦，明天早上我去載你……', voice: 'man', at: ['left', 'right'], dist: 'far' },
      { say: '你又在吃泡麵？', voice: 'woman', at: ['right', 'front-right'], dist: 'far', reply: [
        { say: '宵夜啦，一包而已。', voice: 'man' },
        { say: '你昨天也說一包而已。', voice: 'woman' },
      ] },
      { say: '後門鎖了沒？', voice: 'old_woman', at: ['left', 'front-left'], dist: 'far', reply: { say: '鎖了啦，妳每天都問。', voice: 'old_man' } },
      { say: '爸爸，月亮一直跟著我們。', voice: 'child', at: FRONT, dist: 'far', reply: { say: '它跟著每一個人啦。', voice: 'man' } },
      { say: '……好，那就這樣，掰掰……', voice: 'man', at: ['left', 'right'], dist: 'far' },
      { say: '欸，你明天便當要帶什麼？', voice: 'woman', at: ['right'], dist: 'far', reply: { say: '隨便，不要又是滷蛋就好。', voice: 'man' } },
    ],
  },
  night_insects: {
    every: [8, 14],
    events: [
      { text: '唧——唧——', src: '蟋蟀', at: AROUND, dist: 'far' },
      { text: '嘖、嘖、嘖', src: '壁虎', at: SIDES, dist: 'mid' },
      { text: '嗡嗡', src: '蚊子', at: SIDES, dist: 'near' },
      { text: '呱、呱', src: '青蛙', at: FRONT, dist: 'far' },
      { text: '嗚、嗚', src: '貓頭鷹', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '汪', sfx: 'dog_bark', src: '遠處的狗', at: AROUND, dist: 'far' },
      { text: '呼——', sfx: 'wind_gust', at: AROUND, dist: 'far' },
      { text: '咻——', sfx: 'car_pass', src: '遠處的車', at: ['left', 'right'], dist: 'far' },
    ],
  },
  clock_shop: {
    every: [5, 9],
    events: [
      { text: '滴答、滴答', src: '掛鐘', at: SIDES, dist: 'mid' },
      { text: '嘀、嗒', src: '座鐘', at: ['front-left', 'front-right'], dist: 'near' },
      { text: '嗒嗒嗒嗒', src: '懷錶', at: ['front', 'front-left'], dist: 'near' },
      { text: '叮', sfx: 'tools_clink', at: ['front', 'front-right'], dist: 'near' },
      { text: '嘰嘰嘰', sfx: 'clock_wind', at: ['right', 'front-right'], dist: 'mid' },
      { text: '喀', src: '玻璃櫃門', at: SIDES, dist: 'mid' },
      { text: '噗噗——', sfx: 'car_pass', src: '機車', at: ['back'], dist: 'far' },
      { text: '叮鈴', sfx: 'bicycle_bell', at: ['back-left', 'back-right'], dist: 'far' },
    ],
  },
  // The town's police box, morning and night: walk-in errands, the duty roster, lunch orders.
  police_office: {
    every: [5, 9],
    events: [
      { text: '噠噠、噠', sfx: 'typing', at: SIDES, dist: 'mid' },
      { text: '鈴——', sfx: 'phone_ring', at: ['back-left', 'back-right'], dist: 'far' },
      { text: '嗡——', src: '電扇', at: ['front-left', 'front-right'], dist: 'mid' },
      { text: '沙', sfx: 'paper_rustle', src: '公文', at: SIDES, dist: 'mid' },
      { text: '喀嚓', src: '釘書機', at: SIDES, dist: 'mid' },
      { text: '碰、碰', src: '蓋章', at: ['back-left', 'left'], dist: 'mid' },
      { text: '咕嘟咕嘟', src: '飲水機', at: ['back', 'back-right'], dist: 'mid' },
      { text: '嘎啦', sfx: 'drawer', src: '鐵櫃', at: BACK, dist: 'mid' },
      { text: '咳', sfx: 'cough', at: AROUND, dist: 'far' },
      { say: '……好，我們會派人過去。', voice: 'man', at: ['back-left', 'back-right'], dist: 'far' },
      { say: '學長，這份要簽哪裡？', voice: 'man', at: ['back'], dist: 'far', reply: { say: '最下面，日期也要寫。', voice: 'man' } },
      { say: '警察先生，我的機車被人家拖走了啦。', voice: 'old_woman', at: SIDES, dist: 'mid', reply: [
        { say: '阿姨，妳停在哪裡？紅線嗎？', voice: 'man' },
        { say: '……就停一下下而已啊。', voice: 'old_woman' },
      ] },
      { say: '你好，這邊請坐，什麼事？', voice: 'man', at: SIDES, dist: 'mid' },
      { say: '我撿到一個錢包，拿來給你們。', voice: 'woman', at: SIDES, dist: 'mid', reply: { say: '好，謝謝，麻煩幫我填一下這張。', voice: 'man' } },
      { say: '學長，便當要訂哪家？', voice: 'man', at: BACK, dist: 'far', reply: [
        { say: '老樣子，排骨。', voice: 'man' },
        { say: '你每天都排骨。', voice: 'man' },
      ] },
      { say: '我要報案，隔壁的狗每天晚上都在叫。', voice: 'old_man', at: SIDES, dist: 'mid', reply: { say: '阿伯，這個要打去動保處喔。', voice: 'man' } },
      { say: '請問良民證是在這裡辦嗎？', voice: 'woman', at: SIDES, dist: 'mid', reply: { say: '那要去分局喔，我寫地址給妳。', voice: 'man' } },
      { say: '值班表誰排的？我連三天晚班欸。', voice: 'man', at: BACK, dist: 'far', reply: { say: '所長排的，你去跟他講啊。', voice: 'man' } },
      { say: '媽媽，那是真的槍嗎？', voice: 'child', at: BACK, dist: 'mid', reply: { say: '不要用手指人家，沒禮貌。', voice: 'woman' } },
      { say: '……酒測值零點二五，這要開單喔……', voice: 'man', at: ['back-left', 'back-right'], dist: 'far' },
      { say: '少年仔，順便問一下，公車站在哪？', voice: 'old_woman', at: SIDES, dist: 'mid', reply: { say: '出去右轉，超商前面就是。', voice: 'man' } },
      { say: '……颱風假要等縣政府公布啦……', voice: 'man', at: ['back-left', 'back-right'], dist: 'far' },
    ],
  },
  // The town hospital, noon and late afternoon: numbers called, old people waiting, a child who fears needles.
  hospital: {
    every: [5, 9],
    events: [
      { text: '喀啦喀啦', src: '推車', at: SIDES, dist: 'far' },
      { text: '叩、叩', sfx: 'step', at: AROUND, dist: 'mid' },
      { text: '咳', sfx: 'cough', at: AROUND, dist: 'far' },
      { text: '叮咚', src: '叫號', at: ['front', 'front-left', 'front-right'], dist: 'far' },
      { text: '嗶、嗶', src: '點滴機', at: SIDES, dist: 'far' },
      { text: '嘰——', src: '輪椅', at: SIDES, dist: 'mid' },
      { text: '叮', src: '電梯', at: ['back-left', 'back-right'], dist: 'far' },
      { text: '刷、刷', src: '拖地', at: ['back', 'back-left'], dist: 'far' },
      { say: '……請王先生到批價櫃台……', voice: 'announcer', at: ['front', 'back'], dist: 'far' },
      { say: '……請二十七號，到三號診間……', voice: 'announcer', at: ['front', 'back'], dist: 'far' },
      { say: '這邊請，往前直走。', voice: 'woman', at: ['left', 'right'], dist: 'mid' },
      { say: '小姐，抽血是在哪裡？', voice: 'old_woman', at: SIDES, dist: 'mid', reply: { say: '二樓，搭電梯上去右手邊。', voice: 'woman' } },
      { say: '我已經等一個多小時了欸。', voice: 'old_man', at: SIDES, dist: 'mid', reply: { say: '阿伯，前面還有三位，快了。', voice: 'woman' } },
      { say: '我不要打針……', voice: 'child', at: BACK, dist: 'mid', reply: [
        { say: '只是看一下喉嚨而已啦。', voice: 'woman' },
        { say: '真的嗎？', voice: 'child' },
        { say: '真的，媽媽跟你保證。', voice: 'woman' },
      ] },
      { say: '……醫生說要住院觀察兩天……', voice: 'man', at: ['left', 'right'], dist: 'far' },
      { say: '健保卡帶了嗎？', voice: 'woman', at: SIDES, dist: 'mid', reply: [
        { say: '在妳包包裡啊。', voice: 'man' },
        { say: '……喔，對。', voice: 'woman' },
      ] },
      { say: '妳媽媽還好嗎？', voice: 'old_woman', at: SIDES, dist: 'far', reply: { say: '還好啦，今天精神比較好。', voice: 'woman' } },
      { say: '請問停車要去哪裡蓋章？', voice: 'man', at: SIDES, dist: 'mid', reply: { say: '一樓服務台就可以了。', voice: 'woman' } },
      { say: '阿嬤，我們先去拿藥，再去吃飯。', voice: 'woman', at: SIDES, dist: 'mid', reply: [
        { say: '我不餓啦，回家吃就好。', voice: 'old_woman' },
        { say: '妳早上也這樣說。', voice: 'woman' },
      ] },
      { say: '……那個報告下禮拜才會出來……', voice: 'man', at: ['back-left', 'back-right'], dist: 'far' },
      { say: '小朋友，走廊不可以用跑的喔。', voice: 'woman', at: BACK, dist: 'mid' },
      { say: '這個藥飯前還是飯後吃？', voice: 'old_man', at: SIDES, dist: 'mid', reply: { say: '飯後，一天三次。', voice: 'woman' } },
      { say: '媽媽，那個叔叔的腳為什麼包起來？', voice: 'child', at: BACK, dist: 'far', reply: { say: '噓，小聲一點。', voice: 'woman' } },
    ],
  },
  // The town library after lunch: whispers, students, a grandmother who wants large print.
  library: {
    every: [7, 12],
    events: [
      { text: '沙啦', sfx: 'page_turn', at: AROUND, dist: 'mid' },
      { text: '咳', sfx: 'cough', at: AROUND, dist: 'far' },
      { text: '嘎', sfx: 'chair_scrape', at: AROUND, dist: 'far' },
      { text: '唰、唰', sfx: 'pen_scratch', at: SIDES, dist: 'mid' },
      { text: '噠噠', sfx: 'typing', src: '電腦', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '窸窣', sfx: 'cloth_rustle', src: '外套', at: SIDES, dist: 'mid' },
      { text: '嗶', src: '借書機', at: ['back-left', 'back-right'], dist: 'far' },
      { text: '咚', src: '還書箱', at: ['back'], dist: 'far' },
      { text: '嘰嘰嘰——', src: '影印機', at: ['back-left', 'left'], dist: 'far' },
      { text: '叩、叩', sfx: 'step', at: AROUND, dist: 'far' },
      { say: '……這本可以借回去嗎……', voice: 'woman', at: ['front-left', 'front-right'], dist: 'far', reply: { say: '……可以，借期兩個禮拜。', voice: 'woman' } },
      { say: '……媽媽，這本我看過了……', voice: 'child', at: BACK, dist: 'mid', reply: { say: '……小聲一點，那再去找一本。', voice: 'woman' } },
      { say: '……今天的報紙在哪裡……', voice: 'old_man', at: SIDES, dist: 'far', reply: { say: '……窗戶旁邊那個架子上。', voice: 'woman' } },
      { say: '……不好意思，這裡有人坐嗎……', voice: 'man', at: SIDES, dist: 'mid', reply: { say: '……沒有，你坐。', voice: 'woman' } },
      { say: '……小朋友，這裡要小聲喔……', voice: 'woman', at: BACK, dist: 'far' },
      { say: '……哥哥，這個字怎麼唸……', voice: 'child', at: BACK, dist: 'mid', reply: [
        { say: '……鯨，鯨魚的鯨啦。', voice: 'child' },
        { say: '……那鯨魚會游到我們這裡嗎？', voice: 'child' },
      ] },
      { say: '……我這本過期了，會怎樣嗎……', voice: 'woman', at: ['front-left', 'front-right'], dist: 'far', reply: { say: '……停借幾天而已，沒關係。', voice: 'woman' } },
      { say: '……你手機震動很大聲……', voice: 'man', at: SIDES, dist: 'mid', reply: { say: '……歹勢歹勢。', voice: 'man' } },
      { say: '……阿弟，幫阿嬤找大字的書……', voice: 'old_woman', at: SIDES, dist: 'far', reply: [
        { say: '……阿嬤，這一排都是大字的。', voice: 'child' },
        { say: '……那你挑一本好看的。', voice: 'old_woman' },
      ] },
      { say: '……影印一張多少錢……', voice: 'woman', at: ['back-left', 'left'], dist: 'far', reply: { say: '……黑白兩塊，彩色十塊。', voice: 'woman' } },
      { say: '……我先出去講個電話……', voice: 'man', at: SIDES, dist: 'far' },
      { say: '……期中考考到第幾章……', voice: 'woman', at: ['front-left', 'left'], dist: 'far', reply: [
        { say: '……第六章，老師上禮拜講的。', voice: 'woman' },
        { say: '……完了，我才讀到第三章。', voice: 'woman' },
      ] },
      { say: '……我可以借五本嗎……', voice: 'child', at: BACK, dist: 'mid', reply: { say: '……一張證可以借十本喔。', voice: 'woman' } },
    ],
  },
  // The square at midday: pigeons, an ice-cream cart, grandparents in the shade, kids playing tag.
  town_square: {
    every: [4, 8],
    events: [
      { text: '咕、咕', src: '鴿子', at: AROUND, dist: 'mid' },
      { text: '啪啦啪啦', src: '翅膀', at: AROUND, dist: 'mid' },
      { text: '哈哈', sfx: 'kid_laugh', src: '小孩在笑', at: AROUND, dist: 'far' },
      { text: '叮鈴', sfx: 'bicycle_bell', at: SIDES, dist: 'mid' },
      { text: '咚、咚', sfx: 'ball_bounce', at: BACK, dist: 'mid' },
      { text: '叭噗——', src: '叭噗車', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '喀啦喀啦', src: '滑板', at: SIDES, dist: 'far' },
      { text: '噠噠噠', sfx: 'step_run', at: SIDES, dist: 'mid' },
      { text: '呼——', sfx: 'wind_gust', at: AROUND, dist: 'far' },
      { say: '等一下——不要跑那麼快！', voice: 'woman', at: SIDES, dist: 'far', reply: { say: '媽，妳快點啦！', voice: 'child' } },
      { say: '阿公，我要餵鴿子！', voice: 'child', at: BACK, dist: 'mid', reply: [
        { say: '用丟的就好，不要去抓。', voice: 'old_man' },
        { say: '牠啄我！', voice: 'child' },
        { say: '誰叫你拿那麼近。', voice: 'old_man' },
      ] },
      { say: '來，坐這邊，這邊有樹蔭。', voice: 'old_man', at: SIDES, dist: 'far', reply: { say: '今天日頭好大喔。', voice: 'old_woman' } },
      { say: '叭噗一球多少？', voice: 'man', at: ['front-left', 'front-right'], dist: 'far', reply: { say: '一球二十，兩球三十五。', voice: 'old_man' } },
      { say: '妹妹，帽子戴好，會曬傷。', voice: 'woman', at: BACK, dist: 'mid', reply: { say: '很熱啦——', voice: 'child' } },
      { say: '你當鬼！', voice: 'child', at: BACK, dist: 'far', reply: { say: '剛剛就是我當了啦！', voice: 'child' } },
      { say: '……我那個媳婦喔，什麼都要網購……', voice: 'old_woman', at: ['left', 'back-left'], dist: 'far' },
      { say: '欸，可以幫我們拍一張嗎？', voice: 'woman', at: SIDES, dist: 'mid', reply: { say: '好啊，一、二、三——', voice: 'man' } },
      { say: '我們中午吃什麼？', voice: 'woman', at: SIDES, dist: 'far', reply: [
        { say: '都可以。', voice: 'man' },
        { say: '那吃麵。', voice: 'woman' },
        { say: '……麵喔？', voice: 'man' },
      ] },
      { say: '我的氣球！', voice: 'child', at: BACK, dist: 'far', reply: { say: '……好啦，等一下再買一個。', voice: 'woman' } },
      { say: '外送到了，你在哪？我在廣場這邊。', voice: 'man', at: SIDES, dist: 'far' },
      { say: '少年仔，廟口往哪邊走？', voice: 'old_woman', at: SIDES, dist: 'mid', reply: { say: '直走，看到紅色屋頂就是了。', voice: 'man' } },
      { say: '爸爸，背我！', voice: 'child', at: BACK, dist: 'mid', reply: [
        { say: '你都幾歲了還要背。', voice: 'man' },
        { say: '六歲。', voice: 'child' },
        { say: '……好啦，上來。', voice: 'man' },
      ] },
      { say: '下午要不要去海邊看人家釣魚？', voice: 'old_man', at: ['left', 'right'], dist: 'far', reply: { say: '你自己去，我要睡午覺。', voice: 'old_woman' } },
    ],
  },
  tower_square_night: {
    every: [8, 14],
    events: [
      { text: '呼——', sfx: 'wind_gust', at: AROUND, dist: 'far' },
      { text: '咻——', sfx: 'car_pass', src: '遠處的車', at: ['left', 'right'], dist: 'far' },
      { text: '叩……叩……', sfx: 'step', src: '有人走過', at: SIDES, dist: 'far' },
      { text: '喀啦喀啦', src: '空罐子', at: SIDES, dist: 'mid' },
      { text: '咕……', src: '鴿子', at: FRONT, dist: 'mid' },
      { text: '啪啦啪啦', src: '旗子', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '汪', sfx: 'dog_bark', src: '遠處的狗', at: AROUND, dist: 'far' },
      { text: '叮鈴', sfx: 'bicycle_bell', at: ['left', 'right'], dist: 'far' },
    ],
  },
  wind_open: {
    every: [7, 12],
    events: [
      { text: '呼——', sfx: 'wind_gust', at: AROUND, dist: 'far' },
      { text: '喀沙', src: '枯葉', at: AROUND, dist: 'mid' },
      { text: '咻咻', src: '電線', at: ['left', 'right'], dist: 'mid' },
      { text: '唰——', src: '芒草', at: SIDES, dist: 'mid' },
      { text: '啪嚓', src: '樹枝', at: AROUND, dist: 'far' },
      { text: '匡啷', src: '招牌', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '嘎——', sfx: 'crow', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '嗡——', sfx: 'car_pass', src: '遠處的車', at: ['left', 'right'], dist: 'far' },
    ],
  },
  sea_far: {
    every: [7, 12],
    events: [
      { text: '嘩——', sfx: 'wave', at: FRONT, dist: 'far' },
      { text: '啊、啊', sfx: 'seagull', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '嘩啦——', src: '消波塊', at: FRONT, dist: 'far' },
      { text: '喀啦啦', src: '浪捲石頭', at: FRONT, dist: 'far' },
      { text: '噗噗噗', src: '漁船', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '嗚——', src: '船笛', at: FRONT, dist: 'far' },
      { text: '呼——', sfx: 'wind_gust', src: '海風', at: AROUND, dist: 'far' },
    ],
  },
  old_station_hall: {
    every: [8, 13],
    events: [
      { text: '滴——', src: '滴水', at: AROUND, dist: 'mid' },
      { text: '呼——', sfx: 'wind_gust', src: '穿堂風', at: ['back', 'back-left'], dist: 'far' },
      { text: '啪啦啪啦', src: '翅膀', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '咕、咕', src: '鴿子', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '匡——', src: '鐵皮', at: SIDES, dist: 'far' },
      { text: '吱——', src: '鐵窗', at: SIDES, dist: 'far' },
      { text: '嘰嘰', src: '老鼠', at: SIDES, dist: 'mid' },
      { text: '咻——', sfx: 'car_pass', src: '外面的車', at: ['back', 'back-right'], dist: 'far' },
    ],
  },
  research_facility: {
    every: [9, 15],
    events: [
      { text: '嗡——', src: '伺服器', at: AROUND, dist: 'mid' },
      { text: '喀', sfx: 'relay_click', at: AROUND, dist: 'mid' },
      { text: '滴、滴', src: '機器', at: SIDES, dist: 'far' },
      { text: '呼——', src: '空調', at: ['front-left', 'front-right'], dist: 'mid' },
      { text: '喀噠喀噠', src: '硬碟', at: SIDES, dist: 'mid' },
      { text: '嗚——', src: '散熱風扇', at: SIDES, dist: 'mid' },
      { text: '滴答', src: '冷氣滴水', at: ['back-left', 'back-right'], dist: 'far' },
      { text: '鏗', src: '水管', at: AROUND, dist: 'far' },
    ],
  },
  construction_far: {
    every: [6, 11],
    events: [
      { text: '噠噠噠噠', src: '電鑽', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '鏘', src: '鋼筋', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '嗶、嗶、嗶', sfx: 'truck_reverse', at: ['left', 'right'], dist: 'far' },
      { text: '叩叩叩', sfx: 'hammer', src: '槌子', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '轟——', src: '水泥車', at: ['left', 'right'], dist: 'far' },
      { text: '吱——', src: '電鋸', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '喀啦喀啦', src: '怪手', at: ['front', 'front-left'], dist: 'far' },
    ],
  },
  // Rain outdoors: people caught under the arcade, scooters in raincoats, a child who wants to splash.
  rain: {
    every: [5, 9],
    events: [
      { text: '滴答滴答', src: '屋簷滴水', at: AROUND, dist: 'mid' },
      { text: '唰——', sfx: 'car_pass', src: '車子濺水', at: ['left', 'right'], dist: 'far' },
      { text: '啪', sfx: 'umbrella', at: SIDES, dist: 'mid' },
      { text: '啪噠、啪噠', sfx: 'step_wet', at: SIDES, dist: 'mid' },
      { text: '咚咚咚', src: '鐵皮屋頂', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '咕嚕咕嚕', src: '排水溝', at: SIDES, dist: 'mid' },
      { text: '嘩啦——', sfx: 'rain_burst', at: AROUND, dist: 'far' },
      { text: '噗噗——', src: '機車', at: ['left', 'right'], dist: 'far' },
      { say: '怎麼突然下這麼大？', voice: 'woman', at: SIDES, dist: 'mid', reply: { say: '剛剛還出太陽欸。', voice: 'woman' } },
      { say: '借過借過，雨傘小心。', voice: 'man', at: SIDES, dist: 'mid' },
      { say: '媽媽，我可以踩水嗎？', voice: 'child', at: BACK, dist: 'mid', reply: [
        { say: '不可以，鞋子會濕。', voice: 'woman' },
        { say: '已經濕了。', voice: 'child' },
      ] },
      { say: '阿弟，雨衣穿好再騎。', voice: 'old_woman', at: SIDES, dist: 'far', reply: { say: '好啦，阿嬤妳先進去。', voice: 'man' } },
      { say: '要不要一起撐？我到前面而已。', voice: 'man', at: SIDES, dist: 'mid', reply: { say: '不用啦，謝謝，我等雨停。', voice: 'woman' } },
      { say: '你可以來載我嗎？我沒帶傘。', voice: 'woman', at: SIDES, dist: 'far', reply: { say: '……好，我在超商門口等你。', voice: 'woman' } },
      { say: '這款雨，等一下就停了啦。', voice: 'old_man', at: SIDES, dist: 'far' },
      { say: '計程車！計程車——', voice: 'man', at: ['back', 'back-right'], dist: 'far' },
      { say: '哥哥，你的傘借我。', voice: 'child', at: BACK, dist: 'far', reply: { say: '不要，你自己的呢？', voice: 'child' } },
      { say: '衣服！衣服還曬在外面！', voice: 'woman', at: SIDES, dist: 'far', reply: [
        { say: '我早上就收了啦。', voice: 'man' },
        { say: '……真的喔？你最好了。', voice: 'woman' },
      ] },
      { say: '……這雨下到晚上都不會停啦……', voice: 'man', at: ['left', 'right'], dist: 'far' },
      { say: '進來進來，騎樓這邊比較淋不到。', voice: 'old_woman', at: SIDES, dist: 'mid', reply: { say: '謝謝阿姨。', voice: 'woman' } },
      { say: '我的褲子整個濕掉了啦。', voice: 'woman', at: SIDES, dist: 'far', reply: [
        { say: '誰叫妳要穿白的。', voice: 'woman' },
        { say: '早上出門明明是晴天啊。', voice: 'woman' },
      ] },
    ],
  },
  rain_on_window: {
    every: [7, 12],
    events: [
      { text: '滴答滴答', src: '雨打窗', at: FRONT, dist: 'near' },
      { text: '轟……', sfx: 'thunder_far', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '咚、咚', src: '鐵皮雨遮', at: ['front-left', 'front-right'], dist: 'mid' },
      { text: '嘩嘩嘩', src: '排水管', at: SIDES, dist: 'mid' },
      { text: '喀噠', src: '窗框', at: FRONT, dist: 'mid' },
      { text: '嘩啦——', sfx: 'rain_burst', src: '一陣大雨', at: FRONT, dist: 'far' },
      { text: '唰——', sfx: 'car_pass', src: '車子濺水', at: ['left', 'right'], dist: 'far' },
    ],
  },
};

/** Anomaly sounds: the world holds its breath for a while after one of these. */
export const HUSH_SFX: ReadonlySet<SfxId> = new Set<SfxId>([
  'hum_rise', 'blackout', 'silence_drop', 'tinnitus', 'metal_crash', 'glass_break', 'bell_toll', 'bell_toll_far', 'heartbeat', 'spark',
]);
export const HUSH_MS = 16000;

const SCENE_EVERY: [number, number] = [4, 8];

/** The ambience's life plus whatever this one scene adds. */
export function lifeOf(ambience: readonly AmbienceId[], scene?: readonly LifeEvent[]): Life | null {
  const layers = ambience.map((id) => LIFE[id]).filter((life): life is Life => Boolean(life));
  if (scene?.length) layers.push({ every: SCENE_EVERY, events: [...scene, ...scene] }); // the scene's own sounds come up more often
  if (!layers.length) return null;
  return {
    every: [Math.min(...layers.map((life) => life.every[0])), Math.min(...layers.map((life) => life.every[1]))],
    events: layers.flatMap((life) => life.events),
  };
}

export function isVoice(event: LifeEvent): event is LifeVoice { return 'say' in event; }
