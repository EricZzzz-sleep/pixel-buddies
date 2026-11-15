import { BlockInputEvents, Graphics, Label, Node, tween, Tween, Vec3 } from 'cc';
import { P } from '../art/Palette';
import { DIFFICULTIES } from '../config/GameConfig';
import { formatDuration } from '../core/GameTimer';
import { PlaySession, ResultPayload } from '../core/GameManager';
import { PuzzleBoard } from '../puzzle/PuzzleBoard';
import { PuzzleManager, SwapOutcome } from '../puzzle/PuzzleManager';
import { computeStars } from '../puzzle/PuzzleScoring';
import { Effects } from '../ui/Effects';
import { hex, Theme } from '../ui/Theme';
import { Ticker } from '../ui/Ticker';
import { button, ButtonHandle, label, makeNode, opacityOf, panel, sprite } from '../ui/UIKit';
import { BasePage } from './BasePage';

const MODE_TAG: Record<PlaySession['mode'], string> = {
    classic: '经典',
    daily: '每日挑战',
    'challenge-create': '发起挑战',
    'challenge-accept': '好友挑战',
};

/**
 * 游戏进行页：HUD（时间/步数/三星剩余时间/进度）+ 拼图板 + 工具栏（原图/提示/撤销）。
 * 计时从第一次触碰有效方块开始；暂停、进入后台都会冻结计时。
 */
export class GamePage extends BasePage {
    private board!: PuzzleBoard;
    private pm: PuzzleManager | null = null;
    private session: PlaySession | null = null;
    private titleLabel!: Label;
    private tagLabel!: Label;
    private timeLabel!: Label;
    private movesLabel!: Label;
    private goalLabel!: Label;
    private progressLabel!: Label;
    private progressBar!: Graphics;
    private progressW = 0;
    private hintBtn!: ButtonHandle;
    private undoBtn!: ButtonHandle;
    private peekBtn!: ButtonHandle;
    private fx!: Effects;
    private lastShownSecond = -1;
    private paused = false;
    private finishing = false;
    private tutorialNode: Node | null = null;

    protected build(): void {
        const L = this.L;
        const gm = this.gm;
        const W = L.w - Theme.gutter * 2;

        // 头部：暂停 + 标题
        button(this.root, { w: 84, h: 72, style: 'white', icon: gm.textures.icon('pause', P.ink), iconSize: 26, onClick: () => this.openPause() }, -L.w / 2 + Theme.gutter + 42, L.headerY);
        this.titleLabel = label(this.root, '', Theme.font.h2, { bold: true, width: 360 });
        this.titleLabel.node.setPosition(0, L.headerY + 14);
        this.tagLabel = label(this.root, '', Theme.font.tiny, { color: Theme.textMuted, width: 360 });
        this.tagLabel.node.setPosition(0, L.headerY - 22);

        // HUD 三个数据块
        // 纵向自适应：棋盘受宽度限制，高屏多出的空间平分到 HUD 上下，避免棋盘上下大块留白
        const toolY = -L.h / 2 + L.safeBottom + 24 + 56;
        const progY = toolY + 52 + 44;
        const baseHud = L.contentTop - 46;
        const spare = Math.max(0, baseHud - 38 - 24 - (progY + 48) - (W + 8));
        const hudY = baseHud - spare * 0.3;
        const bw = (W - 24) / 3;
        const mk = (i: number, icon: string, color: number, fill: number) => {
            const p = panel(this.root, bw, 76, { fill, border: P.ink, shadow: P.ink, step: Theme.px, shadowDepth: 1 }, -W / 2 + bw / 2 + i * (bw + 12), hudY);
            sprite(p, gm.textures.icon(icon, color, P.white), 28, 28, -bw / 2 + 34, 0);
            const l = label(p, '', Theme.font.body, { bold: true, width: bw - 70 });
            l.node.setPosition(20, 0);
            return l;
        };
        this.timeLabel = mk(0, 'clock', P.blue3, P.sky);
        this.movesLabel = mk(1, 'steps', P.leaf3, P.mint);
        this.goalLabel = mk(2, 'star', P.gold2, P.butter);
        this.goalLabel.fontSize = Theme.font.small;

        // 工具栏
        const tw = (W - 32) / 3;
        this.peekBtn = button(this.root, { w: tw, h: 104, text: '按住看原图', fontSize: Theme.font.small, style: 'sky', icon: gm.textures.icon('eye', P.blue3, P.white), iconSize: 40, iconTop: true }, -W / 2 + tw / 2, toolY);
        this.hintBtn = button(this.root, { w: tw, h: 104, text: '提示', fontSize: Theme.font.small, style: 'butter', icon: gm.textures.icon('bulb', P.gold2, P.white), iconSize: 40, iconTop: true, onClick: () => this.useHint() }, 0, toolY);
        this.undoBtn = button(this.root, { w: tw, h: 104, text: '撤销', fontSize: Theme.font.small, style: 'lilac', icon: gm.textures.icon('undo', P.purple2, P.white), iconSize: 40, iconTop: true, onClick: () => this.undo() }, W / 2 - tw / 2, toolY);
        // 原图：按住显示，松开隐藏
        this.peekBtn.node.on(Node.EventType.TOUCH_START, () => this.setPeek(true));
        this.peekBtn.node.on(Node.EventType.TOUCH_END, () => this.setPeek(false));
        this.peekBtn.node.on(Node.EventType.TOUCH_CANCEL, () => this.setPeek(false));

        // 进度条（工具栏上方）
        this.progressW = W;
        this.progressLabel = label(this.root, '', Theme.font.tiny, { color: P.ink2, bold: true, align: 'left' });
        this.progressLabel.node.setPosition(-W / 2, progY + 22);
        const bar = makeNode('Progress', this.root, W, 16, 0, progY);
        this.progressBar = bar.addComponent(Graphics);

        // 棋盘：在 HUD 与进度条之间取最大正方形
        const areaTop = hudY - 38 - 24;
        const areaBottom = progY + 48;
        const boardSize = Math.min(W + 8, areaTop - areaBottom);
        this.board = new PuzzleBoard(this.root, boardSize, gm.textures, {
            onFirstTouch: () => this.pm && this.pm.notifyInteraction(),
            onPick: () => gm.audio.play('pick', 0.6),
            onSwap: (o, a, b) => this.onSwap(o, a, b),
            onLockedTouch: () => gm.audio.play('error', 0.5),
        });
        this.board.node.setPosition(0, (areaTop + areaBottom) / 2);

        const fxLayer = makeNode('Fx', this.root, L.w, L.h);
        this.fx = new Effects(fxLayer);

        const ticker = this.root.addComponent(Ticker);
        ticker.cb = () => this.tick();
    }

    onEnter(session: PlaySession): void {
        if (!session) return;
        const gm = this.gm;
        this.session = session;
        this.paused = false;
        this.finishing = false;
        this.lastShownSecond = -1;
        this.pm = new PuzzleManager(session.spec);
        this.board.start(this.pm);
        this.board.setEnabled(true);
        const art = this.gm.resolveArt(session.spec.imageId);
        this.titleLabel.string = art ? art.name : '像素拼图';
        const d = DIFFICULTIES[session.spec.grid];
        this.tagLabel.string = `${MODE_TAG[session.mode]} · ${d.label} ${d.desc}`;
        gm.collection.recordPlayStarted();
        gm.analytics.track('puzzle_start', { mode: session.mode, image: session.spec.imageId, grid: session.spec.grid });
        this.refreshHud(true);
        if (!gm.save.data.tutorial.puzzleBasics) this.showTutorial();
    }

    onExit(): void {
        this.setPeek(false);
        this.closeTutorial();
        // 离开时归还方块到对象池；作品纹理保留（收藏册等仍会用到）
        this.board.clear();
        this.gm.textures.releasePrefix('piece:');
        this.pm = null;
    }

    onBack(): boolean {
        if (this.pm && !this.pm.finished) {
            this.openPause();
            return true;
        }
        return false;
    }

    onAppHide(): void {
        // 进入后台：冻结计时并弹出暂停面板，回来时由玩家主动继续
        if (this.pm && !this.pm.finished && !this.paused) this.openPause();
    }

    // ------------------------------------------------------------ 操作

    private onSwap(o: SwapOutcome, a: number, b: number): void {
        const gm = this.gm;
        gm.audio.play('swap', 0.6);
        if (o.newlyCorrectCells.length) {
            this.scheduleCall(0.14, () => gm.audio.play('correct', 0.7));
            gm.vibrate();
            for (const c of o.newlyCorrectCells) {
                const p = this.board.celebrateCell(c);
                const bp = this.board.node.position;
                this.scheduleCall(0.16, () => this.fx.burst(bp.x + p.x, bp.y + p.y, 6));
            }
        }
        this.refreshHud(true);
        if (o.solved) this.finish();
    }

    private useHint(): void {
        const gm = this.gm;
        if (!this.pm || this.pm.finished) return;
        if (this.pm.hintsLeft <= 0) {
            if (gm.ads.isRewardedAvailable()) {
                this.sm.confirm('提示用完啦', '观看一段激励视频，可获得 1 次额外提示（不看也不影响继续游戏）。', [
                    { text: '不用了', style: 'secondary' },
                    { text: '看视频', style: 'primary', onClick: () => this.rewardHint() },
                ]);
            } else {
                this.sm.toast('本局免费提示已用完，试试“按住看原图”吧');
            }
            return;
        }
        const h = this.pm.useHint();
        if (!h) return;
        gm.audio.play('pick', 0.7);
        this.board.showHint(h.fromCell, h.toCell);
        gm.analytics.track('hint', { left: this.pm.hintsLeft });
        this.refreshHud(true);
    }

    /** 激励视频换提示（仅在广告真实接入且玩家主动选择时调用） */
    private rewardHint(): void {
        this.pauseTimer(true);
        this.gm.ads.showRewarded('extra_hint').then((r) => {
            this.pauseTimer(false);
            this.sm.toast(r.message);
            if (r.status === 'rewarded' && this.pm) {
                this.pm.grantExtraHint(1);
                this.refreshHud(true);
            }
        });
    }

    private undo(): void {
        if (!this.pm) return;
        const r = this.pm.undo();
        if (!r) {
            this.sm.toast('没有可以撤销的操作');
            return;
        }
        this.gm.audio.play('swap', 0.5);
        this.board.applyVisualSwap(r[0], r[1], 0.18);
        this.refreshHud(true);
    }

    private setPeek(show: boolean): void {
        if (!this.pm || this.pm.finished) {
            this.board.setPeek(false);
            return;
        }
        if (show) this.pm.recordPeek();
        this.board.setPeek(show);
    }

    private pauseTimer(p: boolean): void {
        if (!this.pm) return;
        if (p) this.pm.pause();
        else this.pm.resume();
    }

    private openPause(): void {
        if (!this.pm || this.pm.finished || this.paused) return;
        this.paused = true;
        this.pauseTimer(true);
        this.refreshHud(true);
        this.board.setEnabled(false);
        const w = Math.min(this.L.w - 80, 560);
        const h = 560;
        const card = this.sm.openModal(w, h, { closeOnMask: false, onClose: () => this.resumeFromPause() });
        const t = label(card, '休息一下', Theme.font.title, { bold: true });
        t.node.setPosition(0, h / 2 - 70);
        const info = label(card, `已用时 ${formatDuration(this.pm.timer.elapsedMs)} · ${this.pm.moves} 步\n计时已暂停`, Theme.font.small, { color: P.ink2, width: w - 60, wrap: true });
        info.node.setPosition(0, h / 2 - 140);
        button(card, { w: w - 100, h: 96, text: '继续拼图', style: 'primary', icon: this.gm.textures.icon('play', P.white), onClick: () => this.sm.closeModal() }, 0, 10);
        button(card, { w: w - 100, h: 88, text: '重新开始', style: 'secondary', icon: this.gm.textures.icon('refresh', P.ink), onClick: () => this.restart() }, 0, -100);
        button(card, { w: w - 100, h: 88, text: '返回首页', style: 'ghost', onClick: () => this.quit() }, 0, -200);
    }

    private resumeFromPause(): void {
        this.paused = false;
        if (this.pm && !this.pm.finished) {
            this.pauseTimer(false);
            this.board.setEnabled(true);
        }
    }

    private restart(): void {
        if (!this.session) return;
        this.sm.closeAllModals();
        this.paused = false;
        const s = this.session;
        this.board.clear();
        // 经典模式重新打乱；每日/挑战模式必须保持同一道题
        const spec = s.mode === 'classic' ? { ...s.spec, seed: (Math.random() * 0xffffffff) >>> 0 } : s.spec;
        this.onEnter({ ...s, spec });
    }

    private quit(): void {
        this.sm.closeAllModals();
        this.paused = false;
        this.gm.save.flush();
        this.sm.home();
    }

    private finish(): void {
        if (!this.pm || !this.session || this.finishing) return;
        this.finishing = true;
        const gm = this.gm;
        const result = this.pm.getResult();
        this.board.setEnabled(false);
        this.scheduleCall(0.25, () => {
            this.board.playSolved();
            gm.audio.play('complete', 0.9);
        });
        const bp = this.board.node.position;
        this.scheduleCall(0.6, () => this.fx.confetti(this.L.w, this.L.h / 2, bp.y - 200, 46));
        gm.analytics.track('puzzle_complete', { mode: this.session.mode, grid: result.grid, time: Math.round(result.timeMs / 1000), moves: result.moves });
        const payload: ResultPayload = { session: this.session, result };
        this.scheduleCall(1.6, () => this.sm.go('result', payload, { replace: true }));
    }

    // ------------------------------------------------------------ HUD

    private tick(): void {
        if (!this.pm || this.paused) return;
        const sec = Math.floor(this.pm.timer.elapsedMs / 1000);
        if (sec !== this.lastShownSecond) {
            this.lastShownSecond = sec;
            this.refreshHud(false);
        }
    }

    private refreshHud(full: boolean): void {
        const pm = this.pm;
        if (!pm) return;
        const ms = pm.timer.elapsedMs;
        this.timeLabel.string = formatDuration(ms);
        // “显示剩余时间”：距离三星时间上限还剩多少
        const s = computeStars({ grid: pm.spec.grid, timeMs: ms, moves: pm.moves, hintsUsed: pm.hintsUsed, optimalMoves: pm.optimalMoves });
        const left = s.threeStarSeconds * 1000 - ms;
        this.goalLabel.string = left > 0 ? `三星 ${formatDuration(left)}` : `${s.stars} 星进行中`;
        if (!full) return;
        this.movesLabel.string = `${pm.moves} 步`;
        this.hintBtn.setText(`提示 ×${pm.hintsLeft}`);
        this.undoBtn.setEnabled(pm.canUndo);
        const done = pm.correctCount;
        this.progressLabel.string = `已归位 ${done}/${pm.n}`;
        const g = this.progressBar;
        g.clear();
        g.fillColor = hex(P.cream3);
        g.rect(-this.progressW / 2, -8, this.progressW, 16);
        g.fill();
        g.fillColor = hex(P.rose);
        g.rect(-this.progressW / 2, -8, (this.progressW * done) / pm.n, 16);
        g.fill();
        g.fillColor = hex(P.pink2);
        g.rect(-this.progressW / 2, 2, (this.progressW * done) / pm.n, 4);
        g.fill();
    }

    // ------------------------------------------------------------ 新手教程

    private showTutorial(): void {
        const gm = this.gm;
        this.pauseTimer(true);
        const L = this.L;
        const node = makeNode('Tutorial', this.root, L.fullW, L.fullH);
        node.addComponent(BlockInputEvents);
        const dim = node.addComponent(Graphics);
        dim.fillColor = hex(P.ink, 110);
        dim.rect(-L.fullW / 2, -L.fullH / 2, L.fullW, L.fullH);
        dim.fill();
        const bp = this.board.node.position;
        const c0 = this.board.center(0), c1 = this.board.center(Math.min(5, this.pm!.n - 1));
        const hand = sprite(node, gm.textures.icon('hand', P.ink, P.white), 64, 64, bp.x + c0.x + 20, bp.y + c0.y - 20).node;
        tween(hand)
            .repeatForever(
                tween(hand)
                    .set({ position: new Vec3(bp.x + c0.x + 20, bp.y + c0.y - 20, 0) })
                    .to(0.2, { scale: new Vec3(0.85, 0.85, 1) })
                    .to(0.8, { position: new Vec3(bp.x + c1.x + 20, bp.y + c1.y - 20, 0) }, { easing: 'sineInOut' })
                    .to(0.2, { scale: new Vec3(1, 1, 1) })
                    .delay(0.4),
            )
            .start();
        const cardY = -L.h / 2 + L.safeBottom + 220;
        const card = panel(node, L.w - 80, 260, { fill: P.cream, border: P.ink, shadow: P.ink, step: Theme.px, shadowDepth: 2 }, 0, cardY);
        label(card, '玩法小提示', Theme.font.h2, { bold: true }).node.setPosition(0, 86);
        const tip = label(card, '按住方块拖到另一个方块上就能交换位置，\n也可以先点一块、再点另一块。\n放对的方块会锁定，全部归位就完成啦！', Theme.font.small, { color: P.ink2, width: L.w - 140, wrap: true });
        tip.node.setPosition(0, 10);
        button(card, {
            w: 260,
            h: 80,
            text: '知道啦',
            style: 'primary',
            onClick: () => {
                gm.save.mutate((d) => (d.tutorial.puzzleBasics = true), true);
                this.closeTutorial();
            },
        }, 0, -86);
        this.tutorialNode = node;
        opacityOf(node).opacity = 0;
        tween(opacityOf(node)).to(0.2, { opacity: 255 }).start();
    }

    private closeTutorial(): void {
        if (!this.tutorialNode) return;
        this.tutorialNode.children.forEach((c) => Tween.stopAllByTarget(c));
        this.tutorialNode.destroy();
        this.tutorialNode = null;
        // 教程期间未开始计时，这里无需恢复（计时从第一次触碰开始）
        if (this.pm && this.pm.timer.started) this.pauseTimer(false);
    }

    private scheduleCall(delay: number, fn: () => void): void {
        tween(this.root).delay(delay).call(fn).start();
    }
}
