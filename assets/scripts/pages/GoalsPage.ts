import { Node } from 'cc';
import { P } from '../art/Palette';
import { AchievementView, MissionItemView, WeeklyItemView } from '../progress/ProgressManager';
import { fmtDate } from './PageKit';
import { ScrollList } from '../ui/ScrollList';
import { Theme } from '../ui/Theme';
import { button, label, onTap, panel, sprite } from '../ui/UIKit';
import { BasePage } from './BasePage';
import { artFrame, segmentBar } from './PageKit';
import { handleClaim, levelBadge, redDot, xpBar } from './GrowthKit';

type Tab = 'missions' | 'weekly' | 'achievements';
const TABS: Array<{ id: Tab; text: string }> = [
    { id: 'missions', text: '今日任务' },
    { id: 'weekly', text: '本周挑战' },
    { id: 'achievements', text: '成就' },
];

/** 任务与成就：今日任务 / 本周挑战 / 成就，三个标签页，奖励全部手动领取（经验） */
export class GoalsPage extends BasePage {
    private list!: ScrollList;
    private tab: Tab = 'missions';
    private lastBtnAt = 0;
    private tabLayer!: Node;

    protected build(): void {
        const L = this.L;
        this.header('任务与成就');
        this.tabLayer = new Node('TabLayer');
        this.tabLayer.parent = this.root;
        const listTop = L.contentTop - 250;
        const bottom = -L.h / 2 + L.safeBottom + 10;
        this.list = ScrollList.create(this.root, L.w, listTop - bottom, 0, (listTop + bottom) / 2);
    }

    onEnter(p?: { tab?: Tab }): void {
        if (p && p.tab) this.tab = p.tab;
        this.refresh();
    }

    private refresh(): void {
        const gm = this.gm;
        const L = this.L;
        const W = L.w - Theme.gutter * 2;
        gm.progress.refresh();
        this.tabLayer.destroyAllChildren();
        const t = this.tabLayer;

        // ---- 等级条
        const info = gm.progress.level();
        const sy = L.contentTop - 56;
        const sum = panel(t, W, 100, { fill: P.white, border: P.ink, shadow: P.ink, step: Theme.px, shadowDepth: 2 }, 0, sy);
        levelBadge(sum, info.level, -W / 2 + 60, 0, 72);
        label(sum, gm.progress.title(), Theme.font.body, { bold: true, align: 'left', width: 300 }).node.setPosition(-W / 2 + 118, 24);
        label(sum, `${info.into}/${info.need}`, Theme.font.tiny, { color: P.ink2, bold: true, align: 'right', width: 200 }).node.setPosition(W / 2 - 120, 24);
        xpBar(sum, info, W - 160, 36, -16);

        // ---- 标签
        const counts = this.claimCounts();
        const ty = sy - 100;
        const gap = 12;
        const tw = (W - gap * 2) / 3;
        TABS.forEach((tb, i) => {
            const x = -W / 2 + tw / 2 + i * (tw + gap);
            const on = tb.id === this.tab;
            const b = button(t, { w: tw, h: 70, text: tb.text, style: on ? 'primary' : 'white', fontSize: Theme.font.small, onClick: () => { this.tab = tb.id; this.refresh(); } }, x, ty);
            if (counts[tb.id] > 0) redDot(b.node, tw / 2 - 12, 26, 26);
        });
        this.renderTab();
    }

    private claimCounts(): Record<Tab, number> {
        const pm = this.gm.progress;
        const m = pm.missionsView();
        const w = pm.weeklyView();
        return {
            missions: m.items.filter((i) => i.done && !i.claimed).length + (m.bonusReady ? 1 : 0),
            weekly: w.items.filter((i) => i.done && !i.claimed).length + (w.completed && !w.completeClaimed ? 1 : 0),
            achievements: pm.achievementsView().filter((a) => a.unlocked && !a.claimed).length,
        };
    }

    private after(): void {
        // 领取后保持滚动位置：只刷新内容
        this.refresh();
    }

    private renderTab(): void {
        const content = this.list.content;
        content.destroyAllChildren();
        const W = this.L.w - Theme.gutter * 2;
        let y = -10;
        if (this.tab === 'missions') y = this.missionsTab(content, W, y);
        else if (this.tab === 'weekly') y = this.weeklyTab(content, W, y);
        else y = this.achievementsTab(content, W, y);
        this.list.setContentHeight(-y + 30);
        this.list.scrollToTop();
    }

    /** 通用目标行：标题、进度条、右侧领取按钮/状态 */
    private row(parent: Node, W: number, y: number, o: { title: string; sub?: string; progress: number; target: number; xp: number; icon: string; claimed: boolean; locked?: boolean; onClaim: () => void; onTap?: () => void; color?: number }): number {
        const gm = this.gm;
        const h = 128;
        const done = o.progress >= o.target;
        const p = panel(parent, W, h, { fill: P.white, border: done && !o.claimed ? P.gold2 : P.cream3, shadow: done && !o.claimed ? P.gold : Theme.shadow, step: Theme.px, shadowDepth: 1.5 }, 0, y - h / 2);
        const ib = panel(p, 76, 76, { fill: o.locked ? P.grey : done ? P.butter : P.cream2, border: P.ink, shadow: undefined, step: 3 }, -W / 2 + 62, 0);
        sprite(ib, gm.textures.icon(o.locked ? 'lock' : o.icon, o.locked ? P.grey2 : P.ink, P.white), 40, 40);
        const tx = -W / 2 + 120;
        const tw = W - 120 - 190;
        label(p, o.title, Theme.font.body, { bold: true, align: 'left', width: tw }).node.setPosition(tx + tw / 2 - tw / 2, h / 2 - 36);
        if (o.sub) label(p, o.sub, Theme.font.tiny, { color: Theme.textMuted, align: 'left', width: tw }).node.setPosition(tx + tw / 2 - tw / 2, h / 2 - 66);
        const bw = tw - 70;
        segmentBar(p, o.target, Math.min(o.progress, o.target), bw, 14, o.color || P.rose, tx + bw / 2, -h / 2 + 24);
        label(p, `${Math.min(o.progress, o.target)}/${o.target}`, Theme.font.tiny, { bold: true, align: 'right', width: 70 }).node.setPosition(tx + bw + 38, -h / 2 + 24);
        if (done && !o.claimed) button(p, { w: 160, h: 66, text: `领取 +${o.xp}`, style: 'butter', fontSize: Theme.font.small, onClick: () => { this.lastBtnAt = Date.now(); o.onClaim(); } }, W / 2 - 100, 0);
        else if (o.claimed) label(p, '已领取', Theme.font.small, { color: P.leaf3, bold: true, width: 160 }).node.setPosition(W / 2 - 100, 0);
        else label(p, `+${o.xp} 经验`, Theme.font.small, { color: Theme.textMuted, bold: true, width: 160 }).node.setPosition(W / 2 - 100, 0);
        if (o.onTap) {
            const open = o.onTap;
            // 点领取按钮时事件会冒泡到整行：忽略按钮刚触发后的这次点击
            onTap(p, () => Date.now() - this.lastBtnAt > 400 && open());
        }
        return y - h - 16;
    }

    private missionsTab(c: Node, W: number, y0: number): number {
        const gm = this.gm;
        const v = gm.progress.missionsView();
        let y = y0;
        label(c, `${fmtDate(v.dateKey)} · 每天 0 点（本地时间）刷新，已完成 ${v.doneCount}/${v.items.length}`, Theme.font.tiny, { color: Theme.textMuted, width: W, align: 'left' }).node.setPosition(-W / 2, y - 16);
        y -= 40;
        v.items.forEach((it: MissionItemView) => {
            y = this.row(c, W, y, {
                title: it.def.title, progress: it.progress, target: it.def.target, xp: it.def.xp, icon: 'puzzle', claimed: it.claimed, color: P.mint3,
                onClaim: () => handleClaim(gm.progress.claimMission(it.def.id), () => this.after()),
            });
        });
        // 全部完成奖励
        const h = 120;
        const p = panel(c, W, h, { fill: v.bonusReady ? P.butter : P.cream2, border: P.ink, shadow: P.gold2, step: Theme.px, shadowDepth: 1.5 }, 0, y - h / 2);
        sprite(p, gm.textures.icon('crown', P.gold2, P.white), 56, 36, -W / 2 + 62, 0);
        label(p, '完成全部任务奖励', Theme.font.body, { bold: true, align: 'left', width: 360 }).node.setPosition(-W / 2 + 120, 18);
        label(p, v.bonusClaimed ? '今天的额外奖励已领取，明天再来' : `3 个任务都完成后可领取 +${v.bonusXp} 经验`, Theme.font.tiny, { color: P.ink2, align: 'left', width: 380 }).node.setPosition(-W / 2 + 120, -22);
        if (v.bonusReady) button(p, { w: 160, h: 66, text: `领取 +${v.bonusXp}`, style: 'primary', fontSize: Theme.font.small, onClick: () => handleClaim(gm.progress.claimMissionBonus(), () => this.after()) }, W / 2 - 100, 0);
        else if (v.bonusClaimed) label(p, '已领取', Theme.font.small, { color: P.leaf3, bold: true, width: 160 }).node.setPosition(W / 2 - 100, 0);
        y -= h + 16;
        label(c, '没有惩罚：错过一天也不会清零任何进度，任务每天都会换新的。', Theme.font.tiny, { color: Theme.textMuted, width: W, wrap: true }).node.setPosition(0, y - 20);
        return y - 50;
    }

    private weeklyTab(c: Node, W: number, y0: number): number {
        const gm = this.gm;
        const v = gm.progress.weeklyView();
        const th = v.challenge.theme;
        let y = y0;
        const hh = 190;
        const hero = panel(c, W, hh, { fill: P.white, border: th.reward.color, shadow: th.reward.color, step: Theme.px, shadowDepth: 2 }, 0, y - hh / 2);
        artFrame(hero, gm.textures.art(th.cover), 130, -W / 2 + 105, 0, th.tint);
        label(hero, `本周主题：${th.name}`, Theme.font.h2, { bold: true, align: 'left', width: W - 260 }).node.setPosition(-W / 2 + 190 + (W - 260) / 2 - (W - 260) / 2, 40);
        label(hero, `${fmtDate(v.challenge.weekKey)} 起 · 周一刷新`, Theme.font.tiny, { color: Theme.textMuted, align: 'left', width: W - 260 }).node.setPosition(-W / 2 + 190, -4);
        label(hero, `已完成 ${v.doneCount}/${v.items.length} 个目标${v.completed ? ' · 全部完成' : ''}`, Theme.font.small, { color: P.rose2, bold: true, align: 'left', width: W - 260 }).node.setPosition(-W / 2 + 190, -46);
        y -= hh + 16;
        v.items.forEach((it: WeeklyItemView) => {
            y = this.row(c, W, y, {
                title: it.title, progress: it.progress, target: it.target, xp: it.xp, icon: 'star', claimed: it.claimed, color: th.reward.color,
                onClaim: () => handleClaim(gm.progress.claimWeekly(it.id), () => this.after()),
            });
        });
        const h = 120;
        const ready = v.completed && !v.completeClaimed;
        const p = panel(c, W, h, { fill: ready ? P.butter : P.cream2, border: P.ink, shadow: P.gold2, step: Theme.px, shadowDepth: 1.5 }, 0, y - h / 2);
        sprite(p, gm.textures.icon('trophy', P.gold2, P.white), 52, 52, -W / 2 + 62, 0);
        label(p, '周挑战全部完成', Theme.font.body, { bold: true, align: 'left', width: 360 }).node.setPosition(-W / 2 + 120, 18);
        label(p, v.completeClaimed ? '本周奖励已领取' : `完成 3 个目标可领取 +${v.completeXp} 经验`, Theme.font.tiny, { color: P.ink2, align: 'left', width: 380 }).node.setPosition(-W / 2 + 120, -22);
        if (ready) button(p, { w: 160, h: 66, text: `领取 +${v.completeXp}`, style: 'primary', fontSize: Theme.font.small, onClick: () => handleClaim(gm.progress.claimWeeklyComplete(), () => this.after()) }, W / 2 - 100, 0);
        else if (v.completeClaimed) label(p, '已领取', Theme.font.small, { color: P.leaf3, bold: true, width: 160 }).node.setPosition(W / 2 - 100, 0);
        y -= h + 24;
        // 历史
        label(c, `往期完成（共 ${v.history.length} 周）`, Theme.font.body, { bold: true, align: 'left', width: W }).node.setPosition(-W / 2, y - 16);
        y -= 46;
        if (!v.history.length) {
            label(c, '还没有完成过周挑战，这周试试吧', Theme.font.small, { color: Theme.textMuted, width: W }).node.setPosition(0, y - 16);
            y -= 40;
        }
        v.history.slice(0, 8).forEach((hs) => {
            label(c, `${fmtDate(hs.weekKey)} 起的一周 · ${hs.theme === th.id ? th.name : this.seriesName(hs.theme)}`, Theme.font.small, { color: P.ink2, align: 'left', width: W - 20 }).node.setPosition(-W / 2 + 10, y - 14);
            y -= 38;
        });
        return y - 10;
    }

    private seriesName(id: string): string {
        const s = this.gm.collection.allSeries().find((x) => x.info.id === id);
        return s ? s.info.name : id;
    }

    private achievementsTab(c: Node, W: number, y0: number): number {
        const gm = this.gm;
        const list = gm.progress.achievementsView();
        const done = list.filter((a) => a.unlocked).length;
        let y = y0;
        label(c, `已解锁 ${done}/${list.length}`, Theme.font.small, { color: P.ink2, bold: true, align: 'left', width: W }).node.setPosition(-W / 2, y - 16);
        y -= 40;
        // 已解锁未领取排前，其次已解锁，最后未解锁
        const order = (a: AchievementView) => (a.unlocked && !a.claimed ? 0 : a.unlocked ? 1 : 2);
        list.slice().sort((a, b) => order(a) - order(b)).forEach((a) => {
            y = this.row(c, W, y, {
                title: a.def.title, sub: a.def.desc, progress: a.progress, target: a.def.target, xp: a.def.xp, icon: a.def.icon, claimed: a.claimed, locked: !a.unlocked, color: P.gold2,
                onClaim: () => handleClaim(gm.progress.claimAchievement(a.def.id), () => this.after()),
                onTap: () => this.detail(a),
            });
        });
        return y;
    }

    private detail(a: AchievementView): void {
        const gm = this.gm;
        const sm = this.sm;
        const w = Math.min(this.L.w - 48, 620);
        const h = 720;
        const card = sm.openModal(w, h);
        const ic = panel(card, 160, 160, { fill: a.unlocked ? P.butter : P.grey, border: P.ink, shadow: P.gold2, step: Theme.px }, 0, h / 2 - 150);
        sprite(ic, gm.textures.icon(a.unlocked ? a.def.icon : 'lock', a.unlocked ? P.ink : P.grey2, P.white), 88, 88);
        label(card, a.def.title, Theme.font.title, { bold: true, width: w - 60 }).node.setPosition(0, h / 2 - 290);
        label(card, a.def.desc, Theme.font.small, { color: P.ink2, width: w - 80, wrap: true }).node.setPosition(0, h / 2 - 345);
        segmentBar(card, a.def.target, Math.min(a.progress, a.def.target), w - 160, 20, P.gold2, 0, h / 2 - 400);
        label(card, `${Math.min(a.progress, a.def.target)}/${a.def.target} · 奖励 ${a.def.xp} 经验${a.unlocked ? (a.claimed ? '（已领取）' : '') : '（未解锁）'}`, Theme.font.small, { bold: true, color: P.rose2, width: w - 60 }).node.setPosition(0, h / 2 - 445);
        if (a.unlocked && !a.claimed) button(card, { w: w - 100, h: 84, text: `领取 +${a.def.xp} 经验`, style: 'primary', onClick: () => { sm.closeModal(); handleClaim(gm.progress.claimAchievement(a.def.id), () => this.after()); } }, 0, -h / 2 + 150);
        else if (a.unlocked) button(card, {
            w: w - 100, h: 84, text: '分享成就', style: 'butter', icon: gm.textures.icon('share', P.ink),
            onClick: () => gm.share.shareCardOf('achievement', {
                artId: (gm.collection.latestUnlocked() || { id: 'cat_orange' }).id, title: a.def.title, subtitle: '成就解锁', stars: 3,
                lines: [a.def.desc, `Lv.${gm.progress.level().level} ${gm.progress.title()}`], footer: '你也来试试！', text: `我在《像素搭子》解锁了成就「${a.def.title}」`,
            }).then((r) => sm.toast(r.message)),
        }, 0, -h / 2 + 150);
        button(card, { w: w - 100, h: 76, text: '关闭', style: 'secondary', onClick: () => sm.closeModal() }, 0, -h / 2 + 50);
    }
}
