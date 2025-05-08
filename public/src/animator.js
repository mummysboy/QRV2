export class Animator {
  constructor(images, bounds, overlayConfig, domRefs) {
    this.images = images;
    this.bounds = bounds;
    this.oa = overlayConfig;
    this.slideEl = domRefs.slideEl;
    this.overlayEl = domRefs.overlayEl;
    this.claimBtn = domRefs.claimBtn;
    this.current = 0;
    this.isPlaying = true;
  }

  start() {
    requestAnimationFrame(this._loop.bind(this));
  }

  _loop() {
    if (!this.isPlaying) return;
    this.slideEl.src = this.images[this.current].src;

    if (this.current >= this.bounds.startFrame) {
      const t =
        (this.current - this.bounds.startFrame) /
        (this.images.length - this.bounds.startFrame - 1);
      this._updateOverlay(t);
      this.overlayEl.classList.add("visible");
    }

    if (this.current < this.images.length - 1) {
      this.current++;
      setTimeout(
        () => requestAnimationFrame(this._loop.bind(this)),
        this.frameDuration
      );
    } else {
      this.isPlaying = false;
      this.claimBtn.classList.add("visible");
    }
  }

  _updateOverlay(t) {
    // interpolation logic (position/angle/scale) using this.bounds & this.oa
  }
}
