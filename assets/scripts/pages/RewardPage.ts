import { tween } from 'cc';
import { P } from '../art/Palette';
import { Effects } from '../ui/Effects';
import { Theme } from '../ui/Theme';
import { button, label, makeNode, panel, popIn } from '../ui/UIKit';
import { BasePage } from './BasePage';
import { artFrame, rewardRow } from './PageKit';

/**
 * 系列完成庆祝页：系列完整插画（四件作品拼成 2×2）、奖励图标、系列名称、返回收藏册。
 * 奖励在集齐时已经自动发放，这里只是展示；玩家点击按钮后才算“收下”并记录一次事件。
 */
export class RewardPage extends BasePage {
    private content = makeNode('Content', null, 0, 0);
    private fx!: Effects;
    private seriesId = '';

    protected build(): void {
        this.content = makeNode('Content', this.root, this.L.w, this.L.h);
        this.fx = new Effects(makeNode('Fx', this.root, this.L.w, this.L.h));
    }

    onEnter(params?: { id?: string }): void {
        if (params && params.id) this.seriesId = params.id;
        const gm = this.gm;
        const s = gm.collection.seriesProgress(this.seriesId);
        if (!s.info) return;
        const L = this.L;
        const W = L.w - Theme.gutter * 2;
        const color = s.info.reward.color;
        this.content.destroyAllChildren();
        const c = this.content;

        const title = label(c, '系列完成！', Theme.font.hero, { bold: true, color: P.white, outline: { color: P.ink, width: 6 } });
        title.node.setPosition(0, L.headerY - 10);
        label(c, `「${s.info.name}」系列 · 全部收集`, Theme.font.body, { color: P.ink2, bold: true }).node.setPosition(0, L.headerY - 74);

        // 完整插画：2×2
        const tile = Math.min(250, (W - 120) / 2);
        const boardSize = tile * 2 + 24;
        const by = L.headerY - 120 - boardSize / 2 - 20;
        const frame = panel(c, boardSize + 28, boardSize + 28, { fill: P.white, border: color, shadow: P.ink, step: Theme.px, shadowDepth: 2 }, 0, by);
        s.info.items.forEach((id, i) => {
            const t = artFrame(frame, gm.textures.art(id), tile - 20, ((i % 2) - 0.5) * (tile + 4), (0.5 - Math.floor(i / 2)) * (tile + 4), 'mint');
            popIn(t, 0.2 + i * 0.15, 20);
        });
        popIn(frame, 0.05);

        // 奖励
        const ry = by - boardSize / 2 - 124;
        label(c, '你获得了', Theme.font.small, { color: Theme.textMuted, bold: true }).node.setPosition(0, ry + 66);
        const rr = rewardRow(c, s.info, true, W, 0, ry);
        popIn(rr, 0.8);
        label(c, '头像框已装到首页头像，专属背景已用于该系列页面', Theme.font.tiny, { color: P.ink2, width: W, wrap: true }).node.setPosition(0, ry - 66);

        button(c, { w: W, h: 100, text: '收下奖励，返回收藏册', style: 'primary', icon: gm.textures.icon('book', P.white, P.white), onClick: () => this.claim() }, 0, -L.h / 2 + L.safeBottom + 24 + 50);

        gm.audio.play('complete', 0.9);
        tween(c).delay(0.5).call(() => {
            this.fx.ring(0, by, boardSize * 0.75, 20);
            this.fx.confetti(L.w, L.h / 2, -L.h / 2, 50);
        }).start();
    }

    onBack(): boolean {
        this.claim();
        return true;
    }

    private claim(): void {
        const gm = this.gm;
        if (gm.collection.markRewardSeen(this.seriesId)) gm.analytics.track('collection_reward_claimed', { series: this.seriesId });
        this.sm.go('collection', undefined, { replace: true });
    }
}
