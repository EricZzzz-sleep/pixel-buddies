import { Label, Node, Sprite, UITransform } from 'cc';
import { MAX_CUSTOM, workToArtInfo } from '../art/CustomArtStore';
import { P } from '../art/Palette';
import { PixelCanvas } from '../art/PixelCanvas';
import { ART_SIZE } from '../config/GameConfig';
import { convertToPixelArt, MAX_INPUT_SIDE, RGBAImage } from '../imaging/PixelArtConverter';
import { DecodedImage } from '../platform/PlatformAdapter';
import { Theme } from '../ui/Theme';
import { button, ButtonHandle, label, makeNode, onTap, panel, sprite } from '../ui/UIKit';
import { BasePage } from './BasePage';
import { Flow, openDifficultySheet, setLabel } from './PageKit';

const COLOR_OPTIONS = [8, 16, 32];

/**
 * 像素工坊：选择本地照片 → 本地转换为 60×60 像素画 → 保存 → 选难度开始拼图。
 * 照片只在本机内存中处理，不上传；只保存转换后的调色板像素（约 5KB）。
 * 工坊作品不能发起好友挑战（好友那边没有这张照片，第一版也没有服务器）。
 */
export class WorkshopPage extends BasePage {
    private preview!: Sprite;
    private placeholder!: Node;
    private hint!: Label;
    private colorBtns: ButtonHandle[] = [];
    private saveBtn!: ButtonHandle;
    private worksHolder!: Node;
    private worksTitle!: Label;
    private colors = 16;
    private source: DecodedImage | null = null;
    private result: { image: RGBAImage; palette: number[][] } | null = null;
    private busy = false;

    protected build(): void {
        const L = this.L;
        const gm = this.gm;
        this.header('像素工坊');
        const W = L.w - Theme.gutter * 2;
        let y = L.contentTop - 16;

        // ---- 制作区
        const makeH = 620;
        const make = panel(this.root, W, makeH, { fill: P.white, border: P.ink, shadow: P.ink, step: Theme.px, shadowDepth: 2 }, 0, y - makeH / 2);
        const pv = 300;
        const frame = panel(make, pv + 20, pv + 20, { fill: P.mint, border: P.ink, shadow: P.mint3, step: Theme.px }, -W / 2 + 40 + pv / 2, makeH / 2 - 40 - pv / 2);
        this.placeholder = makeNode('Placeholder', frame, pv, pv);
        sprite(this.placeholder, gm.textures.icon('puzzle', P.mint3, P.white), 64, 64, 0, 30);
        label(this.placeholder, '还没有选择照片', Theme.font.small, { color: P.leaf3, bold: true }).node.setPosition(0, -40);
        this.preview = sprite(frame, null, pv, pv);
        this.preview.node.active = false;

        const rx = -W / 2 + 40 + pv + 30;
        const rw = W - (pv + 110);
        label(make, '照片变像素拼图', Theme.font.h2, { bold: true, align: 'left' }).node.setPosition(rx, makeH / 2 - 60);
        this.hint = label(make, '', Theme.font.tiny, { color: P.ink2, align: 'left', width: rw, wrap: true, lineHeight: 1.5 });
        this.hint.node.setPosition(rx, makeH / 2 - 150);
        label(make, '颜色数量', Theme.font.small, { bold: true, align: 'left', color: P.ink2 }).node.setPosition(rx, makeH / 2 - 250);
        const cw = (rw - 16) / 3;
        COLOR_OPTIONS.forEach((n, i) => {
            this.colorBtns.push(
                button(make, {
                    w: cw,
                    h: 64,
                    text: `${n} 色`,
                    fontSize: Theme.font.small,
                    style: 'white',
                    onClick: () => {
                        this.colors = n;
                        this.refreshColors();
                        this.reconvert();
                    },
                }, rx + cw / 2 + i * (cw + 8), makeH / 2 - 300),
            );
        });

        button(make, {
            w: W - 60,
            h: 92,
            text: '选择照片',
            style: 'sky',
            icon: gm.textures.icon('book', P.blue3, P.white),
            onClick: () => this.pick(),
        }, 0, -makeH / 2 + 180);
        this.saveBtn = button(make, {
            w: W - 60,
            h: 92,
            text: '保存并开始拼图',
            style: 'primary',
            icon: gm.textures.icon('play', P.white),
            onClick: () => this.saveAndPlay(),
        }, 0, -makeH / 2 + 70);
        y -= makeH + 24;

        // ---- 我的作品
        const bottom = -L.h / 2 + L.safeBottom + 16;
        const worksH = Math.max(260, y - bottom);
        const works = panel(this.root, W, worksH, { fill: P.cream2, border: P.cream3, step: Theme.px, shadow: undefined }, 0, y - worksH / 2);
        this.worksTitle = label(works, '', Theme.font.small, { bold: true, align: 'left', color: P.ink2 });
        this.worksTitle.node.setPosition(-W / 2 + 24, worksH / 2 - 34);
        this.worksHolder = makeNode('Works', works, W, worksH - 70, 0, -26);
    }

    onEnter(): void {
        this.refreshColors();
        this.refreshState();
        this.buildWorks();
    }

    onExit(): void {
        // 离开时丢弃照片解码数据，降低内存占用
        this.source = null;
        this.result = null;
        this.preview.spriteFrame = null;
        this.gm.textures.release('custom:preview');
        this.preview.node.active = false;
        this.placeholder.active = true;
    }

    private refreshColors(): void {
        COLOR_OPTIONS.forEach((n, i) => this.colorBtns[i].setStyle(n === this.colors ? 'mint' : 'white'));
    }

    private refreshState(): void {
        setLabel(
            this.hint,
            this.result
                ? '预览如左图。满意就保存吧！\n不满意可以换颜色数量或重新选一张。'
                : '选一张照片，游戏会在本机把它变成 60×60 的像素画。\n照片不会上传，也不会被保存。',
        );
        this.saveBtn.setEnabled(!!this.result);
    }

    private pick(): void {
        if (this.busy) return;
        const gm = this.gm;
        if (!gm.platform.capabilities.chooseImage) {
            this.sm.toast('当前环境不支持选择照片');
            return;
        }
        if (!gm.save.data.consent.photo) {
            this.sm.confirm(
                '使用照片前请确认',
                '为了把照片做成拼图，游戏需要读取你选择的一张照片。照片只在本机处理，不会上传或保存原图。详见设置中的《隐私政策》。',
                [
                    { text: '取消', style: 'secondary' },
                    {
                        text: '同意并选择',
                        style: 'primary',
                        onClick: () => {
                            gm.save.mutate((d) => (d.consent.photo = true), true);
                            this.choose();
                        },
                    },
                ],
            );
            return;
        }
        this.choose();
    }

    private choose(): void {
        const gm = this.gm;
        this.busy = true;
        gm.platform
            .chooseImage()
            .then((img) => {
                if (!img) return null;
                if (img.size && img.size > 20 * 1024 * 1024) {
                    this.sm.toast('照片太大了，请换一张（20MB 以内）');
                    return null;
                }
                return gm.platform.decodeImage(img.path, MAX_INPUT_SIDE);
            })
            .then((decoded) => {
                if (decoded === undefined) return;
                if (decoded === null) return;
                this.source = decoded;
                this.reconvert();
            })
            .catch((e) => {
                console.warn('[Workshop] 选择照片失败', e);
                this.sm.toast('照片读取失败，请换一张试试');
            })
            .then(() => (this.busy = false));
    }

    private reconvert(): void {
        if (!this.source) return;
        const r = convertToPixelArt(this.source, { size: ART_SIZE, colors: this.colors });
        if (r.ok !== true) {
            this.sm.toast(r.error);
            return;
        }
        this.result = { image: r.image, palette: r.palette };
        const c = new PixelCanvas(ART_SIZE, ART_SIZE);
        c.data.set(r.image.data);
        this.preview.spriteFrame = this.gm.textures.custom('preview', c);
        this.preview.node.active = true;
        this.placeholder.active = false;
        this.refreshState();
    }

    private saveAndPlay(): void {
        if (!this.result) return;
        const gm = this.gm;
        const saved = gm.customArt.add(this.result.image, this.result.palette);
        if (!saved) {
            this.sm.toast('保存失败，请重新转换一次');
            return;
        }
        for (const id of saved.evicted) gm.textures.release(`art:${id}`);
        if (saved.evicted.length) this.sm.toast(`最多保存 ${MAX_CUSTOM} 张，已移除最早的一张`);
        this.buildWorks();
        const art = workToArtInfo(saved.work);
        openDifficultySheet(art, (g) => Flow.classic(art.id, g), '开始拼图');
    }

    private buildWorks(): void {
        const gm = this.gm;
        const h = this.worksHolder;
        h.destroyAllChildren();
        const list = gm.customArt.list();
        setLabel(this.worksTitle, `我的作品（${list.length}/${MAX_CUSTOM}）· 只保存在本机，不能发起好友挑战`);
        const W = this.L.w - Theme.gutter * 2;
        if (!list.length) {
            label(h, '保存的作品会出现在这里', Theme.font.small, { color: Theme.textMuted });
            return;
        }
        const cols = 3;
        const gap = 16;
        const cw = Math.min(170, (W - 48 - gap * (cols - 1)) / cols);
        const hh = h.getComponent(UITransform)!.height;
        list.forEach((w, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = -((cols - 1) * (cw + gap)) / 2 + col * (cw + gap);
            const yy = hh / 2 - cw / 2 - 10 - row * (cw + 50);
            const card = panel(h, cw, cw, { fill: P.white, border: P.cream3, step: Theme.px, shadow: Theme.shadow }, x, yy);
            sprite(card, gm.textures.art(w.id), cw - 24, cw - 24);
            const rec = [4, 5, 6].map((g) => gm.collection.getRecord(w.id, g as 4 | 5 | 6)).filter(Boolean);
            const best = rec.length ? Math.max(...rec.map((r) => r!.bestStars)) : 0;
            label(h, `${w.name}${best ? ' ' + '★'.repeat(best) : ''}`, Theme.font.tiny, { color: P.ink2, bold: true }).node.setPosition(x, yy - cw / 2 - 20);
            onTap(card, () => {
                gm.audio.play('click');
                const art = workToArtInfo(w);
                openDifficultySheet(art, (g) => Flow.classic(art.id, g));
            });
            // 删除按钮
            const del = panel(card, 40, 40, { fill: P.white, border: P.ink, step: 3, shadow: undefined }, cw / 2 - 12, cw / 2 - 12);
            sprite(del, gm.textures.icon('close', P.rose2), 18, 18);
            onTap(del, (e) => {
                e.propagationStopped = true;
                this.sm.confirm('删除这幅作品？', `「${w.name}」和它的成绩会被删除，无法恢复。`, [
                    { text: '保留', style: 'secondary' },
                    {
                        text: '删除',
                        style: 'primary',
                        onClick: () => {
                            gm.customArt.remove(w.id);
                            gm.textures.release(`art:${w.id}`);
                            this.buildWorks();
                        },
                    },
                ]);
            });
        });
    }
}
