import { Graphics, Node, tween } from 'cc';
import { P } from '../art/Palette';
import { SERIES_STATE_TEXT, SeriesState } from '../collection/SeriesCatalog';
import { hex, Theme } from '../ui/Theme';
import { ScrollList } from '../ui/ScrollList';
import { label, makeNode, onTap, panel, sprite } from '../ui/UIKit';
import { BasePage } from './BasePage';
import { artFrame, rewardRow, segmentBar } from './PageKit';

const STATE_COLOR: Record<SeriesState, number> = { 'not-started': P.grey, collecting: P.butter, almost: P.pink2, done: P.mint2 };

/** 页面背景色晕：系列奖励“专属收藏背景”的实现（只是一层淡色，几乎没有开销） */
export function washBackground(page: BasePage, holder: { node: Node | null }, color: number | null, w: number, h: number): void {
    if (holder.node) {
        holder.node.destroy();
        holder.node = null;
    }
    if (color === null) return;
    const n = makeNode('Wash', page.root, w, h);
    n.setSiblingIndex(0);
    const g = n.addComponent(Graphics);
    g.fillColor = hex(color, 38);
    g.rect(-w / 2, -h / 2, w, h);
    g.fill();
    holder.node = n;
}

/**
 * 我的收藏：总览（已收藏 x/12、整体进度、已完成主题）+ 主题系列卡片。
 * 点击主题进入该系列的作品网格；有尚未展示的系列奖励时，先进入庆祝页。
 */
export class CollectionPage extends BasePage {
    private list!: ScrollList;
    private wash: { node: Node | null } = { node: null };

    protected build(): void {
        const L = this.L;
        this.header('我的收藏');
        const top = L.contentTop - 6;
        const bottom = -L.h / 2 + L.safeBottom + 10;
        this.list = ScrollList.create(this.root, L.w, top - bottom, 0, (top + bottom) / 2);
    }

    onEnter(): void {
        const gm = this.gm;
        gm.analytics.track('collection_page_opened', { page: 'collection' });
        const unseen = gm.collection.unseenRewards();
        this.refresh();
        // 旧存档补发的奖励、或结算页没来得及展示的奖励：进入收藏册时展示一次庆祝页
        if (unseen.length) this.scheduleOnce(() => gm.scene.currentName === 'collection' && gm.scene.go('reward', { id: unseen[0] }), 0.35);
    }

    private scheduleOnce(fn: () => void, delay: number): void {
        // 注意：SceneManager 转场会停掉页面 root 上的 tween，所以挂在滚动容器上
        tween(this.list.node).delay(delay).call(fn).start();
    }

    private refresh(): void {
        const gm = this.gm;
        const L = this.L;
        const content = this.list.content;
        content.destroyAllChildren();
        const W = L.w - Theme.gutter * 2;
        const ov = gm.collection.overall();
        const latest = gm.collection.earnedRewards()[0];
        washBackground(this, this.wash, latest ? latest.reward.color : null, L.fullW, L.fullH);

        // ---- 总览卡片
        const sh = 190;
        const sum = panel(content, W, sh, { fill: P.white, border: latest ? latest.reward.color : P.ink, shadow: P.ink, step: Theme.px, shadowDepth: 2 }, 0, -14 - sh / 2);
        label(sum, `已收藏 ${ov.collected}/${ov.total} 件作品`, Theme.font.h2, { bold: true, align: 'left', width: W - 60 }).node.setPosition(-W / 2 + 30, sh / 2 - 44);
        segmentBar(sum, ov.total, ov.collected, W - 60, 22, P.rose, 0, 8);
        label(sum, `整体进度 ${Math.round(ov.ratio * 100)}%`, Theme.font.small, { color: P.ink2, bold: true, align: 'left', width: 260 }).node.setPosition(-W / 2 + 30, -sh / 2 + 42);
        label(sum, `已完成主题 ${ov.seriesDone}/${ov.seriesTotal}`, Theme.font.small, { color: P.rose2, bold: true, align: 'right', width: 300 }).node.setPosition(W / 2 - 30, -sh / 2 + 42);

        // ---- 主题系列卡片
        const ch = 286;
        let y = -14 - sh - 24;
        for (const s of gm.collection.allSeries()) {
            const done = s.done;
            const color = s.info.reward.color;
            const card = panel(content, W, ch, { fill: P.white, border: done ? color : P.cream3, shadow: done ? color : Theme.shadow, step: Theme.px, shadowDepth: 1.5 }, 0, y - ch / 2);
            const coverId = s.collected > 0 ? s.info.cover : s.info.cover;
            const have = gm.collection.isCollected(coverId);
            artFrame(card, have ? gm.textures.art(coverId) : gm.textures.mosaic(coverId), 140, -W / 2 + 108, 34, s.info.tint);
            const x0 = -W / 2 + 214;
            const rw = W - 240;
            label(card, `系列 0${s.info.no}  ${s.info.name}`, Theme.font.body, { bold: true, align: 'left', width: rw }).node.setPosition(x0, ch / 2 - 42);
            label(card, s.info.desc, Theme.font.tiny, { color: Theme.textMuted, align: 'left', width: rw }).node.setPosition(x0, ch / 2 - 78);
            segmentBar(card, s.total, s.collected, rw - 90, 18, color, x0 + (rw - 90) / 2, ch / 2 - 116);
            label(card, `${s.collected}/${s.total}`, Theme.font.body, { bold: true, align: 'right', width: 80 }).node.setPosition(x0 + rw, ch / 2 - 116);
            const chip = panel(card, 150, 36, { fill: STATE_COLOR[s.state], border: P.ink, shadow: undefined, step: 3 }, x0 + 75, ch / 2 - 160);
            label(chip, SERIES_STATE_TEXT[s.state], Theme.font.tiny, { bold: true });
            if (s.state === 'almost') label(card, `再收集 1 件得奖励`, Theme.font.tiny, { color: P.rose2, bold: true, align: 'left', width: rw - 170 }).node.setPosition(x0 + 168, ch / 2 - 160);
            rewardRow(card, s.info, done, W - 40, 0, -ch / 2 + 54);
            if (done) sprite(card, gm.textures.icon('crown', color, P.white), 44, 28, W / 2 - 50, ch / 2 - 40);
            onTap(card, () => {
                gm.audio.play('click');
                this.sm.go('series', { id: s.info.id });
            });
            y -= ch + 22;
        }
        this.list.setContentHeight(-y + 30);
        this.list.scrollToTop();
    }
}
