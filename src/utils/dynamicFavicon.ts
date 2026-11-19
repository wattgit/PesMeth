export function updateDynamicFavicon(postCount: number, activeMode: string) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background circle (Deep Indigo / Academic Blue)
    ctx.fillStyle = '#1E3A8A';
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, 2 * Math.PI);
    ctx.fill();

    // Inner border ring
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 32, 26, 0, 2 * Math.PI);
    ctx.stroke();

    // Math symbol or Book icon text ('∑' for Mathematics & Journal)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('∑', 32, 33);

    const dataUrl = canvas.toDataURL('image/png');
    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = dataUrl;
  } catch {
    // Fallback silently if canvas blocked
  }
}
