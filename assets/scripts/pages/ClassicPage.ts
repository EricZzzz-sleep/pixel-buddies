import { Label } from 'cc';
import { ART_LIST, ArtCategory } from '../art/ArtCatalog';
import { P } from '../art/Palette';
import { Theme } from '../ui/Theme';
import { ScrollList } from '../ui/ScrollList';
import { label, panel, sprite } from '../ui/UIKit';
import { BasePage } from './BasePage';
import { artCard, artCardHeight, categoryTabs, Flow, openDifficultySheet, setLabel } from './PageKit';

/**
 * 经典拼图：按分类浏览作品 → 选难度 → 开始。
 * 作品按总星数逐步开放；未开放的显示马赛克与所需星数。
 */
export class ClassicPage extends BasePage {
    private list!: ScrollList;
    private category: ArtCategory | null = null;
    private starsLabel!: Label;

    protected build(): void {
        const L = this.L;
        const gm = this.gm;
        this.header('经典拼图');
        const W = L.w - Theme.gutter * 2;
        const pill = panel(this.root, 150, 56, { fill: P.butter, border: P.ink, step: Theme.px, shadow: P.gold2 }, L.headerRight - 75, L.headerY);
        sprite(pill, gm.textures.icon('star', P.gold, P.white), 26, 24, -44, 0);
        this.starsLabel = label(pill, '0', Theme.font.small, { bold: true });
        this.starsLabel.node.setPosition(14, 0);

        const tabsY = L.contentTop - 40;
        categoryTabs(this.root, tabsY, W, (c) => {
            this.category = c;
            this.refresh(true);
        });
        const listTop = tabsY - 50;
        const listBottom = -L.h / 2 + L.safeBottom + 10;
        const h = listTop - listBottom;
        this.list = ScrollList.create(this.root, L.w, h, 0, listBottom + h / 2);
    }

    onEnter(): void {
        setLabel(this.starsLabel, String(this.gm.collection.totalStars()));
        this.refresh(false);
    }

    private refresh(toTop: boolean): void {
        const gm = this.gm;
        const L = this.L;
        const content = this.list.content;
        content.destroyAllChildren();
        const W = L.w - Theme.gutter * 2;
        const cols = 3;
        const gap = 20;
        const cw = (W - gap * (cols - 1)) / cols;
        const ch = artCardHeight(cw);
        const arts = ART_LIST.filter((a) => !this.category || a.category === this.category);
        const stars = gm.collection.totalStars();
        arts.forEach((art, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const playable = gm.collection.isPlayable(art.id);
            const best = gm.collection.getEntries().find((e) => e.art.id === art.id)!;
            artCard(content, {
                art,
                w: cw,
                reveal: playable,
                locked: !playable,
                lockText: `还需 ${art.unlockStars - stars} 颗星解锁`,
                stars: best.bestStars,
                onClick: () => {
                    if (!playable) {
                        this.sm.toast(`收集 ${art.unlockStars} 颗星星即可解锁「${art.name}」`);
                        return;
                    }
                    openDifficultySheet(art, (g) => Flow.classic(art.id, g));
                },
            }, -W / 2 + cw / 2 + col * (cw + gap), -20 - ch / 2 - row * (ch + gap));
        });
        const rows = Math.ceil(arts.length / cols);
        this.list.setContentHeight(rows * (ch + gap) + 40);
        if (toTop) this.list.scrollToTop();
    }
}
