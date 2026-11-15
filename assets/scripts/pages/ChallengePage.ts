import { Label, Node, UITransform } from 'cc';
import { ART_LIST, getArt } from '../art/ArtCatalog';
import { P } from '../art/Palette';
import { DIFFICULTIES, GridSize, SUPPORTED_GRIDS } from '../config/GameConfig';
import { formatDuration } from '../core/GameTimer';
import { Theme, TINTS } from '../ui/Theme';
import { button, ButtonHandle, label, makeNode, onTap, panel, sprite } from '../ui/UIKit';
import { BasePage } from './BasePage';
import { Flow, showIncomingChallenge } from './PageKit';

/**
 * 好友挑战（异步 PK）：
 * - 发起：选图 + 选难度 → 先拼一局记录成绩 → 结算页分享给好友；
 * - 接受：从分享卡片进入会自动弹出；也可粘贴好友发来的挑战码；
 * - 最近挑战：本地记录，明确标注“本地对比”，不伪造在线排行。
 */
export class ChallengePage extends BasePage {
    private picked = '';
    private grid: GridSize = 4;
    private pickerHolder!: Node;
    private gridBtns: ButtonHandle[] = [];
    private recentHolder!: Node;
    private pickedLabel!: Label;

    protected build(): void {
        const L = this.L;
        const gm = this.gm;
        this.header('好友挑战');
        const W = L.w - Theme.gutter * 2;
        let y = L.contentTop - 20;

        // ---- 发起挑战
        const createH = 470;
        const create = panel(this.root, W, createH, { fill: P.white, border: P.ink, shadow: P.ink, step: Theme.px, shadowDepth: 2 }, 0, y - createH / 2);
        label(create, '发起挑战', Theme.font.h2, { bold: true, align: 'left' }).node.setPosition(-W / 2 + 28, createH / 2 - 44);
        this.pickedLabel = label(create, '', Theme.font.tiny, { color: Theme.textMuted, align: 'right' });
        this.pickedLabel.node.setPosition(W / 2 - 28, createH / 2 - 44);
        this.pickerHolder = makeNode('Picker', create, W - 40, 130, 0, createH / 2 - 150);
        const gw = (W - 56 - 12 * (SUPPORTED_GRIDS.length - 1)) / SUPPORTED_GRIDS.length;
        SUPPORTED_GRIDS.forEach((g, i) => {
            this.gridBtns.push(
                button(create, {
                    w: gw,
                    h: 76,
                    text: `${DIFFICULTIES[g].label} ${g}×${g}`,
                    fontSize: Theme.font.small,
                    style: 'white',
                    onClick: () => {
                        this.grid = g;
                        this.refreshGrid();
                    },
                }, -W / 2 + 28 + gw / 2 + i * (gw + 12), createH / 2 - 280),
            );
        });
        button(create, {
            w: W - 56,
            h: 96,
            text: '先拼一局，再邀请好友',
            style: 'primary',
            icon: gm.textures.icon('users', P.white, P.white),
            onClick: () => Flow.challengeCreate(this.picked, this.grid),
        }, 0, -createH / 2 + 70);
        y -= createH + 24;

        // ---- 接受挑战
        const acceptH = 220;
        const accept = panel(this.root, W, acceptH, { fill: P.sky, border: P.ink, shadow: P.blue2, step: Theme.px, shadowDepth: 2 }, 0, y - acceptH / 2);
        label(accept, '收到挑战码？', Theme.font.h2, { bold: true, align: 'left' }).node.setPosition(-W / 2 + 28, acceptH / 2 - 44);
        label(accept, '好友从分享卡片进入会自动打开挑战', Theme.font.tiny, { color: P.blue3, align: 'left' }).node.setPosition(-W / 2 + 28, acceptH / 2 - 80);
        button(accept, {
            w: W - 56,
            h: 80,
            text: '粘贴挑战码',
            style: 'white',
            icon: gm.textures.icon('paste', P.ink, P.white),
            onClick: () => this.pasteCode(),
        }, 0, -acceptH / 2 + 54);
        y -= acceptH + 24;

        // ---- 最近挑战
        const bottom = -L.h / 2 + L.safeBottom + 20;
        const recentH = Math.max(160, y - bottom);
        const recent = panel(this.root, W, recentH, { fill: P.cream2, border: P.cream3, step: Theme.px, shadow: undefined }, 0, y - recentH / 2);
        label(recent, '最近挑战（本地记录）', Theme.font.small, { bold: true, align: 'left', color: P.ink2 }).node.setPosition(-W / 2 + 24, recentH / 2 - 34);
        this.recentHolder = makeNode('Recent', recent, W, recentH - 70, 0, -30);
    }

    onEnter(): void {
        const gm = this.gm;
        if (!this.picked || !gm.collection.isPlayable(this.picked)) this.picked = gm.collection.suggestNext().id;
        this.buildPicker();
        this.refreshGrid();
        this.buildRecent();
    }

    private buildPicker(): void {
        const gm = this.gm;
        const h = this.pickerHolder;
        h.destroyAllChildren();
        const W = this.L.w - Theme.gutter * 2 - 40;
        const playable = ART_LIST.filter((a) => gm.collection.isPlayable(a.id));
        const n = Math.min(playable.length, 6);
        // 只展示最多 6 张：优先包含当前选中项
        let list = playable.slice(0, n);
        if (!list.find((a) => a.id === this.picked)) list = [getArt(this.picked)!, ...list.slice(0, n - 1)];
        const cell = Math.min(110, (W - (n - 1) * 10) / n);
        list.forEach((a, i) => {
            const sel = a.id === this.picked;
            const x = -((n - 1) * (cell + 10)) / 2 + i * (cell + 10);
            const f = panel(h, cell, cell, { fill: sel ? P.rose : TINTS[a.tint][0], border: sel ? P.ink : P.cream3, step: Theme.px, shadow: sel ? P.rose2 : undefined }, x, 0);
            sprite(f, gm.textures.art(a.id), cell - 20, cell - 20);
            onTap(f, () => {
                this.picked = a.id;
                gm.audio.play('click');
                this.buildPicker();
            });
        });
        const art = getArt(this.picked);
        this.pickedLabel.string = art ? `已选：${art.name}` : '';
    }

    private refreshGrid(): void {
        SUPPORTED_GRIDS.forEach((g, i) => this.gridBtns[i].setStyle(g === this.grid ? 'mint' : 'white'));
    }

    private buildRecent(): void {
        const gm = this.gm;
        const h = this.recentHolder;
        h.destroyAllChildren();
        const W = this.L.w - Theme.gutter * 2;
        const logs = gm.challenges.recent();
        const H = h.getComponent(UITransform)!.height;
        const maxRows = Math.max(1, Math.floor(H / 64));
        if (!logs.length) {
            const t = label(h, '还没有挑战记录。\n发起一局，邀请好友来比比看吧！', Theme.font.small, { color: Theme.textMuted, width: W - 60, wrap: true });
            t.node.setPosition(0, 0);
            return;
        }
        logs.slice(0, maxRows).forEach((l, i) => {
            const art = getArt(l.imageId);
            const y = H / 2 - 32 - i * 64;
            const row = panel(h, W - 40, 56, { fill: P.white, border: P.cream3, step: Theme.px, shadow: undefined }, 0, y);
            if (art) sprite(row, gm.textures.art(art.id), 40, 40, -(W - 40) / 2 + 32, 0);
            const kind = l.kind === 'sent' ? '我发起' : '接受';
            const name = art ? art.name : l.imageId;
            label(row, `${kind} · ${name} ${l.grid}×${l.grid}`, Theme.font.tiny, { bold: true, align: 'left' }).node.setPosition(-(W - 40) / 2 + 64, 0);
            const mine = l.myTimeMs ? formatDuration(l.myTimeMs) : '--:--';
            const theirs = l.theirTimeMs ? formatDuration(l.theirTimeMs) : '--:--';
            const txt = l.kind === 'sent' ? `我 ${mine}` : `我 ${mine} / 好友 ${theirs}`;
            label(row, txt, Theme.font.tiny, { color: P.ink2, align: 'right' }).node.setPosition((W - 40) / 2 - 20, 0);
        });
    }

    private pasteCode(): void {
        const gm = this.gm;
        gm.platform.getClipboard().then((text) => {
            if (!text) {
                this.sm.toast('剪贴板里没有找到挑战码');
                return;
            }
            showIncomingChallenge(text);
        });
    }
}
