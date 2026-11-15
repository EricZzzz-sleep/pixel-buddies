import { Graphics, Node, NodePool, Sprite, SpriteFrame, tween, Tween, UITransform, Vec3 } from 'cc';
import { P } from '../art/Palette';
import { hex } from '../ui/Theme';
import { makeNode } from '../ui/UIKit';

/**
 * 拼图方块视图（只负责显示与动画，不含规则）。
 * 通过 PiecePool 复用节点，避免每局重复创建。
 */
export class PuzzlePiece {
    readonly node: Node;
    private sprite: Sprite;
    private frameG: Graphics;
    private glowG: Graphics;
    private size = 100;
    pieceId = -1;

    constructor() {
        this.node = makeNode('Piece', null, 100, 100);
        // 方块阴影/描边层
        const back = makeNode('Back', this.node, 100, 100);
        this.frameG = back.addComponent(Graphics);
        const sp = makeNode('Img', this.node, 100, 100);
        this.sprite = sp.addComponent(Sprite);
        this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        const glow = makeNode('Glow', this.node, 100, 100);
        this.glowG = glow.addComponent(Graphics);
    }

    setup(frame: SpriteFrame, size: number, pieceId: number): void {
        this.pieceId = pieceId;
        this.sprite.spriteFrame = frame;
        this.resize(size);
        this.setGlow('none');
        this.node.setScale(1, 1, 1);
        this.node.angle = 0;
    }

    resize(size: number, drawFrame = true): void {
        this.size = size;
        this.node.getComponent(UITransform)!.setContentSize(size, size);
        this.sprite.node.getComponent(UITransform)!.setContentSize(size, size);
        this.frameG.clear();
        if (drawFrame) {
            // 底部投影，增加“方块”实体感
            this.frameG.fillColor = hex(P.ink, 70);
            this.frameG.rect(-size / 2 + 2, -size / 2 - 4, size, size);
            this.frameG.fill();
        }
    }

    /** 高亮：selected（选中，粉色）、hint（提示，金色）、target（拖动目标，薄荷绿）、correct（归位闪光） */
    setGlow(kind: 'none' | 'selected' | 'hint' | 'target' | 'correct' | 'dest'): void {
        const g = this.glowG;
        g.clear();
        if (kind === 'none') return;
        // selected 粉：你拿起的方块；dest 绿：它应该去的位置；target 蓝：拖动时悬停的格子；hint 金：提示脉冲
        const color = kind === 'selected' ? P.rose : kind === 'dest' ? P.mint3 : kind === 'hint' ? P.gold : kind === 'target' ? P.blue : P.white;
        const s = this.size;
        const w = kind === 'correct' ? 6 : kind === 'dest' ? 8 : 5;
        g.fillColor = hex(color, kind === 'correct' ? 200 : 255);
        g.rect(-s / 2, s / 2 - w, s, w);
        g.rect(-s / 2, -s / 2, s, w);
        g.rect(-s / 2, -s / 2 + w, w, s - w * 2);
        g.rect(s / 2 - w, -s / 2 + w, w, s - w * 2);
        g.fill();
        if (kind === 'dest') {
            g.fillColor = hex(P.mint, 70);
            g.rect(-s / 2 + w, -s / 2 + w, s - w * 2, s - w * 2);
            g.fill();
        }
        if (kind === 'correct') {
            g.fillColor = hex(P.white, 90);
            g.rect(-s / 2 + w, -s / 2 + w, s - w * 2, s - w * 2);
            g.fill();
        }
    }

    stopTweens(): void {
        Tween.stopAllByTarget(this.node);
    }

    moveTo(pos: Vec3, duration = 0.18, onDone?: () => void): void {
        Tween.stopAllByTarget(this.node);
        tween(this.node)
            .to(duration, { position: pos, scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
            .call(() => onDone && onDone())
            .start();
    }

    /** 归位：轻微弹跳 + 白光一闪 */
    bounce(): void {
        this.setGlow('correct');
        tween(this.node)
            .to(0.08, { scale: new Vec3(1.12, 1.12, 1) })
            .to(0.14, { scale: new Vec3(0.96, 0.96, 1) })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .call(() => this.setGlow('none'))
            .start();
    }

    /** 已锁定方块被拖动时左右轻摇 */
    wiggle(): void {
        Tween.stopAllByTarget(this.node);
        this.node.angle = 0;
        tween(this.node).to(0.05, { angle: 6 }).to(0.08, { angle: -6 }).to(0.06, { angle: 3 }).to(0.05, { angle: 0 }).start();
    }

    /** 持续轻微呼吸（目标位置提示）；关闭时恢复原大小 */
    pulseLoop(on: boolean): void {
        Tween.stopAllByTarget(this.node);
        this.node.setScale(1, 1, 1);
        if (!on) return;
        tween(this.node)
            .repeatForever(tween().to(0.45, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'sineInOut' }).to(0.45, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' }))
            .start();
    }

    /** 提示脉冲 */
    pulse(times = 3): void {
        this.setGlow('hint');
        let t = tween(this.node);
        for (let i = 0; i < times; i++) t = t.to(0.18, { scale: new Vec3(1.08, 1.08, 1) }).to(0.18, { scale: new Vec3(1, 1, 1) });
        t.call(() => this.setGlow('none')).start();
    }
}

/** 方块对象池 */
export class PiecePool {
    private pool = new NodePool();
    private map = new Map<Node, PuzzlePiece>();

    get(): PuzzlePiece {
        const n = this.pool.get();
        if (n) return this.map.get(n)!;
        const p = new PuzzlePiece();
        this.map.set(p.node, p);
        return p;
    }

    put(p: PuzzlePiece): void {
        p.stopTweens();
        this.pool.put(p.node);
    }
}
