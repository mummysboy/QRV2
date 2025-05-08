export class ImagePreloader {
  constructor(total, pathFn) {
    this.total = total;
    this.pathFn = pathFn;
    this.images = [];
  }

  async preload() {
    const promises = Array.from({ length: this.total }, (_, i) => {
      return new Promise((res) => {
        const img = new Image();
        img.src = this.pathFn(i);
        img.onload = img.onerror = () => res(img);
      });
    });
    this.images = await Promise.all(promises);
    return this.images;
  }
}
