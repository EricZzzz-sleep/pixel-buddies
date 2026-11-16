import { EditBox, HorizontalTextAlignment, Label, UITransform, VerticalTextAlignment } from 'cc';
import { P } from '../art/Palette';
import { RELEASE } from '../config/PlatformConfig';
import { FEEDBACK_CATEGORIES, FEEDBACK_MAX, FeedbackCategory } from '../feedback/FeedbackRules';
import { hex, Theme } from '../ui/Theme';
import { button, ButtonHandle, label, makeNode, panel } from '../ui/UIKit';
import { BasePage } from './BasePage';
import { setLabel } from './PageKit';

/**
 * 意见反馈：选类型 → 写几句话 → 发送。不需要账号和邮箱。
 * 后端没开通时（本地预览、没有配置接口的小游戏包）会如实提示，并提供“复制反馈”兜底。
 */
export class FeedbackPage extends BasePage {
    private category: FeedbackCategory | null = null;
    private chips = new Map<FeedbackCategory, ButtonHandle>();
    private hint!: Label;
    private edit!: EditBox;
    private counter!: Label;
    private result!: Label;
    private sendBtn!: ButtonHandle;
    private sending = false;

    protected build(): void {
        const L = this.L;
        const gm = this.gm;
        this.header('意见反馈');
        const W = L.w - Theme.gutter * 2;
        const top = L.contentTop;

        const note = label(this.root, '不用登录，也不用填邮箱。请不要写姓名、电话等个人信息。', Theme.font.tiny, { color: Theme.textMuted, width: W, wrap: true });
        note.node.setPosition(0, top - 8);

        // 类型：3 + 2 两行
        const gap = 12;
        const cw = (W - gap * 2) / 3;
        FEEDBACK_CATEGORIES.forEach((c, i) => {
            const row = i < 3 ? 0 : 1;
            const inRow = row === 0 ? 3 : FEEDBACK_CATEGORIES.length - 3;
            const col = row === 0 ? i : i - 3;
            const x0 = -((inRow - 1) * (cw + gap)) / 2;
            const b = button(this.root, {
                w: cw,
                h: 66,
                text: c.label,
                fontSize: Theme.font.small,
                style: 'white',
                onClick: () => this.pick(c.id),
            }, x0 + col * (cw + gap), top - 72 - row * 78);
            this.chips.set(c.id, b);
        });
        this.hint = label(this.root, '先选一个类型', Theme.font.tiny, { color: P.ink2, width: W, wrap: true });
        this.hint.node.setPosition(0, top - 72 - 78 - 56);

        // 输入框
        // 输入框尽量占满中间空白（给底部按钮和结果提示留出位置），矮屏保底 330
        const panelTop = top - 72 - 78 - 96;
        const bottom = -L.h / 2 + L.safeBottom + 60;
        const ph = Math.max(330, Math.min(620, panelTop - (bottom + 46 + 110)));
        const py = panelTop - ph / 2;
        const box = panel(this.root, W, ph, { fill: P.white, border: P.ink, shadow: P.cream3, step: Theme.px, shadowDepth: 1.5 }, 0, py);
        const iw = W - 48;
        const ih = ph - 70;
        const en = makeNode('EditBox', box, iw, ih, 0, 14);
        en.getComponent(UITransform)!.setAnchorPoint(0.5, 0.5);
        // 文字与占位提示都以输入框左上角为锚点，否则宽屏下占位文字会偏出输入框
        const tn = makeNode('Text', en, iw, ih, -iw / 2, ih / 2);
        tn.getComponent(UITransform)!.setAnchorPoint(0, 1);
        const tl = tn.addComponent(Label);
        tl.fontSize = Theme.font.small;
        tl.lineHeight = Math.round(Theme.font.small * 1.4);
        tl.color = hex(P.ink);
        tl.horizontalAlign = HorizontalTextAlignment.LEFT;
        tl.verticalAlign = VerticalTextAlignment.TOP;
        tl.overflow = Label.Overflow.CLAMP;
        tl.enableWrapText = true;
        const pn = makeNode('Placeholder', en, iw, ih, -iw / 2, ih / 2);
        pn.getComponent(UITransform)!.setAnchorPoint(0, 1);
        const pl = pn.addComponent(Label);
        pl.fontSize = Theme.font.small;
        pl.lineHeight = Math.round(Theme.font.small * 1.4);
        pl.color = hex(Theme.textMuted);
        pl.horizontalAlign = HorizontalTextAlignment.LEFT;
        pl.verticalAlign = VerticalTextAlignment.TOP;
        pl.overflow = Label.Overflow.CLAMP;
        pl.enableWrapText = true;
        const eb = en.addComponent(EditBox);
        eb.textLabel = tl;
        eb.placeholderLabel = pl;
        eb.placeholder = '写下你遇到的问题或想法…';
        eb.inputMode = EditBox.InputMode.ANY;
        eb.returnType = EditBox.KeyboardReturnType.DEFAULT;
        eb.maxLength = FEEDBACK_MAX;
        eb.string = '';
        eb.node.on(EditBox.EventType.TEXT_CHANGED, () => this.onText(), this);
        eb.node.on(EditBox.EventType.EDITING_DID_ENDED, () => this.onText(), this);
        this.edit = eb;
        this.counter = label(box, `0/${FEEDBACK_MAX}`, Theme.font.tiny, { color: Theme.textMuted, align: 'right' });
        this.counter.node.setPosition(W / 2 - 24, -ph / 2 + 30);

        this.result = label(this.root, '', Theme.font.small, { color: P.ink2, width: W, wrap: true });
        this.result.node.setPosition(0, py - ph / 2 - 56);

        // 底部按钮
        const bw = (W - 16) / 2;
        button(this.root, { w: bw, h: 92, text: '复制反馈', fontSize: Theme.font.small, style: 'white', onClick: () => this.copy() }, -bw / 2 - 8, bottom);
        this.sendBtn = button(this.root, { w: bw, h: 92, text: gm.feedback.available ? '发送' : '发送（未开通）', fontSize: Theme.font.small, style: 'primary', onClick: () => void this.send() }, bw / 2 + 8, bottom);
    }

    onEnter(): void {
        this.result.string = '';
        this.sending = false;
        this.category = null;
        this.edit.string = '';
        this.onText();
        this.chips.forEach((b) => b.setStyle('white'));
        setLabel(this.hint, this.gm.feedback.available ? '先选一个类型' : '反馈通道还没开通：写好后可以“复制反馈”，发给邀请你的朋友');
    }

    onExit(): void {
        this.edit.string = '';
    }

    private pick(id: FeedbackCategory): void {
        this.category = id;
        this.gm.audio.play('click');
        this.chips.forEach((b, k) => b.setStyle(k === id ? 'primary' : 'white'));
        const c = FEEDBACK_CATEGORIES.find((x) => x.id === id)!;
        setLabel(this.hint, c.hint);
    }

    private onText(): void {
        setLabel(this.counter, `${this.edit.string.length}/${FEEDBACK_MAX}`);
    }

    private context() {
        const w = this.gm.platform.getWindowSize();
        return { version: RELEASE.version, platform: this.gm.platform.kind, vw: Math.round(w.width), vh: Math.round(w.height) };
    }

    private async send(): Promise<void> {
        if (this.sending) return;
        this.sending = true;
        this.sendBtn.setEnabled(false);
        this.sendBtn.setText('发送中…');
        const r = await this.gm.feedback.submit(this.category, this.edit.string);
        this.sending = false;
        this.sendBtn.setEnabled(true);
        this.sendBtn.setText(this.gm.feedback.available ? '发送' : '发送（未开通）');
        this.result.color = hex(r.ok ? P.leaf3 : P.rose2);
        setLabel(this.result, r.message);
        if (r.ok) {
            this.edit.string = '';
            this.onText();
        }
    }

    private async copy(): Promise<void> {
        const c = FEEDBACK_CATEGORIES.find((x) => x.id === this.category);
        const text = this.edit.string.trim();
        if (text.length < 1) {
            this.sm.toast('先写点内容再复制');
            return;
        }
        const x = this.context();
        const body = `【像素搭子 ${x.version} · ${x.platform} · ${x.vw}x${x.vh}】${c ? c.label : '反馈'}：${text}`;
        const ok = await this.gm.platform.setClipboard(body);
        this.sm.toast(ok ? '已复制，可以发给我们了' : '复制失败，请手动选择文字');
    }
}
