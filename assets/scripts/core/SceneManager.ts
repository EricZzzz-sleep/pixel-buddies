import { BlockInputEvents, Graphics, Node, tween, Tween, Vec3 } from 'cc';
import { P } from '../art/Palette';
import type { BasePage, PageName } from '../pages/BasePage';
import { Theme } from '../ui/Theme';
import { button, ButtonStyle, label, makeNode, opacityOf, panel, UIHooks } from '../ui/UIKit';
import { hex } from '../ui/Theme';

/**
 * 页面管理（单场景多页面）。
 * 小游戏上切换场景需要重新加载资源、有白屏风险；这里采用单场景 + 页面节点切换，
 * 配合淡入 + 轻微位移的过渡动画，切换更快更流畅。
 * 同时提供全局浮层：Toast 提示与确认弹窗。
 */
export class SceneManager {
    private pages = new Map<PageName, BasePage>();
    private stack: PageName[] = [];
    private current: BasePage | null = null;
    private toastNode: Node | null = null;
    private modalStack: Node[] = [];
    /** 每次进入页面后回调（用于按页面切换背景音乐等） */
    onPageEnter: ((name: PageName, params: any) => void) | null = null;

    constructor(readonly pageLayer: Node, readonly overlayLayer: Node, private readonly viewW: number, private readonly viewH: number) {}

    register(page: BasePage): void {
        this.pages.set(page.name, page);
    }

    get currentName(): PageName | null {
        return this.current ? this.current.name : null;
    }

    getPage<T extends BasePage>(name: PageName): T {
        return this.pages.get(name) as T;
    }

    /**
     * 跳转页面。
     * @param replace true：替换当前页（不可返回到当前页），用于 游戏 → 结算
     * @param reset true：清空栈（回到首页）
     */
    go(name: PageName, params?: any, opts: { replace?: boolean; reset?: boolean; back?: boolean } = {}): void {
        const next = this.pages.get(name);
        if (!next) {
            console.error(`[SceneManager] 未注册页面 ${name}`);
            return;
        }
        const prev = this.current;
        if (opts.reset) this.stack = [];
        else if (opts.replace && this.stack.length) this.stack.pop();
        if (!opts.back) this.stack.push(name);

        next.ensureBuilt();
        if (prev && prev !== next) prev.onExit();
        if (!next.root.parent) this.pageLayer.addChild(next.root);
        next.root.active = true;
        next.root.setSiblingIndex(this.pageLayer.children.length - 1);
        next.onEnter(params);
        this.current = next;
        if (this.onPageEnter) {
            try {
                this.onPageEnter(name, params);
            } catch (e) {
                console.warn('[SceneManager] onPageEnter 出错', e);
            }
        }

        // 过渡：新页面淡入 + 轻微位移；旧页面淡出后隐藏
        UIHooks.inputLocked = true;
        const dir = opts.back ? -1 : 1;
        const op = opacityOf(next.root);
        Tween.stopAllByTarget(op);
        Tween.stopAllByTarget(next.root);
        op.opacity = prev ? 0 : 255;
        next.root.setPosition(prev ? 24 * dir : 0, 0, 0);
        tween(op).to(0.2, { opacity: 255 }).start();
        tween(next.root)
            .to(0.24, { position: new Vec3(0, 0, 0) }, { easing: 'quadOut' })
            .call(() => (UIHooks.inputLocked = false))
            .start();
        if (prev && prev !== next) {
            const pop = opacityOf(prev.root);
            Tween.stopAllByTarget(pop);
            tween(pop)
                .to(0.16, { opacity: 0 })
                .call(() => {
                    if (this.current !== prev) prev.root.active = false;
                })
                .start();
        }
        if (!prev) UIHooks.inputLocked = false;
    }

    back(): void {
        if (this.modalStack.length) {
            this.closeModal();
            return;
        }
        if (this.current && this.current.onBack()) return;
        if (this.stack.length <= 1) {
            if (this.currentName !== 'home') this.go('home', undefined, { reset: true });
            return;
        }
        this.stack.pop();
        const target = this.stack[this.stack.length - 1];
        this.go(target, undefined, { back: true });
    }

    home(): void {
        this.closeAllModals();
        this.go('home', undefined, { reset: true });
    }

    notifyAppHide(): void {
        if (this.current) this.current.onAppHide();
    }

    // ------------------------------------------------------------ 浮层

    toast(text: string, duration = 1.8): void {
        if (this.toastNode && this.toastNode.isValid) {
            Tween.stopAllByTarget(this.toastNode);
            Tween.stopAllByTarget(opacityOf(this.toastNode));
            this.toastNode.destroy();
        }
        const w = Math.min(this.viewW - 80, Math.max(260, text.length * 26 + 80));
        const n = panel(this.overlayLayer, w, 76, { fill: P.ink, shadow: undefined, step: Theme.px, alpha: 235 }, 0, -this.viewH * 0.18);
        label(n, text, Theme.font.small, { color: 0xffffff, width: w - 40 });
        this.toastNode = n;
        const op = opacityOf(n);
        op.opacity = 0;
        n.setScale(0.9, 0.9, 1);
        tween(op).to(0.15, { opacity: 255 }).delay(duration).to(0.25, { opacity: 0 }).call(() => n.isValid && n.destroy()).start();
        tween(n).to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
    }

    /** 通用弹窗容器：遮罩 + 卡片；返回卡片节点供调用者填充内容 */
    openModal(w: number, h: number, opts: { closeOnMask?: boolean; onClose?: () => void } = {}): Node {
        const root = makeNode('Modal', this.overlayLayer, this.viewW, this.viewH);
        root.addComponent(BlockInputEvents);
        const mask = makeNode('Mask', root, this.viewW, this.viewH);
        const g = mask.addComponent(Graphics);
        g.fillColor = hex(P.ink, 120);
        g.rect(-this.viewW / 2, -this.viewH / 2, this.viewW, this.viewH);
        g.fill();
        if (opts.closeOnMask !== false) mask.on(Node.EventType.TOUCH_END, () => this.closeModal());
        const card = panel(root, w, h, { fill: P.cream, border: P.ink, shadow: P.ink, step: Theme.px, shadowDepth: 2 });
        card.addComponent(BlockInputEvents);
        (root as any).__onClose = opts.onClose;
        this.modalStack.push(root);
        const mop = opacityOf(mask);
        mop.opacity = 0;
        tween(mop).to(0.15, { opacity: 255 }).start();
        card.setScale(0.85, 0.85, 1);
        tween(card).to(0.22, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        return card;
    }

    closeModal(): void {
        const root = this.modalStack.pop();
        if (!root) return;
        const cb = (root as any).__onClose as (() => void) | undefined;
        const op = opacityOf(root);
        tween(op).to(0.12, { opacity: 0 }).call(() => root.isValid && root.destroy()).start();
        if (cb) cb();
    }

    closeAllModals(): void {
        while (this.modalStack.length) {
            const root = this.modalStack.pop()!;
            if (root.isValid) root.destroy();
        }
    }

    get hasModal(): boolean {
        return this.modalStack.length > 0;
    }

    /** 确认弹窗 */
    confirm(title: string, message: string, actions: Array<{ text: string; style?: ButtonStyle; onClick?: () => void }>): void {
        const w = Math.min(this.viewW - 80, 600);
        const msgLines = Math.ceil((message.length * Theme.font.body) / (w - 80)) + message.split('\n').length - 1;
        const h = 220 + Math.max(1, msgLines) * 38 + 30;
        const card = this.openModal(w, h);
        const t = label(card, title, Theme.font.h2, { bold: true });
        t.node.setPosition(0, h / 2 - 60);
        const m = label(card, message, Theme.font.body, { color: P.ink2, width: w - 80, wrap: true });
        m.node.setPosition(0, 10);
        const bw = (w - 80 - (actions.length - 1) * 20) / actions.length;
        actions.forEach((a, i) => {
            button(card, {
                w: bw,
                h: 84,
                text: a.text,
                style: a.style || (i === actions.length - 1 ? 'primary' : 'secondary'),
                onClick: () => {
                    this.closeModal();
                    if (a.onClick) a.onClick();
                },
            }, -w / 2 + 40 + bw / 2 + i * (bw + 20), -h / 2 + 70);
        });
    }
}

