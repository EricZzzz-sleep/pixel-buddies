import { Node, tween, Vec3 } from 'cc';
import { ART_LIST } from '../art/ArtCatalog';
import { P } from '../art/Palette';
import { DIFFICULTIES } from '../config/GameConfig';
import { formatDuration } from '../core/GameTimer';
import { ResultPayload } from '../core/GameManager';
import { DailyUpdate } from '../daily/DailyChallengeManager';
import { ChallengeComparison } from '../social/ChallengeManager';
import { ChallengeData } from '../social/ChallengeCodec';
import { Effects } from '../ui/Effects';
import { Theme } from '../ui/Theme';
import { button, label, makeNode, onTap, panel, popIn, sprite } from '../ui/UIKit';
import { BasePage } from './BasePage';
import { SeriesUpdate } from '../collection/CollectionManager';
import { artFrame, fmtDate, Flow, openDifficultySheet, segmentBar, starFrames } from './PageKit';

/**
 * 结算页：作品展示、星级动画、用时/步数/提示、最佳成绩与新纪录；
 * 每日挑战显示结果卡片，好友挑战显示双方成绩对比与分享按钮。
 * 页面内容依赖每局结果，所以每次进入都重建内容节点（数量很少）。
 */
export class ResultPage extends BasePage {
    private content!: Node;
    private fx!: Effects;

    protected build(): void {
        this.content = makeNode('Content', this.root, this.L.w, this.L.h);
        const fxLayer = makeNode('Fx', this.root, this.L.w, this.L.h);
        this.fx = new Effects(fxLayer);
    }

    onEnter(payload: ResultPayload): void {
        if (!payload) return;
        const gm = this.gm;
        const { session, result } = payload;
        this.content.destroyAllChildren();

        // 写入存档（收藏/纪录/每日/挑战）
        const rec = gm.collection.recordResult(result);
        let daily: DailyUpdate | null = null;
        let compare: ChallengeComparison | null = null;
        let shareData: ChallengeData | null = null;
        if (session.mode === 'daily' && session.dateKey) daily = gm.daily.recordResult(session.dateKey, result);
        if (session.mode === 'challenge-accept' && session.challenge) {
            compare = gm.challenges.compare(session.challenge, result);
            gm.challenges.logReceived(session.challenge, result);
        }
        if (session.mode === 'challenge-create' && session.challenge) shareData = gm.challenges.withResult(session.challenge, result);
        gm.save.flush();

        // 收藏事件：只有“首次解锁”才记录解锁/系列进度；重复完成不会重复触发
        const ser = rec.series;
        if (ser && rec.newlyCollected) {
            gm.analytics.track('collection_item_unlocked', { item: result.imageId, series: ser.info.id });
            gm.analytics.track('collection_series_progressed', { series: ser.info.id, count: ser.after, total: ser.total });
            if (ser.justCompleted) gm.analytics.track('collection_series_completed', { series: ser.info.id });
        }

        const L = this.L;
        const art = gm.resolveArt(result.imageId)!;
        const W = L.w - Theme.gutter * 2;
        const c = this.content;
        const stars = rec.breakdown.stars;

        // 标题
        const titleText = compare ? (compare.outcome === 'win' ? '挑战成功！' : compare.outcome === 'lose' ? '差一点点！' : compare.outcome === 'draw' ? '势均力敌！' : '拼图完成！') : '拼图完成！';
        const title = label(c, titleText, Theme.font.hero - 8, { bold: true, color: P.white, outline: { color: P.ink, width: 6 } });
        title.node.setPosition(0, L.headerY - 6);
        const sub = label(c, `${art.name} · ${DIFFICULTIES[result.grid].label} ${DIFFICULTIES[result.grid].desc}`, Theme.font.small, { color: P.ink2, bold: true });
        sub.node.setPosition(0, L.headerY - 64);

        // 自适应纵向布局：先算出底部按钮与附加区所需高度，再决定作品尺寸（16:9 与全面屏都不重叠）
        const btnY0 = -L.h / 2 + L.safeBottom + 24 + 50;
        const hasShare = session.mode !== 'classic';
        const shareH = hasShare ? 120 + (session.mode === 'challenge-create' ? 70 : 0) : 0;
        const buttonsTop = btnY0 + 46 + shareH;
        const hasSeries = !!rec.series;
        const extraH = (compare ? 186 : daily ? 166 : 0) + (hasSeries ? 110 : 0);
        const avail = L.contentTop - 20 - buttonsTop;
        const artSize = Math.max(120, Math.min(340, avail - (150 + 254 + extraH + 70)));
        // 高屏：内容整体下移，使其在标题与按钮之间居中
        const blockH = artSize + 76 + 84 + 230 + extraH;
        const leftover = avail - 30 - blockH;
        const shift = Math.max(0, leftover * 0.45);

        // 作品
        const artY = L.contentTop - 30 - shift - artSize / 2;
        const frame = artFrame(c, gm.textures.art(art.id), artSize, 0, artY, art.tint);
        frame.setScale(0.6, 0.6, 1);
        tween(frame).to(0.35, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();

        // 星星
        const starY = artY - artSize / 2 - 76;
        const frames = starFrames();
        for (let i = 0; i < 3; i++) {
            const big = i === 1;
            const sz = big ? 96 : 76;
            const s = sprite(c, i < stars ? frames.on : frames.off, sz, sz * (11 / 12), (i - 1) * 110, starY + (big ? 14 : 0));
            s.node.setScale(0, 0, 1);
            tween(s.node)
                .delay(0.35 + i * 0.18)
                .call(() => i < stars && gm.audio.play('star', 0.7))
                .to(0.25, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'backOut' })
                .to(0.12, { scale: new Vec3(1, 1, 1) })
                .start();
        }
        if (stars === 3) {
            tween(c).delay(1.0).call(() => {
                this.fx.ring(0, starY + 10, 180, 20);
                this.fx.confetti(L.w, L.h / 2, -L.h / 2, 40);
            }).start();
            const crown = sprite(c, gm.textures.icon('crown', P.gold, P.white), 66, 42, 0, starY + 82);
            popIn(crown.node, 1.1);
        }

        // 数据面板
        const statsH = 230;
        const statsY = starY - 84 - statsH / 2;
        const stats = panel(c, W, statsH, { fill: P.white, border: P.ink, shadow: P.ink, step: Theme.px, shadowDepth: 2 }, 0, statsY);
        const best = rec.best;
        const rows: Array<[string, string, string, number]> = [
            ['clock', '用时', formatDuration(result.timeMs), P.blue3],
            ['steps', '步数', `${result.moves} 步（最少 ${result.optimalMoves} 步）`, P.leaf3],
            ['bulb', '提示', `${result.hintsUsed} 次${result.peekCount ? ` · 看原图 ${result.peekCount} 次` : ''}`, P.gold2],
            ['trophy', '最佳', `${formatDuration(best.bestTimeMs)} · ${best.bestMoves} 步`, P.rose2],
        ];
        rows.forEach(([icon, k, v, col], i) => {
            const y = statsH / 2 - 40 - i * 50;
            sprite(stats, gm.textures.icon(icon, col, P.white), 28, 28, -W / 2 + 46, y);
            label(stats, k, Theme.font.small, { color: Theme.textMuted, align: 'left' }).node.setPosition(-W / 2 + 76, y);
            label(stats, v, Theme.font.body, { bold: true, align: 'right' }).node.setPosition(W / 2 - 30, y);
        });
        if (rec.isNewRecord && rec.previousBest) {
            const nr = panel(c, 190, 56, { fill: P.rose, border: P.ink, step: Theme.px, shadow: P.rose2 }, W / 2 - 80, statsY + statsH / 2 + 6);
            label(nr, '新纪录！', Theme.font.small, { bold: true, color: P.white });
            nr.angle = 6;
            popIn(nr, 0.9);
        }
        popIn(stats, 0.3);

        // 模式附加区：好友对比 / 每日结果卡片 / 提示
        let extraBottom = statsY - statsH / 2 - 24;
        if (rec.series) extraBottom = this.buildSeriesPanel(rec.series, rec.newlyCollected, extraBottom, W) - 16;
        if (compare) extraBottom = this.buildCompare(compare, extraBottom, W) - 16;
        else if (daily) extraBottom = this.buildDailyCard(daily, result.imageId, extraBottom, W) - 16;
        // 首次解锁：稍等星星动画结束后，弹出收藏卡片庆祝（重复完成不弹）
        if (ser && rec.newlyCollected) tween(this.content).delay(1.5).call(() => this.showUnlock(ser, art.name, art.story, result.imageId)).start();
        if (rec.newlyUnlocked.length) {
            this.sm.toast(`解锁新图：${rec.newlyUnlocked.map((a) => a.name).join('、')}`, 2.4);
        }

        // 按钮区
        const btnY = btnY0;
        const bw = (W - 20) / 2;
        const mode = session.mode;
        if (mode === 'challenge-create' && shareData) {
            const data = shareData;
            button(c, {
                w: W, h: 100, text: '邀请好友来挑战', style: 'primary', icon: gm.textures.icon('share', P.white),
                onClick: () => gm.share.shareChallenge(data).then((r) => this.sm.toast(r.message)),
            }, 0, btnY + 120);
            const code = label(c, `挑战码：${gm.challenges.encode(data)}`, Theme.font.tiny, { color: Theme.textMuted, width: W });
            code.node.setPosition(0, btnY + 190);
        } else if (mode === 'daily' && daily) {
            const d = daily;
            button(c, {
                w: W, h: 100, text: '分享今日成绩', style: 'butter', icon: gm.textures.icon('share', P.ink),
                onClick: () => gm.share.shareDailyResult(session.dateKey!, art.name, d.record.bestTimeMs, d.record.bestMoves, d.record.stars, art.id).then((r) => this.sm.toast(r.message)),
            }, 0, btnY + 120);
        } else if (mode === 'challenge-accept' && session.challenge) {
            const back = gm.challenges.withResult(session.challenge, result);
            button(c, {
                w: W, h: 100, text: '把我的成绩发回去', style: 'primary', icon: gm.textures.icon('share', P.white),
                onClick: () => gm.share.shareChallenge({ ...back, seed: session.challenge!.seed }).then((r) => this.sm.toast(r.message)),
            }, 0, btnY + 120);
        }

        const againText = mode === 'classic' ? '再来一局' : mode === 'daily' ? '再挑战一次' : '再拼一次';
        button(c, {
            w: bw, h: 92, text: againText, style: 'secondary', icon: gm.textures.icon('refresh', P.ink),
            onClick: () => {
                if (mode === 'classic') openDifficultySheet(art, (g) => Flow.classic(art.id, g), '再来一局');
                else if (mode === 'daily') Flow.daily();
                else if (session.challenge) this.sm.go('game', session, { replace: true });
            },
        }, -bw / 2 - 10, btnY);
        const nextArt = this.nextPlayable(art.id);
        if (mode === 'classic' && nextArt) {
            button(c, {
                w: bw, h: 92, text: '下一张', style: 'mint', icon: gm.textures.icon('play', P.ink),
                onClick: () => openDifficultySheet(nextArt, (g) => Flow.classic(nextArt.id, g)),
            }, bw / 2 + 10, btnY);
        } else {
            button(c, { w: bw, h: 92, text: '返回首页', style: 'mint', onClick: () => this.backHome() }, bw / 2 + 10, btnY);
        }
        if (mode === 'classic' && nextArt) {
            const home = label(c, '返回首页', Theme.font.small, { color: P.ink2, bold: true });
            home.node.setPosition(0, btnY + (extraBottom > btnY + 160 ? 80 : 70));
            home.node.on(Node.EventType.TOUCH_END, () => this.backHome());
        }
    }

    /** 作品所属系列的进度条；重复完成时说明离系列奖励还差几件 */
    private buildSeriesPanel(ser: SeriesUpdate, first: boolean, top: number, W: number): number {
        const gm = this.gm;
        const h = 96;
        const p = panel(this.content, W, h, { fill: P.white, border: ser.info.reward.color, shadow: undefined, step: Theme.px }, 0, top - h / 2);
        label(p, `${ser.info.name}系列  ${ser.after}/${ser.total}`, Theme.font.small, { bold: true, align: 'left', width: W - 200 }).node.setPosition(-W / 2 + 26, h / 2 - 28);
        const left = ser.total - ser.after;
        const note = first ? (ser.justCompleted ? '系列集齐！奖励已解锁' : '新作品已加入收藏') : left > 0 ? `距离系列奖励还差 ${left} 件` : '系列奖励已获得';
        label(p, note, Theme.font.tiny, { color: first ? P.rose2 : P.ink2, bold: true, align: 'right', width: 280 }).node.setPosition(W / 2 - 26, h / 2 - 28);
        segmentBar(p, ser.total, ser.after, W - 52, 16, ser.info.reward.color, 0, -h / 2 + 26);
        onTap(p, () => {
            gm.audio.play('click');
            this.sm.go('series', { id: ser.info.id });
        });
        popIn(p, 0.6);
        return top - h;
    }

    /** 新作品收藏卡：展示完整作品、系列进度，并引导查看收藏/领取系列奖励 */
    private showUnlock(ser: SeriesUpdate, name: string, story: string, imageId: string): void {
        const gm = this.gm;
        if (this.sm.currentName !== 'result' || this.sm.hasModal) return;
        const w = Math.min(this.L.w - 48, 640);
        const h = 1010;
        const color = ser.info.reward.color;
        const card = this.sm.openModal(w, h, { closeOnMask: false });
        const ribbon = panel(card, w - 120, 76, { fill: P.rose, border: P.ink, shadow: P.rose2, step: Theme.px }, 0, h / 2 - 58);
        label(ribbon, '新作品已加入收藏！', Theme.font.h2, { bold: true, color: P.white });
        const art = artFrame(card, gm.textures.art(imageId), 380, 0, h / 2 - 330, 'pink');
        popIn(art, 0.1, 30);
        const spark = [[-250, 110], [250, 80], [-230, -150], [240, -170]];
        spark.forEach(([x, y], i) => {
            const sp = sprite(card, gm.textures.icon('sparkle', i % 2 ? P.gold : P.rose, P.white), 34, 34, x, h / 2 - 330 + y);
            tween(sp.node).repeatForever(tween().to(0.5 + i * 0.1, { scale: new Vec3(1.35, 1.35, 1) }).to(0.5 + i * 0.1, { scale: new Vec3(0.8, 0.8, 1) })).start();
        });
        label(card, name, Theme.font.title, { bold: true }).node.setPosition(0, h / 2 - 590);
        label(card, `“${story}”`, Theme.font.small - 2, { color: P.ink2, width: w - 90, wrap: true }).node.setPosition(0, h / 2 - 650);
        label(card, `${ser.info.name}系列  ${ser.after}/${ser.total}`, Theme.font.body, { bold: true, color }).node.setPosition(0, h / 2 - 718);
        segmentBar(card, ser.total, ser.after, w - 140, 24, color, 0, h / 2 - 752);
        const left = ser.total - ser.after;
        const note = ser.justCompleted ? '系列集齐啦！奖励已经为你解锁' : left === 1 ? '只差最后 1 件就能集齐，加油！' : `再收集 ${left} 件，获得徽章、头像框和专属背景`;
        label(card, note, Theme.font.small - 2, { color: P.rose2, bold: true, width: w - 80 }).node.setPosition(0, h / 2 - 794);
        if (ser.justCompleted) {
            button(card, { w: w - 100, h: 88, text: '领取系列奖励', style: 'primary', icon: gm.textures.icon('crown', P.white, P.white), onClick: () => { this.sm.closeModal(); this.sm.go('reward', { id: ser.info.id }); } }, 0, -h / 2 + 150);
        } else {
            button(card, { w: w - 100, h: 88, text: '查看收藏', style: 'primary', icon: gm.textures.icon('book', P.white, P.white), onClick: () => { this.sm.closeModal(); this.sm.go('series', { id: ser.info.id }); } }, 0, -h / 2 + 150);
        }
        button(card, { w: w - 100, h: 80, text: '继续', style: 'secondary', onClick: () => this.sm.closeModal() }, 0, -h / 2 + 50);
        gm.audio.play('star', 0.9);
        gm.vibrate();
    }

    onBack(): boolean {
        this.backHome();
        return true;
    }

    private backHome(): void {
        this.sm.home();
        // 插屏广告只允许在这种自然的页面切换点调用（默认禁用）
        this.gm.ads.showInterstitialAtBreak();
    }

    private nextPlayable(currentId: string) {
        const gm = this.gm;
        const idx = ART_LIST.findIndex((a) => a.id === currentId);
        for (let k = 1; k <= ART_LIST.length; k++) {
            const a = ART_LIST[(idx + k) % ART_LIST.length];
            if (gm.collection.isPlayable(a.id) && a.id !== currentId) return a;
        }
        return null;
    }

    /** 好友对比：左右两栏，如实显示“本地对比” */
    private buildCompare(cmp: ChallengeComparison, top: number, W: number): number {
        const c = this.content;
        const h = 170;
        const y = top - h / 2;
        const p = panel(c, W, h, { fill: P.sky, border: P.ink, shadow: P.blue2, step: Theme.px, shadowDepth: 1.5 }, 0, y);
        const col = (x: number, who: string, t: string, m: string, win: boolean) => {
            label(p, who, Theme.font.small, { bold: true, color: P.ink2 }).node.setPosition(x, 50);
            label(p, t, Theme.font.h2, { bold: true, color: win ? P.rose2 : P.ink }).node.setPosition(x, 6);
            label(p, m, Theme.font.small, { color: P.ink2 }).node.setPosition(x, -36);
        };
        col(-W / 4, '我', formatDuration(cmp.mine.timeMs), `${cmp.mine.moves} 步`, cmp.outcome === 'win');
        if (cmp.theirs) col(W / 4, '好友', formatDuration(cmp.theirs.timeMs), `${cmp.theirs.moves} 步`, cmp.outcome === 'lose');
        else col(W / 4, '好友', '--:--', '尚无成绩', false);
        label(p, 'VS', Theme.font.h2, { bold: true, color: P.blue3 }).node.setPosition(0, 6);
        label(p, '本地对比 · 成绩来自分享卡片，暂无在线排行榜', Theme.font.tiny, { color: P.blue3 }).node.setPosition(0, -h / 2 + 18);
        popIn(p, 0.5);
        return top - h;
    }

    /** 每日挑战结果卡片 */
    private buildDailyCard(d: DailyUpdate, imageId: string, top: number, W: number): number {
        const gm = this.gm;
        const c = this.content;
        const h = 150;
        const y = top - h / 2;
        const p = panel(c, W, h, { fill: P.butter, border: P.ink, shadow: P.gold2, step: Theme.px, shadowDepth: 1.5 }, 0, y);
        sprite(p, gm.textures.icon('calendar', P.ink, P.rose), 40, 36, -W / 2 + 50, 22);
        label(p, `每日挑战 ${fmtDate(gm.daily.todayKey())}`, Theme.font.small, { bold: true, align: 'left' }).node.setPosition(-W / 2 + 86, 30);
        label(p, `今日最佳 ${formatDuration(d.record.bestTimeMs)} · ${d.record.bestMoves} 步 · ${'★'.repeat(d.record.stars)}`, Theme.font.small, { color: P.ink2, align: 'left' }).node.setPosition(-W / 2 + 86, -6);
        label(p, d.streak > 0 ? `已连续完成 ${d.streak} 天${d.isNewRecord && !d.firstClear ? ' · 刷新今日纪录' : ''}` : '', Theme.font.tiny, { color: P.orange3, bold: true, align: 'left' }).node.setPosition(-W / 2 + 86, -40);
        void imageId;
        popIn(p, 0.5);
        return top - h;
    }
}
