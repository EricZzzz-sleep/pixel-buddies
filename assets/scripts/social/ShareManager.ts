import { getArt } from '../art/ArtCatalog';
import { DIFFICULTIES } from '../config/GameConfig';
import { formatDuration } from '../core/GameTimer';
import { PlatformAdapter, ShareResult } from '../platform/PlatformAdapter';
import { ChallengeData, encodeChallenge } from './ChallengeCodec';
import { renderArt } from '../art/PuzzleArt';
import { drawShareCard, SHARE_CARD_H, SHARE_CARD_W, ShareCardData } from './ShareCard';
import { ChallengeManager } from './ChallengeManager';

/**
 * 分享文案与参数组装。所有平台调用都经过 PlatformAdapter；
 * 只能在玩家点击按钮的回调中调用 shareXXX（抖音会拒绝非用户触发的分享）。
 */
export class ShareManager {
    constructor(private readonly platform: PlatformAdapter, private readonly challenges: ChallengeManager) {}

    /** 注册右上角菜单的默认分享内容（不带挑战数据） */
    registerPassiveShare(): void {
        this.platform.setPassiveShare(() => ({ title: '来《像素搭子》拼一张治愈的像素画吧！', query: 'from=menu' }));
    }

    /** 生成分享卡片图（平台不支持时返回 undefined，使用平台默认分享图） */
    private cardImage(data: ShareCardData): string | undefined {
        if (!this.platform.capabilities.shareImage) return undefined;
        const path = this.platform.renderShareImage((ctx) => drawShareCard(ctx, data), SHARE_CARD_W, SHARE_CARD_H);
        return path || undefined;
    }

    shareChallenge(d: ChallengeData): Promise<ShareResult> {
        const art = getArt(d.imageId);
        const name = art ? art.name : '像素拼图';
        const diff = DIFFICULTIES[d.grid];
        const score = d.fromTimeMs > 0 ? `我用 ${formatDuration(d.fromTimeMs)}、${d.fromMoves} 步拼好了` : '我发起了一场拼图挑战';
        const title = `${score}「${name}」(${diff.desc})，你能更快吗？`;
        const code = encodeChallenge(d);
        this.challenges.logSent(d);
        const imageUrl = this.cardImage({
            art: renderArt(d.imageId),
            title: name,
            subtitle: `好友挑战 · ${diff.label} ${diff.desc}`,
            stars: 0,
            lines: d.fromTimeMs > 0 ? [`用时 ${formatDuration(d.fromTimeMs)}`, `${d.fromMoves} 步完成`] : ['同一张图', '同一种打乱'],
            footer: '同一道题，来比比谁更快！',
        });
        return this.platform.share({
            title,
            imageUrl,
            desc: '像素搭子 · 好友挑战',
            query: this.challenges.buildShareQuery(d),
            fallbackText: `${title}\n挑战码：${code}\n打开《像素搭子》→ 好友挑战 → 输入挑战码`,
        });
    }

    shareDailyResult(dateKey: string, imageName: string, timeMs: number, moves: number, stars: number, imageId?: string): Promise<ShareResult> {
        const title = `每日挑战 ${dateKey.slice(5).replace('-', '月')}日「${imageName}」${'★'.repeat(stars)} 用时 ${formatDuration(timeMs)}`;
        const imageUrl = imageId
            ? this.cardImage({
                  art: renderArt(imageId),
                  title: imageName,
                  subtitle: `每日挑战 · ${dateKey}`,
                  stars,
                  lines: [`用时 ${formatDuration(timeMs)}`, `${moves} 步完成`],
                  footer: '今天的拼图，你也来试试！',
              })
            : undefined;
        return this.platform.share({
            title,
            imageUrl,
            desc: '像素搭子 · 每日挑战',
            query: 'from=daily',
            fallbackText: `${title}，${moves} 步。来《像素搭子》挑战今天的拼图吧！`,
        });
    }
}
