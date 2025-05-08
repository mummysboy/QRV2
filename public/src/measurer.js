export class OverlayMeasurer {
  constructor(container, slideEl, overlayEl, overlayStart, total) {
    this.container = container;
    this.slideEl = slideEl;
    this.overlayEl = overlayEl;
    this.overlayStart = overlayStart;
    this.totalSlides = total;
    this.bounds = {};
  }

  async measureFrame(frame) {
    this.slideEl.src = this._getSrc(frame);
    this.overlayEl.style.display = "flex";
    this.overlayEl.style.transform = "translate(-50%,-50%)";
    await new Promise((r) => requestAnimationFrame(r));
    const c = this.container.getBoundingClientRect();
    const o = this.overlayEl.getBoundingClientRect();
    return { x: o.left - c.left, y: o.top - c.top };
  }

  async measure(pathFn) {
    const start = await this.measureFrame(this.overlayStart);
    const end = await this.measureFrame(this.totalSlides - 1);
    this.bounds = { ...start, ...end, startFrame: this.overlayStart };
    this.overlayEl.style.display = "none";
    return this.bounds;
  }

  _getSrc(i) {
    return (this.slideEl.src = pathFn(i));
  }
}
