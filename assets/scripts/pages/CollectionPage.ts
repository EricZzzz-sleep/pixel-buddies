import { Label } from 'cc';
import { ArtCategory, CATEGORY_LABEL } from '../art/ArtCatalog';
import { P } from '../art/Palette';
import { DIFFICULTIES, SUPPORTED_GRIDS } from '../config/GameConfig';
import { CollectionEntry } from '../collection/CollectionManager';
import { formatDuration } from '../core/GameTimer';
import { Theme } from '../ui/Theme';
import { ScrollList } from '../ui/ScrollList';
import { button, label, panel, starRow } from '../ui/UIKit';
import { BasePage } from './BasePage';
import { artCard, artCardHeight, artFrame, categoryTabs, Flow, openDifficultySheet, setLabel, starFrames } from './PageKit';

/**
 * 作品收藏册：按主题分类展示；未收集的作品显示马赛克预览。
 * 点击已收集作品查看大图、小故事与各难度最佳成绩。
 */
export class CollectionPage extends BasePage {
    private list!: ScrollList;
    private category: ArtCategory | null = null;
    private summary!: Label;

    protected build(): void {
        const L = this.L;
        this.header('我的收藏');
        const W = L.w - Theme.gutter * 2;
        const sumY = L.contentTop - 34;
        const sp = panel(this.root, W, 64, { fill: P.lilac, border: P.ink, step: Theme.px, shadow: P.purple }, 0, sumY);
        this.summary = label(sp, '', Theme.font.small, { bold: true });
        const tabsY = sumY - 84;
        categoryTabs(this.root, tabsY, W, (c) => {
            this.category = c;
            this.refresh(true);
        });
        const listTop = tabsY - 46;
        const listBottom = -L.h / 2 + L.safeBottom + 10;
        const h = listTop - listBottom;
        this.list = ScrollList.create(this.root, L.w, h, 0, listBottom + h / 2);
    }

    onEnter(): void {
        const c = this.gm.collection;
        setLabel(this.summary, `已收集 ${c.collectedCount()}/${c.getEntries().length} 幅作品 · 星星 ${c.totalStars()}/${c.maxStars()}`);
        this.refresh(false);
    }

    private refresh(toTop: boolean): void {
        const L = this.L;
        const content = this.list.content;
        content.destroyAllChildren();
        const W = L.w - Theme.gutter * 2;
        const cols = 3;
        const gap = 20;
        const cw = (W - gap * (cols - 1)) / cols;
        const ch = artCardHeight(cw);
        const entries = this.gm.collection.getEntries(this.category || undefined);
        entries.forEach((e, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            artCard(content, {
                art: e.art,
                w: cw,
                reveal: e.collected,
                caption: e.collected ? (e.bestTimeMs ? `最快 ${formatDuration(e.bestTimeMs)} · ${'★'.repeat(e.bestStars)}` : '已收集') : `未收集 · ${CATEGORY_LABEL[e.art.category]}`,
                onClick: () => (e.collected ? this.openDetail(e) : this.sm.toast('完成这幅拼图即可收入收藏册')),
            }, -W / 2 + cw / 2 + col * (cw + gap), -20 - ch / 2 - row * (ch + gap));
        });
        this.list.setContentHeight(Math.ceil(entries.length / cols) * (ch + gap) + 40);
        if (toTop) this.list.scrollToTop();
    }

    private openDetail(e: CollectionEntry): void {
        const gm = this.gm;
        const w = Math.min(this.L.w - 48, 640);
        const h = 1030;
        const card = this.sm.openModal(w, h);
        artFrame(card, gm.textures.art(e.art.id), 320, 0, h / 2 - 210, e.art.tint);
        label(card, e.art.name, Theme.font.title, { bold: true }).node.setPosition(0, h / 2 - 410);
        const story = label(card, `“${e.art.story}”`, Theme.font.small, { color: P.ink2, width: w - 80, wrap: true });
        story.node.setPosition(0, h / 2 - 462);
        SUPPORTED_GRIDS.forEach((g, i) => {
            const r = e.records[g];
            const y = h / 2 - 540 - i * 74;
            const row = panel(card, w - 60, 62, { fill: r ? P.white : P.cream2, border: P.cream3, step: Theme.px, shadow: undefined }, 0, y);
            label(row, `${DIFFICULTIES[g].label} ${DIFFICULTIES[g].desc}`, Theme.font.small, { bold: true, align: 'left' }).node.setPosition(-(w - 60) / 2 + 20, 0);
            if (r) {
                label(row, `${formatDuration(r.bestTimeMs)} · ${r.bestMoves} 步 · ${r.completions} 次`, Theme.font.tiny, { color: P.ink2, align: 'right' }).node.setPosition((w - 60) / 2 - 120, 0);
                starRow(row, starFrames(), r.bestStars, 3, 22, 4).setPosition((w - 60) / 2 - 56, 0);
            } else {
                label(row, '未完成', Theme.font.tiny, { color: Theme.textMuted, align: 'right' }).node.setPosition((w - 60) / 2 - 20, 0);
            }
        });
        button(card, {
            w: w - 100,
            h: 96,
            text: '再拼一次',
            style: 'primary',
            onClick: () => {
                this.sm.closeModal();
                openDifficultySheet(e.art, (g) => Flow.classic(e.art.id, g));
            },
        }, 0, -h / 2 + 80);
    }
}
