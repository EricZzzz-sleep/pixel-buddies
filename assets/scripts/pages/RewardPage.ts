import { tween } from 'cc';
import { P } from '../art/Palette';
import { Effects } from '../ui/Effects';
import { Theme } from '../ui/Theme';
import { button, label, makeNode, panel, popIn } from '../ui/UIKit';
import { BasePage } from './BasePage';
import { artFrame, rewardRow } from './PageKit';

/**
 * 系列完成庆祝页：系列完整插画（全部作品拼成网格）、奖励图标、系列名称、返回收藏册。
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

        // 完整插画：按作品数排成网格（4 件 2×2，12 件一般 3×4），按剩余高度收缩，避免压到奖励和按钮
        const n = s.info.items.length;
        const boardTop = L.headerY - 140;
        const buttonTop = -L.h / 2 + L.safeBottom + 124;
        const maxBoardH = boardTop - buttonTop - 14 - 124 - 96; // 下方留给“你获得了”、奖励行、说明文字
        // 网格外框 = 格数×tile + 4×格数 + 16；在 2~4 列里选单张最大的排法
        const fit = (k: number, avail: number) => (avail - 4 * k - 16) / k;
        let cols = 2;
        let rows = Math.ceil(n / 2);
        let tile = 0;
        for (let k = 2; k <= Math.min(4, Math.max(2, n)); k++) {
            const r = Math.ceil(n / k);
            const t = Math.min(250, fit(k, W - 120), fit(r, maxBoardH));
            if (t > tile + 1) {
                tile = t;
                cols = k;
                rows = r;
            }
        }
        tile = Math.max(60, tile);
        const boardW = cols * tile + 4 * cols + 16;
        const boardH = rows * tile + 4 * rows + 16;
        const by = boardTop - boardH / 2 - 14;
        const frame = panel(c, boardW + 28, boardH + 28, { fill: P.white, border: color, shadow: P.ink, step: Theme.px, shadowDepth: 2 }, 0, by);
        const step = n > 4 ? 0.06 : 0.15;
        s.info.items.forEach((id, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            // 最后一行不满时居中
            const inRow = row === rows - 1 ? n - row * cols : cols;
            const x = (col - (inRow - 1) / 2) * (tile + 4);
            const y = ((rows - 1) / 2 - row) * (tile + 4);
            const t = artFrame(frame, gm.textures.art(id), tile - 20, x, y, 'mint');
            popIn(t, 0.2 + i * step, 20);
        });
        popIn(frame, 0.05);

        // 奖励
        const ry = by - boardH / 2 - 124;
        label(c, '你获得了', Theme.font.small, { color: Theme.textMuted, bold: true }).node.setPosition(0, ry + 66);
        const rr = rewardRow(c, s.info, true, W, 0, ry);
        popIn(rr, 0.8);
        label(c, '头像框已装到首页头像，专属背景已用于该系列页面', Theme.font.tiny, { color: P.ink2, width: W, wrap: true }).node.setPosition(0, ry - 66);

        button(c, { w: W, h: 100, text: '收下奖励，返回收藏册', style: 'primary', icon: gm.textures.icon('book', P.white, P.white), onClick: () => this.claim() }, 0, -L.h / 2 + L.safeBottom + 24 + 50);

        gm.audio.play('complete', 0.9);
        tween(c).delay(0.5).call(() => {
            this.fx.ring(0, by, Math.max(boardW, boardH) * 0.75, 20);
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
