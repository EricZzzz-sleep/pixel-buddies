import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

/** 把 update 回调挂到任意节点上（页面类本身不是组件） */
@ccclass('Ticker')
export class Ticker extends Component {
    cb: ((dt: number) => void) | null = null;
    update(dt: number): void {
        if (this.cb) this.cb(dt);
    }
}
