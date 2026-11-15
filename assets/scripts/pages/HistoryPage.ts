import { Node } from 'cc';
import { getArt } from '../art/ArtCatalog';
import { P } from '../art/Palette';
import { DIFFICULTIES } from '../config/GameConfig';
import { formatDuration } from '../core/GameTimer';
import { BoardResult } from '../social/LeaderboardService';
import { ChallengeLog } from '../storage/SaveSchema';
import { ScrollList } from '../ui/ScrollList';
import { Theme } from '../ui/Theme';
import { button, label, panel } from '../ui/UIKit';
import { BasePage } from './BasePage';
import { artFrame, Flow, fmtDateTime } from './PageKit';

/** 挑战记录与排行：本地好友挑战历史（可再战）+ 今日榜（本机/服务器 明确标注是否已验证） */
export class HistoryPage extends BasePage {
    private list!: ScrollList;
    private token = 0;

    protected build(): void {
        const L = this.L;
        this.header('挑战记录');
        const top = L.contentTop - 6;
        const bottom = -L.h / 2 + L.safeBottom + 10;
        this.list = ScrollList.create(this.root, L.w, top - bottom, 0, (top + bottom) / 2);
    }

    onEnter(): void {
        this.refresh(null);
        const my = ++this.token;
        const key = this.gm.daily.todayKey();
        this.gm.leaderboard.fetch('daily', key).then((r) => {
            if (my === this.token && this.sm.currentName === 'history') this.refresh(r);
        });
    }

    private refresh(board: BoardResult | null): void {
        const gm = this.gm;
        const W = this.L.w - Theme.gutter * 2;
        const c = this.list.content;
        c.destroyAllChildren();
        let y = -14;

        // ---- 今日榜
        y = this.boardCard(c, W, y, board);

        // ---- 挑战历史
        label(c, '好友挑战记录', Theme.font.body, { bold: true, align: 'left', width: W }).node.setPosition(-W / 2, y - 16);
        y -= 46;
        const logs = gm.challenges.recent();
        if (!logs.length) {
            const e = panel(c, W, 150, { fill: P.white, border: P.cream3, shadow: undefined, step: Theme.px }, 0, y - 75);
            label(e, '还没有挑战记录\n发起一场好友挑战，成绩会保存在这里', Theme.font.small, { color: Theme.textMuted, width: W - 60, wrap: true });
            y -= 166;
            button(c, { w: W, h: 88, text: '去发起挑战', style: 'primary', onClick: () => this.sm.go('challenge') }, 0, y - 44);
            y -= 104;
        }
        logs.forEach((l) => {
            y = this.logRow(c, W, y, l);
        });
        label(c, '记录只保存在本机，成绩来自分享卡片，未经服务器验证。', Theme.font.tiny, { color: Theme.textMuted, width: W, wrap: true }).node.setPosition(0, y - 20);
        this.list.setContentHeight(-y + 60);
        this.list.scrollToTop();
    }

    private boardCard(c: Node, W: number, y: number, b: BoardResult | null): number {
        const gm = this.gm;
        const rows = b ? Math.max(1, Math.min(b.entries.length, 5)) : 1;
        const h = 150 + rows * 54;
        const p = panel(c, W, h, { fill: P.white, border: P.ink, shadow: P.blue2, step: Theme.px, shadowDepth: 2 }, 0, y - h / 2);
        label(p, `今日挑战榜 ${gm.daily.todayKey().slice(5)}`, Theme.font.body, { bold: true, align: 'left', width: W - 260 }).node.setPosition(-W / 2 + 30, h / 2 - 36);
        const verified = !!b && b.verified;
        const tag = panel(p, 200, 44, { fill: verified ? P.mint : P.butter, border: P.ink, shadow: undefined, step: 3 }, W / 2 - 126, h / 2 - 36);
        label(tag, b ? (verified ? '服务器已验证' : b.source === 'server' ? '服务器 · 未验证' : '仅本机 · 未验证') : '加载中…', Theme.font.tiny, { bold: true });
        if (!b) return y - h - 20;
        if (!b.entries.length) label(p, '今天还没有成绩，去完成每日挑战吧', Theme.font.small, { color: Theme.textMuted, width: W - 60 }).node.setPosition(0, 10);
        b.entries.slice(0, 5).forEach((e, i) => {
            const ey = h / 2 - 100 - i * 54;
            label(p, `${e.rank}`, Theme.font.body, { bold: true, color: P.rose2, width: 50 }).node.setPosition(-W / 2 + 56, ey);
            label(p, e.name, Theme.font.small, { bold: e.isMe, align: 'left', width: 260 }).node.setPosition(-W / 2 + 90, ey);
            label(p, `${formatDuration(e.timeMs)} · ${e.moves} 步`, Theme.font.small, { align: 'right', width: 300, bold: true }).node.setPosition(W / 2 - 30, ey);
        });
        label(p, b.note, Theme.font.tiny, { color: Theme.textMuted, width: W - 50, wrap: true }).node.setPosition(0, -h / 2 + 30);
        return y - h - 22;
    }

    private logRow(c: Node, W: number, y: number, l: ChallengeLog): number {
        const gm = this.gm;
        const art = getArt(l.imageId);
        const h = 150;
        const p = panel(c, W, h, { fill: P.white, border: P.cream3, shadow: Theme.shadow, step: Theme.px, shadowDepth: 1.5 }, 0, y - h / 2);
        if (art) artFrame(p, gm.textures.art(art.id), 96, -W / 2 + 76, 0, art.tint);
        const x0 = -W / 2 + 150;
        label(p, `${l.kind !== 'received' ? '我发起' : '我接受'} · ${art ? art.name : '像素拼图'} ${DIFFICULTIES[l.grid as 3 | 4 | 5 | 6].desc}`, Theme.font.small, { bold: true, align: 'left', width: W - 330 }).node.setPosition(x0, h / 2 - 32);
        const mine = l.myTimeMs > 0 ? `我 ${formatDuration(l.myTimeMs)} · ${l.myMoves}步` : '我 --';
        const theirs = l.theirTimeMs > 0 ? `好友 ${formatDuration(l.theirTimeMs)} · ${l.theirMoves}步` : l.kind !== 'received' ? '等待好友挑战' : '好友 --';
        label(p, mine, Theme.font.tiny, { bold: true, align: 'left', width: W - 330 }).node.setPosition(x0, h / 2 - 66);
        label(p, theirs, Theme.font.tiny, { color: P.ink2, align: 'left', width: W - 330 }).node.setPosition(x0, h / 2 - 94);
        label(p, fmtDateTime(l.at), Theme.font.tiny, { color: Theme.textMuted, align: 'left', width: W - 330 }).node.setPosition(x0, h / 2 - 122);
        let outcome = '';
        if (l.theirTimeMs > 0 && l.myTimeMs > 0) outcome = l.myTimeMs < l.theirTimeMs ? '胜' : l.myTimeMs > l.theirTimeMs ? '负' : '平';
        if (outcome) {
            const chip = panel(p, 60, 50, { fill: outcome === '胜' ? P.mint : outcome === '负' ? P.pink : P.butter, border: P.ink, shadow: undefined, step: 3 }, W / 2 - 52, h / 2 - 34);
            label(chip, outcome, Theme.font.body, { bold: true });
        }
        button(p, { w: 150, h: 62, text: l.kind !== 'received' ? '再拼一次' : '再战', style: 'sky', fontSize: Theme.font.small, onClick: () => { Flow.challengeAccept(l.code); } }, W / 2 - 100, -h / 2 + 42);
        return y - h - 16;
    }
}
