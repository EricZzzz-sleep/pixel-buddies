import { Label, UITransform } from 'cc';
import { P } from '../art/Palette';
import { RELEASE } from '../config/PlatformConfig';
import { Theme } from '../ui/Theme';
import { button, ButtonHandle, label, panel, sprite } from '../ui/UIKit';
import { BasePage } from './BasePage';
import { setLabel } from './PageKit';

/**
 * 设置：音乐/音效/振动开关、重看教程、清除存档（二次确认）、关于与隐私说明、平台与广告状态（如实显示）。
 */
export class SettingsPage extends BasePage {
    private toggles: Array<{ key: 'music' | 'sfx' | 'vibration' | 'analytics'; btn: ButtonHandle }> = [];
    private infoLabel!: Label;

    protected build(): void {
        const L = this.L;
        const gm = this.gm;
        this.header('设置');
        const W = L.w - Theme.gutter * 2;
        let y = L.contentTop - 20;

        const rows: Array<{ key: 'music' | 'sfx' | 'vibration' | 'analytics'; text: string; icon: string; color: number; sub?: string }> = [
            { key: 'music', text: '背景音乐', icon: 'music', color: P.purple2 },
            { key: 'sfx', text: '音效', icon: 'sound', color: P.blue3 },
            { key: 'vibration', text: '振动反馈', icon: 'vibrate', color: P.leaf3 },
            { key: 'analytics', text: '匿名统计', icon: 'eye', color: P.rose2, sub: '只含玩法数据，无个人信息' },
        ];
        const boxH = rows.length * 96 + 30;
        const box = panel(this.root, W, boxH, { fill: P.white, border: P.ink, shadow: P.ink, step: Theme.px, shadowDepth: 2 }, 0, y - boxH / 2);
        rows.forEach((r, i) => {
            const ry = boxH / 2 - 63 - i * 96;
            sprite(box, gm.textures.icon(r.icon, r.color, P.white), 36, 32, -W / 2 + 54, ry);
            label(box, r.text, Theme.font.body, { bold: true, align: 'left' }).node.setPosition(-W / 2 + 92, ry + (r.sub ? 14 : 0));
            if (r.sub) label(box, r.sub, Theme.font.tiny, { color: Theme.textMuted, align: 'left' }).node.setPosition(-W / 2 + 92, ry - 20);
            const btn = button(box, {
                w: 150,
                h: 66,
                text: '开',
                fontSize: Theme.font.small,
                style: 'mint',
                onClick: () => {
                    if (r.key === 'analytics') {
                        gm.privacy.setEnabled(!gm.privacy.enabled());
                        if (gm.privacy.enabled()) gm.announceSession();
                        this.sm.toast(gm.privacy.enabled() ? '已开启匿名统计' : '已关闭，不会再上报任何数据');
                    } else gm.setSetting(r.key, !gm.settings[r.key]);
                    this.refresh();
                },
            }, W / 2 - 100, ry);
            this.toggles.push({ key: r.key, btn });
            if (r.key === 'music') {
                // 菜单歌单：手动切到下一首
                button(box, {
                    w: 120,
                    h: 66,
                    text: '换一首',
                    fontSize: Theme.font.small,
                    style: 'sky',
                    onClick: () => {
                        if (!gm.settings.music) {
                            this.sm.toast('先打开背景音乐');
                            return;
                        }
                        gm.audio.nextInPlaylist();
                        this.sm.toast('已切换到下一首');
                    },
                }, W / 2 - 245, ry);
            }
        });
        y -= boxH + 28;

        const bw = (W - 20) / 2;
        button(this.root, {
            w: bw,
            h: 90,
            text: '重看玩法教程',
            fontSize: Theme.font.small,
            style: 'sky',
            onClick: () => {
                gm.save.mutate((d) => (d.tutorial.puzzleBasics = false), true);
                this.sm.toast('下一局开始时会再次显示教程');
            },
        }, -bw / 2 - 10, y - 50);
        button(this.root, {
            w: bw,
            h: 90,
            text: '清除存档',
            fontSize: Theme.font.small,
            style: 'secondary',
            onClick: () =>
                this.sm.confirm('清除全部进度？', '收藏、星星、最佳成绩和每日记录都会被删除，且无法恢复。音效设置会保留。', [
                    { text: '再想想', style: 'secondary' },
                    {
                        text: '确认清除',
                        style: 'primary',
                        onClick: () => {
                            gm.save.resetAll();
                            this.sm.toast('存档已清除');
                            this.refresh();
                        },
                    },
                ]),
        }, bw / 2 + 10, y - 50);
        y -= 120;
        button(this.root, {
            w: W,
            h: 84,
            text: '意见反馈（Bug、难度、建议）',
            fontSize: Theme.font.small,
            style: 'butter',
            icon: gm.textures.icon('heart', P.rose2, P.white),
            iconSize: 34,
            onClick: () => this.sm.go('feedback'),
        }, 0, y - 36);
        y -= 100;
        button(this.root, { w: bw, h: 80, text: '隐私政策', fontSize: Theme.font.small, style: 'white', onClick: () => this.sm.go('policy', { tab: 'privacy' }) }, -bw / 2 - 10, y - 44);
        button(this.root, { w: bw, h: 80, text: '用户协议', fontSize: Theme.font.small, style: 'white', onClick: () => this.sm.go('policy', { tab: 'agreement' }) }, bw / 2 + 10, y - 44);
        y -= 116;

        const aboutH = Math.min(520, y - (-L.h / 2 + L.safeBottom + 20));
        const about = panel(this.root, W, aboutH, { fill: P.cream2, border: P.cream3, step: Theme.px, shadow: undefined }, 0, y - aboutH / 2);
        label(about, '关于《像素搭子》', Theme.font.body, { bold: true, align: 'left' }).node.setPosition(-W / 2 + 28, aboutH / 2 - 40);
        this.infoLabel = label(about, '', Theme.font.tiny, { color: P.ink2, width: W - 56, wrap: true, align: 'left', lineHeight: 1.55 });
        this.infoLabel.node.getComponent(UITransform)!.setAnchorPoint(0, 1);
        this.infoLabel.node.setPosition(-W / 2 + 28, aboutH / 2 - 72);
    }

    onEnter(): void {
        this.refresh();
    }

    private refresh(): void {
        const gm = this.gm;
        for (const t of this.toggles) {
            const on = t.key === 'analytics' ? gm.privacy.enabled() : gm.settings[t.key];
            t.btn.setText(on ? '开' : '关');
            t.btn.setStyle(on ? 'mint' : 'ghost');
        }
        const storageOk = gm.save.lastWriteOk ? '正常' : '写入失败（存储空间不足或被禁用）';
        setLabel(
            this.infoLabel,
            [
                `版本 ${RELEASE.version} · 当前平台：${gm.platform.displayName}`,
                `本地存档：${storageOk} · 首次进入 ${new Date(gm.save.data.firstLaunchAt).toLocaleDateString()}`,
                `累计开局 ${gm.save.data.totalPlays} 次 · 完成 ${gm.save.data.totalCompletions} 次`,
                `广告：${gm.ads.statusText()} · 排行榜：未接入服务器，仅本地成绩`,
                '',
                '隐私说明：游戏进度只保存在本机，不需要登录；不上传照片。匿名统计只在你同意后开启，可随时关闭。分享时只携带图片编号、难度、题目种子和你的成绩。',
                '美术说明：全部像素作品与图标均为本游戏原创，由程序逐像素绘制。',
            ].join('\n'),
        );
    }
}
