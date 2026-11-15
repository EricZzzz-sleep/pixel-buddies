import { Node } from 'cc';
import { P } from '../art/Palette';
import { SERIES_STATE_TEXT } from '../collection/SeriesCatalog';
import { ScrollList } from '../ui/ScrollList';
import { Theme } from '../ui/Theme';
import { label, panel } from '../ui/UIKit';
import { BasePage } from './BasePage';
import { washBackground } from './CollectionPage';
import { artCard, artCardHeight, Flow, openDifficultySheet, openItemDetail, rewardRow, segmentBar } from './PageKit';

/** 主题详情：系列进度、奖励预览、作品网格（已收藏显示大图，未收藏显示轮廓和解锁条件） */
export class SeriesPage extends BasePage {
    private list!: ScrollList;
    private titleLabel!: ReturnType<BasePage['header']>['title'];
    private wash: { node: Node | null } = { node: null };
    private seriesId = 'animals';

    protected build(): void {
        const L = this.L;
        this.titleLabel = this.header('主题').title;
        const top = L.contentTop - 6;
        const bottom = -L.h / 2 + L.safeBottom + 10;
        this.list = ScrollList.create(this.root, L.w, top - bottom, 0, (top + bottom) / 2);
    }

    onEnter(params?: { id?: string }): void {
        if (params && params.id) this.seriesId = params.id;
        const gm = this.gm;
        gm.analytics.track('collection_page_opened', { page: 'series', series: this.seriesId });
        this.refresh();
    }

    private refresh(): void {
        const gm = this.gm;
        const L = this.L;
        const s = gm.collection.seriesProgress(this.seriesId);
        const color = s.info.reward.color;
        this.titleLabel.string = s.info.name;
        washBackground(this, this.wash, s.done ? color : null, L.fullW, L.fullH);
        const content = this.list.content;
        content.destroyAllChildren();
        const W = L.w - Theme.gutter * 2;

        // ---- 系列进度 + 奖励
        const ph = 300;
        const top = panel(content, W, ph, { fill: P.white, border: s.done ? color : P.ink, shadow: s.done ? color : P.ink, step: Theme.px, shadowDepth: 2 }, 0, -14 - ph / 2);
        label(top, `${s.collected}/${s.total}  ${SERIES_STATE_TEXT[s.state]}`, Theme.font.h2, { bold: true, align: 'left', width: W - 60 }).node.setPosition(-W / 2 + 30, ph / 2 - 44);
        segmentBar(top, s.total, s.collected, W - 60, 22, color, 0, ph / 2 - 92);
        const hint = s.done ? '集齐奖励已获得，已自动生效' : s.remaining === 1 ? '只差最后 1 件！完成它即可领取全部奖励' : `再收集 ${s.remaining} 件，获得徽章、头像框和专属背景`;
        label(top, hint, Theme.font.small - 2, { color: s.done ? P.leaf3 : P.rose2, bold: true, align: 'left', width: W - 60 }).node.setPosition(-W / 2 + 30, ph / 2 - 134);
        rewardRow(top, s.info, s.done, W - 40, 0, -ph / 2 + 58);

        // ---- 作品网格（2 列）
        const cols = 2;
        const gap = 24;
        const cw = (W - gap) / 2;
        const ch = artCardHeight(cw);
        const stars = gm.collection.totalStars();
        let y = -14 - ph - 24;
        s.info.items.forEach((id, i) => {
            const art = gm.resolveArt(id)!;
            const got = gm.collection.isCollected(id);
            const playable = gm.collection.isPlayable(id);
            const col = i % cols;
            const row = Math.floor(i / cols);
            const last = !got && s.remaining === 1;
            const lockText = got ? '' : last ? '最后一件！集齐领奖' : playable ? '完成拼图即可收藏' : `再收集 ${Math.max(1, art.unlockStars - stars)} 颗星解锁拼图`;
            const d = gm.collection.itemDetail(id)!;
            artCard(content, {
                art,
                w: cw,
                reveal: got,
                locked: !got,
                lockText,
                stars: d.bestStars,
                onClick: () => {
                    if (got) openItemDetail(id);
                    else if (playable) openDifficultySheet(art, (g) => Flow.classic(art.id, g));
                    else this.sm.toast(`再收集 ${Math.max(1, art.unlockStars - stars)} 颗星，就能开始拼「${art.name}」`);
                },
            }, -W / 2 + cw / 2 + col * (cw + gap), y - ch / 2 - row * (ch + gap));
            if (last) {
                const tag = panel(content, 150, 38, { fill: P.rose, border: P.ink, shadow: undefined, step: 3 }, -W / 2 + cw / 2 + col * (cw + gap), y - row * (ch + gap) - 6);
                label(tag, '最后一件！', Theme.font.tiny, { bold: true, color: P.white });
            }
        });
        const rows = Math.ceil(s.info.items.length / cols);
        this.list.setContentHeight(-y + rows * (ch + gap) + 20);
        this.list.scrollToTop();
    }
}
