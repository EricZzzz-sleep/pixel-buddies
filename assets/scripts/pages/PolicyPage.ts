import { Label, UITransform } from 'cc';
import { P } from '../art/Palette';
import { PRIVACY_POLICY, USER_AGREEMENT } from '../config/PolicyText';
import { ScrollList } from '../ui/ScrollList';
import { Theme } from '../ui/Theme';
import { button, ButtonHandle, label, panel } from '../ui/UIKit';
import { BasePage } from './BasePage';

type Tab = 'privacy' | 'agreement';

/** 隐私政策 / 用户协议（可滚动阅读） */
export class PolicyPage extends BasePage {
    private list!: ScrollList;
    private text!: Label;
    private tabs: Record<Tab, ButtonHandle> = {} as any;

    protected build(): void {
        const L = this.L;
        this.header('隐私与协议');
        const W = L.w - Theme.gutter * 2;
        const tabsY = L.contentTop - 36;
        const bw = (W - 16) / 2;
        (['privacy', 'agreement'] as Tab[]).forEach((t, i) => {
            this.tabs[t] = button(this.root, {
                w: bw,
                h: 64,
                text: t === 'privacy' ? '隐私政策' : '用户协议',
                fontSize: Theme.font.small,
                style: 'white',
                onClick: () => this.show(t),
            }, -W / 2 + bw / 2 + i * (bw + 16), tabsY);
        });
        const top = tabsY - 52;
        const bottom = -L.h / 2 + L.safeBottom + 16;
        const h = top - bottom;
        panel(this.root, W, h, { fill: P.white, border: P.cream3, step: Theme.px, shadow: undefined }, 0, bottom + h / 2);
        this.list = ScrollList.create(this.root, W - 24, h - 24, 0, bottom + h / 2);
        this.text = label(this.list.content, '', Theme.font.small, { color: P.ink2, width: W - 72, wrap: true, align: 'left', lineHeight: 1.6 });
        this.text.node.getComponent(UITransform)!.setAnchorPoint(0, 1);
        this.text.node.setPosition(-(W - 72) / 2, -16);
    }

    onEnter(params?: { tab?: Tab }): void {
        this.show(params && params.tab ? params.tab : 'privacy');
    }

    private show(t: Tab): void {
        (['privacy', 'agreement'] as Tab[]).forEach((k) => this.tabs[k].setStyle(k === t ? 'primary' : 'white'));
        this.text.string = t === 'privacy' ? PRIVACY_POLICY : USER_AGREEMENT;
        this.text.updateRenderData(true);
        const th = this.text.node.getComponent(UITransform)!.height;
        this.list.setContentHeight(th + 40);
        this.list.scrollToTop();
    }
}
