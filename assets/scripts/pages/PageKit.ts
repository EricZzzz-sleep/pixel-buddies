import { Graphics, Label, Node, SpriteFrame } from 'cc';
import { ArtCategory, ArtInfo, CATEGORY_LABEL, CATEGORY_ORDER, getArt } from '../art/ArtCatalog';
import { P } from '../art/Palette';
import { beginnerSwaps, DIFFICULTIES, GridSize, misplacedCount, recommendedGrid, SUPPORTED_GRIDS } from '../config/GameConfig';
import { formatDuration } from '../core/GameTimer';
import { GameManager, PlaySession } from '../core/GameManager';
import { randomSeed } from '../core/Random';
import { hex, Theme, TINTS } from '../ui/Theme';
import { button, ButtonHandle, label, makeNode, onTap, panel, sprite, starRow } from '../ui/UIKit';

/** 页面共用的组件与流程 */

export function starFrames(): { on: SpriteFrame; off: SpriteFrame } {
    const t = GameManager.I.textures;
    return { on: t.icon('star', P.gold, P.butter), off: t.icon('starEmpty', P.grey2) };
}

/** 带像素相框的作品缩略图 */
export function artFrame(parent: Node, frame: SpriteFrame, size: number, x = 0, y = 0, tint: keyof typeof TINTS = 'pink'): Node {
    const f = panel(parent, size + 20, size + 20, { fill: TINTS[tint][0], border: P.ink, shadow: TINTS[tint][2], step: Theme.px, shadowDepth: 1.5 }, x, y);
    sprite(f, frame, size, size);
    return f;
}

export interface ArtCardOpts {
    art: ArtInfo;
    w: number;
    /** 显示完整作品，否则显示马赛克 */
    reveal: boolean;
    locked?: boolean;
    lockText?: string;
    stars?: number;
    caption?: string;
    onClick?: () => void;
}

/** 作品卡片（经典模式选择与收藏册共用） */
export function artCard(parent: Node, o: ArtCardOpts, x: number, y: number): Node {
    const gm = GameManager.I;
    const thumb = o.w - 32;
    const h = thumb + 112;
    const card = panel(parent, o.w, h, { fill: P.white, border: P.cream3, shadow: Theme.shadow, step: Theme.px, shadowDepth: 1.5 }, x, y);
    const tint = TINTS[o.art.tint];
    const frameBg = panel(card, thumb + 8, thumb + 8, { fill: tint[0], step: Theme.px }, 0, h / 2 - thumb / 2 - 20);
    const s = sprite(frameBg, o.reveal ? gm.textures.art(o.art.id) : gm.textures.mosaic(o.art.id), thumb, thumb);
    if (o.locked) {
        const lockBg = panel(frameBg, 76, 76, { fill: P.white, border: P.ink, step: Theme.px, shadow: undefined, alpha: 235 });
        sprite(lockBg, gm.textures.icon('lock', P.ink2, P.yellow), 36, 36);
        s.node.setScale(1, 1, 1);
    }
    const name = label(card, o.art.name, Theme.font.small, { bold: true, color: Theme.ink, width: o.w - 20 });
    name.node.setPosition(0, -h / 2 + 66);
    if (o.locked) {
        const lt = label(card, o.lockText || '', Theme.font.tiny, { color: Theme.textMuted, width: o.w - 20 });
        lt.node.setPosition(0, -h / 2 + 30);
    } else if (o.caption !== undefined) {
        const ct = label(card, o.caption, Theme.font.tiny, { color: Theme.textMuted, width: o.w - 20 });
        ct.node.setPosition(0, -h / 2 + 30);
    } else {
        const st = starRow(card, starFrames(), o.stars || 0, 3, 24, 6);
        st.setPosition(0, -h / 2 + 30);
    }
    if (o.onClick) {
        onTap(card, () => {
            if (GameManager.I.audio) GameManager.I.audio.play('click');
            o.onClick!();
        });
    }
    return card;
}

export function artCardHeight(w: number): number {
    return w - 32 + 112;
}

/** 分类标签栏 */
export function categoryTabs(parent: Node, y: number, width: number, onChange: (c: ArtCategory | null) => void, initial: ArtCategory | null = null): { set(c: ArtCategory | null): void } {
    const items: Array<{ key: ArtCategory | null; text: string }> = [{ key: null, text: '全部' }, ...CATEGORY_ORDER.map((c) => ({ key: c, text: CATEGORY_LABEL[c] }))];
    const gap = 12;
    const bw = (width - gap * (items.length - 1)) / items.length;
    const btns: ButtonHandle[] = [];
    let current = initial;
    const refresh = () => items.forEach((it, i) => btns[i].setStyle(it.key === current ? 'primary' : 'white'));
    items.forEach((it, i) => {
        btns.push(
            button(parent, {
                w: bw,
                h: 64,
                text: it.text,
                fontSize: Theme.font.small,
                style: 'white',
                onClick: () => {
                    if (current === it.key) return;
                    current = it.key;
                    refresh();
                    onChange(current);
                },
            }, -width / 2 + bw / 2 + i * (bw + gap), y),
        );
    });
    refresh();
    return {
        set(c) {
            current = c;
            refresh();
        },
    };
}

/** 难度卡片左侧的迷你棋盘：粉色格子 = 开局放错的方块，绿色格子 = 已经在正确位置 */
function miniBoard(parent: Node, grid: number, wrong: number, size: number, x: number, y: number): void {
    const n = grid * grid;
    const node = makeNode('Mini', parent, size, size, x, y);
    const g = node.addComponent(Graphics);
    const gap = 3;
    const cs = (size - gap * (grid - 1)) / grid;
    // 错位格子均匀分布，只是示意
    const wrongSet = new Set<number>();
    for (let k = 0; k < wrong; k++) wrongSet.add(Math.floor(((k + 0.5) * n) / wrong));
    for (let i = 0; i < n; i++) {
        const col = i % grid, row = Math.floor(i / grid);
        g.fillColor = hex(wrongSet.has(i) ? P.rose : P.mint2);
        g.rect(-size / 2 + col * (cs + gap), size / 2 - (row + 1) * cs - row * gap, cs, cs);
        g.fill();
    }
}

/** 已完成的某难度局数（用于新手渐进） */
function completionsAt(grid: GridSize): number {
    const recs = GameManager.I.save.data.records;
    let n = 0;
    for (const id of Object.keys(recs)) n += (recs[id][String(grid)] && recs[id][String(grid)].completions) || 0;
    return n;
}

/** 本局入门拼图的交换次数：前 3 局 1/2/3 次，之后用配置值 */
export function currentBeginnerSwaps(): number {
    const s = beginnerSwaps(completionsAt(3));
    return s === null ? DIFFICULTIES[3].swaps : s;
}

/**
 * 难度选择弹窗：每一档都说明“几块放错、要换几次”，并显示迷你棋盘、个人最佳；
 * 根据玩家进度推荐一档（新手推荐入门 3×3）。
 */
export function openDifficultySheet(art: ArtInfo, onPick: (grid: GridSize) => void, title = '选择难度'): void {
    const gm = GameManager.I;
    const sm = gm.scene;
    const w = Math.min(gm.layout.w - 40, 680);
    const rowH = 158;
    const headH = 250;
    const h = headH + rowH * SUPPORTED_GRIDS.length + 56;
    const rec = recommendedGrid(gm.save.data.totalCompletions);
    const card = sm.openModal(w, h);
    label(card, title, Theme.font.h2, { bold: true }).node.setPosition(0, h / 2 - 50);
    artFrame(card, gm.textures.art(art.id), 120, -w / 2 + 110, h / 2 - 160, art.tint);
    label(card, art.name, Theme.font.h2, { bold: true, align: 'left', width: w - 240 }).node.setPosition(-w / 2 + 196, h / 2 - 125);
    label(card, art.story, Theme.font.small - 2, { color: P.ink2, width: w - 240, wrap: true, align: 'left' }).node.setPosition(-w / 2 + 196, h / 2 - 182);

    const rw = w - 56;
    const rh = rowH - 14;
    SUPPORTED_GRIDS.forEach((g, i) => {
        const d = DIFFICULTIES[g];
        const swaps = g === 3 ? currentBeginnerSwaps() : d.swaps;
        const wrong = misplacedCount(swaps);
        const best = gm.collection.getRecord(art.id, g);
        const tint = TINTS[['butter', 'mint', 'sky', 'lilac'][i] as keyof typeof TINTS];
        const recommended = rec === g;
        const y = h / 2 - headH - rowH / 2 - i * rowH + 10;
        const row = panel(card, rw, rh, { fill: P.white, border: recommended ? P.rose : P.ink, shadow: tint[1], step: Theme.px, shadowDepth: 1.5 }, 0, y);
        miniBoard(row, g, wrong, 84, -rw / 2 + 70, 0);
        label(row, `${d.label}  ${g}×${g}`, Theme.font.body, { bold: true, align: 'left', width: rw - 330 }).node.setPosition(-rw / 2 + 130, 36);
        label(row, `${wrong} 块放错 · 换 ${swaps} 次完成`, Theme.font.small - 2, { color: P.rose2, bold: true, align: 'left', width: rw - 330 }).node.setPosition(-rw / 2 + 130, 0);
        const note = g === 3 && beginnerSwaps(completionsAt(3)) !== null ? `新手第 ${completionsAt(3) + 1} 局，一步步学会` : d.blurb;
        label(row, note, Theme.font.tiny, { color: Theme.textMuted, align: 'left', width: rw - 330 }).node.setPosition(-rw / 2 + 130, -34);
        if (best) {
            starRow(row, starFrames(), best.bestStars, 3, 22, 4).setPosition(rw / 2 - 90, 16);
            label(row, `${formatDuration(best.bestTimeMs)} · ${best.bestMoves} 步`, Theme.font.tiny, { color: P.ink2, bold: true }).node.setPosition(rw / 2 - 90, -18);
        } else {
            label(row, '尚未完成', Theme.font.tiny, { color: Theme.textMuted }).node.setPosition(rw / 2 - 90, 0);
        }
        if (recommended) {
            const tag = panel(row, 132, 34, { fill: P.rose, border: P.ink, shadow: undefined, step: 3 }, rw / 2 - 90, rh / 2);
            label(tag, g === 3 ? '推荐新手' : '推荐', Theme.font.tiny, { bold: true, color: P.white });
        }
        onTap(row, () => {
            gm.audio.play('click');
            sm.closeModal();
            onPick(g);
        });
    });
    label(card, '轻点空白处关闭', Theme.font.tiny, { color: Theme.textMuted }).node.setPosition(0, -h / 2 + 28);
}

/** 开局流程 */
export const Flow = {
    classic(imageId: string, grid: GridSize): void {
        const spec: PlaySession['spec'] = { imageId, grid, seed: randomSeed() };
        // 新手渐进：前 3 局入门拼图分别换 1/2/3 次（只影响经典模式的随机局；每日/挑战不受影响）
        if (grid === 3) {
            const s = beginnerSwaps(completionsAt(3));
            if (s !== null) spec.swaps = s;
        }
        GameManager.I.scene.go('game', { mode: 'classic', spec } as PlaySession);
    },
    daily(): void {
        const gm = GameManager.I;
        const p = gm.daily.getToday();
        gm.daily.recordAttempt(p.dateKey);
        gm.scene.go('game', { mode: 'daily', spec: { imageId: p.imageId, grid: p.grid, seed: p.seed }, dateKey: p.dateKey } as PlaySession);
    },
    challengeCreate(imageId: string, grid: GridSize): void {
        const gm = GameManager.I;
        const ch = gm.challenges.create(imageId, grid);
        gm.scene.go('game', { mode: 'challenge-create', spec: { imageId, grid, seed: ch.seed }, challenge: ch } as PlaySession);
    },
    challengeAccept(raw: string): boolean {
        const gm = GameManager.I;
        const r = gm.challenges.parse(raw);
        if (r.ok !== true) {
            gm.scene.toast(r.message);
            return false;
        }
        const d = r.data;
        gm.scene.go('game', { mode: 'challenge-accept', spec: { imageId: d.imageId, grid: d.grid, seed: d.seed }, challenge: d } as PlaySession);
        return true;
    },
};

/** 展示收到的挑战（分享入口 / 粘贴挑战码） */
export function showIncomingChallenge(raw: string): void {
    const gm = GameManager.I;
    const r = gm.challenges.parse(raw);
    if (r.ok !== true) {
        gm.scene.toast(r.message);
        return;
    }
    const d = r.data;
    const art = getArt(d.imageId)!;
    const w = Math.min(gm.layout.w - 48, 620);
    const h = 760;
    const card = gm.scene.openModal(w, h);
    const tag = panel(card, 220, 56, { fill: P.butter, border: P.ink, step: Theme.px, shadow: undefined }, 0, h / 2 - 60);
    label(tag, '好友挑战', Theme.font.small, { bold: true });
    artFrame(card, gm.textures.art(art.id), 220, 0, h / 2 - 230, art.tint);
    const t = label(card, `「${art.name}」${DIFFICULTIES[d.grid].desc}`, Theme.font.h2, { bold: true, width: w - 60 });
    t.node.setPosition(0, h / 2 - 390);
    const score = d.fromTimeMs > 0 ? `好友成绩：${formatDuration(d.fromTimeMs)} · ${d.fromMoves} 步` : '好友还没有留下成绩，先拼为敬！';
    const s = label(card, score, Theme.font.body, { color: P.rose2, bold: true, width: w - 60 });
    s.node.setPosition(0, h / 2 - 445);
    const note = label(card, '同一张图、同一种打乱，看看谁更快～\n成绩仅在本地对比，暂无在线排行榜', Theme.font.tiny, { color: Theme.textMuted, width: w - 60, wrap: true });
    note.node.setPosition(0, h / 2 - 510);
    button(card, {
        w: w - 120,
        h: 100,
        text: '接受挑战',
        style: 'primary',
        fontSize: Theme.font.h2,
        onClick: () => {
            gm.scene.closeModal();
            Flow.challengeAccept(raw);
        },
    }, 0, -h / 2 + 90);
}

export function fmtDate(dateKey: string): string {
    const [y, m, d] = dateKey.split('-').map((v) => parseInt(v, 10));
    const wd = ['日', '一', '二', '三', '四', '五', '六'][new Date(y, m - 1, d).getDay()];
    return `${m}月${d}日 · 周${wd}`;
}

export function setLabel(l: Label | null, s: string): void {
    if (l && l.string !== s) l.string = s;
}

export { makeNode };
