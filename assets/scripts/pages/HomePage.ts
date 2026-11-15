import { Graphics, Label, Node, Sprite, tween, Tween, Vec3 } from 'cc';
import { getArt } from '../art/ArtCatalog';
import { P } from '../art/Palette';
import { DIFFICULTIES } from '../config/GameConfig';
import { formatDuration } from '../core/GameTimer';
import { Theme } from '../ui/Theme';
import { button, ButtonHandle, drawPanel, label, makeNode, onTap, panel, popIn, sprite, starRow } from '../ui/UIKit';
import { BasePage } from './BasePage';
import { artFrame, fmtDate, Flow, openDifficultySheet, segmentBar, setLabel, starFrames } from './PageKit';

/**
 * 首页：Logo、玩家信息与星星、每日挑战卡片、大号“开始拼图”、四个功能入口。
 * 布局按可用高度自适应：开始按钮始终位于屏幕中部偏上，几秒内就能找到。
 */
export class HomePage extends BasePage {
    private starLabel!: Label;
    private dailyThumb!: Sprite;
    private dailyName!: Label;
    private dailyStatus!: Label;
    private dailyStreak!: Label;
    private dailyDate!: Label;
    private dailyBtn!: ButtonHandle;
    private startBtn!: ButtonHandle;
    private collTitle!: Label;
    private collSub!: Label;
    private collThumb!: Sprite;
    private collBarHolder!: Node;
    private avatarG!: Graphics;
    private avatarBadge!: Node;
    private dailyStarsHolder!: Node;
    private animNodes: Node[] = [];
    private animBases: Vec3[] = [];

    protected build(): void {
        const L = this.L;
        const gm = this.gm;
        const W = L.w - Theme.gutter * 2;

        // ---------- 顶部：头像 + 昵称 + 星星
        const avatar = panel(this.root, 76, 76, { fill: P.peach, border: P.ink, shadow: P.orange2, step: Theme.px }, -L.w / 2 + Theme.gutter + 38, L.headerY);
        sprite(avatar, gm.textures.art('cat_orange'), 56, 56).node.setPosition(0, 0);
        this.avatarG = avatar.getComponent(Graphics)!;
        // 系列奖励“头像框”：集齐系列后头像框换成该系列主色，右下角出现徽章
        this.avatarBadge = sprite(avatar, gm.textures.icon('badge', P.gold, P.white), 30, 30, 30, -30).node;
        this.avatarBadge.active = false;
        const nick = label(this.root, gm.save.data.player.nickname, Theme.font.body, { bold: true, align: 'left' });
        nick.node.setPosition(-L.w / 2 + Theme.gutter + 92, L.headerY + 14);
        const sub = label(this.root, '今天也来拼一张吧', Theme.font.tiny, { color: Theme.textMuted, align: 'left' });
        sub.node.setPosition(-L.w / 2 + Theme.gutter + 92, L.headerY - 18);
        const starPill = panel(this.root, 150, 60, { fill: P.butter, border: P.ink, shadow: P.gold2, step: Theme.px }, L.headerRight - 75, L.headerY);
        sprite(starPill, gm.textures.icon('star', P.gold, P.white), 30, 28, -42, 0);
        this.starLabel = label(starPill, '0', Theme.font.body, { bold: true });
        this.starLabel.node.setPosition(16, 0);

        // ---------- Logo
        const top = L.contentTop;
        // 纵向自适应：先按紧凑布局估算“开始按钮”与底部入口之间的空白，多出来的空间按比例分给各段间距
        const tileH = 150;
        const bottom = -L.h / 2 + L.safeBottom + 24;
        const cardH = 300;
        const compactStartBottom = top - 70 - 120 - cardH - 100 - 64;
        const free = compactStartBottom - (bottom + tileH + 6);
        const extra = Math.max(0, free - 220);
        const logoY = top - 70 - extra * 0.12;
        const logo = makeNode('Logo', this.root, W, 120, 0, logoY);
        const shadow = label(logo, '像素搭子', Theme.font.hero, { bold: true, color: P.rose2, outline: { color: P.rose2, width: 6 } });
        shadow.node.setPosition(5, -6);
        label(logo, '像素搭子', Theme.font.hero, { bold: true, color: P.white, outline: { color: P.ink, width: 6 } });
        const tagline = label(this.root, 'PIXEL BUDDIES · 每张图都是一个小故事', Theme.font.tiny, { color: P.ink2, bold: true });
        tagline.node.setPosition(0, logoY - 62);
        // Logo 两侧小装饰
        const deco1 = sprite(this.root, gm.textures.icon('heart', P.rose, P.white), 28, 24, -210, logoY + 30);
        const deco2 = sprite(this.root, gm.textures.icon('sparkle', P.gold, P.white), 28, 28, 215, logoY + 36);
        this.animNodes.push(deco1.node, deco2.node);

        // ---------- 每日挑战卡片
        const cardY = logoY - 120 - extra * 0.18 - cardH / 2;
        const card = panel(this.root, W, cardH, { fill: P.white, border: P.ink, shadow: P.ink, step: Theme.px, shadowDepth: 2 }, 0, cardY);
        const tag = panel(card, 170, 52, { fill: P.yellow, border: P.ink, step: Theme.px, shadow: undefined }, -W / 2 + 110, cardH / 2 - 2);
        sprite(tag, gm.textures.icon('calendar', P.ink, P.rose), 26, 24, -52, 0);
        label(tag, '今日挑战', Theme.font.small, { bold: true }).node.setPosition(14, 0);
        const thumbFrame = artFrame(card, gm.textures.art('cat_orange'), 196, -W / 2 + 140, -14, 'butter');
        this.dailyThumb = thumbFrame.getComponentInChildren(Sprite)!;
        const tx = -W / 2 + 270;
        this.dailyDate = label(card, '', Theme.font.small, { color: Theme.textMuted, align: 'left' });
        this.dailyDate.node.setPosition(tx, 88);
        this.dailyName = label(card, '', Theme.font.h2, { bold: true, align: 'left' });
        this.dailyName.node.setPosition(tx, 46);
        this.dailyStatus = label(card, '', Theme.font.small, { color: P.ink2, align: 'left' });
        this.dailyStatus.node.setPosition(tx, 6);
        this.dailyStarsHolder = makeNode('DailyStars', card, 120, 30, tx + 60, 6);
        const flame = sprite(card, gm.textures.icon('flame', P.orange2, P.yellow), 22, 26, tx + 11, -32);
        this.dailyStreak = label(card, '', Theme.font.tiny, { color: P.orange3, bold: true, align: 'left' });
        this.dailyStreak.node.setPosition(tx + 30, -32);
        this.animNodes.push(flame.node);
        this.dailyBtn = button(card, { w: 250, h: 80, text: '去挑战', style: 'butter', fontSize: Theme.font.body, onClick: () => Flow.daily() }, tx + 125, -94);

        // ---------- 开始拼图
        const startY = cardY - cardH / 2 - 100 - extra * 0.18;
        this.startBtn = button(this.root, {
            w: W,
            h: 128,
            text: '开始拼图',
            sub: '推荐',
            fontSize: 44,
            style: 'primary',
            icon: gm.textures.icon('puzzle', P.white),
            onClick: () => this.quickStart(),
        }, 0, startY);

        // ---------- 底部功能入口
        const gridY = bottom + tileH / 2 + 6;
        const entries: Array<{ text: string; icon: string; style: 'mint' | 'sky' | 'lilac' | 'white'; color: number; go: () => void }> = [
            { text: '经典拼图', icon: 'puzzle', style: 'mint', color: P.leaf3, go: () => this.sm.go('classic') },
            { text: '好友挑战', icon: 'users', style: 'sky', color: P.blue3, go: () => this.sm.go('challenge') },
            { text: '我的收藏', icon: 'book', style: 'lilac', color: P.purple2, go: () => this.sm.go('collection') },
            { text: '设置', icon: 'gear', style: 'white', color: P.ink2, go: () => this.sm.go('settings') },
        ];
        const gap = 16;
        const tw = (W - gap * 3) / 4;
        entries.forEach((e, i) => {
            button(this.root, { w: tw, h: tileH, text: e.text, fontSize: Theme.font.small, style: e.style, icon: gm.textures.icon(e.icon, e.color, P.white), iconSize: 52, iconTop: true, onClick: e.go }, -W / 2 + tw / 2 + i * (tw + gap), gridY);
        });

        // ---------- 我的收藏入口（开始按钮与底部入口之间）：总进度、最近解锁、下一个系列奖励
        const midY = startY - 64 - 30 - 68 - extra * 0.12;
        const ch = 136;
        const coll = panel(this.root, W, ch, { fill: P.white, border: P.ink, shadow: P.lilac2, step: Theme.px, shadowDepth: 1.5 }, 0, midY);
        const thumbBg = panel(coll, 100, 100, { fill: P.lilac, border: P.ink, shadow: undefined, step: 3 }, -W / 2 + 74, 0);
        this.collThumb = sprite(thumbBg, gm.textures.mosaic('cat_orange'), 80, 80);
        this.collTitle = label(coll, '', Theme.font.body, { bold: true, align: 'left', width: W - 190 });
        this.collTitle.node.setPosition(-W / 2 + 146, ch / 2 - 32);
        this.collSub = label(coll, '', Theme.font.tiny, { color: P.ink2, bold: true, align: 'left', width: W - 190 });
        this.collSub.node.setPosition(-W / 2 + 146, ch / 2 - 66);
        this.collBarHolder = makeNode('Bar', coll, W - 190, 20, 56, -ch / 2 + 30);
        sprite(coll, gm.textures.icon('book', P.purple, P.white), 30, 24, W / 2 - 34, ch / 2 - 30);
        onTap(coll, () => {
            gm.audio.play('click');
            this.sm.go('collection');
        });

        popIn(logo, 0.05);
        popIn(card, 0.1);
        popIn(this.startBtn.node, 0.15);
    }

    onEnter(): void {
        const gm = this.gm;
        const total = gm.collection.totalStars();
        setLabel(this.starLabel, String(total));

        // 每日挑战
        const daily = gm.daily.getToday();
        const art = getArt(daily.imageId)!;
        this.dailyThumb.spriteFrame = gm.textures.art(art.id);
        setLabel(this.dailyDate, `${fmtDate(daily.dateKey)} · ${DIFFICULTIES[daily.grid].desc}`);
        setLabel(this.dailyName, art.name);
        const rec = gm.daily.getRecord(daily.dateKey);
        this.dailyStarsHolder.destroyAllChildren();
        if (rec && rec.completed) {
            setLabel(this.dailyStatus, `最佳 ${formatDuration(rec.bestTimeMs)}`);
            const sr = starRow(this.dailyStarsHolder, starFrames(), rec.stars, 3, 24, 4);
            sr.setPosition(90, 0);
            this.dailyBtn.setText('再挑战');
        } else {
            setLabel(this.dailyStatus, rec && rec.attempts > 0 ? '还差一点点，继续加油' : '全服同一题，今天还没挑战');
            this.dailyBtn.setText('去挑战');
        }
        const streak = gm.daily.streak();
        setLabel(this.dailyStreak, streak > 0 ? `已连续完成 ${streak} 天` : '完成后开始累计连续天数');

        // 开始拼图推荐
        const next = gm.collection.suggestNext();
        if (this.startBtn.sub) setLabel(this.startBtn.sub, `推荐：${next.name}`);

        // 我的收藏卡片 + 头像框
        const ov = gm.collection.overall();
        const latest = gm.collection.latestUnlocked();
        this.collThumb.spriteFrame = latest ? gm.textures.art(latest.id) : gm.textures.mosaic('cat_orange');
        setLabel(this.collTitle, `我的收藏  ${ov.collected}/${ov.total}`);
        const nextS = gm.collection.nextRewardSeries();
        setLabel(
            this.collSub,
            !nextS
                ? '全部主题已集齐，太厉害了！'
                : latest
                  ? `最近解锁：${latest.name} · ${nextS.info.name} ${nextS.collected}/${nextS.total}，再收集 ${nextS.remaining} 件得奖励`
                  : '完成拼图，解锁你的第一件收藏',
        );
        this.collBarHolder.destroyAllChildren();
        segmentBar(this.collBarHolder, ov.total, ov.collected, this.collBarHolder.getComponent('cc.UITransform') ? (this.L.w - Theme.gutter * 2) - 190 : 400, 16, nextS ? nextS.info.reward.color : P.mint3, 0, 0);
        const frame = gm.collection.earnedRewards()[0];
        drawPanel(this.avatarG, 76, 76, { fill: P.peach, border: frame ? frame.reward.color : P.ink, shadow: frame ? frame.reward.color : P.orange2, step: Theme.px, borderWidth: frame ? Theme.px * 2 : Theme.px });
        this.avatarBadge.active = !!frame;
        if (frame) (this.avatarBadge.getComponent(Sprite) as Sprite).spriteFrame = gm.textures.icon('badge', frame.reward.color, P.white);

        this.startIdle();
    }

    onExit(): void {
        this.animNodes.forEach((n, i) => {
            Tween.stopAllByTarget(n);
            if (this.animBases[i]) n.setPosition(this.animBases[i]);
        });
    }

    /** 装饰物轻微浮动（数量很少，开销可忽略） */
    private startIdle(): void {
        if (!this.animBases.length) this.animBases = this.animNodes.map((n) => n.position.clone());
        this.animNodes.forEach((n, i) => {
            const base = this.animBases[i];
            Tween.stopAllByTarget(n);
            n.setPosition(base);
            tween(n)
                .repeatForever(
                    tween(n)
                        .to(1.2 + i * 0.2, { position: new Vec3(base.x, base.y + 6, 0) }, { easing: 'sineInOut' })
                        .to(1.2 + i * 0.2, { position: base }, { easing: 'sineInOut' }),
                )
                .start();
        });
    }

    private quickStart(): void {
        const art = this.gm.collection.suggestNext();
        openDifficultySheet(art, (g) => Flow.classic(art.id, g), '开始拼图');
    }
}
