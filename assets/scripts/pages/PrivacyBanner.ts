import { Node, tween, Vec3 } from 'cc';
import { P } from '../art/Palette';
import { GameManager } from '../core/GameManager';
import type { SceneManager } from '../core/SceneManager';
import { Theme } from '../ui/Theme';
import { button, label, makeNode, opacityOf, panel } from '../ui/UIKit';

/**
 * 首次启动的“匿名统计”说明条：停在屏幕底部，不遮挡主要按钮，不会阻止玩家直接开始拼图。
 * 玩家点“同意”才会开始上报；点“不用了”或不处理都不会有数据离开设备。
 */
export class PrivacyBanner {
    private node: Node | null = null;

    constructor(private readonly sm: SceneManager) {}

    get visible(): boolean {
        return !!this.node && this.node.isValid;
    }

    show(): void {
        const gm = GameManager.I;
        if (this.visible || !gm.privacy.needsPrompt()) return;
        const L = gm.layout;
        const W = L.w - Theme.gutter * 2;
        const h = 292;
        const y = -L.h / 2 + L.safeBottom + 18 + h / 2;
        const root = makeNode('PrivacyBanner', this.sm.overlayLayer, W, h, 0, y);
        const card = panel(root, W, h, { fill: P.white, border: P.ink, shadow: P.ink, step: Theme.px, shadowDepth: 2 }, 0, 0);
        label(card, '帮我们把游戏做得更好？', Theme.font.body, { bold: true, align: 'left' }).node.setPosition(-W / 2 + 30, h / 2 - 38);
        const msg = label(card, '同意后会匿名上报玩法数据（通关、放弃、加载速度）。不含照片、昵称、位置等个人信息，随时可在“设置”里关闭。不同意也能正常玩。', Theme.font.tiny, { color: P.ink2, width: W - 60, wrap: true, align: 'left', lineHeight: 1.5 });
        msg.node.setPosition(-W / 2 + 30, h / 2 - 114);
        const bw = (W - 60 - 16) / 2;
        button(card, {
            w: bw,
            h: 78,
            text: '不用了',
            fontSize: Theme.font.small,
            style: 'white',
            onClick: () => {
                gm.privacy.deny();
                this.hide();
            },
        }, -W / 2 + 30 + bw / 2, -h / 2 + 100);
        button(card, {
            w: bw,
            h: 78,
            text: '同意',
            fontSize: Theme.font.small,
            style: 'primary',
            onClick: () => {
                gm.privacy.grant();
                gm.announceSession();
                this.hide();
                this.sm.toast('谢谢！可以在“设置”里随时关闭');
            },
        }, -W / 2 + 30 + bw + 16 + bw / 2, -h / 2 + 100);
        button(card, {
            w: W - 60,
            h: 44,
            text: '查看收集哪些数据',
            fontSize: Theme.font.tiny,
            style: 'ghost',
            onClick: () => {
                this.hide();
                this.sm.go('policy', { tab: 'privacy' });
            },
        }, 0, -h / 2 + 36);
        this.node = root;
        const op = opacityOf(root);
        op.opacity = 0;
        root.setPosition(0, y - 40, 0);
        tween(op).to(0.25, { opacity: 255 }).start();
        tween(root).to(0.28, { position: new Vec3(0, y, 0) }, { easing: 'backOut' }).start();
    }

    hide(): void {
        const n = this.node;
        this.node = null;
        if (n && n.isValid) n.destroy();
    }
}
