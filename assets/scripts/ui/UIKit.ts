import { Color, EventTouch, Graphics, HorizontalTextAlignment, Label, LabelOutline, Layers, Node, Sprite, SpriteFrame, tween, Tween, UIOpacity, UITransform, Vec3, VerticalTextAlignment } from 'cc';
import { hex, Theme } from './Theme';

/**
 * 代码化 UI 工具集：统一的像素风面板、按钮、文字、图标。
 * 所有界面都由这些函数构建，保证视觉一致，也避免手工维护大量预制体。
 */

export type ButtonStyle = 'primary' | 'secondary' | 'mint' | 'lilac' | 'sky' | 'butter' | 'ghost' | 'white';

const BUTTON_COLORS: Record<ButtonStyle, { fill: number; border: number; shadow: number; text: number; light: number }> = {
    primary: { fill: 0xf48fb1, border: 0x4a3b4f, shadow: 0xd9668a, text: 0xffffff, light: 0xffb3c6 },
    secondary: { fill: 0xffffff, border: 0x4a3b4f, shadow: 0xe8d6bf, text: 0x4a3b4f, light: 0xfff6e9 },
    mint: { fill: 0xa6e3c6, border: 0x4a3b4f, shadow: 0x6fc59f, text: 0x4a3b4f, light: 0xd2f4e4 },
    lilac: { fill: 0xcbb8f5, border: 0x4a3b4f, shadow: 0x9f88da, text: 0x4a3b4f, light: 0xe8dcff },
    sky: { fill: 0xa7d8f7, border: 0x4a3b4f, shadow: 0x74b4e6, text: 0x4a3b4f, light: 0xd4eeff },
    butter: { fill: 0xffe27a, border: 0x4a3b4f, shadow: 0xf5bf47, text: 0x4a3b4f, light: 0xfff3c4 },
    ghost: { fill: 0xfff6e9, border: 0xeadcc8, shadow: 0xeadcc8, text: 0x6e5a70, light: 0xfff6e9 },
    white: { fill: 0xffffff, border: 0xeadcc8, shadow: 0xeadcc8, text: 0x4a3b4f, light: 0xffffff },
};

/** 全局 UI 钩子：按钮音效、输入锁（页面切换动画期间屏蔽点击） */
export const UIHooks = {
    onButtonClick: null as null | (() => void),
    inputLocked: false,
};

export function makeNode(name: string, parent: Node | null, w = 0, h = 0, x = 0, y = 0): Node {
    const n = new Node(name);
    n.layer = Layers.Enum.UI_2D;
    const t = n.addComponent(UITransform);
    t.setContentSize(w, h);
    if (parent) parent.addChild(n);
    n.setPosition(x, y, 0);
    return n;
}

export function size(n: Node): { w: number; h: number } {
    const t = n.getComponent(UITransform)!;
    return { w: t.width, h: t.height };
}

export function setSize(n: Node, w: number, h: number): void {
    n.getComponent(UITransform)!.setContentSize(w, h);
}

export interface LabelOpts {
    color?: number;
    bold?: boolean;
    align?: 'left' | 'center' | 'right';
    width?: number;
    /** 多行时的行高倍数 */
    lineHeight?: number;
    wrap?: boolean;
    outline?: { color: number; width: number };
}

export function label(parent: Node, text: string, fontSize: number, opts: LabelOpts = {}): Label {
    const n = makeNode('Label', parent, opts.width || 0, fontSize * 1.4);
    const l = n.addComponent(Label);
    l.string = text;
    l.fontSize = fontSize;
    l.lineHeight = Math.round(fontSize * (opts.lineHeight || 1.3));
    l.color = hex(opts.color !== undefined ? opts.color : Theme.ink);
    l.isBold = !!opts.bold;
    l.horizontalAlign = opts.align === 'left' ? HorizontalTextAlignment.LEFT : opts.align === 'right' ? HorizontalTextAlignment.RIGHT : HorizontalTextAlignment.CENTER;
    l.verticalAlign = VerticalTextAlignment.CENTER;
    if (opts.width) {
        l.overflow = opts.wrap ? Label.Overflow.RESIZE_HEIGHT : Label.Overflow.SHRINK;
        l.enableWrapText = !!opts.wrap;
    } else {
        l.overflow = Label.Overflow.NONE;
    }
    if (opts.outline) {
        if ('enableOutline' in Label.prototype) {
            // 3.8.2+ 推荐写法
            l.enableOutline = true;
            l.outlineColor = hex(opts.outline.color);
            l.outlineWidth = opts.outline.width;
        } else {
            // 3.8.0 / 3.8.1 兼容
            const o = n.addComponent(LabelOutline);
            o.color = hex(opts.outline.color);
            o.width = opts.outline.width;
        }
    }
    if (opts.align === 'left') n.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
    if (opts.align === 'right') n.getComponent(UITransform)!.setAnchorPoint(1, 0.5);
    return l;
}

/**
 * 阶梯圆角矩形路径（像素风圆角）：四角各切两级台阶。
 * 以节点中心为原点。
 */
export function pixelRectPath(g: Graphics, cx: number, cy: number, w: number, h: number, step: number): void {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
    const s = step, d = step * 2;
    g.moveTo(x0 + d, y0);
    g.lineTo(x1 - d, y0);
    g.lineTo(x1 - d, y0 + s);
    g.lineTo(x1 - s, y0 + s);
    g.lineTo(x1 - s, y0 + d);
    g.lineTo(x1, y0 + d);
    g.lineTo(x1, y1 - d);
    g.lineTo(x1 - s, y1 - d);
    g.lineTo(x1 - s, y1 - s);
    g.lineTo(x1 - d, y1 - s);
    g.lineTo(x1 - d, y1);
    g.lineTo(x0 + d, y1);
    g.lineTo(x0 + d, y1 - s);
    g.lineTo(x0 + s, y1 - s);
    g.lineTo(x0 + s, y1 - d);
    g.lineTo(x0, y1 - d);
    g.lineTo(x0, y0 + d);
    g.lineTo(x0 + s, y0 + d);
    g.lineTo(x0 + s, y0 + s);
    g.lineTo(x0 + d, y0 + s);
    g.close();
}

export interface PanelStyle {
    fill: number;
    border?: number;
    shadow?: number;
    /** 顶部高光条 */
    light?: number;
    /** 像素单位倍数，默认 Theme.px */
    step?: number;
    /** 阴影偏移（像素单位个数） */
    shadowDepth?: number;
    borderWidth?: number;
    alpha?: number;
}

/** 在 Graphics 上绘制像素面板（阴影 → 描边 → 填充 → 高光），全部为填充，边缘锐利 */
export function drawPanel(g: Graphics, w: number, h: number, st: PanelStyle): void {
    g.clear();
    const step = st.step || Theme.px;
    const sd = (st.shadowDepth !== undefined ? st.shadowDepth : 1.5) * step;
    const bw = st.borderWidth !== undefined ? st.borderWidth : step;
    const a = st.alpha !== undefined ? st.alpha : 255;
    if (st.shadow !== undefined && sd > 0) {
        g.fillColor = hex(st.shadow, a);
        pixelRectPath(g, 0, -sd, w, h, step);
        g.fill();
    }
    if (st.border !== undefined && bw > 0) {
        g.fillColor = hex(st.border, a);
        pixelRectPath(g, 0, 0, w, h, step);
        g.fill();
        g.fillColor = hex(st.fill, a);
        pixelRectPath(g, 0, 0, w - bw * 2, h - bw * 2, step);
        g.fill();
    } else {
        g.fillColor = hex(st.fill, a);
        pixelRectPath(g, 0, 0, w, h, step);
        g.fill();
    }
    if (st.light !== undefined) {
        g.fillColor = hex(st.light, a);
        const inset = bw + step;
        g.rect(-w / 2 + inset + step, h / 2 - inset - step, Math.max(0, w - inset * 2 - step * 4), step);
        g.fill();
    }
}

export function panel(parent: Node, w: number, h: number, st: PanelStyle, x = 0, y = 0): Node {
    const n = makeNode('Panel', parent, w, h, x, y);
    drawPanel(n.addComponent(Graphics), w, h, st);
    return n;
}

export function sprite(parent: Node, frame: SpriteFrame | null, w: number, h: number, x = 0, y = 0): Sprite {
    const n = makeNode('Sprite', parent, w, h, x, y);
    const s = n.addComponent(Sprite);
    s.sizeMode = Sprite.SizeMode.CUSTOM;
    s.spriteFrame = frame;
    setSize(n, w, h);
    return s;
}

export function opacityOf(n: Node): UIOpacity {
    return n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
}

export interface ButtonOpts {
    w: number;
    h: number;
    text?: string;
    fontSize?: number;
    style?: ButtonStyle;
    icon?: SpriteFrame | null;
    iconSize?: number;
    /** 图标在文字上方（大方块按钮） */
    iconTop?: boolean;
    sub?: string;
    onClick?: () => void;
}

export interface ButtonHandle {
    node: Node;
    label: Label | null;
    sub: Label | null;
    setText(t: string): void;
    setEnabled(v: boolean): void;
    setStyle(s: ButtonStyle): void;
    readonly enabled: boolean;
}

/**
 * 像素按钮：按下时下沉到阴影位置并轻微缩小，松开回弹；
 * 手指移动超过阈值视为滑动（用于滚动列表），不触发点击。
 */
export function button(parent: Node, o: ButtonOpts, x = 0, y = 0): ButtonHandle {
    const node = makeNode('Button', parent, o.w, o.h + 6, x, y);
    const body = makeNode('Body', node, o.w, o.h);
    const g = body.addComponent(Graphics);
    let style: ButtonStyle = o.style || 'primary';
    let enabled = true;
    const content = makeNode('Content', body, o.w, o.h);
    let lbl: Label | null = null;
    let subLbl: Label | null = null;
    const fs = o.fontSize || Theme.font.body;
    let iconSprite: Sprite | null = null;
    if (o.icon) {
        const isz = o.iconSize || Math.round(fs * 1.2);
        iconSprite = sprite(content, o.icon, isz, isz);
        if (o.iconTop) iconSprite.node.setPosition(0, o.h * 0.14);
    }
    if (o.text !== undefined) {
        lbl = label(content, o.text, fs, { bold: true, color: BUTTON_COLORS[style].text });
        if (o.icon && o.iconTop) lbl.node.setPosition(0, -o.h * 0.24);
    }
    if (o.sub) {
        subLbl = label(content, o.sub, Theme.font.tiny, { color: BUTTON_COLORS[style].text });
        subLbl.node.setPosition(0, -fs * 0.75);
        if (lbl) lbl.node.setPosition(0, fs * 0.35);
    }
    // 图标 + 文字横排
    const layoutRow = () => {
        if (!iconSprite || !lbl || o.iconTop) return;
        lbl.updateRenderData(true);
        const tw = lbl.node.getComponent(UITransform)!.width;
        const isz = iconSprite.node.getComponent(UITransform)!.width;
        const gap = 10;
        const total = isz + gap + tw;
        iconSprite.node.setPosition(-total / 2 + isz / 2, lbl.node.position.y);
        lbl.node.setPosition(-total / 2 + isz + gap + tw / 2, lbl.node.position.y);
    };

    const sd = 6;
    const redraw = (pressed: boolean) => {
        const c = BUTTON_COLORS[style];
        g.clear();
        const step = Theme.px;
        if (!pressed) {
            g.fillColor = hex(c.border);
            pixelRectPath(g, 0, -sd, o.w, o.h, step);
            g.fill();
        }
        g.fillColor = hex(c.border);
        pixelRectPath(g, 0, 0, o.w, o.h, step);
        g.fill();
        g.fillColor = hex(c.shadow);
        pixelRectPath(g, 0, 0, o.w - step * 2, o.h - step * 2, step);
        g.fill();
        g.fillColor = hex(enabled ? c.fill : 0xe4dfe8);
        pixelRectPath(g, 0, step * 0.75, o.w - step * 2, o.h - step * 3.5, step);
        g.fill();
        g.fillColor = hex(enabled ? c.light : 0xf0ecf2);
        g.rect(-o.w / 2 + step * 3, o.h / 2 - step * 3, Math.max(0, o.w * 0.35), step);
        g.fill();
        body.setPosition(0, pressed ? -sd + 3 : 3);
        const tc = hex(enabled ? c.text : 0x9d93a8);
        if (lbl) lbl.color = tc;
        if (subLbl) subLbl.color = tc;
    };
    redraw(false);
    layoutRow();

    let pressing = false;
    node.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
        if (!enabled || UIHooks.inputLocked) return;
        pressing = true;
        redraw(true);
        Tween.stopAllByTarget(node);
        tween(node).to(0.06, { scale: new Vec3(0.97, 0.97, 1) }).start();
    });
    const release = (fire: boolean, e?: EventTouch) => {
        if (!pressing) return;
        pressing = false;
        redraw(false);
        Tween.stopAllByTarget(node);
        tween(node)
            .to(0.08, { scale: new Vec3(1.03, 1.03, 1) })
            .to(0.08, { scale: new Vec3(1, 1, 1) })
            .start();
        if (fire && e) {
            const s = e.getUIStartLocation();
            const p = e.getUILocation();
            if (Math.abs(s.x - p.x) + Math.abs(s.y - p.y) > 24) return; // 滑动不算点击
            if (UIHooks.onButtonClick) UIHooks.onButtonClick();
            if (o.onClick) o.onClick();
        }
    };
    node.on(Node.EventType.TOUCH_END, (e: EventTouch) => release(true, e));
    node.on(Node.EventType.TOUCH_CANCEL, () => release(false));

    return {
        node,
        label: lbl,
        sub: subLbl,
        get enabled() {
            return enabled;
        },
        setText(t: string) {
            if (lbl) {
                lbl.string = t;
                layoutRow();
            }
        },
        setEnabled(v: boolean) {
            enabled = v;
            redraw(false);
        },
        setStyle(s: ButtonStyle) {
            style = s;
            redraw(false);
        },
    };
}

/** 可点击区域（无外观）；同样过滤滑动 */
export function onTap(node: Node, cb: (e: EventTouch) => void): void {
    node.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
        if (UIHooks.inputLocked) return;
        const s = e.getUIStartLocation();
        const p = e.getUILocation();
        if (Math.abs(s.x - p.x) + Math.abs(s.y - p.y) > 24) return;
        cb(e);
    });
}

/** 星星行：已获得为金色，未获得为浅灰描边 */
export function starRow(parent: Node, frames: { on: SpriteFrame; off: SpriteFrame }, count: number, max = 3, sizePx = 28, gap = 6): Node {
    const n = makeNode('Stars', parent, max * sizePx + (max - 1) * gap, sizePx);
    for (let i = 0; i < max; i++) {
        sprite(n, i < count ? frames.on : frames.off, sizePx, sizePx * (11 / 12), -((max - 1) * (sizePx + gap)) / 2 + i * (sizePx + gap), 0);
    }
    return n;
}

/** 胶囊标签（带图标的小数据块） */
export function pill(parent: Node, w: number, h: number, fill: number, icon: SpriteFrame | null, text: string, textColor: number = Theme.ink, fontSize = Theme.font.small): { node: Node; label: Label } {
    const n = panel(parent, w, h, { fill, border: undefined, shadow: undefined, step: Theme.px });
    let lx = 0;
    if (icon) {
        const isz = Math.round(h * 0.5);
        sprite(n, icon, isz, isz, -w / 2 + h * 0.5 + 2, 0);
        lx = h * 0.25;
    }
    const l = label(n, text, fontSize, { bold: true, color: textColor, width: w - h, });
    l.node.setPosition(lx, 0);
    return { node: n, label: l };
}

/** 柔和的入场：透明度 + 轻微上移 */
export function popIn(n: Node, delay = 0, dy = 16): void {
    const op = opacityOf(n);
    op.opacity = 0;
    const p = n.position.clone();
    n.setPosition(p.x, p.y - dy, p.z);
    tween(op).delay(delay).to(0.22, { opacity: 255 }).start();
    tween(n).delay(delay).to(0.26, { position: p }, { easing: 'quadOut' }).start();
}

export function colorOf(n: number, a = 255): Color {
    return hex(n, a);
}
