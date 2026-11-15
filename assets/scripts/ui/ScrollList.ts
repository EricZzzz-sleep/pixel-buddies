import { _decorator, Component, EventTouch, Mask, Node, UITransform } from 'cc';
import { makeNode } from './UIKit';

const { ccclass } = _decorator;

/**
 * 轻量纵向滚动容器：遮罩 + 拖动 + 惯性 + 边界回弹。
 * 子节点放进 content，调用 setContentHeight() 告知内容高度（content 锚点在顶部）。
 * 子按钮通过“移动超过阈值不算点击”与滚动共存。
 */
@ccclass('ScrollList')
export class ScrollList extends Component {
    content!: Node;
    private viewH = 0;
    private contentH = 0;
    private velocity = 0;
    private dragging = false;
    private lastY = 0;
    private lastT = 0;

    static create(parent: Node, w: number, h: number, x = 0, y = 0): ScrollList {
        const view = makeNode('ScrollView', parent, w, h, x, y);
        const mask = view.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_RECT;
        const list = view.addComponent(ScrollList);
        list.viewH = h;
        list.content = makeNode('Content', view, w, h);
        list.content.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
        list.content.setPosition(0, h / 2);
        view.on(Node.EventType.TOUCH_START, list.onStart, list);
        view.on(Node.EventType.TOUCH_MOVE, list.onMove, list);
        view.on(Node.EventType.TOUCH_END, list.onEnd, list);
        view.on(Node.EventType.TOUCH_CANCEL, list.onEnd, list);
        return list;
    }

    setContentHeight(h: number): void {
        this.contentH = h;
        this.content.getComponent(UITransform)!.height = h;
        this.clamp(true);
    }

    scrollToTop(): void {
        this.velocity = 0;
        this.content.setPosition(0, this.viewH / 2);
    }

    private get minY(): number {
        return this.viewH / 2;
    }
    private get maxY(): number {
        return this.viewH / 2 + Math.max(0, this.contentH - this.viewH);
    }

    private onStart(e: EventTouch): void {
        this.dragging = true;
        this.velocity = 0;
        this.lastY = e.getUILocation().y;
        this.lastT = Date.now();
    }

    private onMove(e: EventTouch): void {
        if (!this.dragging) return;
        const y = e.getUILocation().y;
        const dy = y - this.lastY;
        const now = Date.now();
        const dt = Math.max(1, now - this.lastT);
        this.velocity = (dy / dt) * 1000 * 0.8 + this.velocity * 0.2;
        this.lastY = y;
        this.lastT = now;
        let ny = this.content.position.y + dy;
        // 越界阻尼
        if (ny < this.minY) ny = this.content.position.y + dy * 0.35;
        if (ny > this.maxY) ny = this.content.position.y + dy * 0.35;
        this.content.setPosition(0, ny);
    }

    private onEnd(): void {
        this.dragging = false;
        if (Date.now() - this.lastT > 80) this.velocity = 0;
    }

    private clamp(hard: boolean): void {
        const y = this.content.position.y;
        if (hard) this.content.setPosition(0, Math.min(this.maxY, Math.max(this.minY, y)));
    }

    update(dt: number): void {
        if (this.dragging) return;
        let y = this.content.position.y;
        if (Math.abs(this.velocity) > 5) {
            y += this.velocity * dt;
            this.velocity *= Math.pow(0.05, dt); // 指数衰减
        } else {
            this.velocity = 0;
        }
        // 回弹
        if (y < this.minY) {
            y += (this.minY - y) * Math.min(1, dt * 12);
            this.velocity = 0;
        } else if (y > this.maxY) {
            y += (this.maxY - y) * Math.min(1, dt * 12);
            this.velocity = 0;
        }
        if (y !== this.content.position.y) this.content.setPosition(0, y);
    }
}
