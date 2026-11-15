import { Label, Node, Sprite } from 'cc';
import { getArt } from '../art/ArtCatalog';
import { P } from '../art/Palette';
import { DIFFICULTIES } from '../config/GameConfig';
import { formatDuration } from '../core/GameTimer';
import { getDailyPuzzle, shiftDateKey } from '../daily/DailyChallengeManager';
import { Theme } from '../ui/Theme';
import { Ticker } from '../ui/Ticker';
import { button, ButtonHandle, label, makeNode, panel, sprite, starRow } from '../ui/UIKit';
import { BasePage } from './BasePage';
import { artFrame, fmtDate, Flow, setLabel, starFrames } from './PageKit';

/**
 * 每日挑战页：今日题目（按日期固定）、个人最佳、连续天数、刷新倒计时、近 7 天记录。
 */
export class DailyPage extends BasePage {
    private thumb!: Sprite;
    private nameLabel!: Label;
    private dateLabel!: Label;
    private bestLabel!: Label;
    private countdown!: Label;
    private startBtn!: ButtonHandle;
    private starsHolder!: Node;
    private weekHolder!: Node;
    private lastSec = -1;
    private shownDate = '';

    protected build(): void {
        const L = this.L;
        const gm = this.gm;
        this.header('每日挑战');
        const W = L.w - Theme.gutter * 2;
        const top = L.contentTop;

        const cardH = 620;
        const card = panel(this.root, W, cardH, { fill: P.white, border: P.ink, shadow: P.ink, step: Theme.px, shadowDepth: 2 }, 0, top - 20 - cardH / 2);
        this.dateLabel = label(card, '', Theme.font.small, { color: Theme.textMuted, bold: true });
        this.dateLabel.node.setPosition(0, cardH / 2 - 44);
        const f = artFrame(card, gm.textures.art('cat_orange'), 300, 0, cardH / 2 - 250, 'butter');
        this.thumb = f.getComponentInChildren(Sprite)!;
        this.nameLabel = label(card, '', Theme.font.title, { bold: true });
        this.nameLabel.node.setPosition(0, cardH / 2 - 452);
        this.bestLabel = label(card, '', Theme.font.small, { color: P.ink2 });
        this.bestLabel.node.setPosition(0, cardH / 2 - 500);
        this.starsHolder = makeNode('Stars', card, 200, 40, 0, cardH / 2 - 548);

        const midY = top - 20 - cardH - 70;
        this.startBtn = button(this.root, { w: W, h: 116, text: '开始今日挑战', style: 'butter', fontSize: Theme.font.title, icon: gm.textures.icon('calendar', P.ink, P.rose), onClick: () => Flow.daily() }, 0, midY);
        this.countdown = label(this.root, '', Theme.font.small, { color: P.ink2 });
        this.countdown.node.setPosition(0, midY - 90);

        // 近 7 天
        const weekY = midY - 200;
        const wp = panel(this.root, W, 150, { fill: P.cream2, border: P.cream3, step: Theme.px, shadow: undefined }, 0, weekY);
        label(wp, '最近 7 天', Theme.font.small, { bold: true, align: 'left', color: P.ink2 }).node.setPosition(-W / 2 + 24, 46);
        this.weekHolder = makeNode('Week', wp, W, 90, 0, -18);

        const note = label(this.root, '每天 0 点（设备本地时间）刷新，所有玩家当天挑战同一张图', Theme.font.tiny, { color: Theme.textMuted, width: W });
        note.node.setPosition(0, -L.h / 2 + L.safeBottom + 40);

        const t = this.root.addComponent(Ticker);
        t.cb = () => this.tickCountdown();
    }

    onEnter(): void {
        const gm = this.gm;
        const p = gm.daily.getToday();
        this.shownDate = p.dateKey;
        const art = getArt(p.imageId)!;
        this.thumb.spriteFrame = gm.textures.art(art.id);
        setLabel(this.dateLabel, `${fmtDate(p.dateKey)} · 固定难度 ${DIFFICULTIES[p.grid].label} ${DIFFICULTIES[p.grid].desc}`);
        setLabel(this.nameLabel, art.name);
        const rec = gm.daily.getRecord(p.dateKey);
        this.starsHolder.destroyAllChildren();
        if (rec && rec.completed) {
            setLabel(this.bestLabel, `今日最佳 ${formatDuration(rec.bestTimeMs)} · ${rec.bestMoves} 步 · 已尝试 ${rec.attempts} 次`);
            starRow(this.starsHolder, starFrames(), rec.stars, 3, 36, 8);
            this.startBtn.setText('再挑战一次');
        } else {
            setLabel(this.bestLabel, rec ? `已尝试 ${rec.attempts} 次，还没有完成` : art.story);
            this.startBtn.setText('开始今日挑战');
        }
        this.buildWeek(p.dateKey);
        this.lastSec = -1;
        this.tickCountdown();
    }

    private buildWeek(today: string): void {
        const gm = this.gm;
        const h = this.weekHolder;
        h.destroyAllChildren();
        const W = this.L.w - Theme.gutter * 2;
        const cw = (W - 40) / 7;
        for (let i = 6; i >= 0; i--) {
            const key = shiftDateKey(today, -i);
            const r = gm.daily.getRecord(key);
            const x = -W / 2 + 20 + cw / 2 + (6 - i) * cw;
            const done = !!(r && r.completed);
            const isToday = i === 0;
            const cell = panel(h, cw - 10, 72, { fill: done ? P.mint2 : isToday ? P.butter : P.white, border: isToday ? P.ink : P.cream3, step: Theme.px, shadow: undefined }, x, 0);
            label(cell, key.slice(8), Theme.font.tiny, { bold: true, color: P.ink2 }).node.setPosition(0, 16);
            if (done) sprite(cell, gm.textures.icon('check', P.leaf3), 22, 16, 0, -14);
            else sprite(cell, gm.textures.art(getDailyPuzzle(key).imageId), 24, 24, 0, -14).node.active = isToday;
        }
    }

    private tickCountdown(): void {
        // 跨过午夜：日期变了就刷新为新的一天（比较日期键，不依赖某一秒恰好被采样到）
        if (this.shownDate && this.gm.daily.todayKey() !== this.shownDate) {
            this.onEnter();
            return;
        }
        const ms = this.gm.daily.msUntilReset();
        const sec = Math.floor(ms / 1000);
        if (sec === this.lastSec) return;
        this.lastSec = sec;
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        setLabel(this.countdown, `距离下一题 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} · 已连续 ${this.gm.daily.streak()} 天`);
    }
}
