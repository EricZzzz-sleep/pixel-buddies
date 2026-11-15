import { Graphics, Node, NodePool, tween, Vec3 } from 'cc';
import { P } from '../art/Palette';
import { hex } from './Theme';
import { makeNode, opacityOf } from './UIKit';

const CONFETTI_COLORS = [P.rose, P.mint3, P.yellow, P.blue, P.lilac2, P.peach2, P.pink2];

/**
 * 轻量特效：像素纸屑、闪光星。全部使用对象池，数量有上限，低端机也不会卡。
 */
export class Effects {
    private pool = new NodePool();
    private active = 0;
    static readonly MAX = 80;

    constructor(private readonly layer: Node) {}

    private take(color: number, size: number): Node | null {
        if (this.active >= Effects.MAX) return null;
        let n = this.pool.get();
        if (!n) {
            n = makeNode('Fx', null, 16, 16);
            n.addComponent(Graphics);
        }
        const g = n.getComponent(Graphics)!;
        g.clear();
        g.fillColor = hex(color);
        g.rect(-size / 2, -size / 2, size, size);
        g.fill();
        this.layer.addChild(n);
        opacityOf(n).opacity = 255;
        n.setScale(1, 1, 1);
        n.angle = 0;
        this.active++;
        return n;
    }

    private give(n: Node): void {
        this.active = Math.max(0, this.active - 1);
        this.pool.put(n);
    }

    /** 方块归位时的小星星迸发 */
    burst(x: number, y: number, count = 6, color = P.white): void {
        for (let i = 0; i < count; i++) {
            const n = this.take(i % 2 ? color : P.yellow, 8);
            if (!n) return;
            const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
            const d = 50 + Math.random() * 30;
            n.setPosition(x, y, 0);
            tween(n)
                .to(0.35, { position: new Vec3(x + Math.cos(a) * d, y + Math.sin(a) * d, 0), scale: new Vec3(0.3, 0.3, 1) }, { easing: 'quadOut' })
                .call(() => this.give(n))
                .start();
        }
    }

    /** 完成庆祝：从顶部撒落像素纸屑 */
    confetti(width: number, top: number, bottom: number, count = 50): void {
        for (let i = 0; i < count; i++) {
            const n = this.take(CONFETTI_COLORS[i % CONFETTI_COLORS.length], 10 + (i % 3) * 4);
            if (!n) return;
            const x = (Math.random() - 0.5) * width;
            n.setPosition(x, top + Math.random() * 120, 0);
            const dur = 1.4 + Math.random() * 1.0;
            tween(n)
                .delay(Math.random() * 0.4)
                .to(dur, { position: new Vec3(x + (Math.random() - 0.5) * 160, bottom, 0), angle: (Math.random() - 0.5) * 720 }, { easing: 'quadIn' })
                .call(() => this.give(n))
                .start();
            tween(opacityOf(n)).delay(dur * 0.7).to(dur * 0.5, { opacity: 0 }).start();
        }
    }

    /** 三星特效：一圈旋转的金色光点 */
    ring(x: number, y: number, radius: number, count = 16): void {
        for (let i = 0; i < count; i++) {
            const n = this.take(i % 2 ? P.yellow : P.white, 12);
            if (!n) return;
            const a = (i / count) * Math.PI * 2;
            n.setPosition(x, y, 0);
            tween(n)
                .to(0.5, { position: new Vec3(x + Math.cos(a) * radius, y + Math.sin(a) * radius, 0) }, { easing: 'backOut' })
                .delay(0.3)
                .to(0.4, { position: new Vec3(x + Math.cos(a) * radius * 1.4, y + Math.sin(a) * radius * 1.4, 0), scale: new Vec3(0, 0, 1) })
                .call(() => this.give(n))
                .start();
        }
    }
}
