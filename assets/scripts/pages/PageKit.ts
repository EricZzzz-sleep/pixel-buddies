import { Label, Node, SpriteFrame } from 'cc';
import { ArtCategory, ArtInfo, CATEGORY_LABEL, CATEGORY_ORDER, getArt } from '../art/ArtCatalog';
import { P } from '../art/Palette';
import { BEGINNER_GRID, DIFFICULTIES, GridSize, SUPPORTED_GRIDS } from '../config/GameConfig';
import { formatDuration } from '../core/GameTimer';
import { GameManager, PlaySession } from '../core/GameManager';
import { randomSeed } from '../core/Random';
import { Theme, TINTS } from '../ui/Theme';
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

/** 难度选择弹窗：显示每个难度的最佳成绩，选择后回调 */
export function openDifficultySheet(art: ArtInfo, onPick: (grid: GridSize) => void, title = '选择难度'): void {
    const gm = GameManager.I;
    const sm = gm.scene;
    const w = Math.min(gm.layout.w - 48, 640);
    const h = 1010;
    // 还没完成过任何一局：推荐入门难度
    const beginner = gm.save.data.totalCompletions === 0;
    const card = sm.openModal(w, h);
    const t = label(card, title, Theme.font.h2, { bold: true });
    t.node.setPosition(0, h / 2 - 56);
    artFrame(card, gm.textures.art(art.id), 200, 0, h / 2 - 210, art.tint);
    const name = label(card, art.name, Theme.font.h2, { bold: true });
    name.node.setPosition(0, h / 2 - 350);
    const story = label(card, art.story, Theme.font.small, { color: P.ink2, width: w - 80, wrap: true });
    story.node.setPosition(0, h / 2 - 396);
    const colors = ['butter', 'mint', 'sky', 'lilac'] as const;
    SUPPORTED_GRIDS.forEach((g, i) => {
        const d = DIFFICULTIES[g];
        const rec = gm.collection.getRecord(art.id, g);
        const sub = rec
            ? `最佳 ${formatDuration(rec.bestTimeMs)} · ${rec.bestMoves} 步 · ${'★'.repeat(rec.bestStars)}${'☆'.repeat(3 - rec.bestStars)}`
            : beginner && g === BEGINNER_GRID
              ? '推荐第一次玩'
              : '尚未完成';
        button(card, {
            w: w - 80,
            h: 98,
            text: `${d.label}  ${d.desc}`,
            sub,
            style: colors[i],
            fontSize: Theme.font.body,
            onClick: () => {
                sm.closeModal();
                onPick(g);
            },
        }, 0, h / 2 - 494 - i * 116);
    });
    const close = label(card, '轻点空白处关闭', Theme.font.tiny, { color: Theme.textMuted });
    close.node.setPosition(0, -h / 2 + 30);
}

/** 开局流程 */
export const Flow = {
    classic(imageId: string, grid: GridSize): void {
        const session: PlaySession = { mode: 'classic', spec: { imageId, grid, seed: randomSeed() } };
        GameManager.I.scene.go('game', session);
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
